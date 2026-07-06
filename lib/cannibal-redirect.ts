import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscQueryPageMatrix, getGscKeywordUrlFlips } from "./google";
import { getAhrefsKeywords } from "./ahrefs-keywords";
import { getUrlOrganicKeywords, ahrefsConfigured } from "./ahrefs";
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
- Je BELANGRIJKSTE bron is de sectie GEDEELDE ZOEKWOORDEN: dat zijn de zoekwoorden waar (volgens Ahrefs) meerdere pagina's op ranken, met hun positie. Bouw je clusters primair hieruit. Search Console is aanvullend, want het mist juist de long-tail merk+geo-termen waar de cannibalisatie zit.
- Let bij een lokaal/multi-locatie bedrijf specifiek op het patroon waar de handmatige analyses op draaien: een omliggende-plaats- of variant-pagina die rankt op de merk+geo-term van een GROTE stad (bijv. een buitenwijkpagina op "merk grote-stad"). De hoofd-stadspagina is dan de winnaar; de kaper krijgt "de-optimaliseren" (merk+grote-stad-term weghalen) of een 301 als het een duplicaat is. Herken ook meerdere URL-varianten per plaats (kliniek-/poli-/test-varianten) als duplicaten.
- Neem in "clusters" ALLEEN echte cannibalisatie op (minstens één hard signaal + overlappende intentie). Twee pagina's met verschillende intentie (informatieve blog naast transactionele pagina) horen er NIET in.
- Vul "signalen" op basis van de flip-tijdreeks (urlFlip/flipsIn90d), de posities (positiePlafond 5-20) en de klik-verdeling. Zet "ahrefsZoekwoorden": true.
- Verwijzende domeinen / URL Rating per pagina zijn nog niet beschikbaar: zet "ahrefsBacklinks": false in "datakwaliteit", laat "verwijzendeDomeinen" weg, en gebruik posities + klikken/verkeer als proxy voor waarde. Noem bij een 301 kort dat verificatie van verwijzende domeinen de winnaar-keuze nog zou aanscherpen (met name bij gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410).
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

    // Per pagina de Ahrefs-zoekwoorden met positie ophalen: de motor van de analyse
    // (welke pagina rankt op welk merk+geo-zoekwoord). Search Console onder-rapporteert
    // juist die long-tail geo-termen; Ahrefs heeft ze wel. Gecapt op de top-pagina's op
    // vertoningen; getUrlOrganicKeywords cachet 30 dagen, dus herhaalde runs zijn goedkoop.
    const AHREFS_PAGE_LIMIT = 60;
    const pagesForAhrefs = [...urls]
      .filter((u) => (u.status ?? 200) === 200)
      .sort((a, b) => (b.gscImpressions + b.gscClicks * 5) - (a.gscImpressions + a.gscClicks * 5))
      .slice(0, AHREFS_PAGE_LIMIT);
    const perPageKw: { path: string; kws: { keyword: string; position: number | null; volume: number | null; traffic: number | null }[] }[] = [];
    if (ahrefsConfigured()) {
      const pool = 6;
      for (let i = 0; i < pagesForAhrefs.length; i += pool) {
        const batch = pagesForAhrefs.slice(i, i + pool);
        const got = await Promise.all(batch.map(async (u) => {
          try { return { path: pagePath(u.url), kws: await getUrlOrganicKeywords(u.url, "nl", 40) }; }
          catch { return { path: pagePath(u.url), kws: [] as { keyword: string; position: number | null; volume: number | null; traffic: number | null }[] }; }
        }));
        perPageKw.push(...got);
      }
    }

    // Kruis op zoekwoord: welke pagina's ranken op dezelfde term? ≥2 pagina's = een
    // cannibalisatie-kandidaat. Dit rekenen we in code voor en geven we voorgekauwd
    // aan het model (zoals de handmatige Excel-analyse per stad clusterde).
    const kwPages = new Map<string, { page: string; position: number; traffic: number }[]>();
    for (const { path: pp, kws } of perPageKw) {
      for (const k of kws) {
        if (k.position == null) continue;
        const key = k.keyword.toLowerCase();
        const arr = kwPages.get(key) || [];
        if (!arr.some((x) => x.page === pp)) arr.push({ page: pp, position: k.position, traffic: k.traffic || 0 });
        kwPages.set(key, arr);
      }
    }
    const shared = [...kwPages.entries()]
      .filter(([, ps]) => ps.length >= 2)
      .map(([kw, ps]) => ({ kw, ps: ps.sort((a, b) => a.position - b.position), maxTraffic: Math.max(...ps.map((p) => p.traffic)) }))
      .sort((a, b) => b.maxTraffic - a.maxTraffic)
      .slice(0, 140);
    const sharedLines = shared.map(({ kw, ps }) => {
      const vol = volMap.get(kw);
      return `- "${kw}"${vol != null ? ` (vol ${vol})` : ""}: ${ps.map((p) => `${p.page} [Ahrefs pos ${p.position}${p.traffic ? `, ${p.traffic} verkeer` : ""}]`).join("  |  ")}`;
    });
    const hasAhrefsKw = perPageKw.some((p) => p.kws.length > 0);

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
        `gsc=${hasGsc}, gscTijdreeks=${hasFlips} (3 vensters van ~30 dagen), ahrefsZoekwoorden=${hasAhrefsKw} (per pagina, met positie), ahrefsBacklinks=false, crawl=false.`,
      "",
      `GEDEELDE ZOEKWOORDEN — DE CANNIBALISATIE-KANDIDATEN (Ahrefs, per pagina gekruist over de top-${AHREFS_PAGE_LIMIT} pagina's: meerdere pagina's ranken op dezelfde term. Dit is je BELANGRIJKSTE bron; Search Console mist juist deze long-tail merk+geo-termen. Let vooral op pagina's die op de merk+geo van een grote stad ranken terwijl ze een andere/omliggende plaats zijn):`,
      sharedLines.length ? sharedLines.join("\n") : "- (geen gedeelde Ahrefs-zoekwoorden gevonden; val terug op de Search Console-matrix hieronder)",
      "",
      "ALLE PAGINA'S (spiegel van de live site, met Search Console-cijfers):",
      pageLines.length ? pageLines.join("\n") : "- (geen pagina's ingelezen)",
      "",
      "ZOEKWOORD -> PAGINA (Search Console, 90 dagen, ter AANVULLING op de Ahrefs-kruising hierboven):",
      matrixLines.length ? matrixLines.join("\n") : "- (geen sitebrede Search Console-data)",
      "",
      "URL-FLIP-TIJDREEKS (wisselt de top-rankende URL per zoekwoord over de tijd?):",
      flipLines.length ? flipLines.join("\n") : "- (geen URL-flips gedetecteerd, of geen tijdreeks beschikbaar)",
    ].join("\n");

    const raw = await callClaude(buildSystemPrompt(), [{ role: "user", content: context.slice(0, 34000) }], 16000, { slug, action: "cannibal_redirect" });
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
