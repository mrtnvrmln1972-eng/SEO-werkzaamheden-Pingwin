import { PLAN_STAPPEN, STAPPEN, type Omvang, type Punt } from "./grote-punten";

// ═══════════════════════════════════════════════════════════
// WAT LOOPT ER, EN HOE LANG DUURT HET NOG?
// ═══════════════════════════════════════════════════════════
// Een nachtelijke bouwronde is werk dat je niet ziet gebeuren. Zonder antwoord
// op "waar is hij nu mee bezig" en "hoe lang nog" is het scherm 's ochtends een
// zwarte doos: je ziet alleen dat er iets liep, of dat er niets gebeurde, en je
// weet niet of je moet wachten of ingrijpen.
//
// Dit bestand rekent die twee antwoorden uit. Twee regels waren daarbij leidend:
//
//  1. DE VERWACHTING KOMT UIT DE WERKELIJKHEID, NIET UIT EEN GOK. Elk punt dat
//     gebouwd is, laat zijn gemeten bouwtijd achter (`duur` in de database). De
//     verwachting voor het volgende punt is de mediaan van wat punten van
//     dezelfde omvang écht kostten. Pas zolang er nog niets gemeten is, geldt de
//     startwaarde hieronder. Die zelflerende kant is het hele verschil tussen
//     een balk die klopt en een balk die je na twee keer niet meer gelooft.
//  2. DE SCHATTING WORDT SCHERPER NAARMATE HIJ VORDERT. Staat de ronde bij stap
//     4 van 5 na tien minuten, dan zegt dat meer over déze bouw dan het
//     gemiddelde van alle vorige. Hoe verder de ronde is, hoe zwaarder zijn
//     eigen tempo meetelt.
//
// De mediaan en niet het gemiddelde, met opzet: één ronde die vastliep en pas
// na twee uur werd opgeruimd, trekt een gemiddelde blijvend scheef.
// ═══════════════════════════════════════════════════════════

/**
 * Het nachtvenster in Nederlandse tijd: van 22:00 tot 07:00.
 *
 * Waarom er überhaupt een venster is: overdag draaien de tweak-rondes, en die
 * delen hun slot met deze baan. Zonder venster zou een groot punt de tweaks
 * midden op de werkdag een uur kunnen blokkeren, of andersom afgebroken worden
 * omdat er net een tweak-ronde loopt. Nacht voor de grote punten, dag voor de
 * tweaks: dan botsen ze niet om de tijd, en niet om de bestanden.
 */
export const NACHT_START = 22;
export const NACHT_EIND = 7;

/** Waar de verwachting mee begint, zolang er van die omvang nog niets gemeten is. */
export const START_MINUTEN: Record<Omvang, number> = { klein: 25, middel: 50, groot: 100 };

/**
 * Hoe lang het schrijven van een plan ongeveer kost.
 *
 * Eén getal en niet per omvang: uitzoeken hoe iets nu werkt en het opschrijven
 * duurt niet drie keer zo lang omdat de bouw erna groter is. Wat de schatting
 * scherp maakt is de stap waar de ronde is, niet de omvang.
 */
export const PLAN_MINUTEN = 20;

/**
 * Hetzelfde, maar dan gemeten in plaats van geraden.
 *
 * Het getal hierboven is een startwaarde en werd tot 15-08-2026 altijd gebruikt:
 * het scherm zei "nog ongeveer 13 minuten" terwijl er nooit iets gemeten was.
 * Zodra er drie plannen geschreven zijn rekent dit met de mediaan daarvan. De
 * mediaan en niet het gemiddelde, want één ronde die vastliep zou een gemiddelde
 * blijvend scheeftrekken.
 */
export function planMinuten(gemeten: number[] = []): number {
  return gemeten.length >= 3 ? (mediaan(gemeten) ?? PLAN_MINUTEN) : PLAN_MINUTEN;
}

/**
 * Hoeveel minuten Nederland op dit moment vóór UTC ligt (60 in de winter, 120
 * in de zomer). Zonder bibliotheek uitgerekend: de klok in Amsterdam uitlezen
 * en vergelijken met dezelfde klok in UTC.
 */
export function offsetMinuten(nu: Date): number {
  const delen = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(nu);
  const p: Record<string, number> = {};
  for (const d of delen) if (d.type !== "literal") p[d.type] = Number(d.value);
  const alsofUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return Math.round((alsofUtc - Math.floor(nu.getTime() / 1000) * 1000) / 60000);
}

/** Het uur van de klok in Nederland (0 tot 23). */
export function uurHier(nu: Date): number {
  return Math.floor((nu.getTime() + offsetMinuten(nu) * 60000) / 3600000) % 24;
}

/** Is het nu nacht in Nederland, dus: mag de bouwronde voor grote punten draaien? */
export function isNacht(nu: Date): boolean {
  const u = uurHier(nu);
  return u >= NACHT_START || u < NACHT_EIND;
}

/**
 * Welke baan mag op dit moment vanzelf een ronde starten?
 *
 * Alleen voor de AUTOMATISCHE rondes (het uurschema en de nachtelijke
 * werkstroom). Drukt Maarten zelf op "Nu draaien", dan mag dat altijd; hij zit
 * er dan bij, en het slot houdt de twee banen sowieso uit elkaar.
 */
export function baanNu(nu: Date): "punt" | "tweak" {
  return isNacht(nu) ? "punt" : "tweak";
}

/**
 * Het eerstvolgende moment waarop het nachtvenster opengaat.
 * Is het nu al nacht, dan is dat nu.
 */
export function volgendeNacht(nu: Date): Date {
  if (isNacht(nu)) return nu;
  // De datum van vandaag in Nederland, met 22:00 erop. Twee keer uitrekenen,
  // want rond de zomertijdovergang kan de afstand tot UTC vanavond een uur
  // anders zijn dan nu.
  let gok = new Date(nu.getTime() + (NACHT_START - uurHier(nu)) * 3600000);
  gok = new Date(Math.floor(gok.getTime() / 3600000) * 3600000);
  const verschil = offsetMinuten(gok) - offsetMinuten(nu);
  return new Date(gok.getTime() - verschil * 60000);
}

/** De mediaan, of null bij te weinig metingen om iets van te vinden. */
export function mediaan(lijst: number[]): number | null {
  const goed = lijst.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (goed.length < 2) return null;
  const m = Math.floor(goed.length / 2);
  return goed.length % 2 ? goed[m] : Math.round((goed[m - 1] + goed[m]) / 2);
}

/** Hoe lang een punt van deze omvang naar verwachting kost, in minuten. */
export function verwachteMinuten(omvang: Omvang, gemeten: Record<Omvang, number[]>): number {
  return mediaan(gemeten[omvang] ?? []) ?? START_MINUTEN[omvang];
}

export type Voortgang = {
  /** Hoeveel minuten de bouw al bezig is. */
  verstreken: number;
  /** Hoeveel minuten hij naar verwachting nog nodig heeft. */
  rest: number;
  /** Deel van de klus dat af is, 0 tot 1. Voor de balk op het scherm. */
  deel: number;
  /** De hoeveelste stap, en waar hij mee bezig is. */
  stapNr: number;
  stappen: number;
  stap: string;
  /** Duurt dit merkbaar langer dan gewoonlijk? Dan hoort het scherm dat te zeggen. */
  duurtLang: boolean;
};

/**
 * De voortgang van een punt dat nu gebouwd wordt.
 *
 * De balk loopt op de STAPPEN en niet op de klok, want een balk die op tijd
 * loopt staat stil zodra het langer duurt dan verwacht, en dat is precies het
 * moment waarop je wilt zien dat er nog iets gebeurt. De klok zit in de
 * tijdsverwachting ernaast.
 */
export function voortgang(
  punt: Pick<Punt, "gestart" | "stapNr" | "stap" | "omvang">,
  gemeten: Record<Omvang, number[]>,
  nu: Date = new Date(),
  /** "plan" telt met de kortere stappenlijst en een vaste verwachting. */
  soort: "bouw" | "plan" = "bouw",
  /** De gemeten schrijftijden van eerdere plannen; leeg = nog niets gemeten. */
  planGemeten: number[] = [],
): Voortgang {
  const lijst = soort === "plan" ? PLAN_STAPPEN : STAPPEN;
  const stappen = lijst.length;
  const stapNr = Math.max(0, Math.min(stappen, punt.stapNr));
  const verstreken = punt.gestart
    ? Math.max(0, (nu.getTime() - new Date(punt.gestart).getTime()) / 60000)
    : 0;

  const vooraf = soort === "plan" ? planMinuten(planGemeten) : verwachteMinuten(punt.omvang, gemeten);
  // Hoe verder de ronde is, hoe zwaarder zijn eigen tempo meeweegt en hoe
  // minder de verwachting vooraf. Bij stap 0 weten we alleen het gemiddelde,
  // bij de laatste stap weten we het bijna zeker.
  const deel = stapNr / stappen;
  const viaStappen = deel > 0 ? verstreken / deel : vooraf;
  const totaal = deel > 0 ? vooraf * (1 - deel) + viaStappen * deel : vooraf;

  return {
    verstreken: Math.round(verstreken),
    rest: Math.max(1, Math.round(totaal - verstreken)),
    deel,
    stapNr,
    stappen,
    stap: punt.stap || (stapNr > 0 ? lijst[stapNr - 1] : "Net begonnen"),
    duurtLang: verstreken > vooraf * 1.5 && verstreken > 15,
  };
}

export type Verwacht = {
  id: number;
  /** Wanneer deze naar verwachting begint. */
  begint: string;
  /** Hoeveel minuten hij naar verwachting kost. */
  minuten: number;
};

/**
 * Wanneer elk punt in de wachtrij naar verwachting aan de beurt is.
 *
 * Het rekent door de nachten heen: past een punt niet meer in het venster van
 * vannacht, dan begint hij de nacht erna. Zo zie je meteen dat vijf grote
 * punten geen één nacht zijn, in plaats van dat de laatste er 's ochtends
 * onaangekondigd niet is.
 */
export function verwachteStarts(
  wachtrij: Pick<Punt, "id" | "omvang">[],
  gemeten: Record<Omvang, number[]>,
  nu: Date = new Date(),
  bezigTot = 0,
): Verwacht[] {
  const uit: Verwacht[] = [];
  // Het venster begint bij de eerstvolgende nacht, plus wat er nu nog loopt.
  let klok = new Date(volgendeNacht(nu).getTime() + Math.max(0, bezigTot) * 60000);

  for (const p of wachtrij) {
    const minuten = verwachteMinuten(p.omvang, gemeten);
    // Nog binnen de nacht? Zo niet, doorschuiven naar het volgende venster.
    const eindeVenster = eindeVanDeNacht(klok);
    if (klok.getTime() + minuten * 60000 > eindeVenster.getTime()) {
      klok = volgendeNacht(new Date(eindeVenster.getTime() + 60000));
    }
    uit.push({ id: p.id, begint: klok.toISOString(), minuten });
    klok = new Date(klok.getTime() + minuten * 60000);
  }
  return uit;
}

/** Het einde (07:00 in Nederland) van het nachtvenster waarin dit moment valt. */
export function eindeVanDeNacht(moment: Date): Date {
  const u = uurHier(moment);
  // Vóór 07:00 hoort bij de nacht van vannacht; vanaf 22:00 bij de nacht die
  // morgenochtend eindigt.
  const uren = u < NACHT_EIND ? NACHT_EIND - u : 24 - u + NACHT_EIND;
  let gok = new Date(moment.getTime() + uren * 3600000);
  gok = new Date(Math.floor(gok.getTime() / 3600000) * 3600000);
  const verschil = offsetMinuten(gok) - offsetMinuten(moment);
  return new Date(gok.getTime() - verschil * 60000);
}
