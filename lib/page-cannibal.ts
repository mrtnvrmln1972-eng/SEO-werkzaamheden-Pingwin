import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan } from "./site-urls";
import { getAhrefsTopPages, getDomainKeywordsMatching, getUrlOrganicKeywords, getSerpOverview, getKeywordsOverview, ahrefsConfigured } from "./ahrefs";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// PER-PAGINA CANNIBALISATIE + CONTENT-MAPPING (de "dubbelslag")
// ═══════════════════════════════════════════════════════════
// Voor ÉÉN landingspagina: welke andere pagina's kapen haar zoekwoorden, wie is de
// winnaar, en per zoekwoord (top-10 + volume) of het een eigen pagina verdient of
// naar deze pagina geclusterd wordt. Klein bereik = complete data = geen shortcuts.
// Levert één leesbaar document (markdown) dat klant én developer begrijpen.
// ═══════════════════════════════════════════════════════════

export type PageCannibalState = { status: "idle" | "running" | "done" | "error"; result: string; error: string; updatedAt: string | null };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_page_cannibal (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
}

function pagePath(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || ""); }

// Meest onderscheidende term uit de laatste URL-segment (voor de plaats/thema-match).
const STOP = new Set(["soa", "test", "kliniek", "klinieken", "poli", "hiv", "spoed", "en", "gratis", "anoniem", "snel", "thuis", "doen", "locaties", "de", "het", "een", "in", "op", "voor", "waar", "kan", "je"]);
function matchTerm(path: string, fallback: string): string {
  const seg = (path.replace(/\/+$/, "").split("/").pop() || "").toLowerCase();
  const words = seg.split("-").filter((w) => w.length > 2 && !STOP.has(w));
  const longest = words.sort((a, b) => b.length - a.length)[0];
  return longest || (fallback || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))[0] || seg;
}

export async function getPageCannibal(slug: string, url: string): Promise<PageCannibalState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, result, error, updated_at FROM client_page_cannibal WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", result: "", error: "", updatedAt: null };
  return {
    status: (r.status as PageCannibalState["status"]) || "idle",
    result: (r.result as string) || "",
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function setState(slug: string, url: string, status: string, result: string | null, error: string): Promise<void> {
  await sql`
    INSERT INTO client_page_cannibal (client_slug, url, status, result, error, updated_at)
    VALUES (${slug}, ${url}, ${status}, ${result || null}, ${error || null}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET status = ${status}, result = ${result || null}, error = ${error || null}, updated_at = now()`;
}

export async function markPageCannibalRunning(slug: string, url: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const cur = await getPageCannibal(slug, url);
  await setState(slug, url, "running", cur.result || null, "");
}

const SYNTH_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin. Je maakt de CANNIBALISATIE- EN CONTENT-MAPPING-analyse voor ÉÉN landingspagina, als vervolgstap in de pagina-workflow (na analyse, blauwdruk en copy). De uitkomst is één helder document dat zowel de klant als een developer begrijpt.

WAT ECHTE CANNIBALISATIE IS (en niet):
- Wél: meerdere URL's van de klant die op dezelfde intentie/term concurreren, waardoor posities/klikken versplinteren, Google de verkeerde pagina kiest, of URL's flippen. Vooral: een buitenwijk-/variant-pagina die op de merk+geo-term van deze landingspagina rankt.
- Niet: pagina's met een andere zoekintentie (informatieve blog naast transactionele pagina), of een andere dienst die toevallig dezelfde plaats in de term heeft (bloedonderzoek naast soa-test). Die NIET als cannibalisatie flaggen.

DE DUBBELSLAG (content mapping): per concurrerend zoekwoord beslis je met volume + top-10:
- Volume ~0 én de top-10 toont geen eigen pagina's voor die subterm (Google vult het met de moederplaats/algemene pagina's) → clusteren naar DEZE landingspagina; de kaper-pagina de-optimaliseren of 301'en.
- Genoeg volume én de top-10 toont wél eigen pagina's voor die subterm → dan verdient het een eigen pagina (niet mergen).
- >50% dezelfde URL's in de top-10 als de hoofdterm → zelfde intentie → zelfde pagina.

WINNAAR-WEGING (fase 4), in deze volgorde: verwijzende domeinen (zwaarst) > organische klikken/tractie > businesswaarde > content-diepte > URL-kwaliteit. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige. Bij twijfel: de bedoelde eigenaar volgens het plan van de pagina, niet puur de huidige ranking.

ACTIES (beslisboom, licht naar zwaar): niets doen | interne links herverdelen | content differentiëren | canonical | samenvoegen + 301 | de-indexeren (noindex). Lege duplicaten zonder verkeer/links → 301 naar de winnaar.

OUTPUT (nette markdown, Nederlands, geen emoji, geen ruwe # in de tekst maar gebruik echte kopjes):
1. Een korte strategie-alinea in gewone taal: is deze pagina de winnaar, en wat is het patroon?
2. Een markdown-TABEL met alle betrokken pagina's: kolommen | Pagina | Rankt op | Positie | Verw.domeinen | Rol | Actie | Doel |. De winnaar bovenaan. Rollen: WINNAAR / kaapt merk / kaapt (andere subdienst) / duplicaat (geen verkeer) / andere intentie. Acties: behouden + optimaliseren / de-optimaliseren / 301 / interne links / behouden.
3. Kopje "Content mapping": per beslis-zoekwoord de top-10-conclusie (eigen pagina waard, of clusteren naar deze pagina), met volume.
4. Kopje "301-redirects" (bulletlijst van → naar) en kopje "Interne links" (vanaf → naar, ankertekst).
5. Kopje "Nieuwe pagina's overwegen": zoekwoorden die volgens de top-10 wél een eigen pagina verdienen (leeg laten als er geen zijn).
Verzin geen data; gebruik alleen de gegevens hieronder. Benoem eerlijk als een bron ontbrak.`;

export async function runPageCannibal(slug: string, url: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) { await setState(slug, url, "error", null, "Deze klant heeft nog geen domein ingevuld."); return; }
    if (!ahrefsConfigured()) { await setState(slug, url, "error", null, "Hiervoor is een AHREFS_API_TOKEN nodig in Vercel."); return; }
    const subjectPath = pagePath(url);

    // Pass 1: basis-data.
    const [subjectKw, urls, topPages, plan] = await Promise.all([
      getUrlOrganicKeywords(url, "nl", 40).catch(() => []),
      getClientUrls(slug).catch(() => []),
      getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
      getPagePlan(slug, url).catch(() => ""),
    ]);
    const refDom = new Map<string, number>();
    for (const t of topPages) if (t.refDomains != null) refDom.set(pagePath(t.url), t.refDomains);
    const term = matchTerm(subjectPath, subjectKw[0]?.keyword || "");

    // Concurrenten die op de plaats/thema-term ranken (best-rankende URL per term).
    const domMatch = term ? await getDomainKeywordsMatching(domain, term, 100).catch(() => []) : [];

    // Kandidaat-pagina's om per-URL uit te diepen (verstopte kapers zoals buitenwijken).
    const bare = domain.replace(/^www\./i, "").toLowerCase();
    const locPages = urls.filter((u) => {
      const p = pagePath(u.url);
      return p !== subjectPath && (u.status ?? 200) === 200 && /(soa-poli|soa-kliniek|soa-test|hiv-test|bloedonderzoek|spoed|soa-test-locaties)/i.test(p);
    }).map((u) => pagePath(u.url));
    let candidates: string[] = [];
    if (locPages.length) {
      const pick = await callClaude(
        `Je selecteert kandidaat-pagina's die de landingspagina "${subjectPath}" kunnen kannibaliseren. Kies uit de lijst de pagina's die qua plaats/thema in de buurt liggen (bijv. omliggende plaatsen bij een stad, of variant-URL's van dezelfde plaats/dienst; jij kent de Nederlandse geografie). Geef UITSLUITEND de gekozen paden terug, één per regel, maximaal 12, niets anders.`,
        [{ role: "user", content: `Landingspagina: ${subjectPath} (plaats/thema: ${term}).\nKandidaat-pagina's:\n${locPages.slice(0, 120).join("\n")}` }],
        800, { slug, action: "page_cannibal_pick" },
      ).catch(() => "");
      candidates = pick.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("/") && l !== subjectPath).slice(0, 12);
    }

    // Per kandidaat de zoekwoorden ophalen; houd de merk+plaats-rankings over.
    const candKw: { path: string; hits: { keyword: string; position: number | null; volume: number | null }[] }[] = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const batch = candidates.slice(i, i + 5);
      const got = await Promise.all(batch.map(async (p) => {
        const kws = await getUrlOrganicKeywords(`https://${bare}${p}`, "nl", 25).catch(() => []);
        const hits = kws.filter((k) => k.keyword.toLowerCase().includes(term)).map((k) => ({ keyword: k.keyword, position: k.position, volume: k.volume }));
        return { path: p, hits };
      }));
      candKw.push(...got);
    }

    // Beslis-zoekwoorden voor de content mapping (top-10 + volume): de plaats/merk-termen
    // waar concurrenten op ranken, plus de sterkste eigen termen.
    const decisionKw = Array.from(new Set([
      ...domMatch.filter((d) => (d.volume || 0) > 0).slice(0, 8).map((d) => d.keyword),
      ...candKw.flatMap((c) => c.hits.map((h) => h.keyword)),
      ...subjectKw.slice(0, 3).map((k) => k.keyword),
    ])).slice(0, 8);
    const serpLines: string[] = [];
    const vols = await getKeywordsOverview(decisionKw, "nl").catch(() => []);
    const volMap = new Map(vols.map((v) => [v.keyword.toLowerCase(), v.volume]));
    for (let i = 0; i < decisionKw.length; i += 4) {
      const batch = decisionKw.slice(i, i + 4);
      const got = await Promise.all(batch.map(async (kw) => {
        const serp = await getSerpOverview(kw, "nl").catch(() => []);
        const own = serp.filter((s) => s.url && s.url.replace(/^https?:\/\/(www\.)?/i, "").toLowerCase().startsWith(bare)).map((s) => `pos ${s.position} ${pagePath(s.url)}`);
        const top = serp.slice(0, 6).map((s) => `${s.position}. ${(s.url || "").replace(/^https?:\/\//, "").slice(0, 60)}`);
        const vol = volMap.get(kw.toLowerCase());
        return `- "${kw}" (volume ${vol ?? "?"}): eigen pagina's in top-10: ${own.length ? own.join(", ") : "GEEN"} | top: ${top.join(" | ")}`;
      }));
      serpLines.push(...got);
    }

    // Lege duplicaten: status-200 pagina's met de plaats in de URL en geen Ahrefs-verkeer.
    const seenAhrefs = new Set(topPages.map((t) => pagePath(t.url)));
    const emptyDupes = urls.filter((u) => (u.status ?? 200) === 200 && pagePath(u.url) !== subjectPath && pagePath(u.url).toLowerCase().includes(term) && !seenAhrefs.has(pagePath(u.url))).map((u) => pagePath(u.url)).slice(0, 20);

    const context = [
      `LANDINGSPAGINA (het onderwerp): ${subjectPath}`,
      plan ? `PLAN/ROL VAN DEZE PAGINA: ${plan.slice(0, 800)}` : "PLAN: (nog geen plan vastgelegd)",
      `Verw.domeinen van deze pagina: ${refDom.get(subjectPath) ?? "?"}`,
      "",
      `EIGEN TOP-ZOEKWOORDEN van deze pagina (Ahrefs): ${subjectKw.slice(0, 12).map((k) => `"${k.keyword}" pos ${k.position ?? "?"} vol ${k.volume ?? "?"}`).join(" | ") || "(geen)"}`,
      "",
      `CONCURRENTEN op de term "${term}" (Ahrefs, best-rankende URL per zoekwoord):`,
      domMatch.length ? domMatch.slice(0, 40).map((d) => `- "${d.keyword}" -> ${pagePath(d.url)} pos ${d.position ?? "?"} | vol ${d.volume ?? "?"} | ${d.branded ? "merk " : ""}${d.transactional ? "transactioneel" : d.informational ? "informatief" : ""} | verw.dom ${refDom.get(pagePath(d.url)) ?? "?"}`).join("\n") : "- (geen)",
      "",
      "VERSTOPTE KAPERS (per kandidaat-pagina de eigen ranking op de plaats/merk-term; deze zie je niet in de domein-lijst hierboven):",
      candKw.filter((c) => c.hits.length).map((c) => `- ${c.path}: ${c.hits.map((h) => `"${h.keyword}" pos ${h.position ?? "?"}`).join(", ")} | verw.dom ${refDom.get(c.path) ?? "?"}`).join("\n") || "- (geen verstopte kapers gevonden)",
      "",
      "CONTENT MAPPING — top-10 + volume per beslis-zoekwoord (bepaalt: eigen pagina of clusteren):",
      serpLines.join("\n") || "- (geen SERP-data)",
      "",
      `LEGE DUPLICATEN (status 200, plaats in de URL, geen Ahrefs-verkeer; kandidaat 301 naar de winnaar): ${emptyDupes.length ? emptyDupes.join(", ") : "(geen)"}`,
    ].join("\n");

    const raw = await callClaude(SYNTH_SYSTEM, [{ role: "user", content: context.slice(0, 40000) }], 8000, { slug, action: "page_cannibal" });
    const result = raw.replace(/```/g, "").trim();
    if (!result) { await setState(slug, url, "error", null, "De analyse kwam leeg terug. Probeer het opnieuw."); return; }
    await setState(slug, url, "done", result, "");
  } catch (e) {
    try { await setState(slug, url, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}
