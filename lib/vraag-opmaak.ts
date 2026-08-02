// Maartens eigen vragen compact en scanbaar tonen.
//
// Waarom: zijn vragen stonden in hoge blokken met witregels tussen elke alinea. In
// een gesprek van vier vragen kost dat een half scherm aan lucht, terwijl hij alleen
// wil terugvinden wát hij vroeg.
//
// Twee ingrepen, allebei mechanisch:
//  - Witregels eruit, alles achter elkaar.
//  - De kernwoorden vet, zodat de vraag te scannen is.
//
// Bewust GEEN AI die de vraag herschrijft: het zijn zijn woorden en die blijven
// exact staan. Er wordt alleen vet omheen gezet.

// Vaktermen die de kern van een vraag dragen. Klein en concreet gehouden; een lange
// lijst maakt alles vet en dan is niets meer vet.
const KERNWOORDEN = [
  "weekplanning", "weekplan", "planning", "landingspagina", "landingspagina's",
  "zoekwoord", "zoekwoorden", "blauwdruk", "analyse", "copy", "webcopy", "meta",
  "structured data", "schema", "cannibalisatie", "interne links", "alt-teksten",
  "sitebouwer", "doorgevoerd", "live", "overzicht", "conclusie", "conclusies",
  "taken", "taak", "kaart", "kaarten", "prioriteit", "laaghangend fruit",
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * De vraag als compacte HTML: alinea's achter elkaar, kernwoorden vet.
 * Paden en geciteerde termen worden ook vet, want daar gaat de vraag meestal over.
 */
export function vraagHtml(tekst: string): string {
  // Alinea's samenvoegen tot doorlopende tekst; losse regels blijven één geheel.
  const compact = (tekst || "")
    .split(/\n+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ");

  let html = escapeHtml(compact);

  // 1. Paden en URL's: /hovenier-uden/ en https://...
  html = html.replace(/(^|[\s(])(\/[a-z0-9][a-z0-9\-/]*\/?)/gi, (_m, pre, pad) => `${pre}<strong>${pad}</strong>`);
  // 2. Termen tussen aanhalingstekens.
  html = html.replace(/(["'“„])([^"'”“„]{2,60})(["'”])/g, (_m, a, t, b) => `${a}<strong>${t}</strong>${b}`);
  // 3. Vaktermen. Alleen buiten bestaande <strong>, zodat er nooit vet in vet komt.
  for (const w of KERNWOORDEN) {
    const re = new RegExp(`(^|[^\\w<>])(${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")})(?![\\w])`, "gi");
    html = html.replace(re, (m, pre, woord, offset: number, hele: string) => {
      // Zit dit stuk al binnen een <strong>? Dan niets doen.
      const voor = hele.slice(0, offset);
      const open = voor.lastIndexOf("<strong>");
      const dicht = voor.lastIndexOf("</strong>");
      if (open > dicht) return m;
      return `${pre}<strong>${woord}</strong>`;
    });
  }
  return html;
}
