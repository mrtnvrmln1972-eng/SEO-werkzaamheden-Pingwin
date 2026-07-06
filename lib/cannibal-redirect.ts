import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscForPage, getGscKeywordUrlFlips } from "./google";
import { getAhrefsTopPages, getUrlOrganicKeywords, ahrefsConfigured } from "./ahrefs";
import { fetchPageContent } from "./page-content";
import { callClaudeAgentic, type ToolDef, type ToolRunner } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// KEYWORD-CANNIBALISATIE-ANALYSE (dashboard-integratie van de skill)
// ═══════════════════════════════════════════════════════════
// Dit draait EXACT de methodiek uit de agentic skill
// `skills/keyword-cannibalisatie-analyse` (SKILL.md + output-schema.md). Die
// bestanden zijn de enige bron van waarheid: pas je de skill aan, dan verandert
// zowel de Cowork-versie als deze dashboard-versie mee. Het dashboard levert de
// data via de eigen connectoren: per pagina de Ahrefs-zoekwoorden met positie
// (de motor die onthult welke pagina op welk merk+geo-zoekwoord rankt), de GSC-
// matrix + flip-tijdreeks, en Ahrefs-volumes. De gedeelde zoekwoorden (meerdere
// pagina's op één term) worden in code voorgekauwd: dat zijn de cannibalisatie-
// kandidaten, zoals in de handmatige Excel-analyse.
// ═══════════════════════════════════════════════════════════

// --- Output-schema-types (spiegel van references/output-schema.md) ---------
export type ClusterUrl = {
  url: string; rol?: string; positie?: number; klikken?: number; impressies?: number;
  verwijzendeDomeinen?: number; intentie?: string;
};
export type ClusterSignalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
export type RedirectCluster = {
  keyword: string; volume?: number; score?: string; signalen?: ClusterSignalen; intentie?: string;
  urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string;
};
export type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; reden?: string };
export type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
export type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
export type CannibalResult = {
  samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: RedirectCluster[];
  redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null;
};
export type CannibalState = { status: "idle" | "running" | "done" | "error"; result: CannibalResult | null; error: string; updatedAt: string | null };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_cannibal_analysis (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

function pagePath(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || ""); }

// Laadt de skill (methodiek + output-schema) van schijf. Dit is de single source
// of truth die zowel Cowork als het dashboard draaien.
let skillCache: string | null = null;
function loadSkillMethodology(): string {
  if (skillCache != null) return skillCache;
  try {
    const base = path.join(process.cwd(), "skills", "keyword-cannibalisatie-analyse");
    const skill = fs.readFileSync(path.join(base, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const schema = fs.readFileSync(path.join(base, "references", "output-schema.md"), "utf8");
    skillCache = `${skill}\n\n---\n\n${schema}`;
  } catch {
    skillCache = "";
  }
  return skillCache;
}

export async function getCannibalAnalysis(slug: string): Promise<CannibalState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, result, error, updated_at FROM client_cannibal_analysis WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: null, error: "", updatedAt: null };
  let result: CannibalResult | null = null;
  try { result = r.result ? JSON.parse(r.result as string) : null; } catch { result = null; }
  return {
    status: (r.status as CannibalState["status"]) || "idle",
    result,
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function setState(slug: string, status: string, result: CannibalResult | null, error: string): Promise<void> {
  await sql`
    INSERT INTO client_cannibal_analysis (client_slug, status, result, error, updated_at)
    VALUES (${slug}, ${status}, ${result ? JSON.stringify(result) : null}, ${error || null}, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = ${status}, result = ${result ? JSON.stringify(result) : null}, error = ${error || null}, updated_at = now()`;
}

// Zet de run op 'running' (aangeroepen door de start-endpoint; het echte werk draait
// daarna via waitUntil in runCannibalRedirect).
export async function markCannibalRunning(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const cur = await getCannibalAnalysis(slug);
  await setState(slug, "running", cur.result, ""); // behoud het vorige resultaat tijdens het draaien
}

// De opdracht bovenop de skill-methodiek: draai op deze concrete data en lever
// uitsluitend de JSON uit het output-schema terug.
function buildSystemPrompt(): string {
  const methodology = loadSkillMethodology();
  const head = methodology
    ? `Je voert de volgende agentic skill uit. Dit is je volledige methodiek en je output-schema; volg het strikt.\n\n${methodology}`
    : `Je bent een senior SEO-specialist. Voer een keyword-cannibalisatie-analyse uit volgens de standaardmethodiek (URL-flip-detectie, positie-plafond, klik-verdeling, intentie-check, winnaar-weging, beslisboom).`;
  return `${head}

---

UITVOERING IN HET PINGWIN-DASHBOARD (AGENTISCH):
Je hebt tools om de data ZELF op te halen, net zoals in Cowork. Verzin niets; haal op wat je nodig hebt en redeneer per cluster. Werk grondig zoals een handmatige analyse, niet oppervlakkig.
Werkwijze:
1. Begin breed: roep ahrefs_pages (zonder filter) aan voor de sterkste pagina's, en site_urls voor de volledige paginalijst (inclusief pagina's zonder verkeer, dat zijn vaak lege duplicaten).
2. Herken de winnaar-pagina's (de hoofd-locatie-/dienstpagina's) en zoek daarna per plaats/thema gericht met ahrefs_pages(filter: "<plaats>") en site_urls(filter: "<plaats>") naar concurrerende of duplicaat-pagina's. Let op het patroon waar de handmatige analyse op draait: een omliggende-plaats- of variant-pagina waarvan het top-zoekwoord de merk+geo-term van een GROTE stad is (bijv. buitenwijkpagina met top-zoekwoord "merk grote-stad" of "soa test grote-stad").
3. Zoom in met ahrefs_url_keywords op verdachte pagina's om te zien op welke merk+geo-termen ze (mede) ranken, ook waar ze niet de winnaar zijn. Bevestig echte tractie met gsc_page_queries en instabiliteit met gsc_url_flips.
4. Bij twijfel over intentie: fetch_page_content om te bepalen of twee pagina's dezelfde intentie bedienen (echte cannibalisatie) of niet (false positive).
5. Ga alle plaats-/thema-clusters langs voordat je afrondt.
Regels:
- Neem in "clusters" ALLEEN echte cannibalisatie op (hard signaal + overlappende intentie). Informatieve blog naast een transactionele pagina = geen cannibalisatie.
- Winnaar-weging: verwijzende domeinen (zwaarst) > organische tractie > businesswaarde. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige pagina. Gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410 (behoud de verwijzende domeinen). Herken meerdere URL-varianten per plaats (kliniek-/poli-/test-) als duplicaten.
- Vul per cluster "signalen" (urlFlip/flipsIn90d, positiePlafond 5-20, klikVerdeling) en per URL "verwijzendeDomeinen" in. Vul "datakwaliteit" eerlijk in op basis van wat de tools teruggaven: gsc, gscTijdreeks, ahrefsZoekwoorden (kwam ahrefs_pages met data?), ahrefsBacklinks (kwamen er verwijzende domeinen mee?), crawl=false. Bleven de Ahrefs-tools leeg, meld dat expliciet in de samenvatting en verzin geen clusters.
- Lever HELEMAAL AAN HET EIND je antwoord als UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

// De tools die de agent zelf mag aanroepen om data te vergaren (net als de chat).
const CANNIBAL_TOOLS: ToolDef[] = [
  { name: "ahrefs_pages", description: "Ahrefs top-pagina's van het klantdomein: per pagina het top-zoekwoord met positie, organisch verkeer, verwijzende domeinen en aantal zoekwoorden. Optioneel 'filter' (substring, matcht op URL-pad OF top-zoekwoord, hoofdletterongevoelig) om per plaats/thema te zoeken, bijv. 'rotterdam' of 'soa-poli'. Dit is je primaire bron: welke pagina rankt op welk merk+geo-zoekwoord, en hoe sterk qua backlinks.", input_schema: { type: "object", properties: { filter: { type: "string" } } } },
  { name: "site_urls", description: "De volledige lijst live-URL's van de klant (uit de crawl), met HTTP-status en Search Console-klikken/vertoningen. Bevat OOK pagina's zonder verkeer (lege duplicaten die Ahrefs/GSC missen). Optioneel 'filter' (substring op pad). Gebruik om duplicaat-varianten per plaats te vinden (kliniek-/poli-/test-).", input_schema: { type: "object", properties: { filter: { type: "string" } } } },
  { name: "ahrefs_url_keywords", description: "Alle zoekwoorden waarop één specifieke URL organisch rankt (positie, volume, verkeer), uit Ahrefs. Gebruik om in te zoomen op een verdachte pagina en te zien op welke merk+geo-termen hij (mede) rankt, ook waar hij niet de winnaar is. Geef het pad, bijv. /soa-poli-gouda/.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "gsc_page_queries", description: "De echte Search Console-zoekwoorden voor één pagina (klikken, vertoningen, gemiddelde positie, 90 dagen). Gebruik voor de echte Google-tractie en om positie/intentie te bevestigen. Geef het pad.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "gsc_url_flips", description: "URL-flip-tijdreeks: per zoekwoord of de top-rankende URL wisselde over 3 vensters van ~30 dagen (het sterkste cannibalisatie-signaal). Geen input nodig.", input_schema: { type: "object", properties: {} } },
  { name: "fetch_page_content", description: "De on-page inhoud van een pagina (titel, meta, H1, koppen, kern van de tekst) om de zoekintentie te bepalen. Cruciaal om echte cannibalisatie (zelfde intentie) te scheiden van false positives (andere intentie). Geef het pad of de volledige URL.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
];

// Bouwt de tool-uitvoerder, vastgeklonken aan deze klant + domein.
function makeCannibalRunner(slug: string, domain: string): ToolRunner {
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  const toFull = (u: string) => (u || "").startsWith("http") ? u : `https://${bare}${(u || "").startsWith("/") ? "" : "/"}${u || ""}`;
  return async (name, input) => {
    if (name === "ahrefs_pages") {
      const pages = await getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>);
      const f = String(input.filter || "").toLowerCase();
      let rows = f ? pages.filter((p) => p.url.toLowerCase().includes(f) || p.topKeyword.toLowerCase().includes(f)) : pages;
      rows = rows.sort((a, b) => (b.traffic || 0) - (a.traffic || 0)).slice(0, 70);
      return rows.length ? rows.map((p) => `${pagePath(p.url)} | top:"${p.topKeyword}" pos ${p.position ?? "?"} | ${p.traffic ?? 0} verkeer | ${p.refDomains ?? "?"} refdom | ${p.keywords ?? "?"}kw`).join("\n") : "(geen pagina's gevonden)";
    }
    if (name === "site_urls") {
      const urls = await getClientUrls(slug).catch(() => []);
      const f = String(input.filter || "").toLowerCase();
      let rows = f ? urls.filter((u) => pagePath(u.url).toLowerCase().includes(f)) : urls;
      rows = rows.sort((a, b) => b.gscClicks - a.gscClicks).slice(0, 100);
      return rows.length ? rows.map((u) => `${pagePath(u.url)} | status ${u.status ?? "?"} | ${u.gscClicks} clicks | ${u.gscImpressions} impr`).join("\n") : "(geen URL's)";
    }
    if (name === "ahrefs_url_keywords") {
      const kws = await getUrlOrganicKeywords(toFull(String(input.url || "")), "nl", 40).catch(() => []);
      return kws.length ? kws.map((k) => `"${k.keyword}" pos ${k.position ?? "?"} vol ${k.volume ?? "?"} verkeer ${k.traffic ?? "?"}`).join("\n") : "(geen Ahrefs-zoekwoorden voor deze URL)";
    }
    if (name === "gsc_page_queries") {
      const rows = await getGscForPage(domain, toFull(String(input.url || "")), 90).catch(() => []);
      return rows.length ? rows.map((r) => `"${r.keyword}" pos ${r.position} ${r.clicks} clicks ${r.impressions} impr`).join("\n") : "(geen GSC-data voor deze URL)";
    }
    if (name === "gsc_url_flips") {
      const flips = await getGscKeywordUrlFlips(domain, 3).catch(() => []);
      return flips.length ? flips.slice(0, 60).map((f) => `"${f.keyword}": ${f.topUrls.join(" -> ")} (${f.flips}x)`).join("\n") : "(geen URL-flips gevonden)";
    }
    if (name === "fetch_page_content") {
      const c = await fetchPageContent(toFull(String(input.url || ""))).catch(() => null);
      if (!c) return "(kon pagina niet ophalen)";
      return `titel: ${c.title}\nH1: ${c.h1}\nkoppen: ${c.headings.slice(0, 10).join(" | ")}\ntekst: ${c.text.slice(0, 1200)}`;
    }
    return "(onbekende tool)";
  };
}

// Draait de echte analyse AGENTISCH: de agent haalt de data zelf op via de tools
// (zoals Cowork), en levert aan het eind de JSON. Idempotent qua opslag.
export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }
    if (!ahrefsConfigured()) { await setState(slug, "error", null, "Hiervoor is een AHREFS_API_TOKEN nodig in Vercel."); return; }

    const firstMsg = `Analyseer keyword-cannibalisatie voor ${client?.name || slug} (domein: ${domain}). Haal de data zelf op met de tools: begin met ahrefs_pages() en site_urls(), zoek dan per plaats/thema, controleer intentie waar nodig, en lever tot slot UITSLUITEND de JSON volgens het output-schema.`;
    // maxRounds bewust begrensd zodat de agentische loop binnen de 300s-functielimiet
    // blijft; per ronde mag de agent meerdere tools parallel aanroepen, dus dit is ruim.
    const raw = await callClaudeAgentic(buildSystemPrompt(), [{ role: "user", content: firstMsg }], CANNIBAL_TOOLS, makeCannibalRunner(slug, domain), 12, 8000, { slug, action: "cannibal_redirect" });

    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    let parsed: { samenvatting?: unknown; datakwaliteit?: unknown; clusters?: unknown; redirectMap?: unknown; interneLinks?: unknown };
    try { parsed = JSON.parse(jsonText); } catch { await setState(slug, "error", null, "De analyse kwam niet als geldige JSON terug. Probeer het opnieuw."); return; }

    const result: CannibalResult = {
      samenvatting: typeof parsed.samenvatting === "string" ? parsed.samenvatting : "",
      datakwaliteit: parsed.datakwaliteit && typeof parsed.datakwaliteit === "object" ? (parsed.datakwaliteit as Datakwaliteit) : undefined,
      clusters: Array.isArray(parsed.clusters) ? (parsed.clusters as RedirectCluster[]) : [],
      redirectMap: Array.isArray(parsed.redirectMap) ? (parsed.redirectMap as RedirectMapItem[]) : [],
      interneLinks: Array.isArray(parsed.interneLinks) ? (parsed.interneLinks as InterneLink[]) : [],
      generatedAt: new Date().toISOString(),
    };
    await setState(slug, "done", result, "");
  } catch (e) {
    try { await setState(slug, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}
