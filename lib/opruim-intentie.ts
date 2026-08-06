import { getKeywordsOverview } from "./ahrefs";

// ═══════════════════════════════════════════════════════════
// REM 1: ZOEKINTENTIE. WAT WIL IEMAND DIE DIT INTYPT?
// ═══════════════════════════════════════════════════════════
// Tot 06-08-2026 keek het opruimen alleen naar overlap in woorden: staan er
// dezelfde woorden in twee URL's, dan gaan ze over hetzelfde en mag de zwakste
// naar de sterkste. Dat klopt vaak, maar niet altijd, en waar het misgaat kost
// het meteen een pagina.
//
// "soa test kopen" en "wat is een soa test" delen bijna alle woorden. Toch is de
// eerste iemand met zijn pinpas in de hand en de tweede iemand die het nog aan
// het uitzoeken is. Dat zijn twee verschillende pagina's, met een andere kop, een
// andere opbouw en een andere knop. Voeg je ze samen, dan verlies je er één:
// de koper haakt af op een uitlegpagina, of de twijfelaar schrikt van een
// bestelknop. Google weet dat en toont voor die twee termen ook een andere
// soort pagina.
//
// Ahrefs levert de intentie gewoon mee bij het zoekvolume, in dezelfde opvraag
// die we toch al doen. Het kost dus geen extra credits; het werd alleen niet
// gebruikt.
//
// De regel die hieruit volgt is bewust smal: intentie mag NOOIT stilzwijgend
// een samenvoeging afdwingen, maar wel er één tegenhouden. Weten we het niet,
// dan houden we ons stil in plaats van te gokken.
// ═══════════════════════════════════════════════════════════

/** De vier soorten die Ahrefs onderscheidt, plus "onbekend" als hij niets weet. */
export type Intentie = "transactioneel" | "commercieel" | "informatief" | "navigatie" | "";

/** Waar hoort deze intentie thuis: iemand die wíl doen, of iemand die wíl weten?
    Dit is de scheidslijn die ertoe doet; binnen een kamp mag alles samen. */
export type Kamp = "doen" | "weten" | "merk" | "onbekend";

export function kampVan(i: Intentie): Kamp {
  if (i === "transactioneel" || i === "commercieel") return "doen";
  if (i === "informatief") return "weten";
  if (i === "navigatie") return "merk";
  return "onbekend";
}

/** In gewone taal, voor op het scherm en in een mail naar de klant. */
export function intentieUitleg(i: Intentie): string {
  if (i === "transactioneel") return "wil iets regelen of afspreken";
  if (i === "commercieel") return "is aan het vergelijken en kiezen";
  if (i === "informatief") return "wil eerst iets weten";
  if (i === "navigatie") return "zoekt een bepaald merk of een bepaalde pagina";
  return "onbekend";
}

/**
 * Leest de intentie uit wat Ahrefs meestuurt. Dat veld komt in twee vormen terug
 * (een object met vlaggen, of een lijst met namen), dus we vangen ze allebei op
 * in plaats van te vertrouwen op de vorm die we vandaag toevallig zien.
 *
 * De volgorde is niet willekeurig: een term kan meerdere vlaggen tegelijk aan
 * hebben staan, en dan telt de meest concrete. Wie wil kopen wil ook wel weten,
 * maar andersom niet.
 */
export function intentieVan(ruw: unknown): Intentie {
  if (!ruw) return "";
  const aan = new Set<string>();
  if (Array.isArray(ruw)) {
    for (const v of ruw) if (typeof v === "string") aan.add(v.toLowerCase());
  } else if (typeof ruw === "object") {
    for (const [k, v] of Object.entries(ruw as Record<string, unknown>)) {
      if (v === true || v === 1) aan.add(k.toLowerCase().replace(/^is_/, ""));
    }
  } else if (typeof ruw === "string") {
    aan.add(ruw.toLowerCase());
  }
  if (aan.has("transactional")) return "transactioneel";
  if (aan.has("commercial") || aan.has("commercial_investigation")) return "commercieel";
  if (aan.has("informational")) return "informatief";
  if (aan.has("navigational")) return "navigatie";
  return "";
}

export type IntentieOordeel = {
  /** Mag deze samenvoeging doorgaan? */
  mag: boolean;
  /** Eén zin, in gewone taal, waarom wel of niet. Gaat mee naar het scherm. */
  reden: string;
  /** Hard gemeten (allebei bekend) of alleen richtinggevend (iets ontbreekt). */
  hard: boolean;
};

/**
 * Mogen twee pagina's samengevoegd worden, gelet op de intentie van hun termen?
 *
 * Alleen een botsing tussen "doen" en "weten" is een blokkade. Alles wat we niet
 * zeker weten laten we door: een rem die op onwetendheid remt, staat de rest van
 * het opruimen in de weg, en dan wordt hij uitgezet.
 */
export function magSamenvoegen(a: Intentie, b: Intentie): IntentieOordeel {
  const ka = kampVan(a), kb = kampVan(b);
  if (ka === "onbekend" || kb === "onbekend") {
    return { mag: true, reden: "De zoekintentie is van minstens één van deze twee niet bekend, dus die is hier niet meegewogen.", hard: false };
  }
  if (ka === "merk" || kb === "merk") {
    return { mag: true, reden: "Eén van beide is een merkzoekopdracht; die past bij elke pagina van het merk zelf.", hard: true };
  }
  if (ka !== kb) {
    const doen = ka === "doen" ? a : b;
    const weten = ka === "weten" ? a : b;
    return {
      mag: false,
      hard: true,
      reden: `Deze twee pagina's horen bij een andere vraag: bij de één ${intentieUitleg(doen)}, bij de ander ${intentieUitleg(weten)}. Samenvoegen kost dan één van de twee bezoekers, want Google toont voor die twee zoekopdrachten ook een ander soort pagina.`,
    };
  }
  return { mag: true, reden: `Beide zoekopdrachten komen van iemand die hetzelfde wil: ${intentieUitleg(a)}.`, hard: true };
}

export type TermFeiten = { volume: number | null; moeilijkheid: number | null; intentie: Intentie };

/**
 * Volume, moeilijkheid en intentie voor een set termen, in één opvraag. Zit achter
 * dezelfde cache van 30 dagen als de rest, dus een tweede analyse in dezelfde maand
 * kost niets extra.
 */
export async function feitenPerTerm(termen: string[]): Promise<Map<string, TermFeiten>> {
  const schoon = [...new Set(termen.map((t) => (t || "").trim().toLowerCase()).filter(Boolean))];
  const uit = new Map<string, TermFeiten>();
  if (!schoon.length) return uit;
  const overzicht = await getKeywordsOverview(schoon).catch(() => []);
  for (const o of overzicht) {
    uit.set(o.keyword.toLowerCase(), {
      volume: o.volume ?? null,
      moeilijkheid: o.difficulty ?? null,
      intentie: intentieVan(o.intents),
    });
  }
  return uit;
}

/**
 * De regel als instructie voor de motor. Een filter in code houdt tegen wat we
 * kunnen meten; deze tekst zorgt dat het model niet alsnog zelf een samenvoeging
 * verzint over de intentiegrens heen.
 */
export function intentieAlsInstructie(): string {
  return [
    "ZOEKINTENTIE. Dit is een HARDE regel en gaat vóór woordovereenkomst.",
    "Twee pagina's mogen alleen samengevoegd of omgeleid worden als de bezoeker hetzelfde wil.",
    "- Iemand die wil kopen, boeken, aanvragen of een afspraak maken (transactioneel/commercieel) hoort NIET bij iemand die eerst iets wil weten (informatief), ook niet als er dezelfde woorden in de URL staan.",
    "- Voorbeeld: \"soa test kopen\" en \"wat is een soa test\" lijken op elkaar maar zijn twee verschillende pagina's. Voeg ze nooit samen.",
    "- Bots de intentie, laat de pagina dan gewoon staan en zeg in de reden dat de zoekintentie verschilt.",
    "- Weet je de intentie niet, laat hem dan buiten beschouwing in plaats van te gokken.",
  ].join("\n");
}
