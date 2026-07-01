import { getClientBySlug } from "./clients";
import { getPagePlan } from "./site-urls";
import { getGscForPage } from "./google";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";
import { SEO_CRITERIA_MD } from "./seo-criteria";

export type DocKind = "analyse" | "blauwdruk" | "copy";

// Genereert de INHOUD voor een Pingwin-document (blauwdruk of copy), gegrond in
// de live paginadata + het plan + GSC. De huisstijl-opmaak gebeurt daarna in
// lib/pingwin-docx.ts. De methodiek komt uit de Pingwin SEO-skills.

async function buildContext(slug: string, url: string): Promise<string> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const [plan, content, kw] = await Promise.all([
    getPagePlan(slug, url),
    fetchPageContent(url).catch(() => null),
    getGscForPage(domain, url).catch(() => []),
  ]);
  return [
    `KLANT: ${client?.name || slug}`,
    client?.seoProfile ? `KLANTPROFIEL: ${client.seoProfile}` : "",
    `PAGINA: ${url}`,
    `PLAN VOOR DEZE PAGINA: ${plan || "(nog geen plan, leid af uit de data)"}`,
    "",
    "LIVE ON-PAGE INHOUD:",
    content ? `Titel: ${content.title}\nH1: ${content.h1 || "(leeg!)"}\nMeta: ${content.metaDescription}\nKoppen: ${content.headings.join(" | ")}\nTekst (fragment): ${content.text.slice(0, 1200)}` : "(kon de pagina niet inlezen)",
    "",
    "GSC-ZOEKWOORDEN VAN DEZE PAGINA:",
    kw.length ? kw.map((k) => `- "${k.keyword}": positie ${k.position}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") : "- (geen)",
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
Houd het compleet maar compact. Geen markdown-tekens in de tekstvelden.`;

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
8. SCORECARD (de kern): een grote tabel met per criterium-ID uit het criteria-document: ID, criterium, classificatie (CRITICAL/MAJOR/MINOR), gemeten waarde, norm, status (PASS/FAIL/PARTIAL/N/A), opmerking. Loop ALLE relevante criteria langs; markeer wat niet server-side meetbaar is expliciet als "niet gemeten" (bijv. Core Web Vitals) in plaats van gokken.
9. Prioriteiten & aanbevelingen: minimaal 5, gesorteerd op impact x inspanning, elk met een criterium-ID.

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
Werk conform de Pingwin-criteria: H2-dekking 60-80% (target 70%, criterium H2-01), primair zoekwoord front-loaded in de meta-title (META-03), title 50-60 tekens (META-02), meta-description 140-160 tekens (META-07), FAQ 4-8 vragen die een zoekwoord/long-tail bevatten (FAQ-02/03), en een variantenlijst van 10-15 semantische varianten (KW-04, §17).
Gegrond in de data hieronder; verzin geen rankings.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const COPY_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft publicatieklare landingspagina-copy.
Werk tegen deze harde criteria: primair zoekwoord in de eerste 100 woorden; H2-koppen dekken 60-80% van de zoekwoorden; natuurlijke keyword-density 0,5-2%; semantische varianten ≥60% gedekt; open met een direct antwoord op de zoekintentie; FAQ-antwoorden 40-80 woorden.
Toon: warm, deskundig, passend bij het klantprofiel; geen holle marketingtaal, concreet en to-the-point.
Lever de VOLLEDIGE copy uit als document: de H1, per H2 de kop + de alineatekst (als paragraph-blokken), eventuele bullets, en een FAQ-sectie met vraag (subheading) + antwoord (paragraph). Ook een meta-title en meta-description bovenaan als eigen sectie.
Toets je eigen copy aan de Pingwin-criteria hieronder (met name §1 headings, §2 keyword/semantiek, §3 meta, §4 content, §6 FAQ, §12 AEO). Gegrond in de data hieronder.

RELEVANTE CRITERIA:
${SEO_CRITERIA_MD}

${DOCSPEC_FORMAT}`;

const SYSTEMS: Record<DocKind, string> = { analyse: ANALYSE_SYSTEM, blauwdruk: BLUEPRINT_SYSTEM, copy: COPY_SYSTEM };
const RAPPORTTYPE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "SEO-blauwdruk", copy: "SEO-copy" };
const FALLBACK_TITLE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copy" };

export async function generateDocSpec(slug: string, url: string, kind: DocKind): Promise<{ spec: DocSpec; title: string }> {
  const context = await buildContext(slug, url);
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
