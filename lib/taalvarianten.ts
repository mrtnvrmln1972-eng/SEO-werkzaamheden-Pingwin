// ═══════════════════════════════════════════════════════════
// TAALVARIANTEN: EEN TWEEDE TAAL IS EEN EIGEN BOOM, GEEN DUBBELING
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026). Bij One Day Clinic stond `/en/` als één regel op de
// lijst met advertentiepagina's, waardoor 315 pagina's in één klap buiten élke
// analyse vielen. Dat was fout: die pagina's staan op `index, follow` met een
// eigen canonical, en 211 ervan hebben een echte positie in Google.
//
// Maar ze zomaar meenemen in het gewone opruimen is óók fout, en dat is de reden
// dat dit bestand bestaat. Wat er echt aan de hand is:
//
//  1. DE HREFLANG-KOPPELING KLOPT. `/anonieme-soa-test/` en
//     `/en/anonieme-soa-test/` verwijzen netjes naar elkaar als `nl` en `en`.
//     Google ziet ze dus als taalvarianten, niet als duplicaten. Een Engelse
//     pagina samenvoegen met zijn Nederlandse tegenhanger sloopt een werkende
//     taalstructuur. Dat mag dus NOOIT automatisch voorgesteld worden.
//
//  2. DE INHOUD IS NEDERLANDS. De titel is Engels ("Schedule your anonymous STD
//     test"), de tekst eronder Nederlands. Daarom rankt
//     `/en/een-soa-test-doen-in-utrecht/` op "soa test utrecht", een Nederlandse
//     term, en concurreert hij nú wél met de Nederlandse pagina's. Vertaal je hem
//     echt, dan richt hij zich op Engelse termen en verdwijnt die concurrentie
//     vanzelf.
//
// Daaruit volgt de vraag die dit bestand beantwoordt, per pagina:
// **is er in dit land Engelse zoekvraag naar dit onderwerp?**
//
//   - Nee  → de taalvariant heeft geen eigen publiek. Hij is een vertaling die
//            niemand zoekt en die ondertussen de Nederlandse pagina in de weg
//            zit. Omleiden naar de tegenhanger, hreflang eraf.
//   - Ja   → hij blijft, en gaat de vertaalwachtrij in. Pas ná het vertalen
//            klopt de hreflang-belofte en stopt de concurrentie.
//
// Zo wordt "sommige zijn wel interessant, bijvoorbeeld voor experts" een getal
// in plaats van een gevoel.
//
// Alles hier is een pure functie zonder React en zonder database, zodat
// `proeven/taalvarianten.proef.ts` het met echte voorbeelden kan narekenen.

import { padVan } from "./werk-clusters";

/** Taalcodes die als eerste stukje van een pad een taalboom aanduiden. */
const TAALCODES = new Set([
  "en", "de", "fr", "es", "it", "pt", "pl", "tr", "ru", "ar", "zh",
  "nl", "da", "sv", "no", "fi", "cs", "sk", "hu", "ro", "el", "uk",
]);

/** Hoeveel pagina's er onder een prefix moeten staan voor het een taalboom is. */
const MIN_PER_TAAL = 5;

const norm = (p: string) => padVan(p).replace(/\/+$/, "").toLowerCase() || "/";

/**
 * Welke taalbomen heeft deze site? Alleen een prefix die er echt als een boom
 * uitziet telt: een tweeletterige taalcode met genoeg pagina's eronder. Eén losse
 * `/en/over-ons/` maakt nog geen tweede taal.
 */
export function taalBomen(paden: string[]): string[] {
  const tel = new Map<string, number>();
  for (const p of paden) {
    const eerste = norm(p).split("/").filter(Boolean)[0] || "";
    if (!TAALCODES.has(eerste)) continue;
    tel.set(eerste, (tel.get(eerste) || 0) + 1);
  }
  return [...tel.entries()].filter(([, n]) => n >= MIN_PER_TAAL).map(([t]) => t).sort();
}

/** In welke taalboom zit dit pad? Lege tekst = de hoofdtaal van de site. */
export function taalVan(pad: string, bomen: string[]): string {
  const eerste = norm(pad).split("/").filter(Boolean)[0] || "";
  return bomen.includes(eerste) ? eerste : "";
}

/** Hetzelfde pad zonder zijn taalprefix, zodat een variant en zijn tegenhanger te koppelen zijn. */
export function zonderTaal(pad: string, bomen: string[]): string {
  const taal = taalVan(pad, bomen);
  if (!taal) return norm(pad);
  const rest = norm(pad).slice(taal.length + 1);
  return rest.startsWith("/") ? rest : `/${rest}`;
}

// ═══════════════════════════════════════════════════════════
// IS EEN ZOEKOPDRACHT ENGELS OF NEDERLANDS?
// ═══════════════════════════════════════════════════════════
// Zoekopdrachten zijn kort, dus een taalmodel is hier overdreven en een gok op
// losse woorden is te wankel. Wat wél betrouwbaar is: functiewoorden en een paar
// vakwoorden die per taal verschillen. "soa" is Nederlands, "std" en "sti" zijn
// Engels, en dat is precies het onderscheid dat hier telt.
//
// Een zoekopdracht zonder enig signaal telt voor GEEN van beide mee. Liever een
// eerlijk "weet ik niet" dan een verkeerde helft van een besluit.

const NL_WOORDEN = new Set([
  "een", "het", "de", "van", "voor", "wat", "hoe", "waar", "wanneer", "welke", "kan",
  "kun", "kunt", "moet", "mijn", "jouw", "je", "zijn", "met", "zonder", "bij", "naar",
  "soa", "soas", "afspraak", "kosten", "kost", "prijs", "uitslag", "klachten", "zwanger",
  "arts", "huisarts", "onderzoek", "behandeling", "besmetting", "sneltest", "bloedonderzoek",
  "klachtenvrij", "gratis", "anoniem", "anonieme", "spoed", "snel", "snelle", "vergoed",
]);

const EN_WOORDEN = new Set([
  "the", "what", "how", "where", "when", "which", "can", "should", "does", "your",
  "with", "without", "near", "cost", "costs", "price", "results", "appointment",
  "std", "sti", "stds", "stis", "test", "testing", "tested", "clinic", "doctor",
  "symptoms", "treatment", "infection", "pregnant", "free", "anonymous", "fast", "quick",
  "same", "day", "rapid", "screening", "check",
]);

// Woorden die in allebei de talen hetzelfde zijn en dus niets bewijzen.
const NEUTRAAL = new Set([
  "test", "tests", "hiv", "chlamydia", "syfilis", "syphilis", "herpes", "hepatitis",
  "gonorroe", "gonorrhea", "onedayclinic", "amsterdam", "rotterdam", "utrecht",
  "eindhoven", "nijmegen", "den", "haag", "clinic",
]);

export type Taaloordeel = "nederlands" | "engels" | "onbekend";

/** Welke taal is deze zoekopdracht? "onbekend" als er geen duidelijk signaal is. */
export function taalVanZoekopdracht(zoekopdracht: string): Taaloordeel {
  const woorden = (zoekopdracht || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let nl = 0;
  let en = 0;
  for (const w of woorden) {
    if (NEUTRAAL.has(w)) continue;
    // Een woord dat in beide lijsten staat zegt niets; alleen een eenzijdige treffer telt.
    const inNl = NL_WOORDEN.has(w);
    const inEn = EN_WOORDEN.has(w);
    if (inNl && !inEn) nl++;
    else if (inEn && !inNl) en++;
  }
  if (nl > en) return "nederlands";
  if (en > nl) return "engels";
  return "onbekend";
}

// ═══════════════════════════════════════════════════════════
// HET OORDEEL PER TAALVARIANT-PAGINA
// ═══════════════════════════════════════════════════════════

export type GscRegel = { keyword: string; page: string; clicks: number; impressions: number; position: number };

export type VariantOordeel = {
  pad: string;
  taal: string;
  /** De pagina in de hoofdtaal waar dit de vertaling van is, als die bestaat. */
  tegenhanger: string;
  /** Vertoningen op zoekopdrachten in de taal van deze pagina. */
  eigenTaal: number;
  /** Vertoningen op zoekopdrachten in de hoofdtaal: hier zit de concurrentie. */
  hoofdtaal: number;
  /** De sterkste zoekopdracht in de eigen taal, als bewijs bij het oordeel. */
  bewijs: string;
  uitkomst: "blijft-vertalen" | "samenvoegen" | "onbekend";
  reden: string;
  onderbouwing: string[];
};

/** Vanaf hoeveel vertoningen in de eigen taal noemen we het een eigen publiek? */
const DREMPEL_EIGEN_TAAL = 30;

/**
 * Beoordeel elke pagina in een taalboom: heeft hij eigen zoekvraag, of is hij een
 * vertaling die niemand zoekt en die ondertussen de hoofdtaal in de weg zit?
 */
export function beoordeelTaalvarianten(
  livePaden: string[],
  gsc: GscRegel[],
  hoofdtaal = "nederlands" as Taaloordeel,
): { bomen: string[]; oordelen: VariantOordeel[] } {
  const bomen = taalBomen(livePaden);
  if (!bomen.length) return { bomen: [], oordelen: [] };

  const bestaat = new Set(livePaden.map(norm));

  // Vertoningen per pagina, uitgesplitst naar de taal van de zoekopdracht.
  const perPagina = new Map<string, { eigen: number; hoofd: number; beste: { term: string; imp: number } }>();
  for (const r of gsc) {
    const p = norm(r.page);
    const taal = taalVan(p, bomen);
    if (!taal) continue; // alleen pagina's ín een taalboom
    const oordeel = taalVanZoekopdracht(r.keyword);
    const e = perPagina.get(p) || { eigen: 0, hoofd: 0, beste: { term: "", imp: 0 } };
    // "engels" hoort bij de boom /en/; alles wat de hoofdtaal is telt als concurrentie.
    const isEigen = oordeel !== "onbekend" && oordeel !== hoofdtaal;
    if (isEigen) {
      e.eigen += r.impressions;
      if (r.impressions > e.beste.imp) e.beste = { term: r.keyword, imp: r.impressions };
    } else if (oordeel === hoofdtaal) {
      e.hoofd += r.impressions;
    }
    perPagina.set(p, e);
  }

  const oordelen: VariantOordeel[] = [];
  for (const ruw of livePaden) {
    const pad = norm(ruw);
    const taal = taalVan(pad, bomen);
    if (!taal) continue;
    const cijfers = perPagina.get(pad) || { eigen: 0, hoofd: 0, beste: { term: "", imp: 0 } };
    const kaal = zonderTaal(pad, bomen);
    const tegenhanger = bestaat.has(kaal) && kaal !== pad ? kaal : "";

    const eigenPubliek = cijfers.eigen >= DREMPEL_EIGEN_TAAL;
    const onderbouwing: string[] = [];

    if (cijfers.eigen > 0 || cijfers.hoofd > 0) {
      onderbouwing.push(
        `Deze pagina krijgt ${cijfers.eigen} vertoningen op zoekopdrachten in de eigen taal en ${cijfers.hoofd} op zoekopdrachten in de hoofdtaal.`,
      );
    } else {
      onderbouwing.push("Deze pagina komt op geen enkele zoekopdracht in de resultaten voor.");
    }
    if (cijfers.beste.term) {
      onderbouwing.push(`De sterkste eigen zoekopdracht is "${cijfers.beste.term}" (${cijfers.beste.imp} vertoningen).`);
    }
    if (cijfers.hoofd > cijfers.eigen && cijfers.hoofd > 0) {
      onderbouwing.push(
        "Dat hij vooral op de hoofdtaal gevonden wordt is het gevolg van niet-vertaalde inhoud: de titel is vertaald, de tekst niet. Zolang dat zo is concurreert deze pagina met zijn eigen tegenhanger.",
      );
    }

    let uitkomst: VariantOordeel["uitkomst"];
    let reden: string;
    if (eigenPubliek) {
      uitkomst = "blijft-vertalen";
      reden = "Er is eigen zoekvraag in deze taal; blijft staan en moet echt vertaald worden.";
      onderbouwing.push(
        "**Wat we doen:** deze pagina blijft en gaat de vertaalwachtrij in. Vertalen is contentwerk en hoort ná dit besluit, niet ervoor: een pagina vertalen die je daarna wegstuurt is weggegooid werk.",
      );
    } else if (tegenhanger) {
      uitkomst = "samenvoegen";
      reden = "Geen eigen zoekvraag in deze taal; gaat op in de pagina in de hoofdtaal.";
      onderbouwing.push(
        `**Wat we doen:** deze taalvariant heeft geen eigen publiek en zit zijn tegenhanger in de weg. Hij gaat op in ${tegenhanger}, en de hreflang-verwijzing gaat eraf. Zonder die laatste stap blijft Google een vertaling verwachten die er niet meer is.`,
      );
    } else {
      uitkomst = "onbekend";
      reden = "Geen eigen zoekvraag, en er is geen tegenhanger in de hoofdtaal om naartoe te gaan.";
      onderbouwing.push(
        "**Wat we doen:** hier is geen automatisch besluit te nemen. Er is geen publiek voor deze taal én geen pagina om hem in op te laten gaan; dit is een keuze om zelf te maken.",
      );
    }

    oordelen.push({
      pad, taal, tegenhanger,
      eigenTaal: cijfers.eigen, hoofdtaal: cijfers.hoofd,
      bewijs: cijfers.beste.term, uitkomst, reden, onderbouwing,
    });
  }

  oordelen.sort((a, b) => b.eigenTaal - a.eigenTaal || a.pad.localeCompare(b.pad));
  return { bomen, oordelen };
}
