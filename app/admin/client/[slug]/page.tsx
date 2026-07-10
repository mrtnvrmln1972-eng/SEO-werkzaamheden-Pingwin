import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../lib/admin-scope";
import { getTrendFlags } from "../../../../lib/trends";
import { getClientBySlug, listClients, type ClientConfig } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import { googleStatus, getGscForClient, getGa4ForClient } from "../../../../lib/google";
import { MAAND_VOLGORDE } from "../../../../lib/sheet";
import { chatConfigured, getChatHistory } from "../../../../lib/chat";
import { getTasks, type TaskRow } from "../../../../lib/tasks";
import { getStrategySessions } from "../../../../lib/strategy";
import ClientCockpit from "./ClientCockpit";

export const dynamic = "force-dynamic";

export type SheetTask = { text: string; link: string; done: boolean; wie: string };
export type MonthTasks = { thisMonth: SheetTask[]; nextMonth: SheetTask[]; thisLabel: string; nextLabel: string };

function monthLabel(offset: number): string {
  const i = (new Date().getMonth() + offset + 12) % 12;
  return MAAND_VOLGORDE[i];
}

// Geeft een trage externe call een harde tijdslimiet: duurt hij te lang, dan
// val terug op een standaardwaarde i.p.v. het hele scherm op te houden.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

// "Lopende werkzaamheden" (deze maand + volgende maand) rechtstreeks uit de
// database-taken, niet meer uit een Google Sheet. Alleen niet-afgeronde taken.
function buildMonthTasks(tasks: TaskRow[]): MonthTasks {
  const done = /klaar|afgerond|gereed|done|afgehandeld|voltooid/i;
  const thisM = monthLabel(0);
  const nextM = monthLabel(1);
  const thisMonth: SheetTask[] = [];
  const nextMonth: SheetTask[] = [];
  for (const t of tasks) {
    if (!t.taak || !t.taak.trim()) continue;
    if (done.test((t.status || "").trim())) continue;
    const maand = (t.maand || "").trim().toLowerCase();
    const item: SheetTask = { text: t.taak, link: (t.link || "").trim(), done: false, wie: (t.wie || "").trim() };
    if (maand === thisM) thisMonth.push(item);
    else if (maand === nextM) nextMonth.push(item);
  }
  return { thisMonth, nextMonth, thisLabel: thisM, nextLabel: nextM };
}

export default async function ClientCockpitPage({ params, searchParams }: { params: { slug: string }; searchParams: { tab?: string; highlight?: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // Gast zonder toegang tot deze klant: terug naar het overzicht.
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");

  // Wereld-schakelaar: met COCKPIT_MAIL=uit (env-var per Vercel-project) verdwijnen
  // "Actuele stand van zaken" en "Laatste mails" uit deze hele wereld; alleen het
  // Zoekwoorden & links-blok blijft staan. Zonder de env-var verandert er niets.
  const mailSections = process.env.COCKPIT_MAIL !== "uit";

  // Mag deze gebruiker de mail en de "Actuele stand van zaken" (status) zien?
  // Eigenaar altijd; gast alleen als can_see_mail aanstaat. En alleen als de
  // mail-secties in deze wereld überhaupt aanstaan (dan verlaat de data de
  // server niet eens).
  const canSeeMail = scope.canSeeMail && mailSections;

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  // Alle bronnen komen nu uit de database (geen Sheet meer voor de werkzaamheden).
  // Mail en status alleen ophalen als deze gebruiker ze mag zien; anders leeg,
  // zodat de data niet eens de server verlaat.
  const [storedEmails, metrics, keywords, pages, lastIngest, status, ms, google, allClients, chatHistory, tasks, strategySessions] = await Promise.all([
    canSeeMail ? getEmails(params.slug) : Promise.resolve([]),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    canSeeMail ? getStatus(params.slug) : Promise.resolve({ status: { exchanges: [], tasks: [], mailActions: [] }, updatedAt: null }),
    canSeeMail ? msStatus() : Promise.resolve({ configured: false, connected: false, account: null }),
    googleStatus(),
    listClients(),
    getChatHistory(params.slug),
    getTasks(params.slug),
    getStrategySessions(params.slug).catch(() => []),
  ]);

  // "Lopende werkzaamheden" rechtstreeks uit de database-taken.
  const monthTasks = buildMonthTasks(tasks);

  // De twee trage externe groepen (live mail én Google GSC/GA4) parallel, elk
  // met tijdslimiet. Eén trage call valt zo terug op opgeslagen/lege data i.p.v.
  // het hele scherm op te houden.
  const mailPromise = (async () => {
    if (!ms.connected) return { emails: storedEmails, mailLive: false };
    const query = (client.email || client.domain || "").trim();
    if (!query) return { emails: storedEmails, mailLive: false };
    const live = await withTimeout(msSearchClientEmails(query, ms.account || "", 25), 2500, null);
    return live ? { emails: live, mailLive: true } : { emails: storedEmails, mailLive: false };
  })();
  const googlePromise = (async () => {
    if (!google.connected) return { gsc: null, ga4: null };
    const [gsc, ga4] = await Promise.all([
      withTimeout(getGscForClient(client.domain || ""), 2500, null),
      withTimeout(getGa4ForClient(params.slug, client.domain || ""), 2500, null),
    ]);
    return { gsc, ga4 };
  })();
  const [mailRes, googleRes] = await Promise.all([mailPromise, googlePromise]);
  // Trend-vlaggen voor de klanten-dropdown (gevuld door de nachtelijke cron).
  const trendFlags = await getTrendFlags().catch(() => ({} as Awaited<ReturnType<typeof getTrendFlags>>));
  const mailLive = mailRes.mailLive;
  const gsc = googleRes.gsc;
  const ga4 = googleRes.ga4;
  // Ahrefs-rapportmails (automatisch) uit de mailstroom houden.
  const emails = mailRes.emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));

  return (
    <ClientCockpit
      // key op de slug: bij wisselen van klant remount de hele cockpit, zodat
      // geen enkele interne staat (tab, geopende mail, panelen) van de vorige
      // klant blijft hangen. Voorkomt dat gegevens van klant A even bij klant B
      // lijken te blijven staan tijdens het laden.
      key={client.slug}
      client={client}
      emails={emails}
      metrics={metrics}
      keywords={keywords}
      pages={pages}
      lastIngest={mailLive ? null : lastIngest}
      status={status.status}
      statusUpdatedAt={status.updatedAt}
      mailLive={mailLive}
      msConfigured={ms.configured}
      msConnected={ms.connected}
      myEmail={ms.account}
      monthTasks={monthTasks}
      allClients={allClients.map((c) => ({ slug: c.slug, name: c.name, grp: c.grp, good28: !!trendFlags[c.slug]?.good28, good90: !!trendFlags[c.slug]?.good90 }))}
      gsc={gsc}
      ga4={ga4}
      googleConfigured={google.configured}
      googleConnected={google.connected}
      chatConfigured={chatConfigured()}
      chatHistory={chatHistory}
      tasks={tasks}
      strategySessions={strategySessions}
      initialTab={searchParams.tab}
      highlight={searchParams.highlight}
      showMailSections={mailSections}
    />
  );
}
