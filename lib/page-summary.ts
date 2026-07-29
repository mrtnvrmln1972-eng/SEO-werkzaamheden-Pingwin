// Destilleert de KORTE samenvatting (de toplaag) uit de vastgelegde strategie van
// een pagina. Doel: in één oogopslag "wat doet deze pagina nu, wat moet die worden,
// wat is de belangrijkste zet", zonder de hele analyse te lezen. Bewust het goedkope
// model: dit is puur samenvatten van tekst die er al staat, geen nieuwe analyse.

import { callClaude, LIGHT_MODEL, anthropicConfigured } from "./anthropic";
import { getPagePlan, savePageSummary, type PageSummary } from "./site-urls";

const SYSTEM = `Je bent de samenvatter van Pingwin, een SEO-bureau. Je krijgt de vastgelegde SEO-strategie van één webpagina. Vat die samen tot een piepkleine kop in GEWONE, NEDERLANDSE taal, zodat iemand in één oogopslag snapt wat deze pagina nu doet en moet worden. Geen jargon, geen SEO-vaktermen die een leek niet snapt, geen marketingtaal.

Geef PRECIES dit JSON-object terug en niets anders (geen uitleg, geen markdown eromheen):
{
  "nu": "één korte zin: wat deze pagina vandaag is en waar hij op scoort of wat er misgaat",
  "doel": "één korte zin: wat deze pagina moet worden en op welk hoofdzoekwoord",
  "zet": "één korte zin: de ÉÉN belangrijkste actie die het meeste oplevert",
  "related": "als de strategie een andere pagina van dezelfde site noemt die hiermee samenhangt: één korte zin zoals 'Hangt samen met /andere-pagina/: die pakt X, deze pakt Y.' Noem alleen paden/URL's die letterlijk in de strategie staan. Is er geen samenhang, geef dan een lege string."
}

Regels:
- Elke waarde is één zin, maximaal ongeveer 20 woorden. Kort is beter.
- Gebruik NOOIT een los liggend streepje (em-dash of en-dash) als zinsscheiding; gebruik komma, puntkomma, haakjes of een nieuwe zin.
- Verzin niets. Staat iets niet in de strategie, laat het weg of houd de zin algemener.
- Schrijf zoals je het aan een klant zou uitleggen.`;

// Haalt het (eerste) JSON-object uit een modelantwoord, ook als er per ongeluk
// tekst omheen staat.
function parseJson(raw: string): PageSummary | null {
  const t = (raw || "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1));
    const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
    return { nu: clean(o.nu), doel: clean(o.doel), zet: clean(o.zet), related: clean(o.related) };
  } catch { return null; }
}

export type GenResult = { ok: true; summary: PageSummary } | { ok: false; error: string };

// Genereert de samenvatting uit het vastgelegde plan van de pagina en slaat hem op.
export async function generatePageSummary(slug: string, url: string): Promise<GenResult> {
  if (!anthropicConfigured()) return { ok: false, error: "De samenvatting heeft een ANTHROPIC_API_KEY nodig in Vercel." };
  const plan = (await getPagePlan(slug, url)).trim();
  if (!plan) return { ok: false, error: "Er is nog geen vastgelegde strategie voor deze pagina; leg die eerst vast, dan kan ik hem samenvatten." };
  const user = `De pagina is: ${url}\n\nDe vastgelegde strategie:\n\n${plan}`;
  let raw: string;
  try {
    raw = await callClaude(SYSTEM, [{ role: "user", content: user }], 600, { slug, action: "page-summary" }, LIGHT_MODEL);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Samenvatten mislukt." };
  }
  const summary = parseJson(raw);
  if (!summary || (!summary.nu && !summary.doel && !summary.zet)) return { ok: false, error: "Kon geen bruikbare samenvatting maken; probeer het opnieuw." };
  await savePageSummary(slug, url, summary);
  return { ok: true, summary };
}
