import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscQueryPageMatrix, getGscKeywordUrlFlips } from "./google";
import { getAhrefsKeywords } from "./ahrefs-keywords";
import { getAhrefsTopPages, ahrefsConfigured } from "./ahrefs";
import { callClaude } from "./anthropic";

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

UITVOERING IN HET PINGWIN-DASHBOARD:
Je draait nu binnen het dashboard. De data hieronder is al voor je verzameld via de dashboard-connectoren. Redeneer per cluster over deze data; verzin niets bij.
- Je BELANGRIJKSTE bron is de sectie AHREFS PER PAGINA: per pagina het top-zoekwoord met positie, verkeer en verwijzende domeinen. Bouw je clusters primair hieruit door pagina's te groeperen waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft. Search Console is aanvullend, want het mist juist de long-tail merk+geo-termen waar de cannibalisatie zit.
- Let bij een lokaal/multi-locatie bedrijf specifiek op het patroon waar de handmatige analyses op draaien: een omliggende-plaats- of variant-pagina waarvan het top-zoekwoord de merk+geo-term van een GROTE stad is (bijv. een buitenwijkpagina met top-zoekwoord "merk grote-stad" of "soa test grote-stad"). De hoofd-stadspagina (hoogste positie, meeste verwijzende domeinen/verkeer) is dan de winnaar; de kaper krijgt "de-optimaliseren" (merk+grote-stad-term weghalen) of een 301 als het een duplicaat zonder eigen waarde is. Herken meerdere URL-varianten per plaats (kliniek-/poli-/test-varianten) als duplicaten.
- Neem in "clusters" ALLEEN echte cannibalisatie op (minstens één hard signaal + overlappende intentie). Twee pagina's met verschillende intentie (informatieve blog naast transactionele pagina) horen er NIET in.
- Vul "signalen" op basis van de flip-tijdreeks (urlFlip/flipsIn90d), de posities (positiePlafond 5-20) en de klik-verdeling. Zet "ahrefsZoekwoorden": true.
- Je HEBT nu verwijzende domeinen per pagina (kolom "verw.domeinen"). Gebruik die als zwaarste factor voor de winnaar-weging en vul "verwijzendeDomeinen" per URL in. Zet "ahrefsBacklinks": true. Let op: de pagina met de meeste verwijzende domeinen is niet altijd de beste bestemming; bij een sterke maar verkeerde pagina redirect je de link-rijke pagina naar de businesswaardige pagina. Bij gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410 (behoud de verwijzende domeinen).
- Antwoord met UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

// Draait de echte analyse en slaat het resultaat op. Idempotent qua opslag.
export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }

    const [urls, matrix, flips, ahref] = await Promise.all([
      getClientUrls(slug),
      getGscQueryPageMatrix(domain, 90, 400).catch(() => [] as { keyword: string; page: string; clicks: number; impressions: number; position: number }[]),
      getGscKeywordUrlFlips(domain, 3).catch(() => [] as { keyword: string; topUrls: string[]; flips: number }[]),
      getAhrefsKeywords(slug).catch(() => []),
    ]);
    const volMap = new Map(ahref.map((k) => [k.keyword.toLowerCase(), k.volume]));

    // Ahrefs top-pagina's in ÉÉN call: per pagina het top-zoekwoord + positie, verkeer
    // en verwijzende domeinen. Dit is de motor van de analyse (de handmatige Excel
    // draait hier ook op): welke pagina rankt op welk merk+geo-zoekwoord, en hoe sterk
    // is de pagina qua backlinks. Search Console mist juist die long-tail geo-termen.
    let topPages: Awaited<ReturnType<typeof getAhrefsTopPages>> = [];
    if (ahrefsConfigured()) { try { topPages = await getAhrefsTopPages(domain, 300); } catch { topPages = []; } }
    const refDomMap = new Map<string, number>();
    for (const t of topPages) { const p = pagePath(t.url); if (t.refDomains != null) refDomMap.set(p, t.refDomains); }
    const hasAhrefsKw = topPages.length > 0;
    const hasRefDom = topPages.some((t) => t.refDomains != null);

    // De Ahrefs per-pagina-tabel: gesorteerd op verkeer. Dit is de primaire bron.
    const ahrefsLines = [...topPages]
      .sort((a, b) => (b.traffic || 0) - (a.traffic || 0))
      .slice(0, 260)
      .map((t) => `- ${pagePath(t.url)} | top: "${t.topKeyword}" pos ${t.position ?? "?"} | ${t.traffic ?? 0} Ahrefs-verkeer | ${t.refDomains ?? "?"} verw.domeinen | ${t.keywords ?? "?"} kw`);

    const pageLines = [...urls]
      .sort((a, b) => b.gscClicks - a.gscClicks)
      .slice(0, 250)
      .map((u) => `- ${pagePath(u.url)} | status ${u.status ?? "?"} | ${u.gscClicks} clicks | ${u.gscImpressions} vertoningen${u.title ? ` | "${u.title}"` : ""}`);

    const matrixLines = [...matrix]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 400)
      .map((m) => {
        const vol = volMap.get(m.keyword.toLowerCase());
        return `- "${m.keyword}"${vol != null ? ` (vol ${vol})` : ""} -> ${pagePath(m.page)} | pos ${m.position} | ${m.clicks} clicks | ${m.impressions} vertoningen`;
      });

    // Flip-tijdreeks: per zoekwoord welke URL de top-rankende was in 3 opeenvolgende
    // ~30-daagse vensters (nieuw -> oud). ≥2 verschillende = URL-flipping.
    const flipLines = [...flips]
      .slice(0, 80)
      .map((f) => `- "${f.keyword}": ${f.topUrls.join("  →  ")}  (${f.flips} wissel${f.flips === 1 ? "" : "s"} in 90d)`);

    const hasGsc = matrix.length > 0;
    const hasFlips = flips.length > 0 || matrix.length > 0; // de flip-query draaide als er GSC is
    const context = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      "",
      "DATAKWALITEIT (neem dit over in het veld datakwaliteit): " +
        `gsc=${hasGsc}, gscTijdreeks=${hasFlips} (3 vensters van ~30 dagen), ahrefsZoekwoorden=${hasAhrefsKw} (per pagina, met positie), ahrefsBacklinks=${hasRefDom} (verwijzende domeinen per pagina), crawl=false.`,
      "",
      "AHREFS PER PAGINA — JE PRIMAIRE BRON (per pagina het top-zoekwoord met positie, organisch verkeer, verwijzende domeinen en aantal zoekwoorden; gesorteerd op verkeer). Hieruit clusteren: pagina's waarvan het top-zoekwoord de merk+geo-term van dezelfde plaats is, horen bij elkaar. Let op pagina's die op 'merk grote-stad' of 'soa test grote-stad' ranken terwijl hun URL een andere/omliggende plaats of een variant (kliniek-/poli-/test-) is:",
      ahrefsLines.length ? ahrefsLines.join("\n") : "- (GEEN Ahrefs-data beschikbaar. Meld dit expliciet in de samenvatting en datakwaliteit; de analyse is dan zwak en leunt alleen op Search Console.)",
      "",
      "ALLE PAGINA'S (spiegel van de live site, met Search Console-klikken, status/redirects):",
      pageLines.length ? pageLines.join("\n") : "- (geen pagina's ingelezen)",
      "",
      "ZOEKWOORD -> PAGINA (Search Console, 90 dagen, ter AANVULLING op de Ahrefs-tabel hierboven):",
      matrixLines.length ? matrixLines.join("\n") : "- (geen sitebrede Search Console-data)",
      "",
      "URL-FLIP-TIJDREEKS (wisselt de top-rankende URL per zoekwoord over de tijd?):",
      flipLines.length ? flipLines.join("\n") : "- (geen URL-flips gedetecteerd, of geen tijdreeks beschikbaar)",
    ].join("\n");

    const raw = await callClaude(buildSystemPrompt(), [{ role: "user", content: context.slice(0, 36000) }], 16000, { slug, action: "cannibal_redirect" });
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    let parsed: {
      samenvatting?: unknown; datakwaliteit?: unknown; clusters?: unknown;
      redirectMap?: unknown; interneLinks?: unknown;
    };
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
