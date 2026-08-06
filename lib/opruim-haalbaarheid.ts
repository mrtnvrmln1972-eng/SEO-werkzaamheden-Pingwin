import { getSiteAuthority } from "./ahrefs";

// ═══════════════════════════════════════════════════════════
// REM 2: IS DIT EEN KANS, OF EEN ILLUSIE?
// ═══════════════════════════════════════════════════════════
// De eerste rem (opruim-waarde.ts) redt pagina's van de opruimlijst omdat hun
// eigen zoekterm volume heeft. Dat is de goede vraag, maar het is er maar één.
// Volume zegt hoe groot de taart is, niet of wij er een punt van kunnen krijgen.
//
// Een term met moeilijkheid 70 is een taart waar alleen sites met veel autoriteit
// bij komen. Staat het domein op 30, dan is die term geen kans maar een illusie:
// je kunt er een halfjaar aan werken en nog steeds op plek 40 staan. Die pagina
// vervolgens wél op de weekplanning zetten kost echt geld, en het verdringt werk
// dat wél kan lukken.
//
// De maatstaf is de kloof tussen de moeilijkheid van de term (Ahrefs KD, 0 tot
// 100) en de autoriteit van het domein (Ahrefs DR, 0 tot 100). Beide getallen
// zijn schattingen, dus de grenzen zijn bewust ruim en het oordeel is een advies,
// geen slot: niets wordt weggegooid, het wordt gesorteerd.
//
// Eén uitzondering, en die is belangrijk: staat de pagina er zélf al mee in de
// top 20, dan is de kloof weerlegd door de praktijk. Een meting gaat altijd vóór
// een schatting.
// ═══════════════════════════════════════════════════════════

export type Oordeel = "kansrijk" | "pittig" | "buiten bereik" | "onbekend";

export type Haalbaarheid = {
  oordeel: Oordeel;
  /** Moeilijkheid min autoriteit. Negatief is comfortabel, groot positief is kansloos. */
  kloof: number | null;
  moeilijkheid: number | null;
  autoriteit: number | null;
  /** Eén zin in gewone taal; gaat mee naar het scherm en naar de klantmail. */
  uitleg: string;
};

/** Tot deze kloof noemen we het kansrijk: de term is niet zwaarder dan het domein. */
const KANSRIJK_TOT = 0;
/** En tot hier pittig: haalbaar, maar er moet echt iets voor gebeuren. */
const PITTIG_TOT = 15;
/** Vanaf welke positie geldt "hij doet al mee" als bewijs dat het kan. */
const BEWIJS_POSITIE = 20;

/**
 * Het oordeel over één zoekterm voor één domein.
 *
 * @param moeilijkheid Ahrefs KD van de term (null = onbekend)
 * @param autoriteit   Ahrefs DR van het domein (null = onbekend)
 * @param huidigePositie Waar de pagina nu staat op die term, als hij meedoet
 */
export function weegHaalbaarheid(
  moeilijkheid: number | null,
  autoriteit: number | null,
  huidigePositie?: number | null,
): Haalbaarheid {
  const doetAlMee = huidigePositie != null && huidigePositie > 0 && huidigePositie <= BEWIJS_POSITIE;

  if (moeilijkheid == null || autoriteit == null) {
    return {
      oordeel: doetAlMee ? "pittig" : "onbekend",
      kloof: null,
      moeilijkheid,
      autoriteit,
      uitleg: doetAlMee
        ? `De moeilijkheid of de autoriteit is niet op te halen, maar de pagina staat al op plek ${Math.round(huidigePositie as number)}. Dat is zelf het bewijs dat meedoen kan.`
        : "De moeilijkheid van de term of de autoriteit van het domein is niet op te halen, dus hier is niets over te zeggen.",
    };
  }

  const kloof = Math.round(moeilijkheid - autoriteit);

  // De praktijk wint van de schatting. Staat hij al in de top 20, dan is de term
  // aantoonbaar binnen bereik, hoe hoog de moeilijkheid ook is.
  if (doetAlMee && kloof > KANSRIJK_TOT) {
    return {
      oordeel: kloof > PITTIG_TOT ? "pittig" : "kansrijk",
      kloof, moeilijkheid, autoriteit,
      uitleg: `Op papier zwaar (moeilijkheid ${moeilijkheid} tegen een autoriteit van ${autoriteit}), maar de pagina staat er al mee op plek ${Math.round(huidigePositie as number)}. Die meting gaat vóór de schatting: het kan dus, het is alleen werk.`,
    };
  }

  if (kloof <= KANSRIJK_TOT) {
    return {
      oordeel: "kansrijk", kloof, moeilijkheid, autoriteit,
      uitleg: `De term is niet zwaarder dan wat deze website aankan (moeilijkheid ${moeilijkheid}, autoriteit ${autoriteit}). Met een goede pagina is de top 10 realistisch.`,
    };
  }
  if (kloof <= PITTIG_TOT) {
    return {
      oordeel: "pittig", kloof, moeilijkheid, autoriteit,
      uitleg: `De term is iets zwaarder dan de website nu staat (moeilijkheid ${moeilijkheid} tegen autoriteit ${autoriteit}). Haalbaar, maar dan moet de pagina echt beter zijn dan die van de concurrent, en er is geduld voor nodig.`,
    };
  }
  return {
    oordeel: "buiten bereik", kloof, moeilijkheid, autoriteit,
    uitleg: `De term is fors zwaarder dan deze website aankan (moeilijkheid ${moeilijkheid} tegen een autoriteit van ${autoriteit}). Daar komt de site voorlopig niet tussen; de tijd is beter besteed aan een term die wél binnen bereik ligt.`,
  };
}

/** Sorteervolgorde: eerst waar het kan, daarna wat er nog aan zit te komen. */
export const OORDEEL_RANG: Record<Oordeel, number> = {
  kansrijk: 0, pittig: 1, onbekend: 2, "buiten bereik": 3,
};

/**
 * De autoriteit van het eigen domein. Zit achter dezelfde cache van 7 dagen als de
 * rest van de autoriteits-opvragen, dus dit kost hooguit één opvraag per week.
 */
export async function autoriteitVan(domain: string): Promise<number | null> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
  if (!d) return null;
  const a = await getSiteAuthority(d).catch(() => null);
  return a?.domainRating ?? null;
}

/** De regel als instructie voor de motor, zodat die geen kansloze doelen voorstelt. */
export function haalbaarheidAlsInstructie(autoriteit: number | null): string {
  if (autoriteit == null) return "";
  return [
    "HAALBAARHEID. Weeg dit mee bij elk voorstel om een pagina op te bouwen of te bundelen.",
    `De autoriteit van dit domein is ${autoriteit} op 100 (Ahrefs Domain Rating).`,
    `- Een zoekterm met een moeilijkheid boven ${autoriteit + PITTIG_TOT} is voor deze site voorlopig niet te winnen. Presenteer die nooit als kans.`,
    `- Een moeilijkheid tot ${autoriteit} is realistisch; daartussen is het haalbaar maar veel werk.`,
    "- Uitzondering: staat de pagina al in de top 20 op die term, dan is hij aantoonbaar binnen bereik en telt die meting zwaarder dan de moeilijkheid.",
  ].join("\n");
}
