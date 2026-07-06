import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscQueryPageMatrix } from "./google";
import { getAhrefsKeywords } from "./ahrefs-keywords";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// SITE-BREDE CANNIBALISATIE- & REDIRECT-ANALYSE
// ═══════════════════════════════════════════════════════════
// Clustert alle pagina's per plaats/thema en levert per cluster een winnaar +
// een redirect-actielijst (301 / de-optimaliseren / behouden), in de stijl van
// de Cowork-Excel. Gegrond op de URL-spiegel + Search Console + Ahrefs-volumes.
// (Per-pagina backlink-data komt in een latere batch, voor de harde 301-vs-410-keuze.)
// ═══════════════════════════════════════════════════════════

export type RedirectMember = {
  url: string; role: string; action: string; target: string; reason: string;
  clicks?: number; impressions?: number;
};
export type RedirectCluster = { place: string; winner: string; problemType: string; members: RedirectMember[] };
export type TechnicalFinding = { onderwerp: string; bevinding: string; advies: string };
export type CannibalResult = { summary: string; clusters: RedirectCluster[]; technical: TechnicalFinding[]; generatedAt: string | null };
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

const SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin. Je maakt een SITE-BREDE CANNIBALISATIE- EN REDIRECT-ANALYSE voor de (locatie-/cluster)pagina's van een klant, in de stijl van een concrete redirect-actielijst.

METHODIEK (volg strikt):
1. Clusteren: groepeer pagina's per PLAATS/thema op basis van het URL-patroon en de geo in de slug. Herken varianten van dezelfde plaats (bijv. soa-poli-x, soa-kliniek-x, soa-test-x = plaats x) en duplicaten.
2. Winnaar per cluster: de bedoelde eigenaar is de pagina in het hoofdpatroon met de meeste clicks/vertoningen. Wijs die aan als winnaar (behouden + optimaliseren).
3. Per ANDERE pagina in het cluster één actie:
   - "301" naar de winnaar: bij een duplicaat of een pagina met clicks (behoud verkeer/link-equity; nooit weggooien als er clicks zijn).
   - "de-optimaliseren": als de pagina op de merk+geo van een GROTE stad rankt terwijl hij een andere (omliggende) plaats is; haal de grote-stad-term weg en richt op de eigen plaats.
   - "behouden": als de pagina een andere intentie/dienst heeft (bijv. bloedonderzoek, spoed-hiv) en niet echt kannibaliseert.
4. Benoem waar relevant de drie probleemtypes: A) inter-city (omliggende plaats rankt op 'merk [grote stad]'), B) intra-plaats (meerdere URL-varianten per plaats), C) technisch (www/http-duplicaat, /en/-mirror, dunne dienst-varianten).
5. Gesloten/verplaatste klinieken die nog ranken: 301 naar de dichtstbijzijnde open pagina, niet 410.

DATA-KANTTEKENING: je hebt Search Console (clicks, vertoningen, posities) en Ahrefs-zoekvolumes, maar (nog) GEEN verwijzende domeinen per pagina. Gebruik clicks/vertoningen als proxy voor waarde; noem bij een 301-advies kort dat backlink-verificatie de keuze zou aanscherpen als dat relevant is.

Antwoord met UITSLUITEND geldige JSON, exact dit formaat, niets eromheen, geen emoji:
{"summary":"<2 tot 4 zinnen kernconclusie>","clusters":[{"place":"<plaats/thema>","winner":"<url-pad van de winnaar>","problemType":"inter-city|intra-plaats|technisch|gemengd","members":[{"url":"<url-pad>","role":"<korte rol, bijv. WINNAAR / duplicaat / cannibaliseert merk / andere dienst>","action":"301|de-optimaliseren|behouden","target":"<winnaar-url-pad of ->","reason":"<1 zin, noem waar mogelijk de zoekterm + positie>","clicks":<getal>,"impressions":<getal>}]}],"technical":[{"onderwerp":"<www/http, /en/-mirror, dunne dienst-varianten, ...>","bevinding":"<wat je ziet>","advies":"<concreet advies>"}]}
Neem in "clusters" alleen ECHTE cannibalisatie-clusters op (pagina's die elkaar op dezelfde plaats/term in de weg zitten), met de winnaar als eerste member. Verzin geen data; gebruik alleen de gegevens hieronder.`;

// Draait de echte analyse en slaat het resultaat op. Idempotent qua opslag.
export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }

    const [urls, matrix, ahref] = await Promise.all([
      getClientUrls(slug),
      getGscQueryPageMatrix(domain, 90, 400).catch(() => [] as { keyword: string; page: string; clicks: number; impressions: number; position: number }[]),
      getAhrefsKeywords(slug).catch(() => []),
    ]);
    const volMap = new Map(ahref.map((k) => [k.keyword.toLowerCase(), k.volume]));

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

    const context = [
      `KLANT: ${client?.name || slug} (domein: ${domain})`,
      "",
      "ALLE PAGINA'S (spiegel van de live site, met Search Console-cijfers):",
      pageLines.length ? pageLines.join("\n") : "- (geen pagina's ingelezen)",
      "",
      "ZOEKWOORD -> PAGINA (Search Console, 90 dagen: welke pagina rankt op welk zoekwoord; hieruit haal je de cannibalisatie):",
      matrixLines.length ? matrixLines.join("\n") : "- (geen sitebrede Search Console-data)",
    ].join("\n");

    const raw = await callClaude(SYSTEM, [{ role: "user", content: context.slice(0, 24000) }], 14000, { slug, action: "cannibal_redirect" });
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
    const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
    let parsed: { summary?: unknown; clusters?: unknown; technical?: unknown };
    try { parsed = JSON.parse(jsonText); } catch { await setState(slug, "error", null, "De analyse kwam niet als geldige JSON terug. Probeer het opnieuw."); return; }

    const result: CannibalResult = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      clusters: Array.isArray(parsed.clusters) ? (parsed.clusters as RedirectCluster[]) : [],
      technical: Array.isArray(parsed.technical) ? (parsed.technical as TechnicalFinding[]) : [],
      generatedAt: new Date().toISOString(),
    };
    await setState(slug, "done", result, "");
  } catch (e) {
    try { await setState(slug, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}
