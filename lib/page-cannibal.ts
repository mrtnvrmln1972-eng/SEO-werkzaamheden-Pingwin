import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls, getPagePlan, getPageDriveFolder } from "./site-urls";
import { getGscForPage, getGscQueryPageMatrix } from "./google";
import { getAhrefsTopPages, getDomainKeywordsMatching, getUrlOrganicKeywords, getSerpOverview, getKeywordsOverview, ahrefsConfigured } from "./ahrefs";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { cannibalDocSpec, canniTaskDocSpec } from "./page-doc";
import { buildPingwinDoc } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { getTasks, appendTasks, deleteTasksByIds } from "./tasks";
import { getCanniRowStatuses, setCanniRowStatus, getPageRedirects } from "./wp";
import { mdToHtml } from "./markdown";
import { measurePage } from "./page-measure";

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

// Functionele/juridische pagina's horen NOOIT in een cannibalisatie-analyse
// (het voorwaarden-incident van 11-07-2026: "waarde" matchte als deelwoord in
// "voorwaarden" en de pagina kreeg een 301-advies zonder enig bewijs).
const UTILITY_RE = /(voorwaarden|privacy|cookie|disclaimer|sitemap|login|account|klacht|vacature|bedankt|winkelwagen|checkout|contact)/i;
// Hele woorden uit een pad of tekst (zodat "waarde" niet in "voorwaarden" matcht).
function wholeWords(s: string): string[] { return (s || "").toLowerCase().split(/[^a-z0-9à-ü]+/i).filter(Boolean); }

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

BRONNEN EN HET SCHERPE ONDERSCHEID:
- Search Console is de WAARHEID over Google's gedrag. Splitsen meerdere pagina's klikken/vertoningen op DEZELFDE query (zie de GSC-sectie) → dat is harde, echte cannibalisatie; weeg dat het zwaarst. Krijgt op een query alleen deze pagina vertoningen → geen probleem.
- Meerdere pagina's die op VERSCHILLENDE queries ranken is normaal en gezond; flag dat niet. Alleen echt splitsen op dezelfde query/intentie telt.
- Ahrefs is voor de ONTDEKKING, inclusief long-tail merk+geo-termen die GSC verbergt (lage volumes worden geanonimiseerd). Gebruik Ahrefs om kapers te vinden, GSC om te bevestigen of Google ze echt door elkaar haalt.

DE DUBBELSLAG (content mapping): per concurrerend zoekwoord beslis je met volume + top-10:
- Volume ~0 én de top-10 toont geen eigen pagina's voor die subterm (Google vult het met de moederplaats/algemene pagina's) → clusteren naar DEZE landingspagina; de kaper-pagina de-optimaliseren of 301'en.
- Genoeg volume én de top-10 toont wél eigen pagina's voor die subterm → dan verdient het een eigen pagina (niet mergen).
- >50% dezelfde URL's in de top-10 als de hoofdterm → zelfde intentie → zelfde pagina.

WINNAAR-WEGING (fase 4), in deze volgorde: verwijzende domeinen (zwaarst) > organische klikken/tractie > businesswaarde > content-diepte > URL-kwaliteit. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige. Bij twijfel: de bedoelde eigenaar volgens het plan van de pagina, niet puur de huidige ranking.

BEWIJSPLICHT (hard, gaat boven alles):
- Neem in de tabel UITSLUITEND de landingspagina zelf en pagina's uit de lijst "TOEGESTANE PAGINA'S VOOR DE TABEL" hieronder. Staat een pagina daar niet in, dan bestaat hij voor deze analyse niet.
- Citeer in de Reden-kolom kort het bewijs van die pagina (de query-splitsing of de ranking).
- "Geen verkeer" alléén is NOOIT een reden voor een 301; zonder hard signaal is de actie "niets doen", of laat de pagina weg.
- Functionele/juridische pagina's (voorwaarden, privacy, cookies, contact en dergelijke) nooit als duplicaat of 301-kandidaat aanmerken.
- Verw.domeinen "?" betekent ONBEKEND, niet nul: schrijf dan "onbekend" in de RD-kolom.

ACTIES (beslisboom, licht naar zwaar): niets doen | interne links herverdelen | content differentiëren | canonical | samenvoegen + 301 | de-indexeren (noindex). Alleen GECONTROLEERDE duplicaten (aantoonbaar zelfde onderwerp, geen eigen rankings of waarde) → 301 naar de winnaar.
TAALVARIANTEN (bijv. /en/-paden of een andere taalcode): NOOIT 301 of canonical naar de andere taal adviseren; die pagina bedient een eigen taalgroep (expats/internationals). De juiste actie is dan "hreflang + vertalen (pagina blijft)": hreflang-koppeling tussen beide versies, elk zelf-canonical, en de variant volledig in de eigen taal uitwerken. De query-splitsing telt WEL gewoon mee in de Score.

OUTPUT — KORT EN SCANBAAR, absoluut geen lappen tekst. Denk aan een strak Excel-overzicht, niet aan een rapport. Nette markdown, Nederlands, geen emoji.
1. Eén tot twee zinnen strategie: is deze pagina de winnaar en wat is het patroon. Niet meer.
2. ÉÉN markdown-tabel, winnaar bovenaan, met EXACT deze kolommen:
   | Pagina | klik | vert | RD | Rol | Score | Actie | Doel | Reden |
   (klik = GSC-klikken, vert = GSC-vertoningen, RD = verwijzende domeinen; houd de koppen exact zo kort)
   - Score = cannibalisatiescore 1-100: hoe hard deze pagina daadwerkelijk met de geanalyseerde landingspagina concurreert, en dus hoe urgent ingrijpen is. Weeg: bewezen query-splitsing in GSC op dezelfde zoekterm (zwaarst, 70-100), ranken op de kern-/merkterm van de landingspagina zonder GSC-splitsing (40-69), alleen thematische overlap of long-tail-raakvlak (10-39), eigen intentie/andere dienst zonder echte concurrentie (1-9). Bij de winnaar-rij zelf: "-". Alleen het getal in de cel, geen tekst.
   - Schrijf elke URL in de kolommen Pagina en Doel als KLIKBARE markdown-link met het pad als tekst en de LIVE-URL-BASIS ervoor: [/pad/](https://domein/pad/). Zo kun je meteen naar de pagina klikken.
   - Cellen zijn KORT: getallen in de metriek-kolommen, korte labels, en "Reden" is ÉÉN korte zin. ZET NOOIT een lijst van zoekwoorden in een cel; noem hooguit de ene beslissende term + positie.
   - Rol (kort): WINNAAR / kaapt merk / kaapt <subdienst> / duplicaat (geen verkeer) / andere dienst / blog.
   - Actie — maak ALTIJD duidelijk of de pagina blijft of vervalt: "301 (pagina vervalt)" / "de-optimaliseren (pagina blijft)" / "interne links (pagina blijft)" / "behouden" / "behouden + optimaliseren".
   - Doel: bij 301 de winnaar-URL waar hij heen redirect; bij de-optimaliseren/interne links de winnaar waarnaar je intern linkt (de pagina zelf BLIJFT dus bestaan); bij de winnaar zelf "-".
   - KRITIEK tegen verwarring: als een pagina BLIJFT (de-optimaliseren/interne links/behouden), zeg in de Reden expliciet WAAROM hij blijft, namelijk zijn eigen waarde/intentie (bijv. "informatief artikel, eigen intentie" of "andere dienst"). Heeft de pagina GEEN eigen waarde (duplicaat, dun, leeg), dan is de actie 301 (vervalt), niet de-optimaliseren. Dus: een pagina met een Doel maar zonder duidelijke eigen reden om te blijven, hoort een 301 te zijn.
   - Verwerk de content-mapping-conclusie beknopt in Reden waar relevant (bijv. "vol 0, clusteren").
3. Daaronder, ALLEEN als er iets te melden is, als KORTE bullets (geen alinea's):
   - "301-redirects:" per regel: van → naar.
   - "Interne links:" per regel: vanaf → naar (ankertekst).
   - "Nieuwe pagina overwegen:" alleen zoekwoorden die volgens de top-10 + volume écht een eigen pagina verdienen (meestal geen; laat de kop wég als er geen zijn).
Houd het geheel kort genoeg om in één oogopslag te overzien. Verzin geen data; gebruik alleen de gegevens hieronder.`;

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
    const [subjectKw, urls, topPages, plan, gscPage, gscMatrix] = await Promise.all([
      getUrlOrganicKeywords(url, "nl", 40).catch(() => []),
      getClientUrls(slug).catch(() => []),
      getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
      getPagePlan(slug, url).catch(() => ""),
      getGscForPage(domain, url, 90).catch(() => [] as { keyword: string; clicks: number; impressions: number; position: number }[]),
      getGscQueryPageMatrix(domain, 90, 600).catch(() => [] as { keyword: string; page: string; clicks: number; impressions: number; position: number }[]),
    ]);
    const refDom = new Map<string, number>();
    for (const t of topPages) if (t.refDomains != null) refDom.set(pagePath(t.url), t.refDomains);
    const term = matchTerm(subjectPath, subjectKw[0]?.keyword || "");

    // GSC = de waarheid over Google's gedrag: voor de queries van DEZE pagina, welke
    // andere pagina's krijgen ook vertoningen/klikken op dezelfde query (echte concurrentie).
    const subjQ = new Set(gscPage.map((r) => r.keyword.toLowerCase()));
    const byQuery = new Map<string, { page: string; clicks: number; impressions: number; position: number }[]>();
    for (const r of gscMatrix) {
      const q = r.keyword.toLowerCase();
      if (!subjQ.has(q)) continue;
      const arr = byQuery.get(q) || []; arr.push({ page: pagePath(r.page), clicks: r.clicks, impressions: r.impressions, position: r.position }); byQuery.set(q, arr);
    }

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
        800, { slug, action: "page_cannibal_pick" }, LIGHT_MODEL,
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

    const gscLines = [...gscPage]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r) => {
        const others = (byQuery.get(r.keyword.toLowerCase()) || []).filter((p) => p.page !== subjectPath);
        const compet = others.length ? ` | GOOGLE TOONT OOK: ${others.slice(0, 4).map((p) => `${p.page} (${p.clicks} klik/${p.impressions} vert, pos ${p.position})`).join(", ")}` : " | (geen andere pagina op deze query)";
        return `- "${r.keyword}": deze pagina ${r.clicks} klikken / ${r.impressions} vertoningen, pos ${r.position}${compet}`;
      });

    // DUPLICAAT-VERDENKINGEN — eerst onderzocht vóór ze de context ingaan (bewijsplicht):
    // hele-woord-match op de kernterm (geen deelwoorden), functionele pagina's uitgesloten,
    // en daarna de pagina echt gemeten (titel/H1/woordenaantal) om het onderwerp te toetsen.
    const seenAhrefs = new Set(topPages.map((t) => pagePath(t.url)));
    const subjectWords = wholeWords(subjectPath).filter((w) => w.length > 2 && !STOP.has(w));
    const dupeSuspects = urls.filter((u) => {
      const p = pagePath(u.url);
      return (u.status ?? 200) === 200 && p !== subjectPath && !UTILITY_RE.test(p)
        && wholeWords(p).includes(term) && !seenAhrefs.has(p);
    }).map((u) => pagePath(u.url)).slice(0, 6);
    const checkedDupes: string[] = [];
    const dupeEvidence = new Map<string, string>();
    for (const p of dupeSuspects) {
      const m = await measurePage(`https://${bare}${p}`, { staticOnly: true }).catch(() => null);
      if (!m?.ok) continue;
      const hayWords = new Set(wholeWords(`${m.metaTitle} ${m.h1.join(" ")}`));
      const overlap = subjectWords.filter((w) => hayWords.has(w)).length;
      // Alleen bij aantoonbaar hetzelfde onderwerp (kernterm of ≥2 onderwerpwoorden
      // in titel/H1) mag hij als gecontroleerde verdenking mee; anders volledig weg.
      if (hayWords.has(term) || overlap >= 2) {
        checkedDupes.push(`- ${p}: titel "${m.metaTitle}", H1 "${m.h1[0] || "-"}", ${m.wordCount} woorden, geen eigen Ahrefs-rankings`);
        dupeEvidence.set(p, `gecontroleerd mogelijk duplicaat: zelfde onderwerp in titel/H1, geen eigen rankings (${m.wordCount} woorden)`);
      }
    }

    // BEWIJSLIJST: alleen pagina's met minstens één hard signaal mogen in de tabel.
    const evidence = new Map<string, string>();
    for (const [q, arr] of byQuery) {
      for (const p of arr) {
        if (p.page === subjectPath || evidence.has(p.page)) continue;
        evidence.set(p.page, `GSC-splitsing op "${q}" (${p.clicks} klik / ${p.impressions} vert, pos ${p.position})`);
      }
    }
    for (const d of domMatch) {
      const p = pagePath(d.url);
      if (p !== subjectPath && !evidence.has(p)) evidence.set(p, `rankt op "${d.keyword}" pos ${d.position ?? "?"} (Ahrefs)`);
    }
    for (const c of candKw) {
      if (c.hits.length && !evidence.has(c.path)) evidence.set(c.path, `rankt op "${c.hits[0].keyword}" pos ${c.hits[0].position ?? "?"} (Ahrefs)`);
    }
    for (const [p, b] of dupeEvidence) if (!evidence.has(p)) evidence.set(p, b);
    for (const p of [...evidence.keys()]) if (UTILITY_RE.test(p)) evidence.delete(p);

    const context = [
      `LANDINGSPAGINA (het onderwerp): ${subjectPath}`,
      `LIVE-URL-BASIS (zet dit vóór elk pad voor klikbare links): https://${bare}`,
      plan ? `PLAN/ROL VAN DEZE PAGINA: ${plan.slice(0, 800)}` : "PLAN: (nog geen plan vastgelegd)",
      `Verw.domeinen van deze pagina: ${refDom.get(subjectPath) ?? "?"}`,
      "",
      `EIGEN TOP-ZOEKWOORDEN van deze pagina (Ahrefs): ${subjectKw.slice(0, 12).map((k) => `"${k.keyword}" pos ${k.position ?? "?"} vol ${k.volume ?? "?"}`).join(" | ") || "(geen)"}`,
      "",
      "SEARCH CONSOLE — DE WAARHEID OVER GOOGLE (per query van deze pagina: eigen klikken/vertoningen/positie, én welke ANDERE pagina's Google óók op dezelfde query toont. Waar meerdere pagina's op dezelfde query klikken/vertoningen splitsen = echte cannibalisatie. Waar alleen deze pagina staat = geen probleem):",
      gscLines.length ? gscLines.join("\n") : "- (geen Search Console-data voor deze pagina; leun op Ahrefs)",
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
      "TOEGESTANE PAGINA'S VOOR DE TABEL (elk met zijn gemeten bewijs; UITSLUITEND deze pagina's mogen als rij worden opgenomen, naast de landingspagina zelf):",
      evidence.size ? [...evidence].map(([p, b]) => `- ${p}: ${b}`).join("\n") : "- (geen andere pagina's met bewijs; de tabel bevat dan alleen de landingspagina zelf en de conclusie is: geen cannibalisatie)",
      "",
      "GECONTROLEERDE DUPLICAAT-VERDENKINGEN (pagina echt gemeten; alleen deze mogen 'duplicaat' heten):",
      checkedDupes.join("\n") || "- (geen)",
    ].join("\n");

    const raw = await callClaude(SYNTH_SYSTEM, [{ role: "user", content: context.slice(0, 40000) }], 8000, { slug, action: "page_cannibal" });
    const result = raw.replace(/```/g, "").trim();
    if (!result) { await setState(slug, url, "error", null, "De analyse kwam leeg terug. Probeer het opnieuw."); return; }
    await setState(slug, url, "done", result, "");
  } catch (e) {
    try { await setState(slug, url, "error", null, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}

function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}

// Actionable rijen (301/de-optimaliseren/interne links) uit de analyse-tabel
// halen: pad + actie. Voor het beslismoment (welke rijen zijn beoordeeld) en de
// taak-status.
export function parseActionableRows(analysis: string): { path: string; action: string }[] {
  const out: { path: string; action: string }[] = [];
  for (const line of (analysis || "").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const m = line.match(/\[(\/[^\]]*)\]/);
    if (!m) continue;
    if (!/301|de-optimaliseren|interne links/i.test(line)) continue;
    const action = /301/.test(line) ? "301" : /de-optimaliseren/i.test(line) ? "de-optimaliseren" : "interne links";
    if (!out.some((r) => r.path === m[1])) out.push({ path: m[1], action });
  }
  return out;
}

// Diepere duiding van één tabel-rij: legt de GSC-data van de rij-pagina naast
// die van de winnaar en geeft een kort, eerlijk oordeel: echte query-splitsing
// of niet, en klopt de voorgestelde actie. Gebruikt door de check-overlay
// (op aanvraag) en als achtergrond in het taak-document.
export async function canniRowDuiding(slug: string, url: string, rowPath: string): Promise<string> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) throw new Error("Deze klant heeft nog geen domein ingevuld.");
  let origin = "";
  try { origin = new URL(url).origin; } catch { origin = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`; }
  const rowUrl = origin + rowPath;
  const cur = await getPageCannibal(slug, url);
  const analysis = (cur.result || "").trim();
  const rowLine = analysis.split("\n").find((l) => l.includes(`[${rowPath}]`)) || "";
  const [gscRow, gscWinner] = await Promise.all([
    getGscForPage(domain, rowUrl, 90).catch(() => []),
    getGscForPage(domain, url, 90).catch(() => []),
  ]);
  const fmt = (rows: { keyword: string; clicks: number; impressions: number; position: number }[]) =>
    rows.slice(0, 20).map((r) => `- "${r.keyword}" pos ${r.position.toFixed(1)} | ${r.clicks} klik | ${r.impressions} vert`).join("\n") || "- (geen data)";
  return callClaude(
    `Je bent een senior SEO-strateeg bij bureau Pingwin. Geef een KORTE, eerlijke reality-check van één cannibalisatie-voorstel, op basis van echte GSC-data (laatste 90 dagen). Nederlands, gewone taal, geen emoji.
Beantwoord scanbaar in markdown, hooguit ~200 woorden:
1. **Echte splitsing?** Krijgen beide pagina's vertoningen op dezelfde zoektermen (noem de termen met posities), of bedienen ze elk een eigen vraag?
2. **Klopt de voorgestelde actie?** Toets het voorstel uit de analyse-regel aan de data. LET OP: bij taalvarianten (zoals /en/-paden) is 301 of canonical vrijwel nooit juist; het nette antwoord is hreflang-koppeling + de variant volledig in de eigen taal uitwerken.
3. **Advies:** wat zou jij doen (nu uitvoeren / als taak inplannen / naar de pagina-aanpak schuiven / afwijzen), in één of twee zinnen met de kern van het waarom.
Verzin niets; baseer je alleen op de meegegeven data.`,
    [{ role: "user", content: `Geanalyseerde landingspagina (de beoogde winnaar): ${url}\nRij-pagina waar het voorstel over gaat: ${rowUrl}\n\nVoorstel uit de analyse-tabel:\n${rowLine || "(regel niet gevonden)"}\n\nGSC-data rij-pagina:\n${fmt(gscRow)}\n\nGSC-data winnaar:\n${fmt(gscWinner)}` }],
    1500, { slug, action: "canni_duiding" }, LIGHT_MODEL,
  );
}

// "Taak maken" bij een tabel-rij: voor klussen die te groot zijn om direct uit
// te voeren maar op de korte termijn ingepland moeten worden (zoals een volledige
// taalversie). Maakt de diepere duiding, een werkdocument in de Drive-map van de
// pagina, en een taak in Werkzaamheden; markeert de rij als "taak".
export async function makeCanniRowTask(slug: string, url: string, rowPath: string): Promise<{ taskId: number | null; docLink: string }> {
  const cur = await getPageCannibal(slug, url);
  const analysis = (cur.result || "").trim();
  if (!analysis) throw new Error("Er is geen cannibalisatie-analyse meer voor deze pagina.");
  const rowLine = analysis.split("\n").find((l) => l.includes(`[${rowPath}]`)) || "";
  const client = await getClientBySlug(slug);
  const duiding = await canniRowDuiding(slug, url, rowPath).catch(() => "");

  // Werkdocument met de duiding als achtergrond, in de Drive-map van de pagina.
  let docLink = "";
  try {
    const { spec } = await canniTaskDocSpec(slug, url, rowPath, rowLine, duiding || rowLine);
    const buffer = await buildPingwinDoc(spec);
    const folder = await getPageDriveFolder(slug, url).catch(() => null);
    if (folder?.folderId) { try { ({ link: docLink } = await uploadDocx(folder.folderId, `${safeName(client?.name || slug)}-taak-${safeName(rowPath)}.docx`, buffer)); } catch { /* zonder link vastleggen */ } }
  } catch { /* document is aanvullend */ }

  // Dedupe: een eerdere taak voor dezelfde rij vervangen.
  try {
    const existing = await getTasks(slug).catch(() => []);
    const dupIds = existing.filter((t) => t.stepKind === `cannibal_taak:${rowPath}` && t.id != null).map((t) => t.id as number);
    if (dupIds.length) await deleteTasksByIds(slug, dupIds).catch(() => { /* stil */ });
  } catch { /* dedupe niet kritisch */ }

  const linkHtml = docLink ? ` (<a href="${docLink.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">document</a>)` : "";
  const ids = await appendTasks(slug, [{
    taak: `Cannibalisatie-taak ${rowPath}${linkHtml}`,
    toelichting: "",
    klantToelichting: "Uit de cannibalisatie-analyse: dit punt is te groot om direct door te voeren en staat daarom als eigen taak op de planning. De achtergrond en stappen staan in het gekoppelde document.",
    status: "Gepland", wie: "SEO", fase: "Opschonen",
    pageUrl: url, stepKind: `cannibal_taak:${rowPath}`, klantZichtbaar: true,
    docLink: docLink || undefined, clientDocLink: docLink || undefined,
  }]).catch(() => [] as number[]);

  await setCanniRowStatus(slug, url, rowPath, "taak").catch(() => { /* status is hulpinfo */ });
  return { taskId: ids[0] ?? null, docLink };
}

// "Aanbevelingen overnemen" = het BEVESTIGINGSMOMENT na de menselijke beoordeling.
// Kijkt naar de rij-statussen (uitgevoerd/doorgezet/afgewezen; geen status =
// nog voorgesteld) en maakt op basis dáárvan het klantdocument + de Dev-taak:
// alleen geaccepteerde acties in de lijsten, afgewezen voorstellen met reden.
export async function applyPageCannibal(slug: string, url: string): Promise<{ taskId: number | null; docLink: string; executed: number; deferred: number; rejected: number; tasked: number; unreviewed: number }> {
  const cur = await getPageCannibal(slug, url);
  const analysis = (cur.result || "").trim();
  if (!analysis) throw new Error("Er is nog geen cannibalisatie-analyse voor deze pagina. Draai eerst de analyse.");
  const client = await getClientBySlug(slug);
  const path = pagePath(url);

  // 1. De menselijke beslissingen per rij + de live-verificatie van de 301's.
  const statuses = await getCanniRowStatuses(slug, url).catch(() => ({} as Record<string, { status: string; reason: string }>));
  const redirDone = await getPageRedirects(slug, url).catch(() => []);
  const verifiedMap = new Map(redirDone.map((r) => [r.fromPath, r.verified]));
  const rows = parseActionableRows(analysis);
  const executed = rows.filter((r) => statuses[r.path]?.status === "uitgevoerd");
  const deferred = rows.filter((r) => statuses[r.path]?.status === "doorgezet");
  const rejected = rows.filter((r) => statuses[r.path]?.status === "afgewezen");
  const tasked = rows.filter((r) => statuses[r.path]?.status === "taak");
  const unreviewed = rows.filter((r) => !statuses[r.path]);

  const decisions = [
    "BESLISSINGEN PER RIJ (na menselijke beoordeling; LEIDEND voor het document):",
    ...executed.map((r) => `- ${r.path} (${r.action}): GEACCEPTEERD EN DOORGEVOERD${r.action === "301" ? (verifiedMap.get(r.path) ? ", live gecontroleerd (echte 301 naar het juiste doel)" : ", live-controle nog niet geslaagd") : ""}`),
    ...deferred.map((r) => `- ${r.path} (${r.action}): OPGESCHOVEN, wordt opgepakt wanneer die pagina zelf onder handen wordt genomen (advies staat daar klaar)`),
    ...tasked.map((r) => `- ${r.path} (${r.action}): INGEPLAND ALS APARTE TAAK op de korte termijn (groter werk, eigen werkdocument met de stappen)`),
    ...rejected.map((r) => `- ${r.path} (${r.action}): AFGEWEZEN${statuses[r.path]?.reason ? `, reden: ${statuses[r.path].reason}` : " (zonder opgegeven reden)"}`),
    ...unreviewed.map((r) => `- ${r.path} (${r.action}): NOG NIET BEOORDEELD, laat deze volledig weg uit het document`),
  ].join("\n");

  // 2. Dev-inhoud: uitleg + ALLEEN de geaccepteerde redirects/interne links.
  const devMd = await callClaude(
    `Maak uit de cannibalisatie- en content-mapping-analyse hieronder een BEKNOPT developer-overzicht in markdown, met exact deze opbouw:
1. Twee tot drie zinnen in gewone taal: wat deze stap is en waarom (cannibalisatie oplossen zodat Google de juiste pagina laat ranken).
2. Kop "301-redirects" met een lijst "van-pad → naar-pad".
3. Kop "Interne links" met een lijst "vanaf-pad → naar-pad — ankertekst".
NEEM UITSLUITEND de acties op voor deze GEACCEPTEERDE paden: ${executed.length ? executed.map((r) => r.path).join(", ") : "(geen)"}. Alle andere paden (afgewezen/opgeschoven/onbeoordeeld) laat je volledig weg uit de lijsten. Neem uitsluitend wat in de analyse staat; verzin niets. Geen emoji. Blijft er geen enkele redirect of interne link over, zeg dat kort.`,
    [{ role: "user", content: analysis.slice(0, 16000) }], 3000, { slug, action: "page_cannibal_apply" },
  ).catch(() => "");
  const devContent = (devMd || "").replace(/```/g, "").trim() || analysis;

  // 3. Pingwin-document van de dev-inhoud, in de Drive-map van de pagina (indien ingesteld).
  let docLink = "";
  try {
    const { spec } = await cannibalDocSpec(slug, url, analysis, devContent, decisions);
    const buffer = await buildPingwinDoc(spec);
    const folder = await getPageDriveFolder(slug, url).catch(() => null);
    if (folder?.folderId) { try { ({ link: docLink } = await uploadDocx(folder.folderId, `${safeName(client?.name || slug)}-cannibalisatie-${safeName(path)}.docx`, buffer)); } catch { /* zonder link vastleggen */ } }
  } catch { /* document is aanvullend; de taak met de lijst komt er sowieso */ }

  // 4. Eén Dev-taak met de lijst erin (+ document eraan gekoppeld). Dedupe bij opnieuw overnemen.
  try {
    const existing = await getTasks(slug).catch(() => []);
    const dupIds = existing.filter((t) => t.stepKind === "cannibal_redirects" && t.pageUrl === url && t.id != null).map((t) => t.id as number);
    if (dupIds.length) await deleteTasksByIds(slug, dupIds).catch(() => { /* stil */ });
  } catch { /* dedupe niet kritisch */ }

  const klantUitleg = "We hebben in kaart gebracht welke pagina's elkaar in de weg zitten en welke redirects en interne links nodig zijn, zodat Google de juiste pagina laat ranken.";
  // De taak is een NAAM + (als er een document is) een link ernaartoe; de volledige lijst
  // met redirects/interne links staat in dat document, NIET in de toelichting (dat veld is
  // voor onze eigen handmatige opmerkingen). Alleen als er geen Drive-map is (geen document),
  // zetten we het overzicht als vangnet in de toelichting zodat de lijst niet verloren gaat.
  const linkHtml = docLink ? ` (<a href="${docLink.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">document</a>)` : "";
  // Taak-status volgt de werkelijkheid: alles beoordeeld en alle geaccepteerde
  // 301's live geverifieerd → Klaar; anders blijft hij open.
  const allVerified = executed.filter((r) => r.action === "301").every((r) => verifiedMap.get(r.path) === true);
  const taskStatus = unreviewed.length === 0 && allVerified ? "Klaar" : "Gepland";
  const ids = await appendTasks(slug, [{
    taak: `Cannibalisatie, redirects en interne links ${path}${linkHtml}`,
    toelichting: docLink ? "" : mdToHtml(devContent.slice(0, 8000)),
    klantToelichting: klantUitleg,
    status: taskStatus, wie: "Dev", fase: "Opschonen",
    pageUrl: url, stepKind: "cannibal_redirects", klantZichtbaar: true,
    docLink: docLink || undefined, clientDocLink: docLink || undefined,
  }]).catch(() => [] as number[]);

  return { taskId: ids[0] ?? null, docLink, executed: executed.length, deferred: deferred.length, rejected: rejected.length, tasked: tasked.length, unreviewed: unreviewed.length };
}
