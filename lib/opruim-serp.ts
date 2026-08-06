import { getSerpOverview } from "./ahrefs";
import { onderwerpWoorden } from "./opruim-onderwerpen";

// ═══════════════════════════════════════════════════════════
// VERDIENT DEZE ZOEKTERM EEN EIGEN PAGINA?
// ═══════════════════════════════════════════════════════════
// Dit is de vraag die de opruim-analyse tot 7 augustus 2026 nooit stelde. De
// lijst "oppakken" zei: deze term heeft zoekvolume en niemand op de site bezit
// hem, dus bouw die pagina opnieuw op. Bij One Day Clinic leverde dat 56 losse
// herbouwklussen op, waaronder /gonorroe-symptomen/, /gonorroe-symptomen-man/ en
// /gonorroe-symptomen-vrouw/ als drie afzonderlijke pagina's.
//
// Of dat klopt hangt niet van ons af en ook niet van het zoekvolume, maar van
// wat Google voor die term laat zien. Dat is te meten. Voor "gonorroe symptomen
// man" (echt opgevraagd, 7 augustus) bestaat de top 10 uit:
//
//   soaaids.nl/alle-soas/gonorroe/symptomen      breed
//   thuisarts.nl/gonorroe/ik-heb-gonorroe        breed
//   rivm.nl/gonorroe                             breed
//   huidarts.com/huidaandoeningen/gonorroe/      breed
//   artsenzorg.nl/.../gonorroe                   breed
//   ggd.amsterdam.nl/infectieziekten/gonorroe/   breed
//   ikwilvanmijnsoaaf.nl/.../gonorroe-symptomen-mannen-eerste-dagen  eigen pagina
//
// Eén van de zeven. Google wil hier dus één goede pagina over gonorroe, geen
// drie. Die drie los opbouwen is niet alleen driemaal het werk, het is ook de
// manier waarop je je eigen cannibalisatie aanlegt: precies wat deze tool moest
// voorkomen.
//
// Hiermee wordt het pas echt content mapping: niet "welke termen hebben volume",
// maar "hoeveel pagina's horen er te zijn, en welke".
//
// Eén opvraag per zoekterm, 90 dagen bewaard. Gemeten kosten: 95 eenheden per
// term, dus ruim vijftig termen kost ongeveer 5.300 van de 400.000 per maand.
// ═══════════════════════════════════════════════════════════

export type SerpPagina = { url: string; positie: number; eigen: boolean; dekking: number };

export type EigenPaginaToets = {
  term: string;
  /** Hoeveel van de gemeten resultaten een pagina hebben die precies hierover gaat. */
  eigen: number;
  /** En hoeveel het als onderdeel van een breder stuk behandelen. */
  breed: number;
  gemeten: number;
  oordeel: "eigen pagina" | "hoofdstuk" | "onbekend";
  /** Het bredere onderwerp waar deze term onder valt, als het een hoofdstuk is. */
  hoofdonderwerp: string;
  uitleg: string;
  voorbeelden: SerpPagina[];
};

/** Vanaf welk deel van de top 10 met een eigen pagina zeggen we: eigen pagina. */
const EIGEN_VANAF = 0.5;
/** Minder dan dit aantal bruikbare resultaten: geen oordeel, want dan meet je ruis. */
const MIN_GEMETEN = 4;

/**
 * Dekt deze URL precies de zoekterm, of alleen het bredere onderwerp?
 *
 * Bewust op de URL en niet op de titel: een titel kan alles beloven, een URL
 * verraadt hoe de site zelf zijn onderwerpen heeft ingedeeld. En dat is precies
 * de vraag hier.
 */
function dekkingVanUrl(term: string, url: string): number {
  let pad = "";
  try { pad = new URL(url).pathname; } catch { pad = url; }
  const woordenUrl = pad.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const woordenTerm = [...new Set(onderwerpWoorden(term))];
  if (!woordenTerm.length) return 0;
  let gedekt = 0;
  for (const w of woordenTerm) {
    // Prefix-vergelijking, want "man" en "mannen" zijn hetzelfde woord en de
    // woordstam is te grof om dat zelf op te lossen.
    if (woordenUrl.some((u) => u.startsWith(w) || (w.length >= 4 && w.startsWith(u) && u.length >= 4))) gedekt++;
  }
  return gedekt / woordenTerm.length;
}

/** Het bredere onderwerp: de term zonder zijn laatste, meest specifieke woord. */
function hoofdonderwerpVan(term: string): string {
  const delen = term.trim().split(/\s+/);
  return delen.length > 2 ? delen.slice(0, delen.length - 1).join(" ") : delen.slice(0, 1).join(" ");
}

export async function toetsEigenPagina(term: string): Promise<EigenPaginaToets> {
  const leeg: EigenPaginaToets = {
    term, eigen: 0, breed: 0, gemeten: 0, oordeel: "onbekend", hoofdonderwerp: hoofdonderwerpVan(term),
    uitleg: "De zoekresultaten voor deze term zijn niet op te halen, dus hier is niets over te zeggen.",
    voorbeelden: [],
  };
  const t = (term || "").trim();
  if (!t || t.split(/\s+/).length < 2) return leeg;

  const rijen = await getSerpOverview(t).catch(() => []);
  // Alleen echte organische resultaten, en elke website één keer: een site die
  // met dezelfde pagina drie keer in beeld staat (AI-antwoord, vraagblok,
  // organisch) zou anders drie stemmen krijgen.
  const gezien = new Set<string>();
  const uniek = rijen.filter((r) => {
    if (!r.url) return false;
    const type = String(r.type || "").toLowerCase();
    if (type && !type.includes("organic")) return false;
    let host = "";
    try { host = new URL(r.url).hostname.replace(/^www\./, ""); } catch { return false; }
    if (gezien.has(host)) return false;
    gezien.add(host);
    return true;
  });
  if (uniek.length < MIN_GEMETEN) return { ...leeg, gemeten: uniek.length };

  const voorbeelden: SerpPagina[] = uniek.map((r) => {
    const dekking = dekkingVanUrl(t, r.url);
    return { url: r.url, positie: r.position, eigen: dekking >= 0.99, dekking: Math.round(dekking * 100) / 100 };
  });
  const eigen = voorbeelden.filter((v) => v.eigen).length;
  const breed = voorbeelden.length - eigen;
  const deel = eigen / voorbeelden.length;
  const hoofdonderwerp = hoofdonderwerpVan(t);

  const oordeel: EigenPaginaToets["oordeel"] = deel >= EIGEN_VANAF ? "eigen pagina" : "hoofdstuk";
  const uitleg = oordeel === "eigen pagina"
    ? `Van de ${voorbeelden.length} websites in de top 10 hebben er ${eigen} een pagina die precies over "${t}" gaat. Google verwacht hier dus een eigen pagina, en een hoofdstuk op een bredere pagina zal het niet winnen.`
    : `Van de ${voorbeelden.length} websites in de top 10 ${eigen === 0 ? "heeft er geen enkele" : `hebben er maar ${eigen}`} een pagina die precies over "${t}" gaat; de rest behandelt het als onderdeel van een breder stuk${hoofdonderwerp ? ` over ${hoofdonderwerp}` : ""}. Een eigen pagina hiervoor bouwen levert dus geen extra plek op, maar wel een pagina die met je eigen pagina over ${hoofdonderwerp || "dit onderwerp"} gaat concurreren.`;

  return { term: t, eigen, breed, gemeten: voorbeelden.length, oordeel, hoofdonderwerp, uitleg, voorbeelden };
}

/**
 * Meerdere termen achter elkaar, met een kleine parallelle stroom. Bewust niet
 * alles tegelijk: Ahrefs knijpt af bij te veel gelijktijdige opvragen, en een
 * geknepen opvraag levert een leeg oordeel op dat er als een meting uitziet.
 */
export async function toetsTermen(termen: string[], maxTegelijk = 4): Promise<Map<string, EigenPaginaToets>> {
  const uit = new Map<string, EigenPaginaToets>();
  const lijst = [...new Set(termen.map((t) => (t || "").trim().toLowerCase()).filter(Boolean))];
  for (let i = 0; i < lijst.length; i += maxTegelijk) {
    const blok = lijst.slice(i, i + maxTegelijk);
    const uitkomsten = await Promise.all(blok.map((t) => toetsEigenPagina(t).catch(() => null)));
    for (const u of uitkomsten) if (u) uit.set(u.term, u);
  }
  return uit;
}
