// ═══════════════════════════════════════════════════════════
// WAT MOET ER MET DE REST? EEN OORDEEL, GEEN LIJST URL'S
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026), Maartens woorden: "Hier heb ik gewoon een lijst met
// URL's waar ik geen reet aan heb." Terecht. Er stonden 331 pagina's onder de kop
// "geen aanleiding gevonden", en dat is geen bevinding maar een restbak. Je kunt
// er geen plan uit maken, want je weet niet wáárom een pagina er staat: geen
// zoekvraag, geen vertoningen, geen ranking, of gewoon niet bekeken.
//
// Zijn eigen redenering is precies de goede, en die is hier uitgewerkt:
//
//   "Er kan geen zoekvolume zijn; dat kan gewoon een reden zijn om die pagina op
//    te ruimen. Want als niemand erop zoekt, hoef je hem ook niet te hebben. We
//    hebben 1000+ pagina's, we moeten gaan opruimen. Als er wel zoekvolume is,
//    maar geen ranking, geen vertoningen, dan moeten we hem optimaliseren."
//
// Daaruit volgen vijf oordelen, en elk oordeel is een HANDELING met de cijfers
// eronder. Niet "geen aanleiding", maar "niemand vindt deze pagina: 0 vertoningen
// in 90 dagen, dus opruimen of samenvoegen".
//
// Alles hier is een pure functie zonder React en zonder database, zodat
// `proeven/rest-duiding.proef.ts` het met echte cijfers kan narekenen.

import { padVan } from "./werk-clusters";

export type RestOordeel =
  | "doet-het-goed"      // klikken binnen: afblijven
  | "klik-blijft-liggen" // wordt getoond, niet geklikt: titel en description
  | "optimaliseren"      // wel vertoningen, geen positie die iets oplevert
  | "opruimen"           // niemand vindt hem, en niemand zoekt hem
  | "geen-echte-pagina"; // paginering, auteursarchief, feed: technisch opruimen

export const REST_LABEL: Record<RestOordeel, string> = {
  "doet-het-goed": "Doet het goed, afblijven",
  "klik-blijft-liggen": "Wordt getoond, maar niet geklikt",
  optimaliseren: "Er is vraag, wij komen niet voor",
  opruimen: "Niemand vindt hem, niemand zoekt hem",
  "geen-echte-pagina": "Geen echte pagina",
};

export const REST_WAT_NU: Record<RestOordeel, string> = {
  "doet-het-goed":
    "Deze pagina's halen bezoekers uit Google. Er is geen aanleiding om er iets mee te doen; ze staan hier alleen zodat je ziet dat ze bekeken zijn.",
  "klik-blijft-liggen":
    "Google toont deze pagina's wel, maar mensen klikken niet. Dat is geen inhoudelijk probleem maar een presentatieprobleem: de titel en de description doen hun werk niet. Kort werk, direct meetbaar.",
  optimaliseren:
    "Hier komen zoekopdrachten op af, maar de pagina staat te laag om er iets aan over te houden. Dit is de groep waar groei zit: de vraag is er al, de pagina is alleen niet goed genoeg. Uitbouwen op basis van een blauwdruk.",
  opruimen:
    "Deze pagina's krijgen in negentig dagen geen enkele vertoning in Google. Niemand zoekt ernaar en niemand vindt ze. Bij ruim duizend pagina's is dat dood gewicht dat de rest van de site verdunt: opruimen, of laten opgaan in een pagina die het wél doet.",
  "geen-echte-pagina":
    "Paginering, auteursarchieven en feeds. Dit zijn geen pagina's waar SEO-werk op hoort; ze horen op noindex of ze mogen weg. Eén besluit voor de hele groep is genoeg.",
};

/** Wat een pagina in negentig dagen deed, uit Search Console. */
export type PaginaCijfers = { klikken: number; vertoningen: number; positie: number | null };

export type RestRegel = {
  pad: string;
  oordeel: RestOordeel;
  /** Eén zin met de cijfers erin, zodat het oordeel na te rekenen is. */
  onderbouwing: string;
  klikken: number;
  vertoningen: number;
  positie: number | null;
};

// ── Drempels ───────────────────────────────────────────────
// Bewust laag: bij een kleine site is één bezoeker per maand nog steeds een
// bezoeker. Ze staan hier bij elkaar zodat ze op één plek bij te stellen zijn.
const KLIK_DOET_MEE = 3;            // klikken in 90 dagen: dan doet hij mee
const VERTONING_ZICHTBAAR = 50;     // zoveel vertoningen = Google toont hem echt
// Titel-en-description-werk heeft alleen zin als je ook echt gezien wordt, en dat
// is de eerste pagina. Dit stond eerst op 20, en toen kreeg een pagina op plek 14
// het oordeel "wordt getoond maar niet geklikt". Dat klopt niet: op pagina twee
// klikt niemand, dus dat is geen presentatieprobleem maar een positieprobleem.
const POSITIE_ZICHTBAAR = 10;

/** Paginering, auteursarchieven, feeds en andere niet-inhoudelijke adressen. */
export function isGeenEchtePagina(pad: string): boolean {
  const p = padVan(pad).toLowerCase();
  return /\/page\/\d+|\/author\/|\/feed\/?$|\/tag\/|\/category\/|\/wp-json|\/\?|\/amp\/?$/.test(p);
}

const getal = (n: number) => new Intl.NumberFormat("nl-NL").format(n);

/**
 * Wat moet er met deze pagina? Eén oordeel, met de cijfers waarop het rust.
 *
 * De volgorde is de redenering zelf: eerst of het überhaupt een pagina is, dan of
 * hij al iets oplevert, en pas daarna of er vraag is die we laten liggen.
 */
export function duidPagina(pad: string, c: PaginaCijfers): RestRegel {
  const basis = { pad, klikken: c.klikken, vertoningen: c.vertoningen, positie: c.positie };

  if (isGeenEchtePagina(pad)) {
    return {
      ...basis, oordeel: "geen-echte-pagina",
      onderbouwing: "Dit adres hoort bij de techniek van het systeem (paginering, een auteursarchief of een feed), niet bij de inhoud van de site.",
    };
  }

  if (c.klikken >= KLIK_DOET_MEE) {
    return {
      ...basis, oordeel: "doet-het-goed",
      onderbouwing: `Levert ${getal(c.klikken)} ${c.klikken === 1 ? "bezoeker" : "bezoekers"} op in negentig dagen, bij ${getal(c.vertoningen)} vertoningen${c.positie != null ? ` en een gemiddelde plek van ${String(Math.round(c.positie * 10) / 10).replace(".", ",")}` : ""}. Wat werkt, werkt.`,
    };
  }

  if (c.vertoningen === 0) {
    return {
      ...basis, oordeel: "opruimen",
      onderbouwing: "Geen enkele vertoning in negentig dagen. Google laat deze pagina dus nooit zien, aan niemand. Er is geen zoekvraag die hier op afkomt.",
    };
  }

  // Vanaf hier: hij wordt wél getoond. De vraag is of hij dichtbij staat.
  const zichtbaar = c.positie != null && c.positie <= POSITIE_ZICHTBAAR;

  if (c.vertoningen >= VERTONING_ZICHTBAAR && zichtbaar) {
    return {
      ...basis, oordeel: "klik-blijft-liggen",
      onderbouwing: `${getal(c.vertoningen)} vertoningen op plek ${String(Math.round((c.positie ?? 0) * 10) / 10).replace(".", ",")}, en daar komen ${c.klikken === 0 ? "geen" : getal(c.klikken)} klikken uit. Google toont hem dus wél; mensen kiezen hem alleen niet.`,
    };
  }

  return {
    ...basis, oordeel: "optimaliseren",
    onderbouwing: `${getal(c.vertoningen)} vertoningen in negentig dagen${c.positie != null ? `, gemiddeld op plek ${String(Math.round(c.positie * 10) / 10).replace(".", ",")}` : ""}. Er komen dus zoekopdrachten op deze pagina af, maar hij staat te laag om er iets aan over te houden.`,
  };
}

/** De volgorde waarin de groepen op het scherm horen: het meeste werk eerst. */
export const REST_VOLGORDE: RestOordeel[] = [
  "optimaliseren", "klik-blijft-liggen", "opruimen", "geen-echte-pagina", "doet-het-goed",
];

/** Alle overgebleven pagina's beoordeeld en gegroepeerd, grootste groep eerst binnen de vaste volgorde. */
export function duidRest(paden: string[], cijfers: Map<string, PaginaCijfers>): { oordeel: RestOordeel; regels: RestRegel[] }[] {
  const leeg: PaginaCijfers = { klikken: 0, vertoningen: 0, positie: null };
  const alle = paden.map((p) => duidPagina(p, cijfers.get(padVan(p).replace(/\/$/, "").toLowerCase()) || leeg));
  return REST_VOLGORDE
    .map((oordeel) => ({ oordeel, regels: alle.filter((r) => r.oordeel === oordeel).sort((a, b) => b.vertoningen - a.vertoningen || a.pad.localeCompare(b.pad)) }))
    .filter((g) => g.regels.length > 0);
}
