import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getEmails, getMetrics, getKeywords, getStatus } from "./snapshots";
import { msStatus, msSearchClientEmails } from "./ms-graph";
import { getClientUrls } from "./site-urls";
import { googleStatus, getGscForClient, getGscKeywordTrend, getGscForPage } from "./google";
import { measurePage } from "./page-measure";
import { metaVerdictText } from "./meta-rules";
import { getUrlOrganicKeywords, getSerpOverview, getAhrefsTopPages, ahrefsConfigured } from "./ahrefs";
import { callClaudeAgentic, callClaude, LIGHT_MODEL, type ToolDef, type ToolRunner } from "./anthropic";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "./sheet";
import { getFocus } from "./focus";
import { buildOverview, overviewToText, getPageWorkStatus, pageWorkStatusToText } from "./overview";
import { buildPageSignalsText, buildKeywordStandText, buildTeBouwenText } from "./page-signals";
import { readDriveDoc } from "./drive";
import { validateAction, executeAction, type ProposedAction } from "./overview-actions";
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
  emails = emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));
  if (emails.length > 0) {
    parts.push("\nRECENTE E-MAILS (nieuwste eerst, met afzender/ontvangers en inhoud):");
    for (const e of emails.slice(0, 10)) {
      const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
      const date = e.receivedAt ? new Date(e.receivedAt).toLocaleString("nl-NL") : "";
      const to = (e.toAddresses || []).join(", ");
      const bodyText = (stripHtml(e.bodyHtml || "") || e.preview || "").replace(/\s+/g, " ").trim().slice(0, 700);
      parts.push(
        `--- [${dir}, ${date}] Onderwerp: ${e.subject || "(geen onderwerp)"}\n` +
        `Van: ${e.fromAddress || "?"}${to ? ` | Aan: ${to}` : ""}\n` +
        `Inhoud: ${bodyText}`,
      );
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
  try {
    const urls = await getClientUrls(client.slug);
    if (urls.length) {
      const paden = urls.map((u) => { try { return new URL(u.url).pathname; } catch { return u.url; } });
      const nieuwste = urls.map((u) => u.lastScanned || "").filter(Boolean).sort().pop() || "";
      const datum = nieuwste ? new Date(nieuwste).toLocaleDateString("nl-NL") : "onbekend";
      parts.push(
        `\n=== ALLE BEKENDE URL'S VAN DE SITE (paden uit de sitemap/scan; URL-status laatst gescand: ${datum}) ===\n` +
        paden.slice(0, 250).join(", ").slice(0, 5000)
      );
    }
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
  const prof = (client.seoProfile || "").trim();
  if (prof) parts.push("\n=== KLANTPROFIEL (positionering/werkgebied) ===\n" + prof.slice(0, 2500));
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
    emails = emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));
    if (emails.length) {
      // Ruim meegeven (niet te kort afkappen), zodat de agent volledige mails ziet
      // en er echte concept-antwoorden op kan maken.
      const lines = emails.slice(0, 6).map((e) => {
        const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
        const date = e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("nl-NL") : "";
        const body = (stripHtml(e.bodyHtml || "") || e.preview || "").replace(/\s+/g, " ").trim().slice(0, 3000);
        // Superhuman-deeplink gaat voor (daar werkt Maarten); Outlook-webLink als terugval.
        const link = ((e as { superhumanLink?: string | null }).superhumanLink || e.webLink || "").trim();
        return `[${dir}, ${date}] ${e.subject || "(geen onderwerp)"}${link ? `\n(mail-link: ${link})` : ""}:\n${body}`;
      });
      parts.push("\n=== RECENTE E-MAILS (basisinfo; nieuwste eerst; neem relevante punten en herzieningen mee in de strategie) ===\n" + lines.join("\n"));
    }
  } catch { /* aanvulling */ }
  try {
    const { status } = await getStatus(client.slug);
    if (status.exchanges.length) parts.push("\n=== STAND VAN ZAKEN ===\n" + status.exchanges.map((ex) => `[${ex.side === "client" ? "KLANT" : "WIJ"}, ${ex.status === "done" ? "afgehandeld" : "OPEN"}] ${ex.text}`).join("\n"));
  } catch { /* aanvulling */ }
  try { const tasks = await sheetTaskLines(client); if (tasks.length) parts.push("\n=== LOPENDE WERKZAAMHEDEN (huidige maand) ===\n" + tasks.join("\n")); } catch { /* aanvulling */ }
  return parts.join("\n");
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
      taken: { type: "array", description: "Alleen bij weekplan_taken: de lijst projectkaarten die uit dit gesprek volgen. VERPLICHT gevuld: roep weekplan_taken NOOIT met een lege of ontbrekende 'taken' aan (dan wordt de actie afgekeurd). Zet in ÉÉN aanroep meteen alles erin, elk met minimaal 'taak', 'week' en 'info'. BUNDEL-REGELS: maak per pagina PRECIES ÉÉN kaart in totaal, over alle weken heen ('week' is de startweek); NOOIT meerdere pagina's of paden in één kaart of kaarttitel (gaat een aanpak over meerdere pagina's, maak dan per pagina een eigen kaart met dezelfde achtergrond); alle deeltaken voor die pagina (meta, alt-teksten, copy, interne links, structured data, bouwen/publiceren) zet je als '-'-bullets in 'info' van die ene paginakaart, NIET als losse items. Ook opvolg-mails of referenties die bij een pagina horen zijn GEEN eigen item: zet ze als achtergrond-bullet in de paginakaart. Alleen echt werk zonder pagina krijgt een eigen item zonder url (zeldzaam). Streef naar 3 tot 6 kaarten in totaal, maximaal 10. Bouw 'info' op in secties met korte kopjes op een eigen regel eindigend op een dubbele punt: 'Achtergrond:' (korte puntige regels van elk hooguit vijftien woorden: wat is er mis, cijfers, waarom nu), alleen indien relevant 'Afspraken en herkomst:' met '-'-bullets (mail-datum, wie), en 'Aanpak per fase:' met per regel een '-'-bullet die begint met exact een fasenaam plus dubbele punt ('- Analyse: ...', '- Blauwdruk: ...', '- Copy: ...', '- Bouw: ...', '- Structured data: ...'), alleen voor fases die nodig zijn; micro-taken bij de juiste fase-regel (meta bij Copy, alt-teksten/interne links bij Bouw). Herhaal nooit de kaarttitel als bullet.", items: { type: "object", properties: { taak: { type: "string", description: "Korte, concrete taaktitel (één regel). Zet GEEN 'WEEK X' in de titel; de week geef je apart mee in 'week'." }, week: { type: "integer", description: "In welke week deze taak valt: 1 = deze week, 2 = volgende week, enzovoort. Verdeel de taken realistisch over de komende weken." }, info: { type: "string", description: "Alle relevante info/achtergrond bij deze taak: waar komt het vandaan (bijv. de mail van 30 juli), waarom, welke zoektermen/pagina, de aanpak, hoe het zich verhoudt tot andere pagina's, de cannibalisatie-nuance, verwachte impact. Dit is de achtergrond die op de kaart komt, dus volledig. Nette leesbare tekst met korte kopregels en '-'-bullets (geen #, | of **)." }, wie: { type: "string", enum: ["SEO", "Dev"], description: "Wie voert de taak uit." }, url: { type: "string", description: "Optioneel: de pagina waar de taak over gaat." }, taaktype: { type: "string", enum: ["meta", "alt", "copy", "intern", "strategie", "pijplijn", "structured", "overig"], description: "Het type taak, zodat de kaart naar de juiste plek in het dashboard kan deep-linken (meta → Meta & CTR-tab, enz.). meta=meta-title/description, alt=alt-teksten, copy=copy schrijven/controleren, intern=interne links, strategie=strategie bepalen, pijplijn=blauwdruk/copy genereren, structured=structured data, overig=anders." }, bronMail: { type: "string", description: "Optioneel: de webLink van de mail waar deze taak uit voortkomt (die staat bij de RECENTE E-MAILS in de context als 'link: ...'). Zo linkt de kaart direct naar die mail." } }, required: ["taak"] } },
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

// image/images: optionele afbeeldingen (data-URL's, al verkleind in de browser) bij
// een user-bericht. "image" blijft bestaan voor oude opgeslagen gesprekken.
export type ChatMessage = { role: "user" | "assistant"; content: string; image?: string; images?: string[]; actions?: ProposedAction[] };

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
    { name: "gsc_pagina", description: "Search Console-zoekwoorden van één pagina (laatste 90 dagen): zoekwoord, klikken, vertoningen, positie.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "ahrefs_pagina", description: "Ahrefs-gegevens van één pagina: organische zoekwoorden met positie/volume/verkeer, plus het aantal verwijzende domeinen (externe autoriteit) van die pagina.", input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL of pad" } }, required: ["url"] } },
    { name: "serp_top10", description: "De actuele top 10 van Google voor een zoekwoord (NL): positie, URL, titel, domain rating en resultaattype. Gebruik dit ZELF om de concurrentie te beoordelen.", input_schema: { type: "object", properties: { zoekwoord: { type: "string" } }, required: ["zoekwoord"] } },
    { name: "zoek_mail", description: "Zoekt gericht in de mail van deze klant op een naam, e-mailadres, onderwerp of trefwoord (bijv. 'Emre', 'Nicolien' of 'lenzen') en geeft de gevonden mails terug (afzender, datum, onderwerp, volledige inhoud, mail-link). Gebruik dit om de laatste mail van een specifiek persoon of over een onderwerp op te halen.", input_schema: { type: "object", properties: { zoekterm: { type: "string", description: "Naam, e-mailadres, onderwerp of trefwoord" } }, required: ["zoekterm"] } },
  ];
  const run: ToolRunner = async (name, input) => {
    try {
      if (name === "meet_pagina") {
        const m = await measurePage(toFull(String(input.url || "")), { staticOnly: true });
        if (!m.ok) return `Pagina niet leesbaar (status ${m.status ?? "?"}).`;
        const normImg = (f: string) => f.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
        const imgUniek = new Set(m.images.map((i) => normImg(i.file))).size;
        const imgUniekNoAlt = new Set(m.images.filter((i) => !i.hasAlt || !i.alt.trim()).map((i) => normImg(i.file))).size;
        return [
          `Status ${m.status}. Title (${metaVerdictText("meta_title", m.metaTitle)}): ${m.metaTitle}`,
          `Meta-description (${metaVerdictText("meta_description", m.metaDescription)}): ${m.metaDescription}`,
          `H1: ${m.h1.join(" | ") || "(geen)"}`,
          `H2 (${m.h2.length}): ${m.h2.join(" | ")}`,
          `H3 (${m.h3.length}): ${m.h3.slice(0, 15).join(" | ")}`,
          `Woorden: ${m.wordCount}. Interne links: ${m.internalLinkCount}, extern: ${m.externalLinkCount}.`,
          `Afbeeldingen: ${imgUniek} uniek${m.images.length > imgUniek ? ` (${m.images.length} img-tags incl. responsive/lazyload-varianten)` : ""}, zonder alt: ${imgUniekNoAlt} uniek. FAQ: ${m.faqDetected ? `ja (${m.faqCount})` : "nee"}. Schema: ${m.schemaTypes.join(", ") || "geen"}.`,
        ].join("\n");
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
        return `Verwijzende domeinen naar deze pagina: ${rd ?? "onbekend"}.\n${kwText}`;
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
    `- Streef naar 3 tot 6 kaarten in totaal, nooit meer dan 10. Liever één stevige paginakaart met zes bullets dan zes losse snippers.\n` +
    `- "taaktype" van een gebundelde paginakaart: kies het zwaartepunt (meestal "pijplijn" als er analyse/blauwdruk/copy/bouw in zit, anders het meest voorkomende type).\n` +
    `Verder: "week" is een getal (1 = deze week, 2 = volgende, enzovoort); neem de startweek over zoals de tekst die aangeeft, anders realistisch. "wie" is "SEO" of "Dev". "taaktype" is één van: meta, alt, copy, intern, strategie, pijplijn, structured, overig. Bouw "info" op in secties, elk met een kort kopje op een eigen regel dat eindigt op een dubbele punt. Eerst "Achtergrond:" met korte, puntige regels: elk punt één zin van hooguit vijftien woorden; splits een lang verhaal in meerdere korte punten (wat is er mis, welke cijfers, cannibalisatie-nuance, waarom nu). Dan alleen als er afspraken of bronnen zijn "Afspraken en herkomst:" met '-'-bullets (mail-datum, wie, referenties). Daarna "Aanpak per fase:" met per regel een '-'-bullet die begint met exact een fasenaam en dubbele punt, alleen voor fases die nodig zijn: "- Analyse: ...", "- Blauwdruk: ...", "- Copy: ...", "- Bouw: ...", "- Structured data: ...". Micro-taken horen bij de juiste fase-regel (meta-title/description bij Copy; alt-teksten, interne links en andere developer-punten bij Bouw). Herhaal nooit de kaarttitel als bullet en beschrijf een fase nooit dubbel. Verzin geen cijfers; gebruik alleen wat in de tekst staat. Geen emoji, geen Markdown-symbolen (#, | of **), geen tekst buiten de JSON.`;
  // Enkel-modus (per-punt-knopje): één punt in, precies één kaart uit.
  const enkelRegel = enkel
    ? `\nENKEL-MODUS, overschrijft het aantal: de tekst hieronder is ÉÉN punt uit een analyse. Maak er PRECIES ÉÉN kaart van; alleen als het punt expliciet meerdere pagina's noemt, maak je één kaart per genoemde pagina. Gebruik hetzelfde info-formaat (Achtergrond:, alleen indien relevant Afspraken en herkomst:, Aanpak per fase:). Gaat het punt over een specifieke pagina, vul dan de "url" in.`
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

export async function answerChat(slug: string, messages: ChatMessage[], thread = "algemeen"): Promise<{ ok: boolean; answer?: string; error?: string; actions?: ProposedAction[]; title?: string; summary?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };

  // Thread "ads" = de Ads-assistent, thread "overzicht" = de bird's eye-strateeg;
  // beide hebben eigen grounding en rol. Alle andere threads = volledige projectcontext.
  const isAds = cleanThread(thread) === "ads";
  // "overzicht" én "overzicht:<naam>" (meerdere bird's eye-gesprekken) → bird's eye.
  const isOverview = cleanThread(thread).startsWith("overzicht");
  const context = isOverview ? await buildOverviewContext(client) : isAds ? await buildAdsContext(client) : await buildContext(client);
  const system = isOverview
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
      `- GEEF EEN ECHTE, INHOUDELIJKE TERUGKOPPELING (dit wil Maarten zien): je analyse en advies, gegrond in de PAGINA-SIGNALEN, ZOEKWOORDEN MET STAND en de mails. Benoem CONCRETE feiten (welke meta leeg is, welke copy nog niet live bevestigd is, wie welk werk nog open heeft, welke pagina stijgt of daalt, welke mail-opvolging nodig is), niet in vage termen als "strategie + pijplijn". Leesbaar en scanbaar met korte alinea's en kopjes; geen loze zin, maar ook geen eindeloze muur. GEEN DUBBELE LIJST: je tekst-terugkoppeling is de ANALYSE (de stand van zaken). Schrijf de taken en de per-week-planning NIET als tekstlijst (dus geen "Prioriteitsvolgorde"- of "Weekplanning per week"-lijst in de tekst); die komen als kaartjes via 'weekplan_taken'. De redenering/achtergrond per taak (waar komt het vandaan, welke mail, welke links, hoe verhoudt het zich) zet je in het 'info'-veld van die kaart, niet nog eens in de tekst.\n` +
      `- Bij een OPEN vraag of sparren (dus GEEN planning/taken-verzoek) spar je alleen in gewone tekst: geef een heldere terugkoppeling (netjes opgemaakt, belangrijkste eerst), zonder kaarten aan te maken. Vat bondig samen wat je zou doen (bijvoorbeeld "twee nieuwe URL's aanmaken, één bestaande pagina met een toelichting bijwerken") en vraag of Maarten daar kaarten/taken van wil. Vraagt hij wél om een planning of taken, dan geldt WEEKPLANNING hieronder: dan maak je de kaarten meteen.\n` +
      `- Gebruik het gereedschap stel_acties_voor ALLEEN als Maarten er EXPLICIET om vraagt ("maak er een kaart/taak van", "pak dit op", "zet dit door", "ja doe maar", "werk dit uit"). Dus NOOIT uit jezelf een reeks acties genereren; eerst sparren, dan pas op verzoek de kaarten, en alleen voor precies wat hij aangeeft. LET OP: een planning-vraag ("kun je een planning maken", "maak een weekplanning", "maak hier taken van", "wat kunnen we oppakken", "geef een werklijstje") IS zo'n expliciet verzoek; dan maak je de kaarten METEEN (zie WEEKPLANNING), zonder eerst nog te vragen of hij dat wil.\n` +
      `- NIEUWE PAGINA = EERST STRATEGIE (verplicht, met cannibalisatie-check). Voor een nieuwe pagina is de eerste stap NOOIT blauwdruk of copy, maar een doordachte strategie. Doe ZELF eerst de cannibalisatie-check: kijk met ahrefs_pagina/gsc_pagina/serp_top10 (en site_overzicht) of de site al rankt op de doeltermen van de nieuwe pagina. Rankt er al een bestaande pagina hoog op die term (een "pillar"), dan mag de nieuwe pagina die term NIET overnemen; hij moet ondersteunen: afwijkende/specifiekere zoektermen, bij voorkeur een URL als kind onder de pillar, en interne links omhoog naar de pillar. Stel de strategie voor als 'strategie_bepalen'-kaart (bewerkbaar; Maarten past aan/keurt goed). Pas NA goedkeuren mag 'pijplijn_starten' met blauwdruk/copy; stel die dus niet eerder voor. Gooit Maarten een URL of screenshot met "kijk hoe deze rankt", neem die pagina dan mee in de strategie.\n` +
      `- WEEKPLANNING: vraagt Maarten om een planning of taken (bijv. "kun je een planning maken", "maak een weekplanning", "maak hier taken van", "wat kunnen we oppakken", "geef een werklijstje"), geef dan (a) je inhoudelijke terugkoppeling in tekst = ALLEEN de STAND VAN ZAKEN (de analyse), netjes opgemaakt volgens de OPMAAK-regels (blokken met oranje kopjes, streepjes ertussen, bullets, vet, linkjes). GEEN aparte "Prioriteitsvolgorde"- of "Weekplanning per week"-tekstlijst, want dat is de dubbele lijst die Maarten niet wil. EN (b) roep in DEZELFDE beurt 'stel_acties_voor' aan met één 'weekplan_taken': dát is de planning. Per taak: de wie (SEO of Dev), de pagina (url), het taaktype, de week (1 = deze week, 2 = volgende, enzovoort), en in 'info' de VOLLEDIGE achtergrond/redenering (waar komt het vandaan zoals de mail van 30 juli, welke interne links, hoe het zich verhoudt tot andere pagina's, verwachte impact). Elke losse taak is een aparte kaart in de juiste week; de per-week-redenering leeft dus in de kaarten, niet in je tekst. CRUCIAAL: vraag NIET eerst "zal ik dit in de weekplanning zetten?"; de planning-vraag IS het verzoek, maak de kaarten meteen. Kondig het niet aan, maak ze echt. Roep 'weekplan_taken' in ÉÉN keer aan met alle taken er meteen in (nooit leeg, nooit "in twee stappen"). Eindig je beurt NOOIT met alleen een aankondiging als "hier komt de planning" of "ik ga de kaarten aanmaken" zonder de gevulde tool-aanroep: die gevulde aanroep ÍS de planning. Wordt een actie afgekeurd, doe hem dan in dezelfde beurt opnieuw, correct gevuld.\n` +
      `- GEEN MUUR VAN TAKEN (belangrijk): de rijke context is om te WEGEN, niet om alles wat je signaleert als taak uit te spugen. Kies een behapbaar, op prioriteit gesorteerd geheel (richtlijn: een handvol taken per week, niet elk gevonden kansje). Bouw de prioriteit in deze weging: (1) afspraken met de klant (landingspagina's + zoekwoorden), (2) recente mails / open opvolging, (3) belangrijke pagina's die nog opgezet of geoptimaliseerd moeten worden voor de site (autoriteit), (4) laaghangend fruit als aanvulling. Een mooie mix, van hoog naar laag. Een planning mag enkele weken tot ~twee maanden vooruit reiken (week 1 tot 8+), maar gedoseerd en gemotiveerd, niet alles tegelijk.\n` +
      `- Verzin geen cijfers; noem alleen wat uit de bronnen of het gereedschap komt.\n\n` +
      `OPMAAK (heel belangrijk voor Maarten, dit moet er verzorgd en scanbaar uitzien, NOOIT een muur lopende tekst). Nederlands, Markdown, geen emoji. Verplichte structuur, elke terugkoppeling:\n` +
      `  - Begin DIRECT met het eerste kopje. GEEN aankondigings- of vulzinnen zoals "Nu heb ik alles wat ik nodig heb" of "Hier de volledige terugkoppeling"; die kosten Maarten alleen leestijd.\n` +
      `  - Deel je antwoord op in BLOKKEN, elk met een eigen gekleurd kopje (## Kop). Zet een scheidingslijn (--- op een eigen regel, wordt een streepje) TUSSEN de blokken.\n` +
      `  - Binnen een blok: korte BULLETS (-), geen lange alinea's. Eén gedachte per bullet.\n` +
      `  - **Vet** voor de kernfeiten (paginanaam, positie, aantallen, prijs, datum). Pagina's/URL's/slugs schrijf je KAAL als pad (bijv. /lensimplantatie/); die worden automatisch klikbaar. NOOIT markdown-linksyntax [tekst](/pad/) gebruiken voor paden, dat geeft rommelige brackets in beeld.\n` +
      `  - Een 404 op een pagina die juist NIEUW moet komen (aangevraagd, gepland, blauwdruk klaar) is LOGISCH, geen bevinding: noem die status neutraal "nog te bouwen", niet alarmerend "404 — bestaat niet".\n` +
      `  - Voor cijfervergelijkingen (bijv. wat staat live / hoe presteert het, of een lijst producten/prijzen) een net klein tabelletje (| Kop | Kop |). Gebruik GEEN tabel voor de takenlijst (die komt als kaartjes).\n` +
      `  - Doel: het leest als een verzorgd overzicht met oranje kopjes, streepjes ertussen, vet en linkjes, niet als een lap tekst.\n` +
      `Mens aan het stuur: jij adviseert en stelt voor, Maarten beslist.\n\n--- OVERZICHT-CONTEXT ---\n${context}`
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
    const apiMessages = messages.slice(-10).map((m) => {
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
    const { tools, run } = isOverview ? overviewTools(client, base, collected) : base;
    // De chat geeft gewoon zijn rijke agentische antwoord (dat Maarten goed vindt). De
    // taak-kaarten worden NIET meer hier auto-gegenereerd (te fragiel); dat doet de
    // deterministische knop "Zet de taken in de weekplanning" (weekplanFromAnswer) op verzoek.
    let answer = await callClaudeAgentic(system, apiMessages as { role: "user" | "assistant"; content: string }[], tools, run, isOverview ? 12 : 6, isOverview ? 3200 : 2000, { slug, action: isOverview ? "overzicht-chat" : isAds ? "ads-chat" : "projectchat" });

    // Vangnet: eindigt het antwoord als alleen een aankondiging ("Nu heb ik alles…",
    // "Hier is de volledige analyse…") zonder de echte inhoud, forceer dan één
    // afrondingsronde. Dit gebeurde als de agent al zijn rondes aan tools opmaakte.
    const alleenAankondiging = (s: string) => {
      const t = (s || "").trim();
      if (!t) return true;
      return t.length < 400 && !/(^|\n)##\s/.test(t) && /(nu heb ik|hier (is|komt|volgt)|hieronder (volgt|staat)|ik ga (nu )?)/i.test(t);
    };
    if (isOverview && alleenAankondiging(answer)) {
      try {
        const vervolg = await callClaudeAgentic(
          system,
          [...(apiMessages as { role: "user" | "assistant"; content: string }[]), { role: "assistant", content: answer || "(aankondiging zonder inhoud)" }, { role: "user", content: "Je vorige beurt bevatte alleen een aankondiging zonder de inhoud. Geef NU in één keer de volledige terugkoppeling volgens de OPMAAK-regels, beginnend met het eerste kopje. Geen aankondigings- of vulzinnen." }],
          tools, run, 6, 3200, { slug, action: "overzicht-chat-afronding" },
        );
        if (vervolg && vervolg.trim().length > (answer || "").trim().length) answer = vervolg;
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

    const finalAnswer = answer || "(geen antwoord)";
    const assistantMsg: ChatMessage = collected.length ? { role: "assistant", content: finalAnswer, actions: collected } : { role: "assistant", content: finalAnswer };
    await saveChatHistory(slug, thread, [...messages, assistantMsg]);
    let meta: { title?: string; summary?: string } = {};
    if (isOverview) { try { meta = await autoTopicMeta(slug, thread, [...messages, assistantMsg]); } catch { /* meta optioneel */ } }
    return { ok: true, answer: finalAnswer, actions: collected.length ? collected : undefined, title: meta.title, summary: meta.summary };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}
