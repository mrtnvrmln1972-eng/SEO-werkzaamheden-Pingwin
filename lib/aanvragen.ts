import type { Ga4PageConversion } from "./google";
import type { EuroInstelling } from "./opruim-euro";
import { urlKey } from "./url-key";

// ═══════════════════════════════════════════════════════════
// VAN EXTRA BEZOEK NAAR VERWACHTE AANVRAGEN (R2)
// ═══════════════════════════════════════════════════════════
// Eén centrale plek die "extra klikken per maand" (de bezoek-eenheid van de
// prioriteitenscan) omrekent naar "verwachte aanvragen per maand". Elk scherm
// dat dit laat zien haalt het hier op; twee keer dezelfde som apart uitschrijven
// is precies de fout die dit brein afstraft.
//
// De conversieratio komt uit ECHT gemeten GA4-data per pagina (lib/google.ts,
// getGa4ConversionsByPage), niet uit een handmatige schatting: verschillende
// pagina's converteren verschillend, en alleen dan verandert de VOLGORDE van de
// prioriteitenlijst mee (een klant-brede schatting zou elke regel met dezelfde
// factor vermenigvuldigen en dus niets aan de rangorde veranderen). Is er voor
// een pagina te weinig verkeer gemeten, dan is het getal ruis en blijft hij
// onbekend; de bestaande bezoek-gebaseerde rekenwijze blijft dan gewoon staan.
//
// Het bedrag in euro's hergebruikt bewust de klantwaarde die al per klant wordt
// vastgelegd voor de opruimlijst (lib/opruim-euro.ts, scherm Klantwaarde). Dat
// is dezelfde vraag ("wat is één aanvraag/klant gemiddeld waard") die al een
// eigen plek en een "leeg mag"-regel heeft; een tweede veld ernaast zou dezelfde
// vraag twee keer los vastleggen.
// ═══════════════════════════════════════════════════════════

const MIN_SESSIES = 20;

export type Aanvraag = {
  aanvragenPerMaand: number;
  bedragPerMaand: number | null;
  /** T.o.v. het klantgemiddelde; 1 = gemiddeld, >1 converteert beter dan gemiddeld. */
  weging: number;
};

const rond = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Gemeten conversieratio voor één pad, of null bij te weinig data om op te vertrouwen. */
export function ratioVoorPad(data: Ga4PageConversion[] | null, pad: string): number | null {
  if (!data?.length || !pad) return null;
  const sleutel = urlKey(pad);
  const rij = data.find((d) => urlKey(d.path) === sleutel);
  if (!rij || rij.sessions < MIN_SESSIES) return null;
  return rij.ratio;
}

/** Sitegemiddelde conversieratio, voor de wegingsfactor per pagina. */
export function gemiddeldeRatio(data: Ga4PageConversion[] | null): number | null {
  if (!data?.length) return null;
  const sessies = data.reduce((s, d) => s + d.sessions, 0);
  const conversies = data.reduce((s, d) => s + d.conversions, 0);
  return sessies >= MIN_SESSIES ? conversies / sessies : null;
}

/**
 * Rekent verwacht extra bezoek om naar verwachte aanvragen, op basis van de
 * gemeten conversieratio van déze pagina. Geeft `null` als er niets gemeten is;
 * dan verandert er niets aan de bestaande bezoek-rekenwijze.
 */
export function berekenAanvragen(
  extraKlikkenPerMaand: number,
  ratio: number | null,
  gemiddelde: number | null,
  inst: EuroInstelling,
): Aanvraag | null {
  // Geen sitegemiddelde (of 0): er is geen bruikbaar conversiesignaal, bijv.
  // omdat de klant geen GA4-conversies heeft ingericht. Dan is elke ratio, ook
  // een gemeten 0, ruis in plaats van een echte meting, en blijft alles onbekend.
  if (ratio == null || !gemiddelde || gemiddelde <= 0 || extraKlikkenPerMaand <= 0) return null;
  const aanvragen = extraKlikkenPerMaand * ratio;
  const weging = Math.max(0.5, Math.min(2, ratio / gemiddelde));
  return {
    aanvragenPerMaand: rond(aanvragen, 1),
    bedragPerMaand: inst.ingevuld ? Math.round(aanvragen * inst.klantwaarde) : null,
    weging: rond(weging, 2),
  };
}
