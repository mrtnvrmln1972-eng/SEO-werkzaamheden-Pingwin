import { getSetting, setSetting } from "./settings";
import { ctrVoorPositie } from "./prioriteiten-score";
import type { Haalbaarheid } from "./opruim-haalbaarheid";

// ═══════════════════════════════════════════════════════════
// WAT IS HET WAARD? DEZELFDE LIJST, MAAR DAN IN EURO'S
// ═══════════════════════════════════════════════════════════
// De lijsten stonden tot nu toe op zoekvolume. Dat is een goede eerste sortering,
// maar het is geen taal waarin je een besluit uitlegt. "Deze pagina is 500
// zoekopdrachten per maand waard" zegt een klant niets; "deze pagina is ongeveer
// 900 euro per maand waard" wel, en dat is exact hetzelfde getal met drie stappen
// eromheen.
//
// De som, en elke stap is een gewoon getal dat iemand kan nalopen:
//   zoekvolume            hoeveel mensen er per maand op zoeken
//   x klikkans-verschil   welk deel daarvan doorklikt op plek X in plaats van waar
//                         de pagina nu staat (de CTR-curve)
//   x conversie           welk deel van die bezoekers klant wordt
//   x klantwaarde         wat één klant opbrengt
//
// En de eerlijkheid over die twee getallen, want die is het belangrijkst. Niemand
// weet precies welk deel van de bezoekers klant wordt: iemand die belt na drie
// keer terugkomen staat nergens als "conversie", en een deel van de aanvragen
// wordt handmatig verwerkt zonder dat er een meting achter zit. Elke conversie
// is dus een schatting.
//
// Dat is minder erg dan het lijkt, en dat is precies waarom dit toch gebouwd is:
// conversie en klantwaarde zijn voor ELKE regel dezelfde vermenigvuldiging. Ze
// veranderen daarom de VOLGORDE van de lijst niet, alleen de hoogte van de
// bedragen. Voor de vraag "waar beginnen we" maakt het dus niet uit of het 1% of
// 3% is; het maakt alleen uit op het moment dat je het bedrag aan een klant laat
// zien. Daarom staat er overal bij dat het een schatting is, en daarom wordt het
// aantal extra bezoekers er altijd bij genoemd: dat getal leunt niet op de
// aanname en is het harde deel van de som.
//
// Twee dingen zijn bewust géén aanname:
// - De klikkans komt uit dezelfde `scoring-config.json` als de prioriteitenscan.
//   Eén CTR-curve voor het hele dashboard; twee curves die uit elkaar lopen is
//   precies de fout die het brein beschrijft.
// - De conversie en de klantwaarde vult Maarten per klant in. Zonder die twee
//   getallen rekent dit niets uit en zegt het scherm dat, in plaats van een
//   verzonnen standaard te tonen die er als een meting uitziet.
//
// En de doelpositie volgt uit de haalbaarheidsrem: een term die buiten bereik
// ligt krijgt geen bedrag, want de opbrengst van iets dat niet gaat lukken is nul.
// ═══════════════════════════════════════════════════════════

export type EuroInstelling = {
  /** Wat één nieuwe klant gemiddeld opbrengt, in euro's. */
  klantwaarde: number;
  /** Welk deel van de bezoekers klant wordt, in procenten. */
  conversie: number;
  ingevuld: boolean;
};

export type Euro = {
  extraKlikkenPerMaand: number;
  perMaand: number;
  perJaar: number;
  doelPositie: number;
  uitleg: string;
};

const sleutel = (slug: string) => `opruim_euro:${slug}`;

export async function getEuroInstelling(slug: string): Promise<EuroInstelling> {
  const ruw = await getSetting(sleutel(slug)).catch(() => null);
  if (!ruw) return { klantwaarde: 0, conversie: 0, ingevuld: false };
  try {
    const d = JSON.parse(ruw) as { klantwaarde?: unknown; conversie?: unknown };
    const klantwaarde = Number(d.klantwaarde) || 0;
    const conversie = Number(d.conversie) || 0;
    return { klantwaarde, conversie, ingevuld: klantwaarde > 0 && conversie > 0 };
  } catch { return { klantwaarde: 0, conversie: 0, ingevuld: false }; }
}

export async function zetEuroInstelling(slug: string, klantwaarde: number, conversie: number): Promise<EuroInstelling> {
  // Grenzen die een typefout opvangen: een conversie van 300% of een klantwaarde
  // van een miljoen is geen instelling maar een vergissing, en die zou de hele
  // lijst onbruikbaar maken zonder dat iemand het doorheeft.
  const k = Math.max(0, Math.min(1000000, Math.round(Number(klantwaarde) || 0)));
  const c = Math.max(0, Math.min(100, Math.round((Number(conversie) || 0) * 10) / 10));
  await setSetting(sleutel(slug), JSON.stringify({ klantwaarde: k, conversie: c }));
  return { klantwaarde: k, conversie: c, ingevuld: k > 0 && c > 0 };
}

/** De positie die realistisch is, gegeven het haalbaarheidsoordeel. Beloven dat
    een pagina op plek 1 komt is geen raming maar een verkooppraatje. */
function doelPositieVoor(h?: Haalbaarheid): number | null {
  const o = h?.oordeel;
  if (o === "buiten bereik") return null;
  if (o === "kansrijk") return 5;
  return 8;                                  // pittig, onbekend, of geen oordeel
}

/**
 * Wat levert het op als deze term van zijn huidige plek naar een realistische
 * plek gaat? Geeft null terug zodra er iets ontbreekt; een half ingevulde som
 * hoort niet als bedrag op het scherm.
 */
export function berekenEuro(
  volume: number | null,
  huidigePositie: number | null,
  haalbaarheid: Haalbaarheid | undefined,
  inst: EuroInstelling,
): Euro | null {
  if (!inst.ingevuld) return null;
  if (!volume || volume <= 0) return null;
  const doel = doelPositieVoor(haalbaarheid);
  if (doel == null) return null;

  const nu = huidigePositie && huidigePositie > 0 ? huidigePositie : 0;   // 0 = doet nog niet mee
  const winst = Math.max(0, ctrVoorPositie(doel) - ctrVoorPositie(nu));
  if (winst <= 0) return null;

  const extraKlikken = winst * volume;
  const klanten = extraKlikken * (inst.conversie / 100);
  const perMaand = Math.round(klanten * inst.klantwaarde);
  if (perMaand < 1) return null;

  return {
    extraKlikkenPerMaand: Math.round(extraKlikken),
    perMaand,
    perJaar: perMaand * 12,
    doelPositie: doel,
    uitleg: [
      `Er wordt ${volume} keer per maand op gezocht.`,
      nu ? `De pagina staat nu rond plek ${Math.round(nu)}.` : "De pagina doet nu niet mee in de resultaten.",
      `Op plek ${doel} levert dat naar schatting ${Math.round(extraKlikken)} extra bezoekers per maand op.`,
      `Bij ${inst.conversie}% conversie en ${euro(inst.klantwaarde)} per klant is dat ongeveer ${euro(perMaand)} per maand, oftewel ${euro(perMaand * 12)} per jaar.`,
      "Het aantal extra bezoekers is het harde deel van deze som; het bedrag leunt op een geschatte conversie, want niet iedereen die belt of langskomt is te meten. Voor de volgorde van deze lijst maakt dat niets uit (elke regel krijgt dezelfde vermenigvuldiging), voor het bedrag zelf wel.",
    ].join(" "),
  };
}

/** Netjes als bedrag, zonder centen: die suggereren een precisie die er niet is. */
export function euro(n: number): string {
  return `€ ${Math.round(n).toLocaleString("nl-NL")}`;
}

/** De optelsom van een lijst bedragen, voor bovenaan een kaart. */
export function euroTotaal(bedragen: (Euro | null | undefined)[]): number {
  return bedragen.reduce<number>((n, b) => n + (b?.perMaand || 0), 0);
}
