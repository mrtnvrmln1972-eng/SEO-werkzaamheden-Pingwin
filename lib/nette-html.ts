// ═══════════════════════════════════════════════════════════
// ÉÉN POORT: VAN TEKST NAAR NETTE HTML
// ═══════════════════════════════════════════════════════════
// De opmaakregel van dit dashboard is "nooit ruwe opmaaktekens in beeld, en elke
// link en elk pad klikbaar". Die regel werd op het scherm waargemaakt (er is één
// gedeeld opmaakblok in `app/globals.css`), maar niet in de code ervoor: élk
// scherm besliste zélf hoe een stuk tekst HTML werd. Op 17 augustus 2026 stonden
// er negenentwintig van die beslissingen naast elkaar, en ze waren het niet met
// elkaar eens:
//
//   - twee plekken hadden exact dezelfde regel uitgeschreven om te bepalen of
//     iets al HTML was of nog markdown (PagesPanel en de strategie-chat);
//   - de bespreekpunten en de aantekeningen deden iets zwakkers: tekst escapen
//     en regeleindes naar <br>, dus daar kwam `## Kopje` letterlijk in beeld;
//   - het developer-overzicht en de sturing op een taakkaart deden hetzelfde.
//
// Dat is dezelfde ziekte als bij het plakken (zie `lib/rich-paste.ts`), maar dan
// keer negenentwintig: dezelfde afspraak op veel plekken uitgeschreven loopt uit
// elkaar zonder dat iemand het merkt. Vandaar deze ene functie. Alles wat tekst
// op het scherm zet, zet hem hier doorheen.
//
// Bewaakt door `proeven/nette-html.proef.ts`.

import { mdToHtml } from "./markdown";
import { linkifyHtml } from "./linkify";
import { sanitizeHtml } from "./veilige-html";

// Bevat deze tekst markdown-opmaak? Dan moet hij gerenderd worden, ook als er
// toevallig ook een HTML-tag in staat. Precies de regel die eerder op twee
// plekken los stond uitgeschreven.
const MARKDOWN = /(^|\n)#{1,6}\s|\*\*[^*]|(^|\n)\s*[-*]\s|(^|\n)\s*\d+\.\s|\|[^|]*\|/;

// Echte HTML herken je aan een sluittag. Een losse `<` in een zin (of een
// genoemde tag als `<h1>`) is dat niet, en die hoort dus als leestekst in beeld
// te komen in plaats van als opmaak.
const SLUITTAG = /<\/[a-z][a-z0-9]*>/i;

export function isAlHtml(tekst: string): boolean {
  const t = tekst || "";
  return SLUITTAG.test(t) && !MARKDOWN.test(t);
}

// Een beeld, een regelafbreking of een lijn heeft geen sluittag, en is toch echt
// opmaak. Alleen deze drie: een genoemde tag in een zin (`<h1>`) blijft leestekst.
const LOSSE_TAG = /<(?:img|br|hr)\b/i;

/**
 * Bevat deze tekst al opmaak die van een bewerkbaar veld komt?
 *
 * Andere vraag dan `isAlHtml`, en met opzet. Die kiest bij twijfel voor
 * renderen: staat er markdown ín een stuk HTML, dan wint de markdown. Voor een
 * veld waar iemand zelf in typt is dat precies verkeerd om: typt hij letterlijk
 * `**twee sterretjes**` in een opgemaakte alinea, dan zou zijn eigen tekst
 * opnieuw door de renderer gaan en kwam er `&lt;p&gt;` in beeld. De opgeslagen
 * inhoud van zo'n veld is dus leidend; alleen tekst zonder één stukje opmaak
 * (de platte tekst van een doorgezette taak) gaat alsnog door de poort.
 */
export function bevatHtmlOpmaak(tekst: string): boolean {
  const t = tekst || "";
  return SLUITTAG.test(t) || LOSSE_TAG.test(t);
}

/** De site-URL in de twee vormen die de twee onderliggende functies willen. */
function siteVormen(basis?: string): { base: string; host: string } {
  const ruw = (basis || "").trim();
  if (!ruw) return { base: "", host: "" };
  const host = ruw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/\/+$/, "");
  return { base: host ? `https://${host}` : "", host };
}

/**
 * Tekst naar nette HTML, in precies één beslissing.
 *
 * Is het al echte HTML (opgeslagen uit een opmaakbaar veld), dan blijft die
 * staan en wordt hij alleen ontdaan van scripts. Is het markdown of platte
 * tekst, dan gaat hij door dezelfde renderer als alle andere tekst in het
 * dashboard. In beide gevallen worden URL's en paden daarna klikbaar gemaakt.
 *
 * `basis` is de site van de klant, zodat `/hovenier/etten-leur/` naar de echte
 * pagina wijst. Zonder basis blijven alleen volledige URL's klikbaar.
 */
export function netteHtml(tekst: string, opties: { basis?: string } = {}): string {
  const t = (tekst || "").trim();
  if (!t) return "";
  const { base, host } = siteVormen(opties.basis);
  const html = isAlHtml(t) ? sanitizeHtml(t) : mdToHtml(t, base);
  // `linkifyHtml` slaat bestaande links en tags over, dus dit maakt alleen
  // klikbaar wat de renderer nog liet staan; dubbel linken kan niet.
  return linkifyHtml(html, host);
}
