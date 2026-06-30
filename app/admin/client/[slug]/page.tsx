import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug, listClients, type ClientConfig } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import { googleStatus, getGscForClient, getGa4ForClient } from "../../../../lib/google";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "../../../../lib/sheet";
import { chatConfigured, getChatHistory } from "../../../../lib/chat";
import { getTasks } from "../../../../lib/tasks";
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

// Werkzaamheden uit de klant-Google-Sheet, opgesplitst in deze maand en
// volgende maand. Eigen, simpele parser (de budget/totaal-regels hebben een
// lege Taak-kolom en worden overgeslagen). Link gaat naar de exacte rij.
async function loadTasksByMonth(client: ClientConfig): Promise<MonthTasks> {
  const empty: MonthTasks = { thisMonth: [], nextMonth: [], thisLabel: monthLabel(0), nextLabel: monthLabel(1) };
  if (!client.sheetId) return empty;
  const baseEdit = `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit`;
  const rowLink = (rowNum: number) => `${baseEdit}#gid=${client.gid}&range=${rowNum}:${rowNum}`;
  try {
    const res = await fetch(sheetCsvUrl(client.sheetId, client.gid), { cache: "no-store" });
    if (!res.ok) return empty;
    const rows = parseCSV(await res.text());
    const done = /klaar|afgerond|gereed|done|afgehandeld|voltooid/i;
    const thisM = monthLabel(0);
    const nextM = monthLabel(1);
    const thisMonth: SheetTask[] = [];
    const nextMonth: SheetTask[] = [];
    for (let i = 1; i < rows.length; i++) {
      const taak = (rows[i][1] || "").trim();
      if (!taak) continue; // header/budget/totaal-regels
      if (done.test((rows[i][4] || "").trim())) continue; // alleen niet-afgeronde taken
      const maand = (rows[i][5] || "").trim().toLowerCase();
      const t: SheetTask = { text: taak, link: rowLink(i + 1), done: false, wie: (rows[i][7] || "").trim() };
      if (maand === thisM) thisMonth.push(t);
      else if (maand === nextM) nextMonth.push(t);
    }
    return { thisMonth, nextMonth, thisLabel: thisM, nextLabel: nextM };
  } catch {
    return empty;
  }
}

export default async function ClientCockpitPage({ params, searchParams }: { params: { slug: string }; searchParams: { tab?: string; highlight?: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  // Alle snelle bronnen (database + status-checks) tegelijk. De trage Sheet-fetch
  // krijgt een tijdslimiet zodat hij het wisselen niet ophoudt.
  const emptyMonthTasks: MonthTasks = { thisMonth: [], nextMonth: [], thisLabel: monthLabel(0), nextLabel: monthLabel(1) };
  const [storedEmails, metrics, keywords, pages, lastIngest, status, ms, google, monthTasks, allClients, chatHistory, tasks] = await Promise.all([
    getEmails(params.slug),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    getStatus(params.slug),
    msStatus(),
    googleStatus(),
    withTimeout(loadTasksByMonth(client), 3500, emptyMonthTasks),
    listClients(),
    getChatHistory(params.slug),
    getTasks(params.slug),
  ]);

  // De twee trage externe groepen (live mail én Google GSC/GA4) parallel, elk
  // met tijdslimiet. Eén trage call valt zo terug op opgeslagen/lege data i.p.v.
  // het hele scherm op te houden.
  const mailPromise = (async () => {
    if (!ms.connected) return { emails: storedEmails, mailLive: false };
    const query = (client.email || client.domain || "").trim();
    if (!query) return { emails: storedEmails, mailLive: false };
    const live = await withTimeout(msSearchClientEmails(query, ms.account || "", 25), 4000, null);
    return live ? { emails: live, mailLive: true } : { emails: storedEmails, mailLive: false };
  })();
  const googlePromise = (async () => {
    if (!google.connected) return { gsc: null, ga4: null };
    const [gsc, ga4] = await Promise.all([
      withTimeout(getGscForClient(client.domain || ""), 4000, null),
      withTimeout(getGa4ForClient(params.slug, client.domain || ""), 4000, null),
    ]);
    return { gsc, ga4 };
  })();
  const [mailRes, googleRes] = await Promise.all([mailPromise, googlePromise]);
  const mailLive = mailRes.mailLive;
  const gsc = googleRes.gsc;
  const ga4 = googleRes.ga4;
  // Ahrefs-rapportmails (automatisch) uit de mailstroom houden.
  const emails = mailRes.emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));

  return (
    <ClientCockpit
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
      allClients={allClients.map((c) => ({ slug: c.slug, name: c.name }))}
      gsc={gsc}
      ga4={ga4}
      googleConfigured={google.configured}
      googleConnected={google.connected}
      chatConfigured={chatConfigured()}
      chatHistory={chatHistory}
      tasks={tasks}
      initialTab={searchParams.tab}
      highlight={searchParams.highlight}
    />
  );
}
