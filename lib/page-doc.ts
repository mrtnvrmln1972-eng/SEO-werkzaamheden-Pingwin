import { getClientBySlug } from "./clients";
import { getPagePlan } from "./site-urls";
import { getGscForPage } from "./google";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";
import type { DocSpec } from "./pingwin-docx";

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

const BLUEPRINT_SYSTEM = `Je bent een senior SEO-strateeg bij bureau Pingwin en maakt een BLAUWDRUK voor een landingspagina.
De blauwdruk bevat, elk als eigen sectie:
1. Zoekwoord-strategie: primair zoekwoord + secundaire/variant-zoekwoorden (tabel met zoekwoord + rol/volume waar bekend).
2. Headings-structuur: de voorgestelde H1, en de H2's/H3's in volgorde (elke H2 dekt idealiter een zoekwoord/subthema).
3. Meta: 2 varianten meta-title (max ~60 tekens) en 2 varianten meta-description (max ~155 tekens).
4. FAQ: 4 tot 6 vragen die de zoekintentie dekken.
5. Interne links: welke andere pagina's naar deze pagina linken en met welke ankertekst.
6. Beeld-briefs: kort wat voor beeld/alt-tekst per sectie.
Gegrond in de data hieronder; verzin geen rankings. ${DOCSPEC_FORMAT}`;

const COPY_SYSTEM = `Je bent een senior SEO-copywriter bij bureau Pingwin en schrijft publicatieklare landingspagina-copy.
Werk tegen deze harde criteria: primair zoekwoord in de eerste 100 woorden; H2-koppen dekken 60-80% van de zoekwoorden; natuurlijke keyword-density 0,5-2%; semantische varianten ≥60% gedekt; open met een direct antwoord op de zoekintentie; FAQ-antwoorden 40-80 woorden.
Toon: warm, deskundig, passend bij het klantprofiel; geen holle marketingtaal, concreet en to-the-point.
Lever de VOLLEDIGE copy uit als document: de H1, per H2 de kop + de alineatekst (als paragraph-blokken), eventuele bullets, en een FAQ-sectie met vraag (subheading) + antwoord (paragraph). Ook een meta-title en meta-description bovenaan als eigen sectie.
Gegrond in de data hieronder. ${DOCSPEC_FORMAT}`;

export async function generateDocSpec(slug: string, url: string, kind: "blauwdruk" | "copy"): Promise<{ spec: DocSpec; title: string }> {
  const context = await buildContext(slug, url);
  const client = await getClientBySlug(slug);
  const system = kind === "copy" ? COPY_SYSTEM : BLUEPRINT_SYSTEM;
  const raw = await callClaude(system, [{ role: "user", content: `Maak de ${kind} op basis van deze gegevens:\n\n${context}` }], 4096);
  const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  const title = typeof parsed.titel === "string" && parsed.titel.trim() ? parsed.titel.trim() : `${kind === "copy" ? "Copy" : "Blauwdruk"} ${url}`;
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: kind === "copy" ? "SEO-copy" : "SEO-blauwdruk",
    titel: title,
    ondertitel: typeof parsed.ondertitel === "string" ? parsed.ondertitel : url,
    meta: { Klant: client?.name || slug, Pagina: url },
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
  };
  return { spec, title };
}
