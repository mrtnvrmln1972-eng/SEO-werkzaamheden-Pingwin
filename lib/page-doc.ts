import { getClientBySlug } from "./clients";
import { getPagePlan } from "./site-urls";
import { getTasks } from "./tasks";
import { getGscForPage } from "./google";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";
import { SEO_CRITERIA_MD } from "./seo-criteria";
import { getPageSpeed, pageSpeedToText } from "./pagespeed";
import { ahrefsConfigured, getUrlOrganicKeywords, getSerpOverview, getKeywordsOverview, getKeywordIdeas } from "./ahrefs";

export type DocKind = "analyse" | "blauwdruk" | "copy";

// Genereert de INHOUD voor een Pingwin-document (blauwdruk of copy), gegrond in
// de live paginadata + het plan + GSC. De huisstijl-opmaak gebeurt daarna in
// lib/pingwin-docx.ts. De methodiek komt uit de Pingwin SEO-skills.

// Bepaalt het primaire zoekwoord uit de GSC-data (meeste klikken, anders meeste
// vertoningen). Dit is het zaadje voor de Ahrefs SERP- en variantenanalyse.
function derivePrimaryKeyword(kw: { keyword: string; clicks: number; impressions: number }[]): string {
  if (!kw.length) return "";
  const sorted = [...kw].sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions));
  return sorted[0]?.keyword || "";
}

// Haalt het GEKOZEN primaire zoekwoord uit het plan (regel "Primair: ..."). Dat
// is leidend boven de GSC-ranking, want we optimaliseren juist naar nieuw gekozen
// zoekwoorden die van de huidige ranking kunnen afwijken.
function planPrimaryKeyword(plan: string): string {
  const m = (plan || "").match(/primair\s*[:：]\s*([^\n]+)/i);
  if (!m) return "";
  return m[1].replace(/\*+/g, "").trim();
}

async function buildContext(slug: string, url: string, extra?: string): Promise<string> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  // Ronde 1: goedkope/snelle bronnen parallel.
  const [plan, content, kw, psi, allTasks] = await Promise.all([
    getPagePlan(slug, url),
    fetchPageContent(url).catch(() => null),
    getGscForPage(domain, url).catch(() => []),
    getPageSpeed(url).catch(() => null),
    getTasks(slug).catch(() => []),
  ]);

  const normUrl = (u?: string) => (u || "").trim().replace(/\/+$/, "");
  const pageTasks = allTasks.filter((t) => normUrl(t.pageUrl) === normUrl(url));

  // Gekozen zoekwoord uit het plan is leidend; anders de GSC-topper.
  const primary = planPrimaryKeyword(plan) || derivePrimaryKeyword(kw);

  // Ronde 2: Ahrefs-diepte (alleen als geconfigureerd). Top-10 SERP + varianten op
  // het primaire zoekwoord, plus de zoekwoorden waarop de URL zelf organisch scoort.
  let ahrefsText = "";
  if (ahrefsConfigured()) {
    const [urlKw, serp, overview, ideas] = await Promise.all([
      getUrlOrganicKeywords(url, "nl", 40).catch(() => []),
      primary ? getSerpOverview(primary, "nl").catch(() => []) : Promise.resolve([]),
      primary ? getKeywordsOverview([primary], "nl").catch(() => []) : Promise.resolve([]),
      primary ? getKeywordIdeas(primary, "nl", 25).catch(() => []) : Promise.resolve([]),
    ]);
    const ov = overview[0];
    ahrefsText = [
      "AHREFS-DATA:",
      primary ? `Primair zoekwoord (afgeleid uit GSC): "${primary}"${ov ? ` — volume ${ov.volume ?? "n/b"}/mnd, KD ${ov.difficulty ?? "n/b"}, CPC ${ov.cpc ?? "n/b"}` : ""}` : "Primair zoekwoord: (niet af te leiden uit GSC)",
      "",
      "Top-10 SERP voor het primaire zoekwoord (voor intentie- en cannibalisatie-check):",
      serp.length ? serp.slice(0, 10).map((s) => `- #${s.position} ${s.url} (DR ${s.domainRating ?? "n/b"}${s.type ? `, ${s.type}` : ""})`).join("\n") : "- (geen SERP-data)",
      "",
      "Zoekwoorden waarop DEZE URL nu organisch scoort (Ahrefs):",
      urlKw.length ? urlKw.slice(0, 25).map((k) => `- "${k.keyword}": positie ${k.position ?? "n/b"}, volume ${k.volume ?? "n/b"}, verkeer ${k.traffic ?? "n/b"}`).join("\n") : "- (geen)",
      "",
      "Semantische varianten / keyword-ideeën (voor de variantenlijst KW-04, §17):",
      ideas.length ? ideas.slice(0, 20).map((k) => `- "${k.keyword}" (volume ${k.volume ?? "n/b"}, KD ${k.difficulty ?? "n/b"})`).join("\n") : "- (geen)",
    ].join("\n");
  } else {
    ahrefsText = "AHREFS-DATA: niet beschikbaar (geen Ahrefs-koppeling ingesteld).";
  }

  return [
    `KLANT: ${client?.name || slug}`,
    client?.seoProfile ? `KLANTPROFIEL: ${client.seoProfile}` : "",
    `PAGINA: ${url}`,
    primary ? `GEKOZEN PRIMAIR ZOEKWOORD (leidend, uit het plan/GSC): "${primary}"` : "",
    `OVERGENOMEN PLAN VOOR DEZE PAGINA (de strategische conclusie, leidend): ${plan || "(nog geen plan, leid af uit de data)"}`,
    "",
    "OVERGENOMEN TAKEN VOOR DEZE PAGINA (uit de analyse-chat):",
    pageTasks.length ? pageTasks.map((t) => `- [${t.fase || "?"}${t.wie ? "/" + t.wie : ""}] ${t.taak}${t.status ? ` (${t.status})` : ""}`).join("\n") : "- (nog geen taken overgenomen)",
    extra ? `\nEXTRA STURING VAN DE GEBRUIKER (weeg zwaar mee): ${extra}` : "",
    "",
    "LIVE ON-PAGE INHOUD:",
    content ? `Titel: ${content.title}\nH1: ${content.h1 || "(leeg!)"}\nMeta: ${content.metaDescription}\nKoppen: ${content.headings.join(" | ")}\nTekst (fragment): ${content.text.slice(0, 1200)}` : "(kon de pagina niet inlezen)",
    "",
    "GSC-ZOEKWOORDEN VAN DEZE PAGINA:",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen)",
    "",
    psi ? pageSpeedToText(psi) : "Core Web Vitals: niet gemeten.",
    "",
    ahrefsText,
  ].filter(Boolean).join("\n");
}

const DOCSPEC_FORMAT = `Geef UITSLUITEND geldige JSON, niets eromheen, exact dit formaat:
{"titel": "...", "ondertitel": "...", "sections": [ {"heading": "1. Sectienaam", "blocks": [ ... ]} ]}
Toegestane bloktypes in "blocks":
- {"type":"paragraph","text":"..."}
- {"type":"subheading","text":"..."}
- {"type":"bullets","items":["...","..."]}
- {"type":"table","headers":["Kol1","Kol2"],"rows":[["a","b"],["c","d"]]}
- {"type":"highlight","text":"belangrijke callout"}
- {"type":"step","nr":1,"title":"...","text":"..."}
Houd het compleet maar compact. Geen markdown-tekens in de tekstvelden. Gebruik NERGENS emoji of symbolen als iconen (ook niet in classificaties: schrijf CRITICAL/MAJOR/MINOR en PASS/FAIL als gewone tekst, geen gekleurde bolletjes of vinkjes).`;

const ANALYSE_SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin en voert een criteria-gestuurde SEO-ANALYSE uit van een BESTAANDE landingspagina.
Je scoort objectief tegen het criteria-document hieronder (de single source of truth). Geen subjectieve oordelen: alleen een gemeten waarde getoetst aan de norm uit een criterium-ID.

Lever, elk als eigen sectie:
0. Gate-verdict (bovenaan, als highlight): PASS of FAIL, de score /100, het aantal CRITICAL- en MAJOR-failures met hun ID's. Gate = PASS bij 0 CRITICAL, hooguit 2 MAJOR en score >= 85.
1. Samenvatting & KPI's: de GSC-cijfers van deze pagina (posities, klikken, vertoningen) in een tabel.
2. Huidige rankings: tabel van de zoekwoorden waarop de pagina nu scoort, met positie; markeer quick wins (positie 4-20).
3. Paginastructuur & meta: de huidige H1/koppen + title/meta, elk getoetst aan het bijbehorende criterium-ID met status.
4. Content, keyword & semantiek: woordenaantal vs. norm voor het pagina-type, keyword-dekking, variantenlijst (10-15), direct-antwoord-check.
5. Zoekintentie & SERP-alignment.
6. FAQ & AEO-readiness.
7. E-E-A-T, conversie & trust.
8. SCORECARD (de kern): een grote tabel met per criterium-ID uit het criteria-document: ID, criterium, classificatie (CRITICAL/MAJOR/MINOR), gemeten waarde, norm, status (PASS/FAIL/PARTIAL/N/A), opmerking. Loop ALLE relevante criteria langs. Gebruik de Core Web Vitals uit de PageSpeed-data hieronder om CWV-01 t/m CWV-08 echt te scoren; gebruik de Ahrefs top-10 SERP om INT-01 (pagina-type vs. dominant SERP-type) te toetsen en de Ahrefs-varianten voor KW-04. Alleen wat écht niet in de data zit markeer je als "niet gemeten".
9. Prioriteiten & aanbevelingen: minimaal 5, gesorteerd op impact x inspanning, elk met een criterium-ID.

BEOORDEEL DE HUIDIGE PAGINA IN HET LICHT VAN HET GEKOZEN PRIMAIRE ZOEKWOORD (niet alleen de huidige ranking): in welke mate is de bestaande content al geoptimaliseerd voor dat zoekwoord en de zoekintentie? Benoem expliciet welke bestaande elementen (koppen, alinea's, FAQ, tabellen, beeld) BEHOUDEN kunnen blijven omdat ze voldoen, en welke moeten worden aangepast of toegevoegd. Behoud is het uitgangspunt; verander alleen wat de criteria of de top-10-analyse vereisen.

Wees eerlijk: dit is een audit, geen verkooppraatje. Verzin geen rankings of Core Web Vitals; wat je niet gemeten hebt, benoem je als niet gemeten.

CRITERIA-DOCUMENT (leidend voor de scorecard):
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const BLUEPRINT_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin en maakt een BLAUWDRUK voor een landingspagina.
De blauwdruk bevat, elk als eigen sectie:
1. Zoekwoord-strategie: primair zoekwoord + secundaire/variant-zoekwoorden (tabel met zoekwoord + rol/volume waar bekend).
2. Headings-structuur: de voorgestelde H1, en de H2's/H3's in volgorde (elke H2 dekt idealiter een zoekwoord/subthema).
3. Meta: 2 varianten meta-title (max ~60 tekens) en 2 varianten meta-description (max ~155 tekens).
4. FAQ: 4 tot 6 vragen die de zoekintentie dekken.
5. Interne links: welke andere pagina's naar deze pagina linken en met welke ankertekst.
6. Beeld-briefs: kort wat voor beeld/alt-tekst per sectie.
UITGANGSPUNT BEHOUD: vertrek van de bestaande pagina-inhoud + het overgenomen plan en de taken. Geef de PERFECTE invulling voor deze landingspagina: behoud wat er al staat en voldoet aan de criteria + de top-10-eisen, en voeg alleen toe of herschrijf wat daaruit ontbreekt. Maak per sectie duidelijk of het BEHOUDEN, AANPASSEN of NIEUW is. Baseer de structuur op de top-10-analyse van het gekozen zoekwoord.
Werk conform de Pingwin-criteria: H2-dekking 60-80% (target 70%, criterium H2-01), primair zoekwoord front-loaded in de meta-title (META-03), title 50-60 tekens (META-02), meta-description 140-160 tekens (META-07), FAQ 4-8 vragen die een zoekwoord/long-tail bevatten (FAQ-02/03), en een variantenlijst van 10-15 semantische varianten (KW-04, §17).
Gegrond in de data hieronder; verzin geen rankings.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const COPY_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft publicatieklare landingspagina-copy.
Werk tegen deze harde criteria: primair zoekwoord in de eerste 100 woorden; H2-koppen dekken 60-80% van de zoekwoorden; natuurlijke keyword-density 0,5-2%; semantische varianten ≥60% gedekt; open met een direct antwoord op de zoekintentie; FAQ-antwoorden 40-80 woorden.
Toon: warm, deskundig, passend bij het klantprofiel; geen holle marketingtaal, concreet en to-the-point.
Lever de VOLLEDIGE copy uit als document: de H1, per H2 de kop + de alineatekst (als paragraph-blokken), eventuele bullets, en een FAQ-sectie met vraag (subheading) + antwoord (paragraph). Ook een meta-title en meta-description bovenaan als eigen sectie.
UITGANGSPUNT BEHOUD: hergebruik bestaande zinnen/alinea's van de huidige pagina waar die goed zijn en voldoen aan de criteria; herschrijf alleen waar nodig en vul aan met wat de blauwdruk/top-10-analyse vereist. In de copy zit alles uit het plan, de taken en de analyse verwerkt.
Toets je eigen copy aan de Pingwin-criteria hieronder (met name §1 headings, §2 keyword/semantiek, §3 meta, §4 content, §6 FAQ, §12 AEO). Gegrond in de data hieronder.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const SYSTEMS: Record<DocKind, string> = { analyse: ANALYSE_SYSTEM, blauwdruk: BLUEPRINT_SYSTEM, copy: COPY_SYSTEM };
const RAPPORTTYPE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "SEO-blauwdruk", copy: "SEO-copy" };
const FALLBACK_TITLE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copy" };

export async function generateDocSpec(slug: string, url: string, kind: DocKind, extra?: string): Promise<{ spec: DocSpec; title: string }> {
  const context = await buildContext(slug, url, extra);
  const client = await getClientBySlug(slug);
  // Analyse levert een grote scorecard: ruimer tokenbudget zodat de tabel niet afkapt.
  const maxTokens = kind === "analyse" ? 8000 : 4096;
  const raw = await callClaude(SYSTEMS[kind], [{ role: "user", content: `Maak de ${kind} op basis van deze gegevens:\n\n${context}` }], maxTokens);
  const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `${FALLBACK_TITLE[kind]} ${url}`;
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: RAPPORTTYPE[kind],
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}
