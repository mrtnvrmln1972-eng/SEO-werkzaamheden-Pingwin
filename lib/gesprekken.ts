// ═══════════════════════════════════════════════════════════
// WELKE GESPREKKEN BIJ DE SITE-ASSISTENT HOREN
// ═══════════════════════════════════════════════════════════
// Er was één assistent te veel. Het zwevende venster (SEO-assistent) en het
// Overview-blok op de takenpagina waren twee schermen op dezelfde motor, maar
// met verschillende kennis en verschillende gesprekkenlijsten. Het Overview-blok
// toonde alleen zijn eigen onderwerpen ("overzicht*"); het zwevende venster
// toonde álles wat er in de database stond, inclusief die van de bird's eye en
// van Google Ads, met hun technische naam. Bij Kamsteeg stond er letterlijk
// `overzicht:~mshj4bjy` in dat keuzelijstje, en koos je die, dan kreeg je
// stilzwijgend een andere assistent dan het venster beloofde.
//
// Sinds 19-08-2026 is het één tool met twee vensters: dezelfde context, dezelfde
// gereedschappen, dezelfde gesprekken. Dit bestand is de ENIGE plek waar staat
// welke gesprekken daarbij horen en hoe ze heten. Schrijf die regel nergens
// anders opnieuw uit; `proeven/gesprekken.proef.ts` rekent dat na.

/** De naam van het basisgesprek van de site-assistent (het Overview-blok). */
export const GESPREK_BASIS = "overzicht";

/** Voorvoegsel voor een nieuw gesprek dat nog geen naam heeft. */
export const GESPREK_NIEUW = "overzicht:~";

/** Het eigen gesprek van één projectkaart zonder pagina. */
export const GESPREK_KAART = "overzicht:kaart:";

/**
 * Draait dit gesprek op de site-assistent? Dit bepaalt de MOTOR: welke kennis en
 * welke gereedschappen het gesprek krijgt.
 *
 * Niet: "ads" (de Ads-assistent heeft eigen grounding en eigen cijfers) en
 * "lead" (de leadomgeving, een bedrijf dat nog geen klant is en dus geen Search
 * Console en geen weekplanning heeft). Al het andere wél, inclusief het eigen
 * gesprek van een projectkaart en de oude "algemeen".
 */
export function isSiteAssistent(thread: string): boolean {
  const t = (thread || "").trim();
  if (!t) return true;                     // lege naam valt terug op het basisgesprek
  return t !== "ads" && t !== "lead";
}

/**
 * Hoort dit gesprek in de GESPREKKENLIJST van de site-assistent (het Overview-blok
 * en het zwevende venster)? Dat is de motor-regel hierboven, min het eigen gesprek
 * van een projectkaart: dat hoort bij die kaart en niet in een lijst.
 *
 * Twee aparte vragen, met opzet. Verwar ze niet: een kaartgesprek draait wél op de
 * site-assistent (dezelfde kennis) maar staat niet in de lijst.
 */
export function isSiteGesprek(thread: string): boolean {
  const t = (thread || "").trim();
  if (!t) return false;
  if (!isSiteAssistent(t)) return false;
  return !t.startsWith(GESPREK_KAART);
}

/**
 * Hoe een gesprek in beeld heet. Een zelf gegeven of automatisch gemaakte titel
 * wint altijd; anders een leesbare naam in plaats van de technische thread.
 */
export function gesprekLabel(thread: string, title?: string): string {
  const eigen = (title || "").trim();
  if (eigen) return eigen;
  const t = (thread || "").trim();
  if (t === GESPREK_BASIS) return "Overzicht";
  if (t === "algemeen") return "Algemeen";
  if (t === "ads") return "Google Ads";
  if (t.startsWith(GESPREK_NIEUW)) return "Nieuw onderwerp";
  return t.replace(/^overzicht:/, "");
}
