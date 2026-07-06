import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscKeywordUrlFlips } from "./google";
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

// Haalt het eerste complete, gebalanceerde JSON-object uit een tekst (strings/escapes
// meegerekend), zodat losse accolades in proza de parse niet breken. Sluit het object
// niet (afgekapt antwoord), dan geeft hij de rest terug zodat we het kunnen herkennen.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  if (start < 0) return s;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return s.slice(start);
}

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
De data hieronder is al voor je verzameld. Redeneer per plaats/thema; verzin niets bij.
- Je PRIMAIRE bron is de AHREFS PER PAGINA-tabel: per pagina het top-zoekwoord met positie, verkeer en verwijzende domeinen. Cluster pagina's waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft.
- Let op het patroon van de handmatige analyse: een omliggende-plaats- of variant-pagina waarvan het top-zoekwoord de merk+geo-term van een GROTE stad is (bijv. top-zoekwoord "merk grote-stad" of "soa test grote-stad" terwijl de URL een andere/omliggende plaats of een variant is). De hoofd-stadspagina (hoogste positie, meeste verwijzende domeinen) is de winnaar; de kaper krijgt "de-optimaliseren" of een 301 bij een duplicaat. Gebruik de lijst PAGINA'S ZONDER Ahrefs-VERKEER om lege duplicaat-varianten per plaats (kliniek-/poli-/test-) te vinden; die krijgen meestal een 301 naar de plaatswinnaar.
- Neem ALLEEN echte cannibalisatie op (hard signaal + overlappende intentie). Een informatieve blog naast een transactionele pagina = geen cannibalisatie; laat die eruit.
- Winnaar-weging: verwijzende domeinen (zwaarst) > organische tractie > businesswaarde. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige pagina. Gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410 (behoud de verwijzende domeinen).
- Vul per cluster "signalen" (urlFlip/flipsIn90d uit de flip-tijdreeks, positiePlafond 5-20, klikVerdeling) en per URL "verwijzendeDomeinen" in. Vul "datakwaliteit" in: gsc=true, gscTijdreeks (kwamen er flips mee?), ahrefsZoekwoorden=true, ahrefsBacklinks=true, crawl=false.
- Antwoord met UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

// Draait de analyse en slaat het resultaat op. Idempotent qua opslag. Eén betrouwbare
// call over de vooraf verzamelde, geverifieerde data (Ahrefs top-pagina's = de motor).
export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }
    if (!ahrefsConfigured()) { await setState(slug, "error", null, "Hiervoor is een AHREFS_API_TOKEN nodig in Vercel."); return; }

    const [topPages, urls, flips] = await Promise.all([
      getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
      getClientUrls(slug).catch(() => []),
      getGscKeywordUrlFlips(domain, 3).catch(() => [] as { keyword: string; topUrls: string[]; flips: number }[]),
    ]);
    if (!topPages.length) { await setState(slug, "error", null, "Geen Ahrefs-data terug voor dit domein. Controleer de Ahrefs-koppeling (AHREFS_API_TOKEN) en of het domein klopt."); return; }

    const ahrefsSeen = new Set(topPages.map((t) => pagePath(t.url)));
    const ahrefsTable = [...topPages].sort((a, b) => (b.traffic || 0) - (a.traffic || 0)).slice(0, 240)
      .map((t) => `- ${pagePath(t.url)} | top:"${t.topKeyword}" pos ${t.position ?? "?"} | ${t.traffic ?? 0} verkeer | ${t.refDomains ?? "?"} verw.domeinen | ${t.keywords ?? "?"}kw`).join("\n");
    const zeroTraffic = urls.filter((u) => (u.status ?? 200) === 200 && !ahrefsSeen.has(pagePath(u.url))).slice(0, 150)
      .map((u) => `- ${pagePath(u.url)} | status ${u.status ?? "?"} | ${u.gscClicks} clicks`).join("\n");
    const flipLines = flips.slice(0, 60).map((f) => `- "${f.keyword}": ${f.topUrls.join(" -> ")} (${f.flips}x)`).join("\n");
    const hasFlips = flips.length > 0;

    const context = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      "",
      `DATAKWALITEIT (neem over in datakwaliteit): gsc=true, gscTijdreeks=${hasFlips}, ahrefsZoekwoorden=true, ahrefsBacklinks=true (verwijzende domeinen per pagina), crawl=false.`,
      "",
      "AHREFS PER PAGINA — JE PRIMAIRE BRON (pagina | top-zoekwoord + positie | organisch verkeer | verwijzende domeinen | aantal zoekwoorden):",
      ahrefsTable || "- (geen)",
      "",
      "PAGINA'S ZONDER Ahrefs-VERKEER (status 200; vaak lege duplicaat-varianten die je per plaats naar de winnaar redirect):",
      zeroTraffic || "- (geen)",
      "",
      "URL-FLIP-TIJDREEKS (top-rankende URL per zoekwoord over 3 vensters van ~30 dagen):",
      flipLines || "- (geen flips gedetecteerd)",
    ].join("\n");

    const raw = await callClaude(buildSystemPrompt(), [{ role: "user", content: context.slice(0, 40000) }], 16000, { slug, action: "cannibal_redirect" });

    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonText = extractJsonObject(cleaned);
    let parsed: { samenvatting?: unknown; datakwaliteit?: unknown; clusters?: unknown; redirectMap?: unknown; interneLinks?: unknown };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const looksTruncated = jsonText.trim().startsWith("{") && !jsonText.trim().endsWith("}");
      await setState(slug, "error", null, looksTruncated
        ? "De analyse werd afgekapt voordat de JSON af was (te lang). Probeer het opnieuw; ik heb de limiet verhoogd."
        : `De analyse kwam niet als geldige JSON terug. Probeer het opnieuw.${cleaned ? ` (begon met: ${cleaned.slice(0, 120).replace(/\s+/g, " ")})` : ""}`);
      return;
    }

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
