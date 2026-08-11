import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getEmails, getMetrics, getKeywords, getStatus } from "./snapshots";
import { msStatus, msSearchClientEmails } from "./ms-graph";
import { getClientUrls, buildUrlContext } from "./site-urls";
import { googleStatus, getGscForClient, getGscKeywordTrend, getGscForPage } from "./google";
import { measurePage } from "./page-measure";
import { metaVerdictText } from "./meta-rules";
import { getUrlOrganicKeywords, getSerpOverview, getAhrefsTopPages, ahrefsConfigured, getSiteOrganicKeywords, getDomainKeywordsMatching } from "./ahrefs";
import { getCompetitors } from "./competitors";
import { callClaudeAgentic, callClaude, LIGHT_MODEL, HEAVY_MODEL, GEEN_ANTWOORD, type ToolDef, type ToolRunner } from "./anthropic";
import { runChatTool } from "./chat-tools";
import { diepDenkenAan } from "./settings";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "./sheet";
import { getFocus } from "./focus";
import { notitiesTekst } from "./notities";
import { korteGeschiedenis } from "./chat-inkorten";
import type { ChatMsg } from "./anthropic";
import { htmlNaarTekst } from "./veilige-html";
import { buildOverview, overviewToText, getPageWorkStatus, pageWorkStatusToText } from "./overview";
import { buildPageSignalsText, buildKeywordStandText, buildTeBouwenText } from "./page-signals";
import { readDriveDoc } from "./drive";
import { validateAction, executeAction, type ProposedAction } from "./overview-actions";
import { dossierIndexText, searchDossier, getDossierItem, addDossierItem } from "./lead-dossier";
import { listLeadDocs, maakLeadDocument, SJABLONEN } from "./lead-doc";
import { getSiteAuthority } from "./ahrefs";
import { controleerAntwoord, herstelOpdracht, CIJFER_BRON } from "./antwoord-controle";
import { bronVan, ontdubbel, type Bron } from "./chat-bronnen";
import { overlappendePaginas, overlapAlsTekst, zwakkePaginas } from "./concurrenten";
import { getPageInternalLinks, runPageInternalLinks } from "./page-internal-links";
import { getCannibalAnalysis, resultDatum, startCannibalRun, runCannibalRedirect } from "./cannibal-redirect";
import { getGekoppeldeMails } from "./page-emails";
import { isRuisMail } from "./mail-tekst";
import { getPageDossier, dossierToText } from "./page-dossier";
import { getOpgeslagenTekst } from "./page-dossier-tekst";
import { getClientFiles, bestandenContext } from "./client-files";
import type { ClientConfig } from "./clients";

// ═══════════════════════════════════════════════════════════
// PROJECT-CHAT: context verzamelen + AI laten antwoorden
// ═══════════════════════════════════════════════════════════
// Verzamelt per klant alles wat het dashboard al kent (mail, stand van
// zaken, taken uit de Sheet, Search Console, Ahrefs) en stuurt dat als
// context naar Claude, zodat je vragen kunt stellen als "wat is de laatste
// stand van zaken" of "waar wachten we op bij de klant".
// Vereist env ANTHROPIC_API_KEY.
// ═══════════════════════════════════════════════════════════

export function chatConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
}

// Notities van Maarten over deze klant. Wat hij in een notitie plakt (een
// telefoontje, een afspraak, iets wat hij zag) hoort de assistent te weten,
// zonder dat hij het per gesprek opnieuw uitlegt. Geen notities = geen blok.
async function notitiesBlok(slug: string): Promise<string> {
  try {
    const t = await notitiesTekst(slug);
    return t
      ? "\n=== NOTITIES VAN MAARTEN OVER DEZE KLANT (eigen aantekeningen: telefoontjes, afspraken, waarnemingen; betrouwbare achtergrond, spreekt de klantwens aan) ===\n" + t
      : "";
  } catch { return ""; }
}

// ── Welke mails gaan er mee in de context, en hoe volledig ──
//
// Het venster was "de laatste tien, elk afgekapt op 700 tekens". Daardoor viel
// een oudere thread buiten beeld zodra er nieuwere mail binnenkwam, en werd een
// lange mail met teksten middenin afgekapt. Precies de mail die je nodig hebt
// als je vraagt wat er met een pagina moet gebeuren.
//
// Nu: een mail die aan een pagina is VASTGEPIND gaat altijd mee en krijgt ruimte,
// hoe oud hij ook is. De rest volgt op datum, binnen een totaalbudget, zodat de
// context niet alsnog volloopt.
type ChatMail = {
  id: string; subject: string | null; fromAddress: string | null; receivedAt: string | null;
  preview: string | null; bodyHtml: string | null; direction: string | null; webLink?: string | null;
  superhumanLink?: string | null;
};

function kiesMails(
  emails: ChatMail[],
  gekoppeld: Map<string, { url: string; bron: string; score: number }>,
  opts: { budget?: number; ruim?: number; kort?: number } = {},
): string[] {
  const budget = opts.budget ?? 12000;
  const ruim = opts.ruim ?? 3000;
  const kort = opts.kort ?? 1200;

  const vast = emails.filter((e) => gekoppeld.get(e.id)?.bron === "pin");
  const rest = emails.filter((e) => gekoppeld.get(e.id)?.bron !== "pin");
  const volgorde = [...vast, ...rest];

  const regels: string[] = [];
  let op = 0;
  for (const e of volgorde) {
    const koppeling = gekoppeld.get(e.id);
    const isVast = koppeling?.bron === "pin";
    if (!isVast && op >= budget) break;
    const ruimte = isVast ? ruim : Math.min(kort, Math.max(0, budget - op));
    if (ruimte < 200 && !isVast) break;
    const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
    const datum = e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("nl-NL") : "";
    const body = (stripHtml(e.bodyHtml || "") || e.preview || "").replace(/\s+/g, " ").trim().slice(0, ruimte);
    const link = (e.superhumanLink || e.webLink || "").trim();
    const bij = koppeling ? ` [hoort bij ${koppeling.url}${isVast ? ", vastgepind" : ""}]` : "";
    regels.push(`[${dir}, ${datum}]${bij} ${e.subject || "(geen onderwerp)"}${link ? `\n(mail-link: ${link})` : ""}:\n${body}`);
    op += body.length;
  }
  return regels;
}

async function sheetTaskLines(client: ClientConfig): Promise<string[]> {
  if (!client.sheetId) return [];
  try {
    const res = await fetch(sheetCsvUrl(client.sheetId, client.gid), { cache: "no-store" });
    if (!res.ok) return [];
    const data = structureData(parseCSV(await res.text()), client.budget);
    if (!data) return [];
    const month = MAAND_VOLGORDE[new Date().getMonth()];
    return data.tasks
      .filter((t) => t.maand === month)
      .map((t) => `- ${t.taak}${t.status ? ` (status: ${t.status})` : ""}`);
  } catch {
    return [];
  }
}

async function buildContext(client: ClientConfig): Promise<string> {
  const parts: string[] = [];
  parts.push(`KLANT: ${client.name} (${client.domain || "geen domein"})`);

  // E-mails (live indien gekoppeld, anders opgeslagen).
  let emails = await getEmails(client.slug);
  const ms = await msStatus();
  if (ms.connected) {
    const q = (client.email || client.domain || "").trim();
    if (q) {
      const live = await msSearchClientEmails(q, ms.account || "", 15);
      if (live) emails = live;
    }
  }
  // Automatische meldingen eruit, met hetzelfde filter dat ook bij het koppelen
  // aan een pagina geldt. Bij One Day Clinic waren negen van de twintig "laatste
  // mails" meldingen van Ahrefs, Search Console of een agenda-uitnodiging; die
  // verdrongen de echte correspondentie.
  emails = emails.filter((e) => !isRuisMail(e));
  if (emails.length > 0) {
    // Vastgepinde mail hoort er altijd bij, ook als hij ouder is dan de laatste
    // tien; de rest volgt op datum binnen een totaalbudget.
    const gekoppeld = await getGekoppeldeMails(client.slug).catch(() => new Map());
    const regels = kiesMails(emails as ChatMail[], gekoppeld);
    if (regels.length) {
      parts.push("\nRECENTE E-MAILS (nieuwste eerst; mails die bij een pagina horen staan vooraan):");
      parts.push(regels.join("\n---\n"));
    }
  }

  // Stand van zaken.
  const { status } = await getStatus(client.slug);
  if (status.exchanges.length > 0) {
    parts.push("\nSTAND VAN ZAKEN (gesprek klant/wij):");
    for (const ex of status.exchanges) {
      parts.push(`[${ex.side === "client" ? "KLANT" : "WIJ"}, ${ex.status === "done" ? "afgehandeld" : "OPEN"}] ${ex.text}`);
    }
  }
  if (status.mailActions.length > 0) {
    parts.push("\nMOGELIJKE ACTIES UIT MAIL:");
    for (const a of status.mailActions) parts.push(`- ${a.text}`);
  }

  // Lopende werkzaamheden uit de Sheet (huidige maand).
  const tasks = await sheetTaskLines(client);
  if (tasks.length > 0) {
    parts.push("\nLOPENDE WERKZAAMHEDEN (huidige maand, uit Google Sheet):");
    parts.push(...tasks);
  }

  // Search Console.
  const google = await googleStatus();
  if (google.connected && client.domain) {
    const gsc = await getGscForClient(client.domain);
    if (gsc && gsc.metrics.length > 0) {
      parts.push("\nSEARCH CONSOLE (laatste 28 dagen):");
      parts.push(gsc.metrics.map((m) => `${m.metric}=${m.value}`).join(", "));
      if (gsc.keywords.length > 0) {
        parts.push("Top zoekwoorden (GSC, 28d): " + gsc.keywords.slice(0, 10).map((k) => `${k.keyword} (pos ${k.position}, ${k.clicks} klikken)`).join("; "));
      }
    }
    // Zoekwoord-ontwikkeling over de laatste 4 maanden (gemiddelde positie per maand).
    const trend = await getGscKeywordTrend(client.domain);
    if (trend && trend.rows.length > 0) {
      parts.push(`\nSEARCH CONSOLE ZOEKWOORD-TREND (gem. positie per maand: ${trend.months.join(" / ")}):`);
      for (const r of trend.rows) parts.push(`${r.keyword}: ${r.positions.map((p) => (p == null ? "-" : p)).join(" / ")}`);
    }
  }

  // Ahrefs (opgeslagen).
  const metrics = await getMetrics(client.slug);
  if (metrics.length > 0) {
    parts.push("\nAHREFS: " + metrics.map((m) => `${m.metric}=${m.value}`).join(", "));
  }
  const keywords = await getKeywords(client.slug, 15);
  if (keywords.length > 0) {
    parts.push("Ahrefs-zoekwoorden: " + keywords.map((k) => `${k.keyword} (pos ${k.position ?? "-"}, vol ${k.volume ?? "-"})`).join("; "));
  }

  // Google Ads (via de GA4-koppeling): prestaties, campagnes en activiteit-signalen,
  // zodat je in de chat kunt sparren over de inrichting en of er echt aan gewerkt wordt.
  try {
    const { getAdsComparison } = await import("./google");
    const ads = await getAdsComparison(client.slug, client.domain || "", 28, "prev");
    if (ads?.linked) {
      const t = (m: string) => ads.totals.find((x) => x.metric === m);
      const cost = t("cost"), clicks = t("clicks"), conv = t("conversions");
      const e2 = (n: number | undefined) => (n ?? 0).toFixed(2);
      parts.push("\nGOOGLE ADS (laatste 28 dagen vs. de 28 dagen ervoor, via GA4-koppeling):");
      parts.push(`Kosten \u20ac${e2(cost?.cur)} (vorige periode \u20ac${e2(cost?.prev)}), klikken ${Math.round(clicks?.cur || 0)} (${Math.round(clicks?.prev || 0)}), conversies ${Math.round(conv?.cur || 0)} (${Math.round(conv?.prev || 0)}).`);
      parts.push("Campagnes (nu vs. vorige periode):");
      for (const c of ads.campaigns.slice(0, 15)) {
        const status = c.prevCost === 0 && c.cost > 0 ? "NIEUW" : c.cost === 0 && c.prevCost > 0 ? "GESTOPT/STIL" : "loopt";
        parts.push(`- ${c.name} [${status}]: kosten \u20ac${e2(c.cost)} (was \u20ac${e2(c.prevCost)}), klikken ${Math.round(c.clicks)} (${Math.round(c.prevClicks)}), conversies ${Math.round(c.conversions)} (${Math.round(c.prevConversions)})`);
      }
      parts.push("Activiteit-duiding: NIEUW = campagne draaide vorige periode nog niet; GESTOPT/STIL = had toen kosten en nu niet; grote kostenverschuivingen wijzen op actieve wijzigingen. Weinig campagnes en vlakke kosten maandenlang = mogelijk geparkeerd account. Budgetten, biedstrategie-instellingen en de exacte wijzigingshistorie zitten NIET in deze data (die vereisen de Google Ads-API); zeg dat eerlijk als ernaar gevraagd wordt.");
    }
  } catch { /* Ads-context is aanvulling */ }

  // Klantprofiel en notities: deze chat had ze allebei niet, terwijl het juist de
  // achtergrond is waarmee je een antwoord op maat geeft.
  const prof = (client.seoProfile || "").trim();
  if (prof) parts.push("\n=== KLANTPROFIEL (positionering/werkgebied) ===\n" + prof.slice(0, 2500));
  const nt = await notitiesBlok(client.slug);
  if (nt) parts.push(nt);

  return parts.join("\n");
}

// ── Ads-chat: eigen, gerichte context (thread "ads") ──
// Alleen de Google Ads-cijfers (28 dagen én 90 dagen, met campagnes), zodat de
// Ads-assistent scherp over campagnes en optimalisatie kan adviseren zonder de
// hele projectcontext mee te slepen.
async function buildAdsContext(client: ClientConfig): Promise<string> {
  const parts: string[] = [];
  parts.push(`KLANT: ${client.name} (${client.domain || "geen domein"})`);
  const { getAdsComparison } = await import("./google");
  const e2 = (n: number | undefined) => (n ?? 0).toFixed(2);
  for (const days of [28, 90]) {
    try {
      const ads = await getAdsComparison(client.slug, client.domain || "", days, "prev");
      if (!ads?.linked) { if (days === 28) parts.push("\nEr is (nog) geen Google Ads-data via de GA4-koppeling gevonden."); continue; }
      const t = (m: string) => ads.totals.find((x) => x.metric === m);
      const cost = t("cost"), clicks = t("clicks"), conv = t("conversions");
      parts.push(`\nGOOGLE ADS, LAATSTE ${days} DAGEN (vs. de ${days} dagen ervoor, via GA4-koppeling):`);
      parts.push(`Kosten €${e2(cost?.cur)} (was €${e2(cost?.prev)}), klikken ${Math.round(clicks?.cur || 0)} (${Math.round(clicks?.prev || 0)}), conversies ${Math.round(conv?.cur || 0)} (${Math.round(conv?.prev || 0)}).`);
      parts.push("Campagnes:");
      for (const c of ads.campaigns.slice(0, 20)) {
        const status = c.prevCost === 0 && c.cost > 0 ? "NIEUW" : c.cost === 0 && c.prevCost > 0 ? "GESTOPT/STIL" : "loopt";
        parts.push(`- ${c.name} [${status}]: kosten €${e2(c.cost)} (was €${e2(c.prevCost)}), klikken ${Math.round(c.clicks)} (${Math.round(c.prevClicks)}), conversies ${Math.round(c.conversions)} (${Math.round(c.prevConversions)})`);
      }
    } catch { /* periode overslaan */ }
  }
  parts.push("\nDUIDING: NIEUW = campagne draaide de vorige periode nog niet; GESTOPT/STIL = had toen kosten en nu niet; grote kostenverschuivingen wijzen op actieve wijzigingen. Weinig campagnes en maandenlang vlakke kosten = mogelijk geparkeerd account. Budget-instellingen, biedstrategieën, zoektermen-rapporten en de exacte wijzigingshistorie zitten NIET in deze data (die vereisen de Google Ads-API); zeg dat eerlijk als ernaar gevraagd wordt.");
  return parts.join("\n");
}

// ── Bird's eye-chat: eigen, strategie-gegronde context (thread "overzicht") ──
// De overkoepelende agent werkt vanuit de AFGESPROKEN strategie (focus-notities +
// gelinkte Google-documenten), de werkstatus per pagina (wat is gedaan/loopt/gepland)
// en het site-brede laaghangend fruit, zodat hij een gestructureerd werkplan kan
// aansturen in plaats van alleen losse snelle winst.
async function buildOverviewContext(client: ClientConfig): Promise<string> {
  const parts: string[] = [];
  parts.push(`KLANT: ${client.name} (${client.domain || "geen domein"})`);
  // De volledige URL-lijst van de site reist ALTIJD mee, zodat het model paden kan
  // matchen (enkelvoud/meervoud!) en nooit zelf een URL hoeft te vormen. Plus de
  // scandatum, zodat duidelijk is hoe vers de status-informatie is.
  // De URL-lijst mét status en redirect-bestemming, plus een verse sitemap-check.
  // Eerder gingen alleen de kale paden mee en werd de status weggegooid; daardoor
  // zag een al opgeruimde pagina er precies zo uit als een levende. Zie
  // buildUrlContext in lib/site-urls.ts voor de volledige uitleg.
  try {
    const blok = await buildUrlContext(client.slug, client.domain || "");
    if (blok) parts.push("\n" + blok);
  } catch { /* aanvulling */ }
  try { parts.push("\n=== SITE-OVERZICHT (werkstatus + laaghangend fruit) ===\n" + overviewToText(await buildOverview(client.slug))); } catch { /* aanvulling */ }
  try { const ws = pageWorkStatusToText(await getPageWorkStatus(client.slug)); if (ws.trim()) parts.push("\n=== WERKSTATUS PER PAGINA (wat is gedaan / loopt / gepland) ===\n" + ws); } catch { /* aanvulling */ }
  try { const sig = await buildPageSignalsText(client.slug); if (sig.trim()) parts.push("\n=== PAGINA-SIGNALEN (harde feiten van de live pagina's uit de laatste scan; hier baseer je concrete taken op) ===\n" + sig); } catch { /* aanvulling */ }
  try { const kw = await buildKeywordStandText(client.slug); if (kw.trim()) parts.push("\n=== ZOEKWOORDEN MET STAND (Search Console: waar staan ze en bewegen ze) ===\n" + kw); } catch { /* aanvulling */ }
  try { const tb = await buildTeBouwenText(client.slug); if (tb.trim()) parts.push("\n=== TE BOUWEN / UIT TE BREIDEN PAGINA'S (autoriteit: wat moet er nog bij) ===\n" + tb); } catch { /* aanvulling */ }
  try {
    const f = await getFocus(client.slug);
    const t = stripHtml(f.html).replace(/\n{3,}/g, "\n\n").trim();
    if (t) parts.push("\n=== AFGESPROKEN ZOEKWOORDEN & LINKS (focus-notities: dit is de BEDOELING/het plan en kan verouderd zijn, soms maanden oud; toets het ALTIJD aan de actuele data hierboven en aan de live site. Gebruik lees_document alleen om de richting te snappen, niet om de huidige stand te bepalen) ===\n" + t);
  } catch { /* aanvulling */ }
  const links: string[] = [];
  if (client.cockpit?.workDocUrl) links.push(`Werkdocument: ${client.cockpit.workDocUrl}`);
  if (client.cockpit?.resultsUrl) links.push(`Resultaten: ${client.cockpit.resultsUrl}`);
  if (links.length) parts.push("\n=== SNELLE LINKS (leesbaar met lees_document) ===\n" + links.join("\n"));
  // Top Prio's: Maartens eigen prioriteitenlijstje. Dat bereikte tot nu toe geen
  // enkele prompt, terwijl het juist stuurt waar de aandacht heen moet.
  try {
    const f = await getFocus(client.slug);
    const p = htmlNaarTekst(f.prioHtml).trim();
    if (p) parts.push("\n=== TOP PRIO'S (wat Maarten zelf bovenaan heeft gezet; laat dit meewegen in wat je voorstelt) ===\n" + p.slice(0, 2000));
  } catch { /* aanvulling */ }
  const prof = (client.seoProfile || "").trim();
  if (prof) parts.push("\n=== KLANTPROFIEL (positionering/werkgebied) ===\n" + prof.slice(0, 2500));
  // De concurrenten die Maarten zelf heeft aangewezen. Die lijst voedde tot nu toe
  // alleen de prioriteitenscan, de kansenlijst en de Google-profiel-motor, en bereikte
  // dit gesprek helemaal niet: de bird's eye kende alleen de partijen die toevallig in
  // een opgevraagde top 10 stonden. Wie Maarten als concurrent ziet, is een oordeel dat
  // je niet uit een SERP haalt.
  try {
    const conc = await getCompetitors(client.slug);
    parts.push(conc.length
      ? "\n=== CONCURRENTEN (door Maarten aangewezen; dit is wie hij als de concurrentie ziet, niet wat de SERP toevallig toont) ===\n"
        + conc.join(", ")
        + "\nGebruik concurrent_zoekwoorden om te zien waar zij op scoren en wij niet, en ahrefs_site_authority om te wegen of we van ze kunnen winnen."
      : "\n=== CONCURRENTEN ===\nEr is voor deze klant nog geen concurrentenlijst ingevuld (KPI's-tab, knop Concurrenten, vier plekken). Zeg dat als een strategievraag erom vraagt, en gebruik zolang de partijen uit de top 10 (serp_top10) als concurrentie.");
  } catch { /* aanvulling */ }
  const nt = await notitiesBlok(client.slug);
  if (nt) parts.push(nt);
  // Recente e-mails als basisinfo: nieuwe wensen, herzieningen, ingevulde formulieren
  // van de klant horen mee te wegen in de strategie (nieuwste eerst).
  try {
    let emails = await getEmails(client.slug);
    const ms = await msStatus();
    // Live Outlook-mails SAMENVOEGEN met de ingelezen mails (niet vervangen): zo
    // blijven mails van de sitebouwer/developer (die vaak onder een ander adres in
    // de ingelezen lijst staan) meewegen naast de live klant-correspondentie.
    if (ms.connected) {
      const q = (client.email || client.domain || "").trim();
      if (q) {
        const live = await msSearchClientEmails(q, ms.account || "", 12).catch(() => null);
        if (live && live.length) {
          const seen = new Set(live.map((e) => e.id));
          emails = [...live, ...emails.filter((e) => !seen.has(e.id))]
            .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
        }
      }
    }
    // Automatische meldingen eruit, met hetzelfde filter dat ook bij het koppelen
  // aan een pagina geldt. Bij One Day Clinic waren negen van de twintig "laatste
  // mails" meldingen van Ahrefs, Search Console of een agenda-uitnodiging; die
  // verdrongen de echte correspondentie.
  emails = emails.filter((e) => !isRuisMail(e));
    if (emails.length) {
      // Ruim meegeven (niet te kort afkappen), zodat de agent volledige mails ziet
      // en er echte concept-antwoorden op kan maken. Mails die aan een pagina zijn
      // vastgepind gaan altijd mee, ook als ze maanden oud zijn: dat is vaak juist
      // de mail waarin de klant de teksten heeft teruggestuurd.
      const gekoppeld = await getGekoppeldeMails(client.slug).catch(() => new Map());
      const lines = kiesMails(emails as ChatMail[], gekoppeld, { budget: 14000, ruim: 3000, kort: 1500 });
      parts.push("\n=== RECENTE E-MAILS (basisinfo; mails die bij een pagina horen staan vooraan; neem relevante punten en herzieningen mee in de strategie) ===\n" + lines.join("\n"));
    }
  } catch { /* aanvulling */ }
  try {
    const { status } = await getStatus(client.slug);
    if (status.exchanges.length) parts.push("\n=== STAND VAN ZAKEN ===\n" + status.exchanges.map((ex) => `[${ex.side === "client" ? "KLANT" : "WIJ"}, ${ex.status === "done" ? "afgehandeld" : "OPEN"}] ${ex.text}`).join("\n"));
  } catch { /* aanvulling */ }
  try { const tasks = await sheetTaskLines(client); if (tasks.length) parts.push("\n=== LOPENDE WERKZAAMHEDEN (huidige maand) ===\n" + tasks.join("\n")); } catch { /* aanvulling */ }
  return parts.join("\n");
}

// ── Lead-chat: de werkplek voor een bedrijf dat nog geen klant is ──
// Bewust een eigen, lichte context. Een lead heeft geen Search Console, geen
// weekplanning en geen lopende werkzaamheden; wat hij wél heeft is een website
// die we van buitenaf kunnen meten, en een dossier dat groeit met alles wat
// Maarten aanlevert. De inhoud van dat dossier reist NIET mee: alleen de
// inhoudsopgave. De chat haalt zelf op wat hij nodig heeft.
async function buildLeadContext(client: ClientConfig): Promise<string> {
  const parts: string[] = [];
  parts.push(`BEDRIJF: ${client.name}${client.domain ? ` (website: ${client.domain})` : " (nog geen website ingevuld)"}`);
  parts.push(`FASE: lead (nog geen klant). We hebben GEEN toegang tot hun Search Console of Analytics; alles wat we weten komt uit onze eigen meting van de live site, uit Ahrefs, en uit wat Maarten aanlevert.`);
  if (client.email) parts.push(`Contact-e-mail: ${client.email}`);

  const index = await dossierIndexText(client.slug).catch(() => "");
  parts.push(
    "\n=== HET DOSSIER (inhoudsopgave; nieuwste eerst) ===\n" +
    (index
      ? index + "\n\nDit is BEWUST alleen een inhoudsopgave. Heb je de volledige inhoud van een stuk nodig, haal die dan op met zoek_dossier of lees_dossier. Verzin nooit wat er in een stuk staat."
      : "(het dossier is nog leeg; Maarten kan documenten en notities toevoegen, en jij kunt ze bewaren met bewaar_in_dossier)")
  );

  try {
    const docs = await listLeadDocs(client.slug);
    if (docs.length) {
      parts.push(
        "\n=== AL GEMAAKTE DOCUMENTEN (de plank) ===\n" +
        docs.slice(0, 20).map((d) => {
          const datum = d.createdAt ? new Date(d.createdAt).toLocaleDateString("nl-NL") : "";
          return `- ${d.titel} (${datum})${d.opdracht ? ` — opdracht was: ${d.opdracht.slice(0, 200)}` : ""}${d.driveLink ? `\n  link: ${d.driveLink}` : ""}`;
        }).join("\n")
      );
    }
  } catch { /* aanvulling */ }

  // De paginalijst van hun site, als die al gescand is. Alleen de paden, zodat
  // je nooit zelf een URL hoeft te vormen.
  try {
    const urls = await getClientUrls(client.slug);
    if (urls.length) {
      const paden = urls.map((u) => { try { return new URL(u.url).pathname; } catch { return u.url; } });
      parts.push(`\n=== BEKENDE PAGINA'S VAN HUN SITE (${urls.length}) ===\n` + paden.slice(0, 200).join(", ").slice(0, 4000));
    } else {
      parts.push("\n=== HUN SITE ===\nDe site is nog niet ingelezen. Wil je weten welke pagina's er zijn, gebruik dan meet_pagina op losse URL's, of vraag Maarten of hij de site laat scannen.");
    }
  } catch { /* aanvulling */ }

  return parts.join("\n");
}

// Het gereedschap van de lead-chat, bovenop de gewone meet-tools: het dossier
// doorzoeken en lezen, iets blijvends bewaren, en een document maken.
function leadTools(client: ClientConfig, base: { tools: ToolDef[]; run: ToolRunner }): { tools: ToolDef[]; run: ToolRunner } {
  const sjabloonLijst = SJABLONEN.map((s) => `${s.key} (${s.naam}: ${s.omschrijving})`).join("; ");
  const extra: ToolDef[] = [
    { name: "zoek_dossier", description: "Zoekt in het dossier van dit bedrijf op een trefwoord (bijvoorbeeld 'budget', 'Ads', 'concurrent', 'propositie') en geeft de gevonden stukken MET hun volledige inhoud terug. Gebruik dit voordat je iets beweert over wat er is aangeleverd of afgesproken.", input_schema: { type: "object", properties: { zoekterm: { type: "string" } }, required: ["zoekterm"] } },
    { name: "lees_dossier", description: "Leest één stuk uit het dossier volledig, op nummer (het nummer tussen blokhaken in de inhoudsopgave, bijvoorbeeld 12 voor [#12]).", input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
    { name: "bewaar_in_dossier", description: "Bewaart iets blijvends over dit bedrijf in het dossier, zodat het bij elk volgend document en gesprek meegaat. Gebruik dit voor feiten die blijven gelden (wat de klant belangrijk vindt, hun propositie, een concurrent, een besluit). NIET voor eenmalige instructies voor één document (zoals het budget van dít voorstel); die geef je gewoon mee aan maak_document.", input_schema: { type: "object", properties: { titel: { type: "string", description: "Korte herkenbare titel" }, inhoud: { type: "string", description: "De volledige tekst die bewaard moet blijven" }, soort: { type: "string", enum: ["notitie", "document", "analyse", "meting", "overig"] } }, required: ["titel", "inhoud"] } },
    { name: "ahrefs_site", description: "Domain Rating, aantal verwijzende domeinen en backlinks van een heel domein (werkt op elk domein, ook van een bedrijf dat nog geen klant is). Gebruik dit voor de autoriteitsvergelijking met concurrenten. Verzin deze cijfers nooit.", input_schema: { type: "object", properties: { domein: { type: "string", description: "Kaal domein, bijvoorbeeld tudorkozijnen.nl" } }, required: ["domein"] } },
    { name: "maak_document", description: `Maakt een compleet document in de Pingwin-huisstijl en zet het als bewerkbaar bestand in Drive, met een link op de plank. Beschikbare sjablonen: ${sjabloonLijst}. Gebruik dit ALLEEN wanneer Maarten er expliciet om vraagt ("maak een voorstel", "werk dit uit tot een document"). Zet in 'opdracht' ALLES wat Maarten voor dit specifieke document heeft meegegeven: het budget, waar de klant waarde aan hecht, welke pagina's erin moeten, de looptijd, en wat er juist niet in moet. Dat wint van de standaardaanpak.`, input_schema: { type: "object", properties: { sjabloon: { type: "string", description: "De sleutel van het sjabloon, bijvoorbeeld seo-voorstel" }, opdracht: { type: "string", description: "Alles wat Maarten voor dit document heeft meegegeven, in zijn eigen woorden samengevat" } }, required: ["sjabloon"] } },
  ];

  const run: ToolRunner = async (name, input) => {
    try {
      if (name === "zoek_dossier") {
        const term = String(input.zoekterm || "").trim();
        if (!term) return "Geef een zoekterm.";
        const items = await searchDossier(client.slug, term);
        if (!items.length) return `Niets in het dossier gevonden voor "${term}".`;
        return items.map((i) => {
          const datum = i.createdAt ? new Date(i.createdAt).toLocaleDateString("nl-NL") : "";
          return `[#${i.id}] ${i.titel} (${datum})${i.driveLink ? `\nlink: ${i.driveLink}` : ""}\n${(i.inhoud || i.samenvatting).slice(0, 6000)}`;
        }).join("\n\n---\n\n");
      }
      if (name === "lees_dossier") {
        const id = Number(input.id || 0);
        const item = id ? await getDossierItem(client.slug, id) : null;
        if (!item) return "Dat nummer staat niet in het dossier van dit bedrijf.";
        const datum = item.createdAt ? new Date(item.createdAt).toLocaleDateString("nl-NL") : "";
        return `[#${item.id}] ${item.titel} (${datum})${item.driveLink ? `\nlink: ${item.driveLink}` : ""}\n\n${(item.inhoud || item.samenvatting).slice(0, 20000)}`;
      }
      if (name === "bewaar_in_dossier") {
        const titel = String(input.titel || "").trim();
        const inhoud = String(input.inhoud || "").trim();
        if (!inhoud) return "Geen inhoud om te bewaren.";
        const item = await addDossierItem(client.slug, { titel, inhoud, soort: String(input.soort || "notitie"), bron: "Uit het gesprek met Maarten" });
        return `Bewaard in het dossier als [#${item.id}] ${item.titel}. Noem dit kort in je antwoord, in één regel.`;
      }
      if (name === "ahrefs_site") {
        if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld.";
        const target = String(input.domein || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
        if (!target) return "Geen domein opgegeven.";
        return JSON.stringify(await getSiteAuthority(target));
      }
      if (name === "maak_document") {
        const sjabloon = String(input.sjabloon || "seo-voorstel").trim();
        const opdracht = String(input.opdracht || "").trim();
        const r = await maakLeadDocument(client.slug, sjabloon, opdracht);
        if (!r.ok) return `Document maken mislukt: ${r.error || "onbekende fout"}`;
        const link = r.doc?.driveLink || "";
        return [
          `Document gemaakt: "${r.doc?.titel}".`,
          link ? `Het staat op de plank en is te openen en te bewerken: ${link}` : `Let op: het document is gemaakt maar kon niet in Drive gezet worden${r.driveError ? ` (${r.driveError})` : ""}. Meld dat eerlijk.`,
          "Vat in je antwoord in een paar regels samen wat er in het document staat en welke keuzes je gemaakt hebt, en geef de link. Plak niet het hele document in de chat.",
        ].join("\n");
      }
      return base.run(name, input);
    } catch (e) {
      return `Gereedschap-fout: ${(e as Error).message}`;
    }
  };
  return { tools: [...base.tools, ...extra], run };
}

// De bird's eye krijgt bovenop de gewone read-tools twee site-brede tools:
// het overzicht opvragen en een gekoppeld Google-document uitlezen.
function overviewTools(client: ClientConfig, base: { tools: ToolDef[]; run: ToolRunner }, collected: ProposedAction[]): { tools: ToolDef[]; run: ToolRunner } {
  const domain = client.domain || "";
  const extra: ToolDef[] = [
    { name: "site_overzicht", description: "Het actuele site-brede beeld van deze klant: werkstatus (pagina's met strategie / half plan / nog leeg, gemaakte documenten) plus het laaghangend fruit (striking distance, quick wins) en CTR-onderkansen. Gebruik dit om te bepalen waar we staan en wat prioriteit heeft.", input_schema: { type: "object", properties: {} } },
    { name: "lees_document", description: "Leest de tekstinhoud van een gekoppeld Google-document (Doc/Sheet/Slides) uit via de Drive-koppeling. Geef een Google-link of document-id. Gebruik dit om de AFGESPROKEN strategie te lezen die in de focus-notities gelinkt staat (navigatie/URL-structuur, zoekwoorden-samenvatting, werkdocument), zodat je vanuit de echte afspraken plant.", input_schema: { type: "object", properties: { link: { type: "string", description: "Google Drive-link of document-id" } }, required: ["link"] } },
    { name: "stel_acties_voor", description: "Stel één of meer concrete acties voor als knopkaartjes die Maarten met één klik kan goedkeuren. VOER NIETS ZELF UIT. Gebruik dit ALLEEN wanneer Maarten er EXPLICIET om vraagt (bijv. 'maak er een kaart/taak van', 'pak dit op', 'zet dit door', 'werk dit uit'). NIET uit jezelf en nooit een hele reeks tegelijk; standaard spar je gewoon in tekst. Maak alleen kaarten voor precies wat Maarten aangeeft.", input_schema: { type: "object", properties: { acties: { type: "array", items: { type: "object", properties: {
      type: { type: "string", enum: ["pagina_toevoegen", "taak_aanmaken", "plan_vastleggen", "strategie_bepalen", "pijplijn_starten", "structured_data", "alt_teksten", "meta_verbeteren", "profiel_bijwerken", "weekplan_taken"], description: "pagina_toevoegen=nieuwe (nog niet bestaande) landingspagina aanmaken (alleen de URL); strategie_bepalen=een DOORDACHTE strategie voor een pagina voorstellen als BEWERKBARE goedkeur-kaart (verplichte fase 1 voor een nieuwe pagina; doe eerst zelf de cannibalisatie-check met ahrefs_pagina/gsc_pagina/serp_top10 en verwerk die in de tekst); taak_aanmaken=losse taak in de takenlijst; plan_vastleggen=strategie-alinea bij een pagina; pijplijn_starten=analyse/blauwdruk/copy-documenten genereren (belanden in Taken en het klantdashboard; blauwdruk/copy is voor een NIEUWE pagina geblokkeerd tot een strategie is goedgekeurd); structured_data=schema toevoegen; alt_teksten=alt-tekst-lijst voor de sitebouwer genereren; meta_verbeteren=nieuwe meta-title/description met de geavanceerde regels (pixelbreedte + criteria); profiel_bijwerken=blijvende nuance uit de mail (positionering, terminologie, no-go's, beslissingen) vastleggen in het klantprofiel, zodat copy/meta/strategie het automatisch meenemen; weekplan_taken=de concrete taken die uit dit gesprek volgen als projectkaarten in de weekplanning zetten; BUNDEL daarbij per pagina tot ÉÉN kaart in totaal (alle deeltaken, ook bouwen/publiceren en opvolg-mails, als '-'-bullets in 'info'; 'week' is de startweek), alleen echt niet-paginawerk apart (zeldzaam). Gebruik dit als Maarten zoiets zegt als 'maak hier taken van' of 'zet dit in de weekplanning'." },
      reason: { type: "string", description: "In één korte zin waarom deze actie nu zinvol is." },
      url: { type: "string", description: "Pad of volledige URL van de pagina (verplicht behalve bij een losse taak zonder pagina)." },
      title: { type: "string", description: "Alleen bij pagina_toevoegen: titel van de nieuwe pagina." },
      taak: { type: "string", description: "Alleen bij taak_aanmaken: de taakomschrijving." },
      fase: { type: "string", enum: ["Bouwen", "Herbedraden", "Opschonen"], description: "Alleen bij taak_aanmaken." },
      wie: { type: "string", enum: ["SEO", "Dev"], description: "Alleen bij taak_aanmaken: wie doet het." },
      plan: { type: "string", description: "Alleen bij plan_vastleggen: de strategie-tekst." },
      steps: { type: "array", items: { type: "string", enum: ["analyse", "blauwdruk", "copy"] }, description: "Alleen bij pijplijn_starten: welke documenten (standaard alle drie; bij een niet-live pagina laat je analyse weg)." },
      keyword: { type: "string", description: "Alleen bij meta_verbeteren: het primaire zoekwoord van de pagina." },
      tekst: { type: "string", description: "Bij profiel_bijwerken: de nuance/tekst voor het klantprofiel. Bij strategie_bepalen: de volledige strategie voor de pagina in gewone leesbare tekst met korte kopregels en '-' voor bullets (GEEN Markdown-symbolen zoals #, | of **), met minimaal: primaire + secundaire zoektermen (bewust ANDERS dan een bestaande pillar op dezelfde term), de verhouding tot bestaande pagina's, het cannibalisatie-oordeel (concurreert deze pagina met een bestaande top-pagina? zo ja, hoe voorkomen we dat: afwijkende termen, URL als kind, interne links omhoog naar de pillar), de gewenste URL/plek, en de kern van de H1/koppen. Maarten kan dit op de kaart nog bijstellen vóór goedkeuren." },
      taken: { type: "array", description: "Alleen bij weekplan_taken: de lijst projectkaarten die uit dit gesprek volgen. VERPLICHT gevuld: roep weekplan_taken NOOIT met een lege of ontbrekende 'taken' aan (dan wordt de actie afgekeurd). Zet in ÉÉN aanroep meteen alles erin, elk met minimaal 'taak', 'week' en 'info'. BUNDEL-REGELS: maak per pagina PRECIES ÉÉN kaart in totaal, over alle weken heen ('week' is de startweek); NOOIT meerdere pagina's of paden in één kaart of kaarttitel (gaat een aanpak over meerdere pagina's, maak dan per pagina een eigen kaart met dezelfde achtergrond); site-brede meta/alt-opruiming over veel pagina's wordt ÉÉN Dev-kaart 'Werklijst sitebouwer: meta's en alt-teksten site-breed' zonder url, geen losse kaartjes per pagina; alle deeltaken voor die pagina (meta, alt-teksten, copy, interne links, structured data, bouwen/publiceren) zet je als '-'-bullets in 'info' van die ene paginakaart, NIET als losse items. Ook opvolg-mails of referenties die bij een pagina horen zijn GEEN eigen item: zet ze als achtergrond-bullet in de paginakaart. Alleen echt werk zonder pagina krijgt een eigen item zonder url (zeldzaam). Streef naar 3 tot 6 kaarten in totaal, maximaal 10. BEGRENZING (het scherm toont niet meer dan dit, de rest zakt naar 'Eerdere notities'): hooguit VIER regels achtergrond en per fase precies ÉÉN regel. Kies dus de vier regels die iemand echt nodig heeft om deze klus te doen, niet alles wat je over de pagina weet. SJABLOON PER SOORT KLUS: bij een nieuwe of uit te breiden pagina zijn dat het primaire zoekwoord met de huidige stand, waarom juist nu, en hoe de pagina zich verhoudt tot de rest van de site; bij meta/CTR de huidige meta met het probleem en het doelzoekwoord; bij structured data welk schema-type en waarop het gebaseerd is; bij alt-teksten of interne links om welke pagina's het gaat. Herhaal NOOIT een cijfer dat al in een andere regel staat, en noem een meting maar één keer. Bouw 'info' op in secties met korte kopjes op een eigen regel eindigend op een dubbele punt: 'Achtergrond:' (korte puntige regels van elk hooguit vijftien woorden: wat is er mis, cijfers, waarom nu), alleen indien relevant 'Afspraken en herkomst:' met '-'-bullets (mail-datum, wie), en 'Aanpak per fase:' met per regel een '-'-bullet die begint met exact een fasenaam plus dubbele punt ('- Analyse: ...', '- Blauwdruk: ...', '- Copy: ...', '- Bouw: ...', '- Structured data: ...'), alleen voor fases die nodig zijn; micro-taken bij de juiste fase-regel (meta bij Copy, alt-teksten/interne links bij Bouw). Herhaal nooit de kaarttitel als bullet.", items: { type: "object", properties: { taak: { type: "string", description: "Korte, concrete taaktitel (één regel). Zet GEEN 'WEEK X' in de titel; de week geef je apart mee in 'week'." }, week: { type: "integer", description: "In welke week deze taak valt: 1 = deze week, 2 = volgende week, enzovoort. Verdeel de taken realistisch over de komende weken." }, info: { type: "string", description: "Alle relevante info/achtergrond bij deze taak: waar komt het vandaan (bijv. de mail van 30 juli), waarom, welke zoektermen/pagina, de aanpak, hoe het zich verhoudt tot andere pagina's, de cannibalisatie-nuance, verwachte impact. Dit is de achtergrond die op de kaart komt, dus volledig. Nette leesbare tekst met korte kopregels en '-'-bullets (geen #, | of **)." }, wie: { type: "string", enum: ["SEO", "Dev"], description: "Wie voert de taak uit." }, url: { type: "string", description: "Optioneel: de pagina waar de taak over gaat." }, taaktype: { type: "string", enum: ["meta", "alt", "copy", "intern", "strategie", "pijplijn", "structured", "overig"], description: "Het type taak, zodat de kaart naar de juiste plek in het dashboard kan deep-linken (meta → Meta & CTR-tab, enz.). meta=meta-title/description, alt=alt-teksten, copy=copy schrijven/controleren, intern=interne links, strategie=strategie bepalen, pijplijn=blauwdruk/copy genereren, structured=structured data, overig=anders." }, bronMail: { type: "string", description: "Optioneel: de webLink van de mail waar deze taak uit voortkomt (die staat bij de RECENTE E-MAILS in de context als 'link: ...'). Zo linkt de kaart direct naar die mail." } }, required: ["taak"] } },
    }, required: ["type"] } } }, required: ["acties"] } },
  ];
  const run: ToolRunner = async (name, input) => {
    if (name === "site_overzicht") {
      try { return overviewToText(await buildOverview(client.slug)) + "\n\n" + pageWorkStatusToText(await getPageWorkStatus(client.slug)); }
      catch (e) { return `Kon overzicht niet ophalen: ${(e as Error).message}`; }
    }
    if (name === "lees_document") {
      const r = await readDriveDoc(String(input.link || ""));
      if (!r.ok) return `Kon document niet lezen: ${r.error}`;
      return `Document "${r.name}":\n${r.text}`;
    }
    if (name === "stel_acties_voor") {
      const raw = Array.isArray(input.acties) ? input.acties : [];
      let added = 0, rejected = 0;
      let emptyWeekplan = false;
      for (const a of raw) {
        const id = `a${Date.now().toString(36)}_${collected.length}`;
        const v = validateAction(a as Record<string, unknown>, domain, id);
        if (v) { collected.push(v); added++; }
        else {
          rejected++;
          const ao = (a || {}) as Record<string, unknown>;
          if (ao.type === "weekplan_taken" && !(Array.isArray(ao.taken) && ao.taken.length)) emptyWeekplan = true;
        }
      }
      if (added === 0 && emptyWeekplan) {
        // Veelgemaakte fout: weekplan_taken zonder gevulde 'taken'. Vertel de agent
        // concreet hoe hij het meteen goed overdoet, zodat de beurt niet doodloopt.
        return "De weekplan_taken-actie had geen gevulde 'taken'. Roep 'stel_acties_voor' NU opnieuw aan met de volledige takenlijst erin: elke taak met minimaal 'taak' (titel), 'week' (1,2,3...), 'info' (de achtergrond) en waar mogelijk 'wie', 'url', 'taaktype'. Doe dit in deze beurt; eindig niet met alleen een aankondiging.";
      }
      return `${added} actie(s) geregistreerd als knopkaartjes onder je antwoord${rejected ? ` (${rejected} afgekeurd wegens ontbrekende velden)` : ""}. Benoem ze niet nog eens als lijst; verwijs er kort naar.`;
    }
    return base.run(name, input);
  };
  return { tools: [...base.tools, ...extra], run };
}

// Eén voorgestelde taak uit de oogst-stap (zie "eerst sparren" onderaan dit bestand).
// "waarom" is voor het scherm (waarom volgt dit uit het gesprek), "info" is de
// achtergrond die op de projectkaart belandt.
export type OogstTaak = {
  taak: string; waarom: string; info?: string; url?: string; taaktype?: string;
  week?: number; wie?: string; zekerheid: "hoog" | "middel" | "laag";
};
// geenTaak = wat de assistent bewust NIET als werk zag. Dat tonen we grijs, zodat
// zichtbaar is dat het is meegewogen en er niets stilletjes wegvalt.
export type OogstResultaat = { taken: OogstTaak[]; geenTaak: string[]; verwerkt?: boolean };

// image/images: optionele afbeeldingen (data-URL's, al verkleind in de browser) bij
// een user-bericht. "image" blijft bestaan voor oude opgeslagen gesprekken.
// soort/oogst: berichten die uit de knoppen komen (conclusie, takenvoorstel) in
// plaats van uit een vraag van Maarten.
export type ChatMessage = {
  role: "user" | "assistant"; content: string; image?: string; images?: string[];
  actions?: ProposedAction[]; soort?: "conclusie" | "oogst"; oogst?: OogstResultaat;
  // Wat de chat voor dít antwoord heeft opgezocht (ingeklapt onder het antwoord).
  bronnen?: Bron[];
};

const cleanThread = (t?: string) => (t || "algemeen").trim().slice(0, 80) || "algemeen";

export async function getChatHistory(slug: string, thread = "algemeen"): Promise<ChatMessage[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT messages FROM client_chat WHERE client_slug = ${slug} AND thread = ${cleanThread(thread)} LIMIT 1`;
  if (!rows[0]?.messages) return [];
  try {
    const parsed = JSON.parse(rows[0].messages as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Alle gesprekken (threads) van een klant, nieuwste eerst. Inclusief de
// onderwerp-samenvatting en de "gedaan"-vlag voor de toggle-weergave.
export async function listChatThreads(slug: string): Promise<{ thread: string; count: number; updatedAt: string; title: string; summary: string; done: boolean }[]> {
  await ensureSchema();
  // Tel niet door de hele (soms grote) messages-blob te laden en te parsen; we
  // hoeven alleen te weten óf er berichten zijn (0/1). Scheelt veel laadtijd.
  const { rows } = await sql`
    SELECT thread, updated_at, title, summary, done,
           CASE WHEN messages IS NULL OR btrim(messages) IN ('', '[]') THEN 0 ELSE 1 END AS cnt
    FROM client_chat WHERE client_slug = ${slug} ORDER BY updated_at DESC`;
  return rows.map((r) => ({ thread: (r.thread as string) || "algemeen", count: Number(r.cnt) || 0, updatedAt: new Date(r.updated_at as string).toISOString(), title: (r.title as string) || "", summary: (r.summary as string) || "", done: !!r.done }));
}

// Werkt de samenvatting en/of "gedaan"-status van één onderwerp (thread) bij.
// Raakt de berichten niet aan. Maakt de rij zo nodig aan (leeg gesprek dat nog
// geen bericht heeft, maar wel een naam/samenvatting).
export async function setThreadMeta(slug: string, thread: string, meta: { title?: string; summary?: string; done?: boolean }): Promise<void> {
  await ensureSchema();
  const t = cleanThread(thread);
  const title = meta.title === undefined ? null : String(meta.title).slice(0, 120);
  const summary = meta.summary === undefined ? null : String(meta.summary).slice(0, 400);
  const done = meta.done === undefined ? null : !!meta.done;
  await sql`
    INSERT INTO client_chat (client_slug, thread, messages, title, summary, done, updated_at)
    VALUES (${slug}, ${t}, '[]', ${title}, ${summary}, ${done ?? false}, now())
    ON CONFLICT (client_slug, thread) DO UPDATE SET
      title   = COALESCE(${title}, client_chat.title),
      summary = COALESCE(${summary}, client_chat.summary),
      done    = COALESCE(${done}, client_chat.done)`;
}

// Maakt automatisch een korte titel (alleen als die er nog niet is) plus een verse
// samenvatting van 1-2 regels voor een bird's eye-onderwerp, zodat Maarten die niet
// zelf hoeft te typen. Draait op het lichte model; faalt stil (meta is optioneel).
async function autoTopicMeta(slug: string, thread: string, msgs: ChatMessage[]): Promise<{ title?: string; summary?: string }> {
  const { rows } = await sql`SELECT title FROM client_chat WHERE client_slug = ${slug} AND thread = ${cleanThread(thread)} LIMIT 1`;
  const needTitle = !((rows[0]?.title as string) || "").trim();
  const convo = msgs.slice(-6).map((m) => `${m.role === "user" ? "Maarten" : "Assistent"}: ${(m.content || "").slice(0, 800)}`).join("\n").slice(0, 3500);
  const sys = "Je maakt een korte, kernachtige omschrijving van een SEO-werkoverleg-onderwerp voor in een overzicht. Antwoord UITSLUITEND met geldige JSON, zonder codeblok en zonder extra tekst. Nederlands, gewone taal, geen Markdown-tekens.";
  const user = `Gesprek:\n${convo}\n\nGeef ${needTitle ? '{"title": "<max 6 woorden, geen punt aan het eind>", "summary": "<1 tot 2 korte regels: wat speelt er>"}' : '{"summary": "<1 tot 2 korte regels: wat speelt er>"}'}`;
  const raw = await callClaude(sys, [{ role: "user", content: user }], 300, { slug, action: "topic-meta" }, LIGHT_MODEL);
  let parsed: { title?: string; summary?: string } = {};
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { /* geen geldige JSON */ }
  const out: { title?: string; summary?: string } = {};
  if (needTitle && typeof parsed.title === "string" && parsed.title.trim()) out.title = parsed.title.trim().replace(/[.]$/, "").slice(0, 80);
  if (typeof parsed.summary === "string" && parsed.summary.trim()) out.summary = parsed.summary.trim().slice(0, 200);
  if (out.title || out.summary) await setThreadMeta(slug, thread, out);
  return out;
}

// Inhaalslag: maak (met terugwerkende kracht) titel + samenvatting voor een
// bestaand onderwerp op basis van de opgeslagen historie. Voor onderwerpen waar
// al gewerkt is voordat de auto-titel bestond.
export async function generateTopicMetaFor(slug: string, thread: string): Promise<{ title?: string; summary?: string }> {
  const msgs = await getChatHistory(slug, thread);
  if (!msgs.length) return {};
  return autoTopicMeta(slug, thread, msgs);
}

async function saveChatHistory(slug: string, thread: string, messages: ChatMessage[]): Promise<void> {
  await ensureSchema();
  const keep = messages.slice(-40);
  const content = JSON.stringify(keep.map((m, i) => ((m.image || m.images?.length) && i < keep.length - 6 ? { role: m.role, content: m.content } : m)));
  await sql`
    INSERT INTO client_chat (client_slug, thread, messages, updated_at)
    VALUES (${slug}, ${cleanThread(thread)}, ${content}, now())
    ON CONFLICT (client_slug, thread) DO UPDATE SET messages = EXCLUDED.messages, updated_at = now()`;
}

// Wist één gesprek (thread) van een klant; de assistent begint daar weer schoon.
export async function clearChatHistory(slug: string, thread = "algemeen"): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_chat WHERE client_slug = ${slug} AND thread = ${cleanThread(thread)}`;
}

function chatTools(client: ClientConfig): { tools: ToolDef[]; run: ToolRunner } {
  const domain = (client.domain || "").trim();
  const toFull = (u: string) => {
    const t = (u || "").trim();
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${(domain || "").replace(/^https?:\/\//i, "").replace(/\/$/, "")}${t.startsWith("/") ? t : `/${t}`}`;
  };
  const tools: ToolDef[] = [
    { name: "meet_pagina", description: "Leest en meet een pagina live uit: meta-title/description, H1/H2/H3, aantal woorden, interne/externe links, afbeeldingen, FAQ en schema. Gebruik dit ZELF om contentkwaliteit en on-page zaken te beoordelen in plaats van ernaar te vragen.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad (bijv. /zwemvijvers/)" } }, required: ["url"] } },
    { name: "controleer_url", description: "Controleert LIVE wat een URL echt doet: bestaat hij (200), is hij al omgeleid (301/302, en waarheen), of is hij weg (404). Volgt de omleiding NIET, dus dit is de enige betrouwbare manier om te weten of een pagina nog leeft. Gebruik dit ALTIJD voordat je zegt dat een pagina live staat, nog gebouwd moet worden, of opgeruimd/omgeleid moet worden. Ook voor een pad dat niet in de bekende URL-lijst staat.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "concurrerende_paginas", description: "DE ENIGE JUISTE MANIER om te bepalen welke pagina's een doelpagina in de weg zitten. Zoekt in Search Console welke andere pagina's van deze klant vertoningen krijgen op DEZELFDE zoekwoorden, en geeft per concurrent de gedeelde zoekwoorden met posities, de live status, en de EIGEN sterkste zoekterm van die pagina (het bestaansrecht). Gebruik dit ALTIJD bij vragen over cannibalisatie, concurrerende pagina's, opruimen, redirects of 'welke pagina's zitten in de weg'. Leid dit NOOIT zelf af uit de URL-lijst: dan mis je pagina's en verzin je pagina's. De uitkomst is compleet; noem er geen andere bij.", input_schema: { type: "object", properties: { url: { type: "string", description: "De doelpagina (volledige URL of pad)" } }, required: ["url"] } },
    { name: "cannibalisatie_analyse", description: "DE VOLLEDIGE anti-cannibalisatie-analyse van het dashboard, site-breed. Dit is de zwaarste en meest complete analyse die er is: hij detecteert URL-flipping over tijd (Google die wisselt tussen URLs, het sterkste bewijs van echte cannibalisatie), positieplafonds en klikverdeling per cluster, en levert een complete redirectmap (van, naar, reden, wel of niet content samenvoegen), een interne-linkplan met anker­teksten, en een oordeel over de datakwaliteit. Gebruik dit ALTIJD als eerste bij elke vraag over cannibalisatie, opruimen, redirects of concurrerende pagina's; de andere tools zijn snelle hulpjes, dit is de echte analyse. Draait als achtergrondtaak: is hij nog niet klaar, zeg dat dan en doe zelf GEEN uitspraak over wat er opgeruimd moet worden.", input_schema: { type: "object", properties: { opnieuw: { type: "boolean", description: "true = de analyse opnieuw laten draaien met verse data" } } } },
    { name: "dunne_paginas", description: "Zoekt de pagina's die opgeruimd of samengevoegd kunnen worden: live pagina's die op GEEN ENKELE zoekterm van hun eigen onderwerp ranken. Alles wat ze binnenhalen is geleend van merktermen of andere plaatsen, dus ze versnipperen autoriteit zonder iets op te leveren. Precies de kleine locatiepaginaatjes (denk Mijdrecht, Abcoude, Veldhoven). Geeft per pagina de klikken, vertoningen, de geleende topterm, en welke andere pagina die term wél bezit als voor de hand liggend redirect-doel. Gebruik dit ALTIJD bij 'welke pagina's moeten we opruimen', 'welke dunne pagina's zitten in de weg', 'welke locatiepagina's kunnen weg'. Verschil met concurrerende_paginas: DAT zoekt pagina's die dezelfde zoekwoorden delen (meestal juist de STERKE pagina's, die je wilt houden); DIT zoekt de zwakke pagina's zonder eigen bestaansrecht. Voor opruimen is dit de juiste tool.", input_schema: { type: "object", properties: {} } },
    { name: "interne_link_kansen", description: "De interne-link-analyse van het dashboard voor één pagina: vanaf welke bestaande pagina's je het beste naar deze pagina kunt linken, gewogen op autoriteit, verkeer en relevantie. Gebruik dit ALTIJD als het gaat over het versterken van een pagina, interne links leggen, linkwaarde sturen of autoriteit doorgeven. Geef nooit zelf een lijst bronpagina's uit je hoofd.", input_schema: { type: "object", properties: { url: { type: "string", description: "De pagina die je wilt versterken (volledige URL of pad)" } }, required: ["url"] } },
    { name: "gsc_pagina", description: "Search Console-zoekwoorden van één pagina (laatste 90 dagen): zoekwoord, klikken, vertoningen, positie.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "ahrefs_pagina", description: "Ahrefs-gegevens van één pagina: organische zoekwoorden met positie/volume/verkeer, plus het aantal verwijzende domeinen (externe autoriteit) van die pagina.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "serp_top10", description: "De actuele top 10 van Google voor een zoekwoord (NL): positie, URL, titel, domain rating en resultaattype. Gebruik dit ZELF om de concurrentie te beoordelen.", input_schema: { type: "object", properties: { zoekwoord: { type: "string" } }, required: ["zoekwoord"] } },
    { name: "zoek_mail", description: "Zoekt gericht in de mail van deze klant op een naam, e-mailadres, onderwerp of trefwoord (bijv. 'Emre', 'Nicolien' of 'lenzen') en geeft de gevonden mails terug (afzender, datum, onderwerp, volledige inhoud, mail-link). Gebruik dit om de laatste mail van een specifiek persoon of over een onderwerp op te halen.", input_schema: { type: "object", properties: { zoekterm: { type: "string", description: "Naam, e-mailadres, onderwerp of trefwoord" } }, required: ["zoekterm"] } },
    // ── Zoekwoordonderzoek: de drie tools die hier misten ──
    // De chat kon alles nameten wat de site AL doet, maar niets zeggen over een
    // zoekterm waar we nog niets mee doen: geen volume, geen moeilijkheid, geen
    // intentie. Daarmee was elk gesprek over een nieuwe zoekwoordstrategie
    // (welke termen kiezen we, en kunnen we die winnen?) gokwerk, en dat is
    // precies het gesprek waar het oordeel vandaan moet komen. Zelfde namen als in
    // de pagina-chat, zodat de bronnenstrip ze meteen netjes benoemt.
    { name: "ahrefs_keyword_volume", description: "Echt maandelijks zoekvolume, keyword difficulty, CPC én zoekintentie uit Ahrefs voor één of meer zoekwoorden (NL). DE tool voor een zoekwoordstrategie: zet hier in één aanroep de hele kandidatenlijst in (tien tot dertig termen tegelijk mag) en vergelijk daarna pas. Verzin NOOIT een volume of moeilijkheid uit je hoofd; haal ze hiermee op.", input_schema: { type: "object", properties: { keywords: { type: "array", items: { type: "string" } }, country: { type: "string" } }, required: ["keywords"] } },
    { name: "ahrefs_keyword_ideas", description: "Zoekwoord-ideeën rond een zaad-zoekwoord uit Ahrefs, met volume en difficulty (NL). Gebruik dit om termen te vinden waar de klant NOG NIET op mikt, en om te toetsen of er naast de voor de hand liggende termen een rijker of kansrijker cluster bestaat. Gebruik dit vóórdat je een zoekwoordstrategie beoordeelt, anders beoordeel je alleen de lijst die er toevallig al lag.", input_schema: { type: "object", properties: { seed: { type: "string" }, country: { type: "string" } }, required: ["seed"] } },
    { name: "concurrent_zoekwoorden", description: "De zoekwoorden waarop een CONCURRENT-domein organisch scoort (positie, volume, verkeer), zodat je een echte content-gap kunt doen: waar halen zij verkeer dat wij missen? Geef alleen het domein voor hun sterkste termen, of geef er een term bij (bijvoorbeeld een plaatsnaam of een thema) om alleen dat deel te zien. Gebruik dit bij elke strategievraag waarin de concurrentie meeweegt; leid nooit zelf af waar een concurrent op scoort.", input_schema: { type: "object", properties: { domein: { type: "string", description: "Kaal domein van de concurrent, bijvoorbeeld grasengroen.nl" }, term: { type: "string", description: "Optioneel: alleen zoekwoorden die deze term bevatten" } }, required: ["domein"] } },
    { name: "ahrefs_site_authority", description: "Domain Rating, verwijzende domeinen en backlinks van ELK domein of URL (Ahrefs), dus ook van een concurrent uit de top 10. Gebruik dit voor de haalbaarheidsvraag: kan deze klant met deze autoriteit realistisch winnen van wie er nu staat? Een hoge moeilijkheid bij een laag Domain Rating is geen kans maar een illusie; zeg dat dan ook.", input_schema: { type: "object", properties: { target: { type: "string", description: "Kaal domein (pingwin.nl) of volledige URL" } }, required: ["target"] } },
    { name: "pagina_dossier", description: "HET COMPLETE DOSSIER van één pagina: de stand (welke stappen af zijn, of de copy live staat), de mails die aantoonbaar over deze pagina gaan (met datum en afzender), de documenten die we gemaakt hebben, teksten die de klant heeft teruggestuurd en nog verwerkt moeten worden, en wat er met de pagina is gebeurd. Gebruik dit ALTIJD voordat je zegt wat er met een pagina moet gebeuren of wie er aan zet is; dan weet je of er al over gemaild is en of er al teksten liggen. Noem een mail als 'de mail van 22 juli' (dag plus maand), want dat wordt automatisch een klikbare link.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad van de pagina" } }, required: ["url"] } },
  ];
  const run: ToolRunner = async (name, input) => {
    try {
      if (name === "pagina_dossier") {
        const doel = toFull(String(input.url || ""));
        const d = await getPageDossier(client.slug, doel, { verseMail: true });
        const alinea = await getOpgeslagenTekst(client.slug, doel).catch(() => "");
        return dossierToText(d) + (alinea ? `\n\nEERDER VASTGELEGDE SAMENVATTING: ${alinea}` : "");
      }
      if (name === "meet_pagina") {
        const gevraagd = toFull(String(input.url || ""));
        const m = await measurePage(gevraagd, { staticOnly: true });
        if (!m.ok) return `Pagina niet leesbaar (status ${m.status ?? "?"}).`;
        // Een omleiding MOET bovenaan staan. Zonder deze regel meet je vier
        // omgeleide URL's, krijg je vier keer de doelpagina terug (zelfde titel,
        // zelfde woordaantal) en concludeer je "vier identieke duplicaten",
        // terwijl ze allang zijn opgeruimd. Dat is precies wat er misging.
        const padOf = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
        const omleiding = m.redirected && padOf(m.finalUrl) !== padOf(gevraagd)
          ? `LET OP, DIT IS EEN OMLEIDING. ${padOf(gevraagd)} leidt door naar ${padOf(m.finalUrl)}. Alles hieronder is gemeten op ${padOf(m.finalUrl)}, NIET op ${padOf(gevraagd)}. ${padOf(gevraagd)} is dus AL opgeruimd: noem hem geen duplicaat, geen dunne pagina en stel niet voor om hem om te leiden.\n`
          : "";
        const normImg = (f: string) => f.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
        const imgUniek = new Set(m.images.map((i) => normImg(i.file))).size;
        const imgUniekNoAlt = new Set(m.images.filter((i) => !i.hasAlt || !i.alt.trim()).map((i) => normImg(i.file))).size;
        return [
          omleiding + `Status ${m.status}. Title (${metaVerdictText("meta_title", m.metaTitle)}): ${m.metaTitle}`,
          `Meta-description (${metaVerdictText("meta_description", m.metaDescription)}): ${m.metaDescription}`,
          `H1: ${m.h1.join(" | ") || "(geen)"}`,
          `H2 (${m.h2.length}): ${m.h2.join(" | ")}`,
          `H3 (${m.h3.length}): ${m.h3.slice(0, 15).join(" | ")}`,
          `Woorden: ${m.wordCount}. Interne links: ${m.internalLinkCount}, extern: ${m.externalLinkCount}.`,
          `Afbeeldingen: ${imgUniek} uniek${m.images.length > imgUniek ? ` (${m.images.length} img-tags incl. responsive/lazyload-varianten)` : ""}, zonder alt: ${imgUniekNoAlt} uniek. FAQ: ${m.faqDetected ? `ja (${m.faqCount})` : "nee"}. Schema: ${m.schemaTypes.join(", ") || "geen"}.`,
        ].join("\n");
      }
      if (name === "concurrerende_paginas") {
        const doel = toFull(String(input.url || ""));
        const doelPad = (() => { try { return new URL(doel).pathname; } catch { return doel; } })();
        // De site-brede opruimlijst gaat ALTIJD mee, ook als hij er niet om vraagt.
        // Eerder moest het model daar zelf een tweede tool voor aanroepen, en dat
        // deed het niet: na zes pagina-analyses waren de beurten op en bleven juist
        // de dunne locatiepagina's (Mijdrecht, Rijswijk, Houten) buiten beeld.
        const [r, zwak] = await Promise.all([
          overlappendePaginas(client.slug, domain, doel),
          zwakkePaginas(client.slug, domain).catch(() => null),
        ]);
        let uit = overlapAlsTekst(r);
        const bij = (zwak?.kandidaten || []).filter((k) => k.dubbelMet.some((d) => d === doelPad));
        if (bij.length) {
          uit += `\n\n=== DUNNE PAGINA'S DIE BIJ ${doelPad} HOREN (${bij.length}) ===\n`
            + `Deze pagina's verdienen geen eigen zoekterm en wijzen op basis van hun zoekwoorden naar DEZE stadspagina. Ze staan niet in de overlap hierboven omdat ze te weinig vertoningen hebben om zoekwoorden te delen, maar ze versnipperen wel de autoriteit. NEEM ZE OP IN JE ANTWOORD.\n`
            + bij.map((k) => `- ${k.pad} [${k.klikken} klikken, ${k.vertoningen} vertoningen] -> 301 naar ${doelPad}; leent "${k.geleendeTop?.keyword ?? "?"}"`).join("\n");
        } else if (zwak?.ok) {
          uit += `\n\n(Geen dunne pagina's die specifiek naar ${doelPad} wijzen. Gebruik dunne_paginas voor het volledige site-brede beeld.)`;
        }
        return uit;
      }
      if (name === "cannibalisatie_analyse") {
        const st = await getCannibalAnalysis(client.slug);
        if (st.status === "running") return `De volledige cannibalisatie-analyse draait nog: stap ${st.stap} van ${st.stappen} (${st.stapLabel}). Zeg dat tegen Maarten, noem bij welke stap hij is, geef aan dat de hele analyse een kwartier tot twintig minuten kost, en doe zelf GEEN uitspraak over welke pagina's opgeruimd moeten worden.`;
        // Een maand oude "klaar" is geen klaar. De analyse van One Day Clinic stond
        // op done met een uitkomst van 6 juli; zonder deze controle zou die als de
        // huidige stand worden gepresenteerd. Ouder dan een week = opnieuw draaien.
        const datum = resultDatum(st);
        const dagenOud = datum ? (Date.now() - new Date(datum).getTime()) / 86400000 : Infinity;
        if (input.opnieuw === true || st.status === "idle" || st.status === "error" || !st.result || dagenOud > 7) {
          try { void startCannibalRun(client.slug).then(() => runCannibalRedirect(client.slug)).catch(() => { /* de cron pikt hem op */ }); } catch { /* best effort */ }
          const oud = st.result && Number.isFinite(dagenOud)
            ? ` Er ligt nog een uitkomst van ${Math.round(dagenOud)} dagen geleden (${datum ? new Date(datum).toLocaleDateString("nl-NL") : "?"}); die is te oud om op te vertrouwen en gebruik je NIET.`
            : "";
          return `Ik heb de volledige cannibalisatie-analyse zojuist gestart; die kost een paar minuten.${oud} Zeg dat tegen Maarten en doe zelf GEEN uitspraak over wat er opgeruimd moet worden. Vraag hem zo opnieuw te vragen, dan is de verse redirectlijst er.`;
        }
        const r = st.result;
        const regels: string[] = [
          `VOLLEDIGE CANNIBALISATIE-ANALYSE, uitgevoerd op ${st.updatedAt ? new Date(st.updatedAt).toLocaleString("nl-NL") : "onbekend"} (${Math.round(dagenOud)} dagen oud; noem die datum in je antwoord). Dit is de complete uitkomst; NEEM DE REDIRECTMAP HIERONDER LETTERLIJK EN VOLLEDIG OVER, laat geen regel weg en verzin er geen bij.`,
          r.samenvatting || "",
        ];
        if (r.datakwaliteit) regels.push(`Datakwaliteit: ${JSON.stringify(r.datakwaliteit)}`);
        if (r.redirectMap?.length) {
          regels.push(`\nREDIRECTMAP (${r.redirectMap.length} regels, volledig overnemen):`);
          for (const m of r.redirectMap) regels.push(`- ${m.van} -> ${m.naar}${m.type ? ` (${m.type})` : ""}${m.mergeContent ? " [content samenvoegen]" : ""}${m.reden ? `: ${m.reden}` : ""}`);
        } else regels.push("\nGeen redirectmap in de uitkomst; zeg dat er niets om te leiden is in plaats van zelf iets te bedenken.");
        if (r.interneLinks?.length) {
          regels.push(`\nINTERNE LINKS (${r.interneLinks.length} regels, volledig overnemen):`);
          for (const l of r.interneLinks) regels.push(`- vanaf ${l.vanaf} naar ${l.naar}${l.ankertekst ? ` met ankertekst "${l.ankertekst}"` : ""}${l.reden ? `: ${l.reden}` : ""}`);
        }
        if (r.clusters?.length) regels.push(`\nCLUSTERS: ${r.clusters.length}. Signalen per cluster (urlFlip = Google wisselt tussen URLs, het sterkste bewijs) staan in de analyse; benoem ze bij je advies.`);
        return regels.join("\n");
      }
      if (name === "dunne_paginas") {
        const r = await zwakkePaginas(client.slug, domain);
        return r.tekst;
      }
      if (name === "interne_link_kansen") {
        const doel = toFull(String(input.url || ""));
        const st = await getPageInternalLinks(client.slug, doel);
        if (st.status === "done" && st.result) return `INTERNE-LINK-KANSEN voor ${doel} (analyse van ${st.updatedAt ? new Date(st.updatedAt).toLocaleDateString("nl-NL") : "onbekend"}):\n${st.result}`;
        if (st.status === "running") return "De interne-link-analyse voor deze pagina draait nog. Zeg dat, en doe zelf geen uitspraak over welke pagina's moeten linken.";
        // Nog nooit gedraaid: start hem, zodat de volgende vraag hem wel heeft.
        try { void runPageInternalLinks(client.slug, doel); } catch { /* best effort */ }
        return "Voor deze pagina is nog geen interne-link-analyse gedraaid; ik ben hem nu gestart. Doe zelf GEEN uitspraak over welke pagina's moeten linken, en zeg dat de analyse eraan komt.";
      }
      if (name === "controleer_url") {
        // redirect: "manual" is hier het hele punt: we willen de ECHTE status van
        // dit adres zien, niet die van de pagina waar hij eventueel heen wijst.
        const doel = toFull(String(input.url || ""));
        const padOf2 = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 10000);
          const res = await fetch(doel, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 PingwinBot" } }).finally(() => clearTimeout(t));
          if (res.status >= 300 && res.status < 400) {
            const naar = res.headers.get("location") || "";
            return `${padOf2(doel)}: ${res.status} OMGELEID naar ${naar ? padOf2(naar) : "onbekende bestemming"}. Deze pagina is AL opgeruimd. Stel niet voor om hem om te leiden en noem hem geen duplicaat.`;
          }
          if (res.status >= 400) return `${padOf2(doel)}: ${res.status}, deze pagina bestaat NIET (meer).`;
          return `${padOf2(doel)}: ${res.status}, staat echt live.`;
        } catch (e) {
          return `${padOf2(doel)}: niet te controleren (${(e as Error).message}). Doe hier GEEN uitspraak over de status.`;
        }
      }
      if (name === "gsc_pagina") {
        const rows = await getGscForPage(domain, toFull(String(input.url || "")), 90);
        if (!rows.length) return "Geen GSC-data voor deze pagina (of de Google-koppeling ontbreekt).";
        return rows.slice(0, 25).map((r) => `${r.keyword}: pos ${r.position}, ${r.clicks} klikken, ${r.impressions} vertoningen`).join("\n");
      }
      if (name === "ahrefs_pagina") {
        if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld.";
        const full = toFull(String(input.url || ""));
        const [kws, top] = await Promise.all([
          getUrlOrganicKeywords(full, "nl", 30).catch(() => []),
          getAhrefsTopPages(domain).catch(() => []),
        ]);
        const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
        const rd = top.find((t) => norm(t.url) === norm(full))?.refDomains;
        const kwText = kws.length ? kws.map((k) => `${k.keyword}: pos ${k.position ?? "-"}, vol ${k.volume ?? "-"}, verkeer ${k.traffic ?? "-"}`).join("\n") : "Geen organische zoekwoorden gevonden.";
        const rdText = rd === undefined || rd === null
          ? "Verwijzende domeinen naar deze pagina: NIET OPGEHAALD (deze pagina staat niet in de Ahrefs top-pages). Noem hier GEEN getal; zeg dat het niet gemeten is."
          : `Verwijzende domeinen naar deze pagina: ${rd} (Ahrefs).`;
        return `${rdText}\n${kwText}`;
      }
      if (name === "serp_top10") {
        const rows = await getSerpOverview(String(input.zoekwoord || ""), "nl");
        if (!rows.length) return "Geen SERP-data gevonden.";
        return rows.slice(0, 10).map((r) => `#${r.position} ${r.url} (DR ${r.domainRating ?? "-"}, ${r.type})${r.title ? ` \u2014 ${r.title}` : ""}`).join("\n");
      }
      if (name === "zoek_mail") {
        const q = String(input.zoekterm || "").trim();
        if (!q) return "Geef een zoekterm (naam, e-mailadres, onderwerp of trefwoord).";
        type M = { fromAddress: string | null; subject: string | null; receivedAt: string | null; bodyHtml: string | null; preview: string | null; direction: string | null; link: string | null };
        const normM = (e: { fromAddress?: string | null; subject?: string | null; receivedAt?: string | null; bodyHtml?: string | null; preview?: string | null; direction?: string | null; superhumanLink?: string | null; webLink?: string | null }): M => ({ fromAddress: e.fromAddress ?? null, subject: e.subject ?? null, receivedAt: e.receivedAt ?? null, bodyHtml: e.bodyHtml ?? null, preview: e.preview ?? null, direction: e.direction ?? null, link: e.superhumanLink || e.webLink || null });
        let mails: M[] = [];
        try { const ms = await msStatus(); if (ms.connected) { const live = await msSearchClientEmails(q, ms.account || "", 8); if (live) mails = live.map(normM); } } catch { /* val terug op opgeslagen */ }
        if (!mails.length) {
          const stored = await getEmails(client.slug, 80).catch(() => []);
          const ql = q.toLowerCase();
          mails = stored.filter((e) => `${e.fromAddress || ""} ${e.subject || ""} ${stripHtml(e.bodyHtml || "") || e.preview || ""}`.toLowerCase().includes(ql)).slice(0, 8).map(normM);
        }
        if (!mails.length) return `Geen mail gevonden voor "${q}".`;
        return mails.slice(0, 6).map((e) => {
          const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
          const date = e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("nl-NL") : "";
          const body = (stripHtml(e.bodyHtml || "") || e.preview || "").replace(/\s+/g, " ").trim().slice(0, 3000);
          return `[${dir}, ${date}] van ${e.fromAddress || "?"} — ${e.subject || "(geen onderwerp)"}${e.link ? `\n(mail-link: ${e.link})` : ""}:\n${body}`;
        }).join("\n\n---\n\n");
      }
      if (name === "concurrent_zoekwoorden") {
        if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld.";
        const dom = String(input.domein || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
        if (!dom) return "Geef het domein van de concurrent.";
        const term = String(input.term || "").trim();
        // Credit-bewust: honderd zoekwoorden is ruim genoeg voor een gap-oordeel, en
        // de volledige domeinlijst (achthonderd) is voor de scan-motoren, niet voor
        // een gesprek waarin er vaak drie concurrenten achter elkaar langskomen.
        if (term) {
          const rijen = await getDomainKeywordsMatching(dom, term, 60);
          if (!rijen.length) return `Geen zoekwoorden met "${term}" gevonden voor ${dom}.`;
          return `ZOEKWOORDEN VAN ${dom} MET "${term}" (Ahrefs, ${rijen.length}):\n`
            + rijen.map((r) => `- ${r.keyword}: positie ${r.position ?? "-"}, volume ${r.volume ?? "-"}, verkeer ${r.traffic ?? "-"} -> ${r.url}`).join("\n");
        }
        const rijen = await getSiteOrganicKeywords(dom, "nl", 100);
        if (!rijen.length) return `Ahrefs kent geen organische zoekwoorden voor ${dom}.`;
        return `STERKSTE ZOEKWOORDEN VAN ${dom} (Ahrefs, top ${rijen.length} op verkeer):\n`
          + rijen.map((r) => `- ${r.keyword}: positie ${r.position ?? "-"}, volume ${r.volume ?? "-"}, verkeer ${r.traffic ?? "-"}${r.branded ? " [merknaam]" : ""}${r.url ? ` -> ${r.url}` : ""}`).join("\n");
      }
      // Het zoekwoordonderzoek-gereedschap draait op dezelfde uitvoering als in de
      // pagina-chat, zodat er nooit twee versies van hetzelfde ontstaan.
      if (name === "ahrefs_keyword_volume" || name === "ahrefs_keyword_ideas" || name === "ahrefs_site_authority") {
        return await runChatTool(name, input);
      }
      return "Onbekend gereedschap.";
    } catch (e) {
      return `Gereedschap-fout: ${(e as Error).message}`;
    }
  };
  return { tools, run };
}

// Vervangt de historie van een gesprek (voor het verwijderen van losse berichten).
export async function replaceChatHistory(slug: string, thread: string, messages: ChatMessage[]): Promise<void> {
  await saveChatHistory(slug, thread, messages);
}

// Haalt de concrete weektaken uit een bird's eye-antwoord en geeft een gevalideerde
// weekplan_taken-actie terug (of null). Gebruikt het BEPROEFDE JSON-patroon (zoals
// extractProposal in page-chat-ground): vraag callClaude om UITSLUITEND JSON en parse dat.
// Geen tool_choice (bleek onbetrouwbaar). De taken staan al concreet IN het antwoord, dus
// dit is puur extraheren. Eén retry-vangnet.
async function generateWeekplanActie(client: ClientConfig, context: string, analyse: string, slug: string, enkel = false): Promise<ProposedAction | null> {
  const system =
    `Je krijgt hieronder een SEO-weekplanning/analyse voor ${client.name} als tekst (en wat context). Zet die om in een KLEIN aantal overzichtelijke projectkaarten.\n` +
    `Antwoord met UITSLUITEND geldige JSON, niets eromheen, exact dit formaat:\n` +
    `{"taken":[{"taak":"korte omschrijving in één regel, geen 'Week X' erin","week":1,"info":"achtergrond plus de deeltaken als '-'-bullets","wie":"SEO","url":"/pad/ of volledige URL of leeg","taaktype":"meta"}]}\n` +
    `BUNDEL-REGELS (belangrijkste):\n` +
    `- NOOIT meerdere pagina's in één kaart. Gaat een aanpak over meerdere paden of pagina's (bijvoorbeeld drie soorten tuinen), maak dan per pagina een eigen kaart met dezelfde achtergrond, elk met de eigen "url"; zet nooit meerdere paden of paginanamen in één kaarttitel.\n` +
    `- Maak per pagina PRECIES ÉÉN kaart in totaal, over alle weken heen. Een pagina is een project; "week" is de week waarin het werk aan die pagina start. Alle deeltaken voor die pagina (meta, alt-teksten, copy, interne links, structured data, bouwen) zet je NIET als losse kaarten, maar als '-'-bullets in "info" van die ene paginakaart.\n` +
    `- Bouwen en publiceren is een FASE van de paginakaart, geen eigen kaart. Maak dus nooit een aparte kaart "bouw en publiceer /pad/".\n` +
    `- Hoort een mail, bevestiging of referentie bij een pagina (bijvoorbeeld "stuur een bevestigingsmail naar Emre over deze pagina" of "bekijk de referentiesite"), dan is dat GEEN eigen kaart: zet het als achtergrond of als '-'-bullet in de info van die paginakaart.\n` +
    `- De titel van een paginakaart: het pad plus het doel, bijvoorbeeld "Ontwikkel /lensimplantatie/trifocale-pro-lens/ (copy, bouw, interne links)".\n` +
    `- Alleen écht werk dat aan geen enkele pagina hangt krijgt een eigen kaart, zonder url; dat is zeldzaam.\n` +
    `- Site-brede meta- of alt-tekst-opruiming over veel pagina's is NOOIT een stapel losse kaartjes: dat wordt ÉÉN Dev-kaart "Werklijst sitebouwer: meta's en alt-teksten site-breed" zonder url. Meta's of alt-teksten van een pagina die tóch een eigen paginakaart heeft blijven gewoon een fase-bullet op die kaart.\n` +
    `- Streef naar 3 tot 6 kaarten in totaal, nooit meer dan 10. Liever één stevige paginakaart met zes bullets dan zes losse snippers.\n` +
    `- "taaktype" van een gebundelde paginakaart: kies het zwaartepunt (meestal "pijplijn" als er analyse/blauwdruk/copy/bouw in zit, anders het meest voorkomende type).\n` +
    `Verder: "week" is een getal (1 = deze week, 2 = volgende, enzovoort); neem de startweek over zoals de tekst die aangeeft, anders realistisch. "wie" is "SEO" of "Dev". "taaktype" is één van: meta, alt, copy, intern, strategie, pijplijn, structured, overig. Bouw "info" op in secties, elk met een kort kopje op een eigen regel dat eindigt op een dubbele punt. Eerst "Achtergrond:" met korte, puntige regels: elk punt één zin van hooguit vijftien woorden; splits een lang verhaal in meerdere korte punten (wat is er mis, welke cijfers, cannibalisatie-nuance, waarom nu). Dan alleen als er afspraken of bronnen zijn "Afspraken en herkomst:" met '-'-bullets (mail-datum, wie, referenties). Daarna "Aanpak per fase:" met per regel een '-'-bullet die begint met exact een fasenaam en dubbele punt, alleen voor fases die nodig zijn: "- Analyse: ...", "- Blauwdruk: ...", "- Copy: ...", "- Bouw: ...", "- Structured data: ...". Micro-taken horen bij de juiste fase-regel (meta-title/description bij Copy; alt-teksten, interne links en andere developer-punten bij Bouw). Herhaal nooit de kaarttitel als bullet en beschrijf een fase nooit dubbel. Verzin geen cijfers; gebruik alleen wat in de tekst staat. Geen emoji, geen Markdown-symbolen (#, | of **), geen tekst buiten de JSON.`;
  // Enkel-modus (per-punt- of per-sectie-knopje): verdeel de geselecteerde tekst
  // slim PER PAGINA, want per pagina doorlopen we de fases.
  const enkelRegel = enkel
    ? `\nENKEL-MODUS, overschrijft het streefgetal: de tekst hieronder is ÉÉN sectie of ÉÉN punt uit een analyse. Verdeel hem PER PAGINA:\n` +
      `- Herken alle pagina's/paden die in de tekst voorkomen (toets ze aan de bekende URL's in de context) en maak per pagina PRECIES ÉÉN kaart, met de deeltaken van díe pagina als fase-bullets. Neem geen punten van andere pagina's mee.\n` +
      `- Ook geplande NIEUWE pagina's (bijv. locatiepagina's of pagina's uit de zoekwoordenlijst) zijn pagina's: per nieuwe pagina één kaart, met het bedoelde pad als "url" als dat in de tekst of context staat.\n` +
      `- Punten die aan geen enkele pagina hangen, bundel je samen in ÉÉN restkaart zonder url; versnipper die niet.\n` +
      `- Gaat de tekst maar over één pagina of één los punt, dan is het gewoon één kaart.\n` +
      `Gebruik hetzelfde info-formaat (Achtergrond:, alleen indien relevant Afspraken en herkomst:, Aanpak per fase:).`
    : "";
  const body = `--- WEEKPLANNING / ANALYSE ---\n${analyse}\n\n--- EXTRA CONTEXT (voor url's/achtergrond) ---\n${context.slice(0, 6000)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = enkelRegel + (attempt === 0 ? "" : enkel
      ? "\n\nLET OP: geef nu minimaal 1 kaart, met 'taak', 'week' (getal) en 'info'. Laat niets leeg."
      : "\n\nLET OP: geef nu minimaal 3 kaarten, elk met 'taak', 'week' (getal) en 'info'. Bundel deeltaken per pagina in één kaart. Laat niets leeg.");
    try {
      const raw = await callClaude(system + extra, [{ role: "user", content: body.slice(0, 16000) }], 3500, { slug, action: attempt === 0 ? "overzicht-weekplan" : "overzicht-weekplan-retry" });
      const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      const clean = start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText;
      const parsed = JSON.parse(clean) as { taken?: unknown };
      const v = validateAction({ type: "weekplan_taken", taken: parsed.taken }, client.domain || "", `a${Date.now().toString(36)}_wp${attempt}`);
      if (v && v.taken && v.taken.length) return v;
    } catch { /* volgende poging */ }
  }
  return null;
}

// Deterministische knop-actie: zet de concrete taken uit een BIRD'S EYE-antwoord om in
// sleepbare kaarten in het weekplanning-bord. Door de mens getriggerd (knop), dus geen
// afhankelijkheid van modelkeuze of intent-detectie. Werkt bij elk project/elke vraag.
export async function weekplanFromAnswer(slug: string, answer: string, thread = "overzicht", enkel = false): Promise<{ ok: boolean; added: number; merged: number; error?: string }> {
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, added: 0, merged: 0, error: "Klant niet gevonden." };
  if (!answer || !answer.trim()) return { ok: false, added: 0, merged: 0, error: "Geen antwoord om taken uit te halen." };
  // De taken staan al concreet in het antwoord; de context is alleen URL-/achtergrondhulp.
  // Begrens het verzamelen op 20 seconden, zodat een trage bron (GSC, mail, sheet) de knop
  // nooit tegen de route-timeout aan kan duwen. Bij overschrijding: gewoon zonder context.
  const context = await Promise.race([
    buildOverviewContext(client).catch(() => ""),
    new Promise<string>((resolve) => setTimeout(() => resolve(""), 20000)),
  ]);
  const actie = await generateWeekplanActie(client, context, answer, slug, enkel).catch(() => null);
  if (!actie || !actie.taken || !actie.taken.length) return { ok: false, added: 0, merged: 0, error: "Kon geen concrete taken uit dit antwoord halen. Probeer het opnieuw." };
  const result = await executeAction(slug, actie, thread);
  // executeAction meldt "N nieuwe kaarten en M bestaande paginakaarten aangevuld".
  const mA = /(\d+)\s+nieuwe/.exec(result.message || "");
  const mM = /(\d+)\s+bestaande/.exec(result.message || "");
  const merged = result.ok && mM ? Number(mM[1]) : 0;
  const added = result.ok ? (mA ? Number(mA[1]) : (merged ? 0 : actie.taken.length)) : 0;
  return { ok: result.ok, added, merged, error: result.ok ? undefined : result.message };
}

// ═══════════════════════════════════════════════════════════
// EERST SPARREN, DAN CONCLUDEREN, DAN PAS TAKEN
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: de bird's eye hing vier knopjes aan ELKE bullet, en een
// regex (lib/punt-soort.ts) moest per regel raden of het werk was. Dat raden gaat
// mis ("Foto's met locatiecontext versterken dit" is een inzicht, geen taak) en het
// gebeurt op het verkeerde moment: midden in een gesprek waarin nog gedacht wordt.
// Nu is het één bewuste denkstap over het HELE gesprek, door Maarten getriggerd:
// eerst sparren (geen knopjes), dan "Trek de conclusie", dan pas "Welke taken
// volgen hieruit?". Dat laatste levert een voorstel dat hij aanvinkt; niets gaat
// automatisch door. Zo is er nog maar één weg naar een taak.
// ═══════════════════════════════════════════════════════════

// Het hele gesprek als leesbare tekst voor de conclusie- en oogst-stap. Bewust NIET
// messages.slice(-10) zoals de gewone beurt: juist het complete verloop telt hier.
// Bij een heel lang gesprek houden we het EINDE vast (daar staat de afweging).
function gesprekAlsTekst(messages: ChatMessage[], max = 24000): string {
  const regels = messages
    .filter((m) => m.soort !== "oogst" && (m.content || "").trim().length > 10)
    .map((m) => `${m.role === "user" ? "MAARTEN" : "ASSISTENT"}: ${(m.content || "").trim()}`);
  const tekst = regels.join("\n\n");
  return tekst.length > max ? "(het begin van het gesprek is ingekort)\n\n" + tekst.slice(-max) : tekst;
}

/**
 * Stap 1 van het oogsten: lees het hele gesprek terug en schrijf de conclusie.
 * Bewust GEEN nieuwe analyse en geen gereedschap: dit vat samen waar het gesprek
 * op uitkomt, zodat de takenstap daarna iets heeft om zich op te baseren.
 */
export async function trekConclusie(slug: string, thread = "overzicht"): Promise<{ ok: boolean; answer?: string; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  const messages = await getChatHistory(slug, thread);
  const gesprek = gesprekAlsTekst(messages);
  if (!gesprek.trim()) return { ok: false, error: "Er is nog geen gesprek om een conclusie uit te trekken." };

  const system =
    `Je bent de bird's eye-strateeg van Pingwin voor de klant ${client.name}. Hieronder staat een volledig gesprek tussen Maarten en jou. Trek daar nu de conclusie uit.\n\n` +
    `WAT DIT WEL EN NIET IS: dit is een samenvattende conclusie van wat er in dit gesprek is besproken en afgewogen. Geen nieuwe analyse, geen nieuwe feiten, geen takenlijst en geen weekplanning; de taken komen in een aparte stap hierna.\n\n` +
    `STRUCTUUR, precies deze kopjes (laat een kopje weg als er niets zinnigs onder staat):\n` +
    `## Waar we op uitkomen\n## Wat we nu weten\n## Wat nog open staat\n\n` +
    `REGELS:\n` +
    `- Nederlands, Markdown, geen emoji.\n` +
    `- Korte bullets (-), één gedachte per bullet. Geen lange alinea's, geen muur.\n` +
    `- Begin DIRECT met het eerste kopje. Geen aankondigings- of vulzinnen ("Hier is de conclusie", "Nu heb ik het beeld compleet").\n` +
    `- Onder "Wat nog open staat" horen echte open punten: wat we niet weten, waar we op wachten, of waar Maarten of de klant nog over moet beslissen.\n` +
    `- **Vet** voor de kernfeiten. Pagina's en paden schrijf je KAAL als pad (/hovenier-oss/); die worden vanzelf klikbaar. Nooit [tekst](/pad/).\n` +
    `- Verzin niets dat niet in het gesprek staat.`;

  try {
    const raw = await callClaude(system, [{ role: "user", content: gesprek }], 1600, { slug, action: "overzicht-conclusie" });
    const answer = (raw || "").trim();
    if (!answer) return { ok: false, error: "De conclusie kwam leeg terug. Probeer het nog een keer." };
    const bericht: ChatMessage = { role: "assistant", content: answer, soort: "conclusie" };
    await saveChatHistory(slug, thread, [...messages, bericht]);
    return { ok: true, answer };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}

/**
 * Stap 2 van het oogsten: bepaal welk werk er uit het HELE gesprek volgt.
 * Levert een VOORSTEL op (niets wordt automatisch weggezet). "geen_taak" maakt
 * zichtbaar wat bewust niet als werk is aangemerkt, zodat er niets stilletjes
 * wegvalt en Maarten kan zien dat het is meegewogen.
 */
export async function oogstTaken(slug: string, thread = "overzicht"): Promise<{ ok: boolean; oogst?: OogstResultaat; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  const messages = await getChatHistory(slug, thread);
  const gesprek = gesprekAlsTekst(messages);
  if (!gesprek.trim()) return { ok: false, error: "Er is nog geen gesprek om taken uit te halen." };

  // Context is hier alleen hulp voor juiste paden en achtergrond; het gesprek is
  // leidend. Begrensd op 20 seconden zodat een trage bron de route niet ophoudt.
  const context = await Promise.race([
    buildOverviewContext(client).catch(() => ""),
    new Promise<string>((resolve) => setTimeout(() => resolve(""), 20000)),
  ]);

  // Gaat het gesprek over opruimen of concurrerende pagina's, dan halen we de
  // overlap-analyse er ZELF bij voor de pagina's die in het gesprek voorkomen.
  // Anders vertelt de taak het gesprek na ("stel een redirectlijst op") in plaats
  // van de lijst mee te leveren, en moet het werk alsnog een keer over.
  let hardeData = "";
  if (/redirect|omleid|opruim|cannibal|kannibal|concurre|in de weg|dubbel|duplicaat/i.test(gesprek)) {
    const paden = [...new Set([...gesprek.matchAll(/(?<![\w:])\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\//gi)].map((m) => m[0]))];
    const bekend = await getClientUrls(slug).catch(() => []);
    const bekendePaden = new Map(bekend.map((u) => { try { return [new URL(u.url).pathname, u.url] as const; } catch { return [u.url, u.url] as const; } }));
    // Alleen de pagina's waar het gesprek echt om draait: de vaakst genoemde live paden.
    const telling = paden
      .filter((p) => bekendePaden.has(p))
      .map((p) => ({ p, n: (gesprek.match(new RegExp(p.replace(/[/-]/g, "\\$&"), "g")) || []).length }))
      .sort((a, b) => b.n - a.n).slice(0, 3);
    const stukken: string[] = [];
    for (const { p } of telling) {
      try { stukken.push(overlapAlsTekst(await overlappendePaginas(slug, client.domain || "", bekendePaden.get(p) as string))); }
      catch { /* deze pagina overslaan */ }
    }
    // Bij een opruimvraag is de lijst zwakke pagina's belangrijker dan de overlap:
    // dat zijn de pagina's die echt weg kunnen.
    try { const z = await zwakkePaginas(slug, client.domain || ""); if (z.ok) stukken.unshift(z.tekst); } catch { /* overslaan */ }
    if (stukken.length) hardeData = "\n\n--- VERSE ANALYSE UIT SEARCH CONSOLE (leidend boven wat er in het gesprek of in een document staat) ---\n" + stukken.join("\n\n");
  }

  const system =
    `Je bepaalt welk werk er volgt uit een gesprek tussen Maarten en de bird's eye-strateeg van Pingwin voor de klant ${client.name}.\n` +
    `Antwoord met UITSLUITEND geldige JSON, niets eromheen, exact dit formaat:\n` +
    `{"taken":[{"taak":"korte concrete titel in één regel","waarom":"in één zin waarom dit uit dit gesprek volgt","info":"de achtergrond voor op de kaart","url":"/pad/ of leeg","taaktype":"copy","week":1,"wie":"SEO","zekerheid":"hoog"}],"geen_taak":["punt uit het gesprek dat bewust geen taak is"]}\n\n` +
    `WAT IS EEN TAAK (dit is de kern van je opdracht): alleen werk dat iemand echt moet UITVOEREN en dat nog niet gedaan is. Een constatering, een cijfer, een stand van zaken, een uitleg, een inzicht of een overweging is GEEN taak, ook niet als de zin met een werkwoord begint. "Foto's met locatiecontext versterken de pagina" is een inzicht; "Voeg foto's met locatiecontext toe aan /hovenier-oss/" is een taak. Bij twijfel zet je het in "geen_taak", niet in "taken". Liever drie taken die kloppen dan tien die half kloppen.\n` +
    `"geen_taak": de belangrijkste punten uit het gesprek die je bewust NIET als taak opvoert, elk in één korte regel in gewone taal. Zo ziet Maarten dat je ze hebt meegewogen. Hooguit acht regels; laat triviale zinnen weg.\n` +
    `"waarom": één zin die teruggrijpt op wat er in dit gesprek is besproken of besloten. Niet algemeen ("goed voor SEO"), maar specifiek.\n` +
    `"zekerheid": "hoog" als het gesprek hier duidelijk op uitkomt of Maarten het zelf zegt; "middel" bij een logische maar niet uitgesproken vervolgstap; "laag" bij een suggestie van jezelf die hij makkelijk kan laten vallen.\n\n` +
    `BUNDEL-REGELS (net als de projectkaarten in het dashboard):\n` +
    `- Per pagina PRECIES ÉÉN taak, over alle weken heen. Alle deeltaken voor die pagina (meta, alt-teksten, copy, interne links, structured data, bouwen en publiceren) zet je als '-'-bullets in "info", niet als losse taken.\n` +
    `- NOOIT meerdere pagina's in één taak of in één titel. Gaat een aanpak over drie pagina's, maak dan drie taken met dezelfde achtergrond, elk met de eigen "url".\n` +
    `- Site-brede meta- of alt-opruiming over veel pagina's is ÉÉN Dev-taak "Werklijst sitebouwer: meta's en alt-teksten site-breed" zonder url, nooit een stapel losse kaartjes.\n` +
    `- Streef naar 2 tot 6 taken, nooit meer dan 10. Een gesprek dat nergens op uitkomt mag gerust nul taken opleveren; zet dan alles in "geen_taak".\n` +
    `- "week": 1 = deze week, 2 = volgende, enzovoort; realistisch verdeeld. "wie" is "SEO" of "Dev". "taaktype" is één van: meta, alt, copy, intern, strategie, pijplijn, structured, overig.\n\n` +
    `"info" bouw je op in secties met een kort kopje op een eigen regel dat eindigt op een dubbele punt. Eerst "Achtergrond:" met korte puntige regels van hooguit vijftien woorden (wat is er mis, welke cijfers, waarom nu), hooguit vier regels. Dan alleen indien relevant "Afspraken en herkomst:" met '-'-bullets (mail-datum, wie). Dan "Aanpak per fase:" met per regel een '-'-bullet die begint met exact een fasenaam en dubbele punt ("- Analyse: ...", "- Copy: ...", "- Bouw: ..."), alleen voor fases die nodig zijn. Herhaal nooit de titel als bullet en noem een cijfer maar één keer.\n\n` +
    `HET CONCRETE WERK MOET IN DE TAAK ZITTEN, NIET ERNAAR VERWIJZEN (hard, hier ging het mis). Een taak als "stel een redirectlijst op" is waardeloos: dan moet het werk alsnog gedaan worden. Staat de lijst in het gesprek of in de verse overlap-analyse, dan zet je hem VOLUIT in "info" onder het kopje "Redirecttabel:", met per regel exact: "- /bronpad/ -> /doelpad/ (reden; cijfers van die pagina)". Dat is wat de sitebouwer uitvoert zonder na te denken. Hetzelfde geldt voor interne links: onder "Interne links:" per regel "- vanaf /bronpad/ met ankertekst \"...\" naar /doelpad/". Vat NOOIT een tabel samen tot een zin.\n` +
    `NOOIT EEN OPRUIMADVIES ZONDER DE CIJFERS. Stel je voor om een pagina om te leiden of te verwijderen, dan zet je in diezelfde regel wat die pagina NU presteert (eigen sterkste zoekterm, positie, vertoningen) uit de overlap-analyse. Heeft een pagina een eigen sterke zoekterm die de doelpagina niet bedient, dan is omleiden waarschijnlijk FOUT: die zet je niet in de redirecttabel maar noem je in "geen_taak" met de reden dat hij eigen verkeer heeft. Zonder cijfers geen redirect.\n` +
    `IS ER EEN VERSE OVERLAP-ANALYSE MEEGELEVERD, DAN IS DIE LEIDEND boven wat er in het gesprek staat. Het gesprek kan pagina's gemist hebben of een pagina noemen die al omgeleid is. Neem alle concurrenten uit die analyse mee, en laat elke pagina die daar als "AL OMGELEID" staat volledig weg.\n` +
    `VERDER: gebruik alleen paden die letterlijk in het gesprek, de overlap-analyse of de context staan; vorm zelf geen paden. Verzin geen cijfers. Geen emoji, geen Markdown-symbolen (#, | of **) en geen tekst buiten de JSON.`;

  const body = `--- HET GESPREK ---\n${gesprek}${hardeData}\n\n--- EXTRA CONTEXT (alleen voor juiste paden en achtergrond) ---\n${context.slice(0, 6000)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt === 0 ? "" : "\n\nLET OP: je vorige antwoord was geen geldige JSON. Geef nu UITSLUITEND het JSON-object, zonder tekst eromheen.";
    try {
      const raw = await callClaude(system + extra, [{ role: "user", content: body.slice(0, 30000) }], 3500, { slug, action: attempt === 0 ? "overzicht-oogst" : "overzicht-oogst-retry" });
      const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      const parsed = JSON.parse(start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText) as { taken?: unknown; geen_taak?: unknown };

      const taken: OogstTaak[] = (Array.isArray(parsed.taken) ? parsed.taken : [])
        .map((t) => {
          const o = (t || {}) as Record<string, unknown>;
          const taak = String(o.taak || "").replace(/^\s*week\s*\d+\s*[—:-]+\s*/i, "").slice(0, 400).trim();
          if (!taak) return null;
          const zeker = String(o.zekerheid || "").toLowerCase();
          return {
            taak,
            waarom: String(o.waarom || "").slice(0, 400).trim(),
            info: String(o.info || o.toelichting || "").slice(0, 4000).trim() || undefined,
            url: String(o.url || "").slice(0, 400).trim() || undefined,
            taaktype: String(o.taaktype || "").slice(0, 40).trim().toLowerCase() || undefined,
            week: Math.max(1, Math.min(12, Math.round(Number(o.week) || 1))),
            wie: /dev/i.test(String(o.wie || "")) ? "Dev" : "SEO",
            zekerheid: (zeker === "hoog" || zeker === "laag" ? zeker : "middel") as OogstTaak["zekerheid"],
          } as OogstTaak;
        })
        .filter(Boolean)
        .slice(0, 10) as OogstTaak[];

      const geenTaak = (Array.isArray(parsed.geen_taak) ? parsed.geen_taak : [])
        .map((r) => String(r || "").slice(0, 300).trim())
        .filter(Boolean)
        .slice(0, 8);

      // Nul taken is een geldige uitkomst (een gesprek hoeft nergens op uit te komen),
      // maar dan moet er wel íets te zien zijn, anders lijkt het op een fout.
      if (!taken.length && !geenTaak.length) continue;

      // Dezelfde feitencontrole als op een chatantwoord. Die zat er hier nog niet
      // op, waardoor een taak ongemerkt "433 live locaties" kon bevatten.
      const bronnen = gesprek + "\n" + hardeData + "\n" + context;
      const bekendePaden = (await getClientUrls(slug).catch(() => []))
        .map((u) => { try { return new URL(u.url).pathname; } catch { return u.url; } });
      const teToetsen = taken.map((t) => `${t.taak}\n${t.waarom}\n${t.info || ""}`).join("\n") + "\n" + geenTaak.join("\n");
      const controle = controleerAntwoord(teToetsen, bronnen, bekendePaden);
      if (!controle.ok && attempt === 0) continue;   // één keer opnieuw, dan pas doorlaten
      if (!controle.ok) {
        // Tweede poging ook niet rond: benoem het zichtbaar in plaats van te verzwijgen.
        const punten = [...controle.cijfers, ...controle.paden].slice(0, 8).join("; ");
        geenTaak.unshift(`Let op: deze punten zijn niet nagetrokken en kunnen fout zijn: ${punten}. Controleer ze voordat je ze uitvoert.`);
      }

      const oogst: OogstResultaat = { taken, geenTaak };
      const bericht: ChatMessage = { role: "assistant", content: "Voorstel: dit werk volgt uit dit gesprek.", soort: "oogst", oogst };
      await saveChatHistory(slug, thread, [...messages, bericht]);
      return { ok: true, oogst };
    } catch { /* volgende poging */ }
  }
  return { ok: false, error: "Kon geen taken uit dit gesprek halen. Probeer het nog een keer." };
}

/**
 * Stap 3: de taken die Maarten heeft AANGEVINKT als projectkaarten wegzetten.
 * Loopt door dezelfde poort als alle andere kaarten (validateAction/executeAction),
 * zodat bundelen per pagina, padcorrectie en samenvoegen precies gelijk blijven.
 */
export async function zetOogstWeg(slug: string, thread: string, index: number, taken: OogstTaak[]): Promise<{ ok: boolean; added: number; merged: number; error?: string }> {
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, added: 0, merged: 0, error: "Klant niet gevonden." };
  if (!taken.length) return { ok: false, added: 0, merged: 0, error: "Er is niets aangevinkt." };

  const actie = validateAction(
    {
      type: "weekplan_taken",
      taken: taken.map((t) => ({
        taak: t.taak,
        // Zonder eigen achtergrond is het "waarom" nog altijd betere context dan niets.
        info: (t.info || "").trim() || (t.waarom ? `Achtergrond:\n- ${t.waarom}` : ""),
        wie: t.wie, url: t.url, week: t.week, taaktype: t.taaktype,
      })),
    },
    client.domain || "",
    `a${Date.now().toString(36)}_oogst`,
  );
  if (!actie || !actie.taken || !actie.taken.length) return { ok: false, added: 0, merged: 0, error: "De aangevinkte taken waren niet compleet genoeg om kaarten van te maken." };

  const result = await executeAction(slug, actie, thread);
  const mA = /(\d+)\s+nieuwe/.exec(result.message || "");
  const mM = /(\d+)\s+bestaande/.exec(result.message || "");
  const merged = result.ok && mM ? Number(mM[1]) : 0;
  const added = result.ok ? (mA ? Number(mA[1]) : (merged ? 0 : actie.taken.length)) : 0;

  // Het voorstel is verwerkt: markeer het, zodat het na herladen ingeklapt staat
  // en er niet per ongeluk twee keer dezelfde kaarten uit komen.
  if (result.ok) {
    try {
      const msgs = await getChatHistory(slug, thread);
      // De plek kan verschoven zijn (Maarten kan een bericht verwijderd hebben);
      // val dan terug op het laatste voorstel dat nog niet verwerkt is.
      let plek = msgs[index]?.oogst ? index : -1;
      if (plek < 0) for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].oogst && !msgs[i].oogst?.verwerkt) { plek = i; break; } }
      const m = plek >= 0 ? msgs[plek] : null;
      if (m && m.oogst) {
        msgs[plek] = { ...m, oogst: { ...m.oogst, verwerkt: true } };
        await saveChatHistory(slug, thread, msgs);
      }
    } catch { /* markering is bijzaak, de kaarten staan er */ }
  }
  return { ok: result.ok, added, merged, error: result.ok ? undefined : result.message };
}

export async function answerChat(slug: string, messages: ChatMessage[], thread = "algemeen"): Promise<{ ok: boolean; answer?: string; error?: string; actions?: ProposedAction[]; bronnen?: Bron[]; title?: string; summary?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };

  // Thread "ads" = de Ads-assistent, thread "overzicht" = de bird's eye-strateeg;
  // beide hebben eigen grounding en rol. Alle andere threads = volledige projectcontext.
  const isAds = cleanThread(thread) === "ads";
  // "overzicht" én "overzicht:<naam>" (meerdere bird's eye-gesprekken) → bird's eye.
  const isOverview = cleanThread(thread).startsWith("overzicht");
  // Thread "lead" = de leadomgeving: eigen lichte context (dossier + plank),
  // los van alles wat voor bestaande klanten gebouwd is.
  const isLead = cleanThread(thread) === "lead";
  let context = isLead
    ? await buildLeadContext(client)
    : isOverview ? await buildOverviewContext(client) : isAds ? await buildAdsContext(client) : await buildContext(client);
  // Wat je in dit gesprek naar binnen hebt gesleept, leest de assistent mee: de
  // teksten die de klant terugstuurde, de screenshot van het zoekresultaat. Zonder
  // dit blok landde een gedropt bestand wel in het dossier, maar wist het gesprek
  // waarin je het liet vallen er niets van.
  try {
    const bestanden = await getClientFiles(slug, { thread: cleanThread(thread) });
    const blok = bestandenContext(bestanden);
    if (blok) context += "\n\n=== " + blok;
  } catch { /* aanvulling */ }
  // ── Opruimvraag? Dan start de motor, niet het model ────────────────────────
  // Vier keer op rij hetzelfde patroon: iets belangrijks afhankelijk maken van de
  // keuze van het model, en het model kiest het niet. De cannibalisatie-motor bleef
  // op zijn uitkomst van 6 juli staan omdat de chat de tool simpelweg nooit
  // aanriep. Dus doen we het hier, in code, vóór het antwoord begint.
  let opruimBlok = "";
  if (isOverview) {
    const laatste = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (/opruim|redirect|omleid|cannibal|kannibal|in de weg|dunne pagina|concurrerende pagina|dubbel/i.test(laatste)) {
      try {
        const st = await getCannibalAnalysis(client.slug);
        const datum = resultDatum(st);
        const dagen = datum ? (Date.now() - new Date(datum).getTime()) / 86400000 : Infinity;
        if (st.status === "running") {
          opruimBlok = `\n\n=== DE VOLLEDIGE CANNIBALISATIE-ANALYSE DRAAIT OP DIT MOMENT (stap ${st.stap} van ${st.stappen}: ${st.stapLabel}) ===\nZeg tegen Maarten dat de analyse loopt, bij welke stap hij is, en dat hij het straks opnieuw moet vragen. Geef GEEN eigen opruimlijst; die zou onvolledig zijn.`;
        } else if (!st.result || dagen > 7) {
          try { void startCannibalRun(client.slug).then(() => runCannibalRedirect(client.slug)).catch(() => { /* de cron pikt hem op */ }); } catch { /* best effort */ }
          opruimBlok = `\n\n=== DE VOLLEDIGE CANNIBALISATIE-ANALYSE IS ZOJUIST GESTART ===\n${st.result && datum ? `De vorige uitkomst is van ${new Date(datum).toLocaleDateString("nl-NL")}, ${Math.round(dagen)} dagen oud, en wordt NIET gebruikt.` : "Er was nog geen analyse."}\nBEGIN JE ANTWOORD HIERMEE: zeg dat de volledige analyse nu draait, dat het een kwartier tot twintig minuten kost, en dat Maarten het daarna opnieuw moet vragen voor de complete redirectlijst. Geef ondertussen GEEN eigen opruimlijst uit de snelle hulpjes; die is aantoonbaar onvolledig gebleken.`;
        } else {
          const r = st.result;
          const regels = [`\n\n=== VOLLEDIGE CANNIBALISATIE-ANALYSE (${datum ? new Date(datum).toLocaleDateString("nl-NL") : "datum onbekend"}) ===`, `Dit is de complete uitkomst van de motor. NEEM DE REDIRECTMAP LETTERLIJK EN VOLLEDIG OVER, laat geen regel weg en verzin er geen bij. Noem de datum van de analyse.`, r.samenvatting || ""];
          if (r.redirectMap?.length) {
            regels.push(`REDIRECTMAP (${r.redirectMap.length} regels):`);
            for (const m of r.redirectMap) regels.push(`- ${m.van} -> ${m.naar}${m.mergeContent ? " [content samenvoegen]" : ""}${m.reden ? `: ${m.reden}` : ""}`);
          }
          if (r.interneLinks?.length) {
            regels.push(`INTERNE LINKS (${r.interneLinks.length} regels):`);
            for (const l of r.interneLinks) regels.push(`- vanaf ${l.vanaf} naar ${l.naar}${l.ankertekst ? ` met ankertekst "${l.ankertekst}"` : ""}`);
          }
          opruimBlok = regels.join("\n");
        }
      } catch { /* de motor mag een antwoord nooit blokkeren */ }
    }
  }

  const system = isLead
    ? `Je bent een ervaren SEO-consultant van bureau Pingwin en je werkt samen met Maarten aan ${client.name}, een bedrijf dat nog geen klant is. Dit is de werkplek waar alles rond deze lead samenkomt: wat we weten, wat we meten en wat we opleveren.\n\n` +
      `HOE MAARTEN MET JE WERKT (belangrijk):\n` +
      `- Hij dumpt vrij wat hij denkt: wat de klant belangrijk vindt, welke pagina in de analyse moet, wat het budget mag zijn, een stuk van een collega. Er is GEEN vast formaat waar hij zich aan moet houden; jij vist eruit wat waar hoort.\n` +
      `- Vertelt hij iets dat BLIJVEND geldt voor dit bedrijf (hun propositie, een concurrent, wat ze belangrijk vinden, een besluit), bewaar dat dan met bewaar_in_dossier en meld dat in één regel. Gaat het om een instructie voor één document (het budget van dít voorstel, welke pagina erin moet), bewaar dat dan NIET apart maar geef het mee in de opdracht van maak_document.\n` +
      `- Vraagt hij om een document ("maak een voorstel", "werk dit uit"), gebruik dan maak_document en zet ALLES wat hij heeft meegegeven in de opdracht. Vat daarna in een paar regels samen wat erin staat en geef de link. Plak nooit het hele document in de chat.\n\n` +
      `WAT JE WEL EN NIET KUNT METEN BIJ EEN LEAD (hard, hier geen aannames):\n` +
      `- WEL: hun live pagina's uitlezen (meet_pagina), waar hun pagina's op ranken met positie en volume (ahrefs_pagina), de autoriteit van hun domein en dat van concurrenten (ahrefs_site), en de top 10 op een zoekwoord (serp_top10). Dat werkt allemaal zonder toegang van de klant.\n` +
      `- NIET: Search Console en Analytics. Die zijn van hen; wij hebben er geen toegang toe. Gebruik gsc_pagina hier dus niet en beloof nooit cijfers die daar vandaan zouden moeten komen.\n` +
      `- Noem je cijfers in een terugkoppeling of document, zeg er dan bij dat het schattingen van buitenaf zijn. Dat is eerlijk én een verkoopargument: met toegang tot hun eigen cijfers wordt het scherper.\n\n` +
      `HOE JE DENKT:\n` +
      `- Verzin NOOIT cijfers, posities, zoekvolumes, bedragen of bevindingen. Meet het, of zeg dat je het nog niet weet.\n` +
      `- Het dossier hieronder is BEWUST alleen een inhoudsopgave. Moet je weten wat er precies in een stuk staat, haal het dan op met zoek_dossier of lees_dossier. Beweer nooit iets over de inhoud van een stuk dat je niet gelezen hebt.\n` +
      `- Meet uit jezelf voordat je antwoordt. Vraagt Maarten "hoe staat deze landingpagina ervoor", dan meet je hem en vertel je wat je zag; je stelt geen controlevragen die je zelf kunt beantwoorden.\n` +
      `- Denk mee als consultant, niet als uitvoerder: benoem wat je zou doen en waarom, in volgorde van impact.\n\n` +
      `OPMAAK (Nederlands, Markdown, geen emoji):\n` +
      `- Begin direct met de inhoud. Geen aankondigingszinnen zoals "Ik ga even kijken" of "Hier is het resultaat".\n` +
      `- Korte kopjes (## Kop), korte bullets (-), **vet** voor kernfeiten (paginanaam, positie, bedrag, datum). Geen muur tekst.\n` +
      `- Pagina's en paden schrijf je KAAL (bijv. /kozijnen/), die worden automatisch klikbaar. Gebruik geen markdown-linksyntax voor paden.\n` +
      `- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, dubbele punt, haakjes of een nieuwe zin.\n\n` +
      `Mens aan het stuur: jij adviseert, meet en stelt op; Maarten beslist en verstuurt.\n\n--- LEAD-CONTEXT ---\n${context}`
    : isOverview
    ? `Je bent de overkoepelende SEO-strateeg ("bird's eye") van Pingwin voor de klant ${client.name}. Je helpt Maarten vanuit één helder, gestructureerd werkplan bepalen wat we doen, wat er nog moet en waar het laaghangend fruit zit. Dat plan is gegrond in de AFSPRAKEN met de klant (navigatie, zoekwoordenlijst, geplande landingspagina's), niet alleen in snelle winst.\n\n` +
      `GEREEDSCHAP, gebruik het ZELF voordat je antwoordt:\n` +
      `- lees_document: lees de gelinkte Google-strategiedocumenten (navigatie/URL-structuur, zoekwoorden-samenvatting, werkdocument) om de BEDOELING/richting te snappen. Bepaal de huidige stand (bestaat een pagina, hoe rankt hij) NOOIT hieruit, maar uit de live data (meet_pagina, ahrefs_pagina, gsc_pagina). Het document kan maanden oud zijn.\n` +
      `- site_overzicht: het actuele site-brede beeld (werkstatus + laaghangend fruit).\n` +
      `- zoek_mail: haal gericht de laatste mail van een specifiek persoon of over een onderwerp op (bijv. "de laatste mail van Emre en die van Nicolien"), zodat je niet afhankelijk bent van alleen de laatste mails in de context. Gebruik dit als Maarten naar iemands mail of een mailonderwerp verwijst.\n` +
      `- meet_pagina / gsc_pagina / ahrefs_pagina / serp_top10: om een concrete pagina of zoekwoord na te meten.\n\n` +
      `HOE JE DENKT:\n` +
      `- BRON-HIËRARCHIE (belangrijkste regel): baseer je op de MEEST ACTUELE, FEITELIJKE data, in deze volgorde van waarheid: (1) de live site (meet_pagina) en de site-brede werkstatus (site_overzicht); (2) actuele Ahrefs-rankings en Search Console (ahrefs_pagina/gsc_pagina/serp_top10); (3) de recente e-mails en de stand van zaken. Het zoekwoord- of URL-plan (nav-sheet, focus-notities) is de BEDOELING en kan maanden oud zijn: gebruik het om de richting te snappen, maar presenteer het NOOIT als de huidige werkelijkheid en toets het altijd aan de actuele data. Geen shortcuts: beweer je iets over de site, rankings of pagina's, haal het dan uit de actuele bron, niet uit het plan of je geheugen.\n` +
      `- DE CONTEXT HIERONDER BEVAT AL HARDE FEITEN: het blok PAGINA-SIGNALEN (meta leeg/te lang, afbeeldingen zonder alt, orphan-pagina's, "copy aangeleverd maar nog niet live") uit de laatste sitescan, en ZOEKWOORDEN MET STAND (posities en bewegingen) uit Search Console. Dít is je vertrekpunt: gebruik deze feiten direct in je analyse en taken, zodat je terugkoppeling concreet is en niet generiek. Meet pas live (meet_pagina/gsc_pagina) bij als een pagina niet in de signalen staat of je een detail vers wilt bevestigen.\n` +
      `- HOLISTISCH, BIJ ELKE VRAAG: weeg altijd het complete beeld mee (paginasignalen, zoekwoord-standen, laaghangend fruit uit site_overzicht, de afgesproken landingspagina's/zoekwoorden, de mails met klant én sitebouwer, en wat er al gedaan is). Dat geldt niet alleen bij "maak een weekplanning", maar bij elke vraag, ook een losse strategievraag ("moeten we deze pagina toevoegen?").\n` +
      `- STAND VAN ZAKEN DEKT ALTIJD DRIE DELEN: (1) wat staat live en hoe presteert het, (2) wat is aangeleverd maar nog niet verwerkt/live, (3) welke pagina's moeten er nog BIJ of uitgebreid worden om de site autoriteit te geven. Deel (3) mag je NOOIT overslaan en redeneer je HOLISTISCH: weeg het TE BOUWEN-blok, de AFGESPROKEN ZOEKWOORDEN & LINKS (daar staat vaak een uitgewerkte navigatie met veel geplande pagina's), de STAND VAN ZAKEN, de RECENTE E-MAILS, Ahrefs/Search Console én de echte site samen, en bedenk ZELF welke grote landingspagina's en thema's de site nog nodig heeft (bijv. tuinaanleg, bestratingsplan, soorten tuinen). Stel die ook voor als ze in geen enkele lijst staan maar de site ze duidelijk mist voor autoriteit. Noem ze concreet (welke pagina/onderwerp, waarom belangrijk), niet in algemene termen.\n` +
      `- Vertrek vanuit de afgesproken strategie; plaats het laaghangend fruit dáárop, niet los ervan.\n` +
      `- CONTROLEER OF EEN PAGINA BESTAAT, GOK NOOIT. Beweer NOOIT dat een pagina "nog te bouwen" is, "nog niet bestaat" of "geen landingspagina heeft" op basis van alleen de nav-sheet, het plan of je geheugen. Een pagina uit de afgesproken navigatie is misschien allang gebouwd en live. Check het eerst: staat de URL in de live page-lijst (site_overzicht), of meet hem met meet_pagina. Pas als hij aantoonbaar niet leest (bijvoorbeeld 404) noem je hem "te bouwen". Twijfel je, zeg dat dan expliciet ("ik moet even checken of deze al live staat") in plaats van te stellen dat hij niet bestaat. Dit is hard: liever eerlijk twijfelen dan iets onwaars beweren.\n` +
      `- NOEM NOOIT EEN URL OF PAD DAT NIET LETTERLIJK IN DE CONTEXT OF TOOL-UITVOER STAAT. Vorm zelf geen paden (enkelvoud/meervoud, koppeltekens): zoek het juiste pad op in ALLE BEKENDE URL'S VAN DE SITE en gebruik exact dát pad (bijv. /lensimplantatie/edof-lenzen/ en niet /edof-lens/). Staat een onderwerp niet in die lijst, zeg dan expliciet "niet gevonden in de sitemap" en controleer eventueel met meet_pagina; trek nooit conclusies (zoals "bestaat niet") over een pad dat je zelf hebt gevormd.\n` +
      `- CITEER JE EEN MAIL (datum, afzender of onderwerp), zet er dan ALTIJD de mail-link uit de context achter als markdown-link, bijvoorbeeld [mail van 25 juli](https://mail.superhuman.com/...). De link staat per mail in de context als "(mail-link: ...)". Nooit een mail noemen zonder die link als hij er is.\n` +
      `- Vraagt Maarten "waar waren we / wat hebben we gedaan", vat dan concreet samen uit de werkstatus per pagina: wat is geoptimaliseerd, wat loopt, wat staat gepland.\n` +
      `- Werk als proactieve partner: betrek de recente e-mails. Nieuwe wensen, herzieningen, positioneringsvragen of ingevulde formulieren van de klant wegen mee in de strategie; signaleer zelf als een mail iets raakt dat we moeten oppakken of aanpassen.\n` +
      `- Zie je in de mail blijvende nuance die het klantprofiel raakt (positionering, terminologie, no-go's, beslissingen zoals "beplantingsplan geen aparte pagina"), BENOEM dat kort in je tekst en vraag of je het klantprofiel zult bijwerken. Maak de 'profiel_bijwerken'-kaart pas als Maarten ja zegt (hij kan de tekst dan nog bijstellen).\n` +
      `- MAILS: NOOIT EEN NAAM OF AFSPRAAK VERZINNEN BIJ DEZE KLANT. Noem je een mail, dan moet die in de RECENTE E-MAILS van DEZE klant staan. Vind je met zoek_mail iets uit een ander gesprek (bijvoorbeeld over een andere klant of een algemene mail aan een leverancier), gebruik dat dan hooguit als achtergrond en schrijf het NIET toe aan deze klant, en noem er geen personen bij alsof die voor deze klant werken. Bij twijfel laat je de naam weg en schrijf je alleen wat er is afgesproken. Zet bij een mailverwijzing altijd de datum in de vorm 'mail van 5-7', want daarmee wordt hij in het dashboard klikbaar.\n` +
      `- NIET HERHALEN WAT JE AL VERTELD HEBT (hard, dit is de grootste ergernis). Kijk naar je EERDERE antwoorden in dit gesprek. Heb je de paginastand (de tabel met pagina's, posities, vertoningen, klikken, woorden) daar al gegeven, geef die dan NIET opnieuw. Verwijs ernaar in één regel ("de standentabel staat in mijn eerste antwoord") en behandel alleen wat NIEUW is: het antwoord op de gestelde vraag, wat er sindsdien veranderd is, en je oordeel. Een vervolgvraag over één pagina of één zoekwoord verdient een antwoord over díe pagina, niet een compleet nieuw site-overzicht. In een gesprek van vier vragen hoort de complete stand er hooguit ÉÉN keer in te staan.\n` +
      `- GEEF EEN ECHTE, INHOUDELIJKE TERUGKOPPELING (dit wil Maarten zien): je analyse en advies, gegrond in de PAGINA-SIGNALEN, ZOEKWOORDEN MET STAND en de mails. Benoem CONCRETE feiten (welke meta leeg is, welke copy nog niet live bevestigd is, wie welk werk nog open heeft, welke pagina stijgt of daalt, welke mail-opvolging nodig is), niet in vage termen als "strategie + pijplijn". Leesbaar en scanbaar met korte alinea's en kopjes; geen loze zin, maar ook geen eindeloze muur. GEEN DUBBELE LIJST: je tekst-terugkoppeling is de ANALYSE (de stand van zaken). Schrijf de taken en de per-week-planning NIET als tekstlijst (dus geen "Prioriteitsvolgorde"- of "Weekplanning per week"-lijst in de tekst); die komen als kaartjes via 'weekplan_taken'. De redenering/achtergrond per taak (waar komt het vandaan, welke mail, welke links, hoe verhoudt het zich) zet je in het 'info'-veld van die kaart, niet nog eens in de tekst.\n` +
      `- SPARREN IS DE STANDAARD (belangrijkste gedragsregel). Dit is een gesprek tussen twee vakmensen, geen takenfabriek. Geef je analyse, je afweging en je oordeel in gewone tekst; Maarten leest en praat verder. Maak NIET uit jezelf kaarten of taken, en sluit niet standaard af met "zal ik hier taken van maken?". Er staan twee knoppen onder het gesprek waarmee Maarten zelf de conclusie trekt en daarna laat bepalen welk werk eruit volgt; die stappen wegen het HELE gesprek en doen dat beter dan jij halverwege kunt.\n` +
      `- ÉÉN WEDERVRAAG MAG, en is vaak beter dan gokken. Hangt je antwoord wezenlijk af van iets dat je niet kunt opzoeken (een keuze van Maarten of de klant, een voorkeur, een budget of prioriteit), stel dan ÉÉN gerichte vraag terug en geef alvast je beste inschatting erbij. Nooit meerdere vragen tegelijk en nooit een vraag die je zelf kunt beantwoorden met je gereedschap; dan meet je het gewoon.\n` +
      `- Gebruik het gereedschap stel_acties_voor ALLEEN als Maarten er EXPLICIET om vraagt ("maak er een kaart/taak van", "pak dit op", "zet dit door", "ja doe maar", "werk dit uit"). Dus NOOIT uit jezelf een reeks acties genereren; eerst sparren, dan pas op verzoek de kaarten, en alleen voor precies wat hij aangeeft. LET OP: een planning-vraag ("kun je een planning maken", "maak een weekplanning", "maak hier taken van", "wat kunnen we oppakken", "geef een werklijstje") IS zo'n expliciet verzoek; dan maak je de kaarten METEEN (zie WEEKPLANNING), zonder eerst nog te vragen of hij dat wil.\n` +
      `- NIEUWE PAGINA = EERST STRATEGIE (verplicht, met cannibalisatie-check). Voor een nieuwe pagina is de eerste stap NOOIT blauwdruk of copy, maar een doordachte strategie. Doe ZELF eerst de cannibalisatie-check: kijk met ahrefs_pagina/gsc_pagina/serp_top10 (en site_overzicht) of de site al rankt op de doeltermen van de nieuwe pagina. Rankt er al een bestaande pagina hoog op die term (een "pillar"), dan mag de nieuwe pagina die term NIET overnemen; hij moet ondersteunen: afwijkende/specifiekere zoektermen, bij voorkeur een URL als kind onder de pillar, en interne links omhoog naar de pillar. Stel de strategie voor als 'strategie_bepalen'-kaart (bewerkbaar; Maarten past aan/keurt goed). Pas NA goedkeuren mag 'pijplijn_starten' met blauwdruk/copy; stel die dus niet eerder voor. Gooit Maarten een URL of screenshot met "kijk hoe deze rankt", neem die pagina dan mee in de strategie.\n` +
      `- WEEKPLANNING: vraagt Maarten om een planning of taken (bijv. "kun je een planning maken", "maak een weekplanning", "maak hier taken van", "wat kunnen we oppakken", "geef een werklijstje"), geef dan (a) je inhoudelijke terugkoppeling in tekst = ALLEEN de STAND VAN ZAKEN (de analyse), netjes opgemaakt volgens de OPMAAK-regels (blokken met oranje kopjes, streepjes ertussen, bullets, vet, linkjes). GEEN aparte "Prioriteitsvolgorde"- of "Weekplanning per week"-tekstlijst, want dat is de dubbele lijst die Maarten niet wil. EN (b) roep in DEZELFDE beurt 'stel_acties_voor' aan met één 'weekplan_taken': dát is de planning. Per taak: de wie (SEO of Dev), de pagina (url), het taaktype, de week (1 = deze week, 2 = volgende, enzovoort), en in 'info' de VOLLEDIGE achtergrond/redenering (waar komt het vandaan zoals de mail van 30 juli, welke interne links, hoe het zich verhoudt tot andere pagina's, verwachte impact). EEN KAART GAAT OVER PRECIES EEN PAGINA: alle deeltaken voor die pagina (meta, alt, copy, interne links, structured data, bouwen) horen als bullets in de info van die ene kaart, en een aanpak die over meerdere pagina's gaat wordt per pagina een eigen kaart met dezelfde achtergrond. Zet dus nooit meerdere pagina's in een titel, ook niet in het meervoud ('de CRP-pagina's'). De per-week-redenering leeft in de kaarten, niet in je tekst. CRUCIAAL: vraag NIET eerst "zal ik dit in de weekplanning zetten?"; de planning-vraag IS het verzoek, maak de kaarten meteen. Kondig het niet aan, maak ze echt. Roep 'weekplan_taken' in ÉÉN keer aan met alle taken er meteen in (nooit leeg, nooit "in twee stappen"). Eindig je beurt NOOIT met alleen een aankondiging als "hier komt de planning" of "ik ga de kaarten aanmaken" zonder de gevulde tool-aanroep: die gevulde aanroep ÍS de planning. Wordt een actie afgekeurd, doe hem dan in dezelfde beurt opnieuw, correct gevuld.\n` +
      `- GEEN MUUR VAN TAKEN (belangrijk): de rijke context is om te WEGEN, niet om alles wat je signaleert als taak uit te spugen. Kies een behapbaar, op prioriteit gesorteerd geheel (richtlijn: een handvol taken per week, niet elk gevonden kansje). Bouw de prioriteit in deze weging: (1) afspraken met de klant (landingspagina's + zoekwoorden), (2) recente mails / open opvolging, (3) belangrijke pagina's die nog opgezet of geoptimaliseerd moeten worden voor de site (autoriteit), (4) laaghangend fruit als aanvulling. Een mooie mix, van hoog naar laag. Een planning mag enkele weken tot ~twee maanden vooruit reiken (week 1 tot 8+), maar gedoseerd en gemotiveerd, niet alles tegelijk.\n` +
      `- VERSE DATA WINT ALTIJD VAN CONTEXT (harde volgorde). De blokken hieronder zijn een momentopname en kunnen verouderd of onvolledig zijn. Een tool die je NU aanroept geeft de werkelijkheid. Spreken ze elkaar tegen, dan gebruik je de tool-uitkomst en benoem je het verschil ("de opgeslagen scan zei X, live is het Y"); kies nooit stilzwijgend een van beide. Ontbreekt een cijfer in de context, dan is dat GEEN nul: dat is onbekend, en dan haal je het op.\n` +
      `- BIJ EEN CANNIBALISATIE- OF OPRUIMVRAAG BEGIN JE MET cannibalisatie_analyse. Dat is de volledige motor van het dashboard, met URL-flipping over tijd, een complete redirectmap en een interne-linkplan. Draait hij nog, dan zeg je dat en wacht je; je gaat NIET zelf een lijst verzinnen uit de snelle hulpjes. Is hij klaar, dan neem je de redirectmap letterlijk en volledig over.\n` +
      `- BIJ ELKE CANNIBALISATIE- OF OPRUIMVRAAG ROEP JE DAARNAAST DE TOOLS AAN: concurrerende_paginas voor de pagina's in kwestie, EN dunne_paginas voor het site-brede beeld. Dat laatste is vaak waar het antwoord zit: de kleine locatiepaginaatjes zonder eigen zoekterm. Vraagt Maarten "wat zit deze pagina in de weg", dan bedoelt hij bijna altijd ook "wat kan er weg"; geef hem dus beide, met de op te ruimen pagina's BOVENAAN en de pagina's met bestaansrecht kort daaronder.\n` +
      `- OPRUIMEN? GEBRUIK dunne_paginas, NIET concurrerende_paginas. Vraagt Maarten welke pagina's opgeruimd of samengevoegd moeten worden, dan zoek je de ZWAKKE pagina's: die zonder eigen zoekterm. concurrerende_paginas geeft je juist de pagina's die de meeste zoekwoorden delen, en dat zijn meestal de STERKE pagina's die je wilt houden; die als opruimlijst presenteren is fout. Vuistregel: "wat zit deze pagina in de weg" is concurrerende_paginas, "wat kan er weg" is dunne_paginas.\n` +
      `- WELKE PAGINA'S ELKAAR IN DE WEG ZITTEN, ZOEK JE OP MET concurrerende_paginas. NOOIT zelf afleiden uit de URL-lijst. Dat is twee keer misgegaan: pagina's gemist die er echt toe deden, en pagina's verzonnen die niet bestaan. De tool leest Search Console en geeft de VOLLEDIGE lijst; die neem je over zoals hij is.\n` +
      `- GEEN OPRUIMADVIES ZONDER DE CIJFERS VAN DIE PAGINA. Stel je voor een pagina om te leiden of te verwijderen, dan noem je in dezelfde adem wat die pagina nu presteert: zijn eigen sterkste zoekterm, positie en vertoningen. Heeft een pagina een eigen sterke term die de doelpagina niet bedient, dan heeft hij BESTAANSRECHT en leid je hem niet om; zeg dat expliciet. Een pagina wegzetten op basis van "lijkt dun" zonder cijfers doe je nooit.\n` +
      `- GAAT HET OVER EEN PAGINA VERSTERKEN OF INTERNE LINKS, gebruik dan interne_link_kansen. Verzin nooit zelf welke pagina's zouden moeten linken; die analyse weegt autoriteit en relevantie en die van jou niet.\n` +
      `- ELK RANKINGCIJFER KOMT UIT EEN VERSE AANROEP, NOOIT UIT JE HOOFD (hard, hier is het eerder grondig misgegaan). Noem je een positie, een Domain Rating of een aantal verwijzende domeinen, dan heb je in DEZE beurt gsc_pagina, ahrefs_pagina of serp_top10 aangeroepen en neem je het cijfer letterlijk over. Zet er de bron bij, bijvoorbeeld "positie 3,6 (Search Console, 90 dagen)" of "positie 7 (Ahrefs)". Search Console en Ahrefs zijn twee verschillende bronnen die verschillende cijfers geven; haal ze nooit door elkaar en presenteer nooit het ene als het andere. Geeft een bron geen data, schrijf dan "Ahrefs: geen positie bekend". Vul NOOIT een getal in dat plausibel lijkt.\n` +
      `- STATUS VAN EEN PAGINA CONTROLEER JE MET controleer_url, ALTIJD. Voordat je zegt dat een pagina live staat, nog gebouwd moet worden, dun is, een duplicaat is of opgeruimd/omgeleid moet worden: controleer hem. meet_pagina volgt een omleiding en toont dan de inhoud van de DOELpagina; staat er "LET OP, DIT IS EEN OMLEIDING" in de uitvoer, dan is de gevraagde pagina AL opgeruimd en zeg je dat, in plaats van hem als duplicaat op te voeren. Een pagina die in de context onder OMGELEID staat is klaar; die stel je nooit voor om op te ruimen.\n` +
      `- Verzin geen cijfers; noem alleen wat uit de bronnen of het gereedschap komt. Er draait een automatische feitencontrole op je antwoord: elk pad en elk cijfer wordt naast de context en de tool-uitvoer gelegd. Wat daar niet in staat wordt tegengehouden en moet je overdoen. Schrijf dus liever "niet gemeten" dan een getal te gokken.\n\n` +
      // ── Strategisch denken ──
      // De regels hierboven zijn allemaal remmen: niet gokken, niet verzinnen, niet
      // zelf taken maken. Nodig, maar samen maken ze een brave uitvoerder die netjes
      // opsomt wat er is. Wat Maarten mist is het omgekeerde: iemand die zegt dat de
      // hele opzet niet deugt en met een betere komt. Dat is geen extra vrijheid om
      // te gokken (de bronregels blijven onverkort gelden), maar de opdracht om het
      // oordeel er ook echt uit te laten komen.
      `DENK ALS STRATEEG, NIET ALS INVENTARISLIJST (dit is waarvoor dit gesprek bestaat):\n` +
      `- STEL DE OPZET ZELF TER DISCUSSIE. Krijg je een zoekwoordenlijst, een plan of een aanpak voorgelegd, beoordeel dan EERST of het de juiste aanpak is, en pas daarna de invulling. Deugt de opzet niet, zeg dat in de eerste regels, met de reden en met een beter alternatief ernaast. Je bent hier de tegenspraak, niet de uitvoerder van een lijstje dat er al lag.\n` +
      `- VOLUME IS GEEN KANS. Een zoekterm telt pas als de klant hem kan winnen: weeg volume tegen de moeilijkheid (ahrefs_keyword_volume) én tegen de autoriteit van wie er nu staat (serp_top10 plus ahrefs_site_authority op de eigen site én op een paar concurrenten). Moeilijkheid 70 bij een zwak domein is geen kans maar een illusie; zeg dat dan zo.\n` +
      `- LET OP WAT DE SERP ECHT LAAT ZIEN. Staat er bij een lokale zoekterm vooral een kaartblok of andere niet-organische resultaten (te zien aan het type in serp_top10), dan is de winst daar niet een landingspagina maar het Google-bedrijfsprofiel, de reviews en de vindbaarheid op de kaart. Benoem dat in plaats van een pagina voor te stellen die het bovenste deel van het scherm toch niet haalt.\n` +
      `- WEES BEDUCHT OP DE DIENST-MAAL-PLAATS-MATRIX. Vier diensten maal tien plaatsen is veertig dunne, uitwisselbare pagina's die elkaar in de weg zitten en die niemand kan schrijven met echt materiaal. Kies liever weinig pagina's met bestaansrecht: één sterk anker op de thuisplaats, hooguit een paar regiopagina's waar het volume het rechtvaardigt (tel dan de diensten van diezelfde plaats bij elkaar op), en de rest gedekt met echte projectpagina's of casussen. Die zijn uniek, en de plaatsnaam-relevantie krijg je er gratis bij.\n` +
      `- WEEG DE CONCURRENTIE UIT TWEE BRONNEN. De partijen in de top 10 (serp_top10) zijn wie er op déze zoekterm staan; de lijst in de context is wie Maarten als de concurrentie ziet. Die twee zijn niet hetzelfde en je hebt ze allebei nodig. Bij een strategievraag kijk je met concurrent_zoekwoorden waar de aangewezen concurrenten verkeer halen dat wij missen, en zeg je het eerlijk als die lijst nog leeg is.\n` +
      `- ZOEK DE ONDERSCHEIDENDE NICHE. Kijk met ahrefs_keyword_ideas verder dan de lijst die je kreeg: is er een specialisme met landelijk volume, weinig concurrentie en hoge orderwaarde, dan is dát vaak de motor, en is het lokale werk de basis eronder. Waar iemand voor rijdt, is geen lokaal spel.\n` +
      `- ONDERZOEK IS GEEN DOEL. Meten kost tijd, en een antwoord dat er niet komt is niets waard. Haal op wat je nodig hebt voor het oordeel, en begin daarna te schrijven; ga niet door tot je alles van de site weet. Ontbreekt er iets, dan zeg je dat in \u00e9\u00e9n regel en schrijf je verder.\n` +
      `- LEVER EEN GELAAGDE KEUZE MET EEN VOLGORDE, geen waslijst. Zeg wat eerst gebeurt en waarom dat eerst is (opbrengst en haalbaarheid tegen elkaar), en wat je bewust NIET doet, met de reden erbij. Sluit af met één scherpe vraag als het antwoord echt van een keuze van Maarten of van beschikbaar materiaal afhangt.\n\n` +
      `OPMAAK (heel belangrijk voor Maarten, dit moet er verzorgd en scanbaar uitzien, NOOIT een muur lopende tekst). Nederlands, Markdown, geen emoji (dus ook geen vinkjes of kruisjes als tekens; schrijf gewoon "live", "404" of "let op"). Verplichte structuur, elke terugkoppeling:\n` +
      `  - Begin DIRECT met het eerste kopje. GEEN aankondigings- of vulzinnen zoals "Nu heb ik alles wat ik nodig heb" of "Hier de volledige terugkoppeling"; die kosten Maarten alleen leestijd.\n` +
      `  - Deel je antwoord op in BLOKKEN, elk met een eigen gekleurd kopje (## Kop). Zet een scheidingslijn (--- op een eigen regel, wordt een streepje) TUSSEN de blokken.\n` +
      `  - Binnen een blok: korte BULLETS (-), geen lange alinea's. Eén gedachte per bullet.\n` +
      `  - GEEN PREFIXEN zoals "Doen:" of "Vraag:" meer voor een bullet. Schrijf gewoon wat je te zeggen hebt. Welk werk er uit een gesprek volgt bepaalt Maarten met de knop "Welke taken volgen hieruit?", die het HELE gesprek weegt; jij hoeft losse regels dus niet als taak te markeren.\n` +
      `  - **Vet** voor de kernfeiten (paginanaam, positie, aantallen, prijs, datum). Pagina's/URL's/slugs schrijf je KAAL als pad (bijv. /lensimplantatie/); die worden automatisch klikbaar. NOOIT markdown-linksyntax [tekst](/pad/) gebruiken voor paden, dat geeft rommelige brackets in beeld.\n` +
      `  - Een 404 op een pagina die juist NIEUW moet komen (aangevraagd, gepland, blauwdruk klaar) is LOGISCH, geen bevinding: noem die status neutraal "nog te bouwen", niet alarmerend "404 — bestaat niet".\n` +
      `  - Voor cijfervergelijkingen (bijv. wat staat live / hoe presteert het, of een lijst producten/prijzen) een net klein tabelletje (| Kop | Kop |). Gebruik GEEN tabel voor de takenlijst (die komt als kaartjes).\n` +
      `  - Doel: het leest als een verzorgd overzicht met oranje kopjes, streepjes ertussen, vet en linkjes, niet als een lap tekst.\n` +
      `Mens aan het stuur: jij adviseert en stelt voor, Maarten beslist.\n\n--- OVERZICHT-CONTEXT ---\n${context}${opruimBlok}`
    : isAds
    ? `Je bent de Google Ads-specialist van Pingwin voor de klant ${client.name}. ` +
      `Je helpt Maarten beoordelen wat er in het Ads-account gebeurt en wordt geoptimaliseerd, wat er beter kan en welke vragen hij het Ads-bureau moet stellen. ` +
      `Baseer je op de onderstaande Ads-context (via de GA4-koppeling; wees eerlijk over wat daar NÍET in zit).\n\n` +
      `OPMAAK: schrijf conversationeel en netjes, zoals in een chat, in Markdown. Geen emoji. Korte alinea's, bullets (-) voor opsommingen, **vet** voor kernpunten, en cijfers of campagne-vergelijkingen in een nette Markdown-tabel.\n\n` +
      `WERKWIJZE: jij bent de specialist; geef ANTWOORDEN en concrete optimalisatie-adviezen (budgetverdeling over campagnes, stilgevallen of juist nieuwe campagnes, kosten per conversie, opvallende verschuivingen), in volgorde van impact. ` +
      `Je kunt met meet_pagina zelf landingspagina's uitlezen om de aansluiting tussen advertentie en pagina te beoordelen. ` +
      `Sluit waar zinvol af met de vragen die Maarten aan de Ads-beheerder kan stellen. Hooguit één korte wedervraag, alleen bij een echte keuze.\n\n--- ADS-CONTEXT ---\n${context}`
    : `Je bent de SEO-projectassistent van Pingwin voor de klant ${client.name}. ` +
    `Beantwoord in het Nederlands, uitsluitend op basis van de onderstaande projectcontext ` +
    `(e-mails inclusief afzender/ontvangers en inhoud, stand van zaken, taken, Search Console incl. 4-maanden zoekwoord-trend, Ahrefs, en Google Ads-prestaties per campagne via de GA4-koppeling).\n\n` +
    `OPMAAK: schrijf conversationeel en netjes, zoals in een chat, in Markdown. Geen emoji.\n` +
    `- Schrijf in korte alinea's. Gebruik een kopje (## Kop) alleen als je antwoord echt meerdere onderwerpen behandelt; bij een kort antwoord geen kop.\n` +
    `- Gebruik bullets (-) voor opsommingen en **vet** voor labels/kernpunten.\n` +
    `- Zet cijfermatige of vergelijkende data (zoals zoekwoord-posities per maand, klikken, CTR) in een nette Markdown-tabel met uitgelijnde kolommen, bijvoorbeeld:\n` +
    `  | Zoekwoord | apr | mei | jun |\n  | --- | --- | --- | --- |\n  | soa test amsterdam | 9 | 7 | 6 |\n` +
    `- Houd zinnen kort en groepeer logisch. Sluit af met een kort actiepunt als dat past.\n\n` +
    `Noem waar relevant het mail-onderwerp, de datum of de ontvanger (bv. of een mail naar de klant of naar jezelf ging). ` +
    `Staat het antwoord niet in de context, zeg dat eerlijk in plaats van te gokken.\n\n` +
    `WERKWIJZE (belangrijk): jij bent de specialist; Maarten wil ANTWOORDEN, geen vragenlijsten.\n` +
    `- Je hebt gereedschap om ZELF te kijken: meet_pagina (content/koppen/meta/links van een URL), gsc_pagina (zoekwoorden per pagina), ahrefs_pagina (posities, volume en verwijzende domeinen van een pagina), serp_top10 (de concurrentie op een zoekwoord) en zoek_mail (de mailwisseling met deze klant doorzoeken op naam, onderwerp of trefwoord; noem bij het citeren van een mail altijd de mail-link uit de uitvoer als markdown-link). GEBRUIK dat gereedschap eerst, en beantwoord de vraag daarna onderbouwd met wat je zag.\n` +
    `- Stel NOOIT een lijst controlevragen die je zelf kunt beantwoorden (zoals "staat het zoekwoord in de H1?" of "hoeveel backlinks heeft de pagina?"): meet het en vertel het resultaat.\n` +
    `- Enkelvoud/meervoud en andere woordvormen tellen als GEDEKT: "veranda's" in een H1 dekt het zoekwoord "veranda" gewoon af (Google begrijpt woordvormen). Zeg dus nooit "het zoekwoord ontbreekt in de H1" als alleen de woordvorm verschilt; beoordeel koppen op kern-overlap en op een onderscheidende propositie.\n` +
    `- Trek zelf de conclusie en sluit af met concrete aanbevelingen in volgorde van impact. Hooguit \u00e9\u00e9n korte vraag, alleen als een echte keuze bij Maarten ligt.\n\n--- PROJECTCONTEXT ---\n${context}`;

  try {
    // Agentisch: de assistent kan zelf meten (pagina, GSC, Ahrefs, top-10) vóór hij
    // antwoordt. Vision-berichten (afbeelding) gaan als content-blokken mee.
    // Het takenvoorstel is een scherm-element, geen gespreksbeurt: die placeholder
    // ("Voorstel: dit werk volgt uit dit gesprek.") hoort niet in de context.
    // Oudere antwoorden gaan INGEKORT mee (kopjes plus de eerste regels). Zonder
    // dat las de assistent bij elke vraag zes eigen rapporten terug en schreef er
    // een zevende bij dat alles herhaalde; twee opeenvolgende antwoorden vertelden
    // dan hetzelfde verhaal. Je eigen vragen en het laatste antwoord blijven heel.
    const apiMessages = korteGeschiedenis(messages.filter((m) => m.soort !== "oogst").slice(-10) as ChatMsg[]).map((m: ChatMsg & { images?: string[]; image?: string }) => {
      const imgs = [...(m.images || []), ...(m.image ? [m.image] : [])];
      const blocks = imgs
        .map((im) => im.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i))
        .filter((x): x is RegExpMatchArray => !!x)
        .map((x) => ({ type: "image", source: { type: "base64", media_type: x[1], data: x[2] } }));
      if (!blocks.length) return { role: m.role, content: m.content };
      return {
        role: m.role,
        content: [
          ...blocks,
          { type: "text", text: m.content || (blocks.length > 1 ? "Bekijk deze afbeeldingen en betrek ze bij het gesprek." : "Bekijk deze afbeelding en betrek hem bij het gesprek.") },
        ] as unknown as string,
      };
    });
    const base = chatTools(client);
    const collected: ProposedAction[] = [];
    const { tools, run: rawRun } = isLead ? leadTools(client, base) : isOverview ? overviewTools(client, base, collected) : base;
    // Alles wat het gereedschap in DEZE beurt teruggaf, bewaren. Dat is samen met
    // de context het enige bewijsmateriaal; de feitencontrole hieronder toetst het
    // antwoord daartegen.
    const toolUitvoer: string[] = [];
    // Waar het antwoord op steunt, in gewone taal. Wordt onder het antwoord getoond
    // (ingeklapt) zodat te zien is of er echt gemeten is, en waar een cijfer vandaan komt.
    const bronnen: Bron[] = [];
    const run: ToolRunner = async (naam, invoer) => {
      const uit = await rawRun(naam, invoer);
      toolUitvoer.push(`[${naam}] ${uit}`);
      try {
        const b = bronVan(naam, invoer as Record<string, unknown>, client.domain || undefined);
        if (b) bronnen.push(b);
      } catch { /* de bronnenstrip mag een antwoord nooit blokkeren */ }
      return uit;
    };
    // De chat geeft gewoon zijn rijke agentische antwoord (dat Maarten goed vindt). De
    // taak-kaarten worden NIET meer hier auto-gegenereerd (te fragiel); dat doet de
    // deterministische knop "Zet de taken in de weekplanning" (weekplanFromAnswer) op verzoek.
    // Ruimte om de vraag áf te maken. Het oude plafond (12 rondes voor de bird's eye,
    // 6 voor de projectchat) was de reden dat goede antwoorden halverwege eindigden met
    // "zal ik dat nog nakijken?": dat was niet twijfel, dat was "ik zat vol". Een echte
    // strategievraag over zes landingspagina's kost al gauw dertig stappen.
    //
    // De klok eronder is de rem: de route mag 300 seconden duren, dus rondt de agent
    // vanaf 190 seconden af met wat hij heeft in plaats van te worden afgekapt. Daarna
    // is er nog tijd over voor de afrondings- en feitencontrole-rondes hieronder.
    const startTijd = Date.now();
    // Elke extra ronde hieronder (afronden, uitschrijven, feitencontrole) is een
    // model-aanroep van tientallen seconden. Die klokken stonden los van elkaar op
    // 240 en 265 seconden, en werden gestart zonder te kijken hoe laat het al was.
    // Samen liepen ze zo over de 300 seconden die de route mag duren; dan hakt het
    // platform de functie om en krijgt de browser geen antwoord meer, ook geen
    // foutmelding. Dus: een ronde begint alleen nog als er ook echt tijd voor is.
    // Een compleet antwoord met een ongecontroleerd cijfer is beter dan niets.
    const ruimteVoorRonde = (nodigMs: number) => Date.now() + nodigMs < startTijd + 270_000;
    const rondes = isOverview ? 26 : isLead ? 18 : 14;
    // Diep denken: alleen de bird's eye draait op het zware model, want dat is het
    // gesprek waarin de opzet zelf ter discussie staat. Uit te zetten in de kop van
    // Overview; kent het account het model niet, dan zakt hij automatisch een trede.
    const zwaar = isOverview && (await diepDenkenAan()) ? HEAVY_MODEL : undefined;
    let answer = await callClaudeAgentic(system, apiMessages as { role: "user" | "assistant"; content: string }[], tools, run, rondes, isOverview ? 3200 : isLead ? 3000 : 2000, { slug, action: isOverview ? "overzicht-chat" : isLead ? "lead-chat" : isAds ? "ads-chat" : "projectchat" }, startTijd + (isOverview ? 155_000 : 190_000), zwaar);

    // ── Vangnet: eenentwintig bronnen en dan geen antwoord ──────────────────
    // Het onderzoek lukte, het opschrijven niet: de rondes of de tijd waren op en
    // wat overbleef was de melding "kon het niet netjes afronden". Alles wat de
    // agent had opgehaald werd dan weggegooid. Nu schrijven we het antwoord alsnog
    // uit dat materiaal, in één ronde zonder gereedschap, dus zonder nieuwe
    // vertraging en zonder dat er een cijfer bij kan komen dat niemand ophaalde.
    if (isOverview && answer.trim() === GEEN_ANTWOORD && toolUitvoer.length && ruimteVoorRonde(45_000)) {
      try {
        const vraag = [...messages].reverse().find((m) => m.role === "user")?.content || "";
        const materiaal = toolUitvoer.join("\n").slice(-24000);
        const uit = await callClaude(
          system,
          [{ role: "user", content: `De vraag van Maarten was:\n${vraag}\n\nDit is alles wat er in deze beurt is opgezocht (${toolUitvoer.length} keer gereedschap gebruikt):\n${materiaal}\n\nSchrijf NU het antwoord, volledig, volgens de OPMAAK-regels. Gebruik uitsluitend wat hierboven staat; is iets niet opgehaald, zeg dan dat je het niet gemeten hebt. Geen aankondigingszinnen, begin direct met het eerste kopje.` }],
          3500, { slug, action: "overzicht-chat-uitschrijven" }, zwaar,
        );
        if (uit && uit.trim()) answer = uit.trim();
      } catch { /* dan blijft de melding staan */ }
    }
    // Lukte ook dat niet, leg het dan vast in plaats van het te laten verdampen.
    // Zonder dit spoor kun je achteraf alleen gissen welke stap de tekst opat, en
    // dat is precies wat er op 6 augustus gebeurde: de melding was het enige wat
    // er nog was. Nu staat er een regel in het verbruikscherm.
    if (isOverview && answer.trim() === GEEN_ANTWOORD) {
      try {
        const { logUsage } = await import("./usage");
        await logUsage({ slug, service: "anthropic", action: `overzicht-chat-geen-antwoord (${toolUitvoer.length} keer gereedschap gebruikt)`, model: zwaar || "standaard", tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0 });
      } catch { /* meten mag de chat niet breken */ }
    }

    // Vangnet: eindigt het antwoord als alleen een aankondiging ("Nu heb ik alles…",
    // "Hier is de volledige analyse…") zonder de echte inhoud, forceer dan één
    // afrondingsronde. Dit gebeurde als de agent al zijn rondes aan tools opmaakte.
    const alleenAankondiging = (s: string) => {
      const t = (s || "").trim();
      if (!t) return true;
      return t.length < 400 && !/(^|\n)##\s/.test(t) && /(nu heb ik|hier (is|komt|volgt)|hieronder (volgt|staat)|ik ga (nu )?)/i.test(t);
    };
    if (isOverview && alleenAankondiging(answer) && ruimteVoorRonde(60_000)) {
      try {
        const vervolg = await callClaudeAgentic(
          system,
          [...(apiMessages as { role: "user" | "assistant"; content: string }[]), { role: "assistant", content: answer || "(aankondiging zonder inhoud)" }, { role: "user", content: "Je vorige beurt bevatte alleen een aankondiging zonder de inhoud. Geef NU in één keer de volledige terugkoppeling volgens de OPMAAK-regels, beginnend met het eerste kopje. Geen aankondigings- of vulzinnen." }],
          tools, run, 6, 3200, { slug, action: "overzicht-chat-afronding" }, startTijd + 240_000, zwaar,
        );
        if (vervolg && vervolg.trim() !== GEEN_ANTWOORD && vervolg.trim().length > (answer || "").trim().length) answer = vervolg;
      } catch { /* dan het oorspronkelijke antwoord */ }
    }

    // Aankondigings-/vulzinnen aan het begin ook uit de OPGESLAGEN tekst knippen,
    // zodat nieuwe antwoorden schoon de historie in gaan (de weergave filtert
    // daarnaast retroactief voor oude berichten).
    if (isOverview && answer) {
      const regels = answer.split("\n");
      let i = 0;
      while (i < regels.length) {
        const r = regels[i].trim();
        if (!r) { i++; continue; }
        if (r.length < 160 && !/^##/.test(r) && /^(nu heb ik|hier (is|komt|volgt)|hieronder (volgt|staat)|prima[,.]|ok[eé][,.]|goed[,.]|helder[,.! ]|ik ga (nu )?)/i.test(r)) { i++; continue; }
        break;
      }
      const rest = regels.slice(i).join("\n").trim();
      if (rest) answer = rest;
    }

    // ── Feitencontrole: geen cijfer of pad zonder bron ──────────────────────
    // Dit is de rem die er niet was. De prompt zei al "verzin geen cijfers"; dat
    // hield niets tegen. Nu wordt het antwoord getoetst aan de context plus wat
    // de tools echt teruggaven, en moet het over als er iets niet klopt.
    if (isOverview && answer) {
      try {
        const bekendePaden = (await getClientUrls(client.slug).catch(() => []))
          .map((u) => { try { return new URL(u.url).pathname; } catch { return u.url; } });
        const bronnen = context + "\n" + toolUitvoer.join("\n");
        let controle = controleerAntwoord(answer, bronnen, bekendePaden);
        // De controle zelf is rekenwerk en kost geen tijd; alleen de HERSTELronde
        // is een model-aanroep. Is de tijd op, dan slaan we die over en blijft de
        // waarschuwingsregel hieronder over: dan zie je wél dat een cijfer niet
        // nagetrokken is, in plaats van dat je helemaal geen antwoord krijgt.
        if (!controle.ok) {
          if (ruimteVoorRonde(60_000)) {
            const hersteld = await callClaudeAgentic(
              system,
              [...(apiMessages as { role: "user" | "assistant"; content: string }[]),
               { role: "assistant", content: answer },
               { role: "user", content: herstelOpdracht(controle) }],
              tools, run, 6, 3200, { slug, action: "overzicht-chat-feitencontrole" }, startTijd + 265_000, zwaar,
            );
            // De herstelronde verving het antwoord ONVOORWAARDELIJK. Kwam die ronde
            // zelf niet rond (tijd op), dan werd een compleet antwoord vervangen door
            // de melding "kon het niet netjes afronden". Dat is precies wat Maarten
            // op 6 augustus in beeld kreeg na eenentwintig geraadpleegde bronnen.
            if (hersteld && hersteld.trim() && hersteld.trim() !== GEEN_ANTWOORD) {
              const naControle = controleerAntwoord(hersteld, context + "\n" + toolUitvoer.join("\n"), bekendePaden);
              answer = hersteld;
              controle = naControle;
            }
          }
          // Nog steeds niet rond (of geen tijd meer om het over te doen)? Dan
          // verzwijgen we dat niet, maar zetten we er één korte regel boven wat er
          // niet is nagetrokken. Liever een zichtbare waarschuwing dan een cijfer
          // dat betrouwbaar lijkt. Per cijfer de ECHTE bron noemen (niet steeds
          // alle drie opsommen), zodat dit geen lap generieke tekst wordt die je
          // iedere keer weg moet lezen.
          if (!controle.ok) {
            const cijferDelen = controle.cijfers.map((c) => {
              const label = Object.keys(CIJFER_BRON).find((l) => c.startsWith(l + " "));
              return `${c} (${label ? CIJFER_BRON[label] : "bron"})`;
            });
            const padDelen = controle.paden.map((p) => `${p} (niet op de site gevonden)`);
            const punten = [...cijferDelen, ...padDelen];
            answer = `**Let op, niet bevestigd:** ${punten.join("; ")}. Vraag na te meten.\n\n${answer}`;
          }
        }
      } catch { /* de controle mag een antwoord nooit helemaal blokkeren */ }
    }

    const finalAnswer = answer || "(geen antwoord)";
    const gebruikteBronnen = ontdubbel(bronnen);
    const assistantMsg: ChatMessage = { role: "assistant", content: finalAnswer };
    if (collected.length) assistantMsg.actions = collected;
    if (gebruikteBronnen.length) assistantMsg.bronnen = gebruikteBronnen;
    await saveChatHistory(slug, thread, [...messages, assistantMsg]);
    let meta: { title?: string; summary?: string } = {};
    if (isOverview) { try { meta = await autoTopicMeta(slug, thread, [...messages, assistantMsg]); } catch { /* meta optioneel */ } }
    return { ok: true, answer: finalAnswer, actions: collected.length ? collected : undefined, bronnen: gebruikteBronnen.length ? gebruikteBronnen : undefined, title: meta.title, summary: meta.summary };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}
