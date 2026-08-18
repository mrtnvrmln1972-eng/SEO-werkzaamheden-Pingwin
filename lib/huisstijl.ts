// ═══════════════════════════════════════════════════════════
// DE VASTGELEGDE HUISSTIJL: EEN KEUZE DIE VOOR IEDEREEN GELDT
// ═══════════════════════════════════════════════════════════
// De speelruimte op /admin/stijl liet je een richting proberen, maar alleen in
// je eigen browser. De laatste stap was steeds: "zeg maar welke, dan zet ik hem
// door in de code." Dat is een klik-instructie met een chat ertussen, en dat is
// precies wat hier niet hoort. Nu ligt er een knop: vastleggen, en de stijl geldt
// meteen voor élk scherm en élke bezoeker, ook het klant-dashboard.
//
// WAAROM IN DE DATABASE EN NIET IN DE CODE
// ────────────────────────────────────────
// Drie redenen. Een keuze die een bouw nodig heeft, gebeurt niet op het moment
// dat je hem maakt. Het dashboard is bedoeld om straks door een ander bureau
// gebruikt te worden, en die kan niet bij de code. En de vier bestaande werelden
// (Pingwin, NOC, MMC) draaien op dezelfde code, dus een kleur in de code zetten
// zou betekenen dat ze allemaal hetzelfde worden.
//
// De schaal zelf blijft wél in de code staan. Dit stuurt alleen de handvol
// tokens uit lib/proefstijl.ts: accent, lettertype, en de vermenigvuldigers op
// ruimte, tekst, ronding en diepte. Alles daarbuiten is opmaak, geen instelling.
// ═══════════════════════════════════════════════════════════

import { unstable_cache, revalidateTag } from "next/cache";
import { getSetting, setSetting } from "./settings";
import { type Thema, BASIS, themaNaarCss, zelfdeThema } from "./proefstijl";

export const SETTING_HUISSTIJL = "huisstijl_thema";

/**
 * De vastgelegde stijl, of null als het dashboard gewoon op zijn eigen opmaak
 * staat. Faalt de database, dan is het antwoord ook null: een stijl is een
 * verfraaiing en mag nooit een scherm tegenhouden.
 */
export async function leesHuisstijl(): Promise<Thema | null> {
  try {
    const rauw = await getSetting(SETTING_HUISSTIJL);
    if (!rauw) return null;
    const t = JSON.parse(rauw) as Thema;
    if (typeof t?.accent !== "string" || !Array.isArray(t?.ronding)) return null;
    return zelfdeThema(t, BASIS) ? null : t;
  } catch {
    return null;
  }
}

/** Leg een stijl vast, of geef null om terug te gaan naar de standaard. */
export async function bewaarHuisstijl(thema: Thema | null): Promise<void> {
  await setSetting(SETTING_HUISSTIJL, thema ? JSON.stringify(thema) : null);
}

/**
 * Het blok opmaak voor in de kop van elke pagina, of een lege string.
 *
 * Wordt in de hoofdschil (app/layout.tsx) meegerenderd, dus vóór het eerste
 * beeld. Een stijl die pas ná het laden wordt toegepast, laat je een tel lang
 * het oude scherm zien en dat is lelijker dan geen stijl.
 */
export async function huisstijlCss(): Promise<string> {
  const thema = await leesHuisstijl();
  return thema ? themaNaarCss(thema) : "";
}

// Elke pagina van het dashboard vraagt dit op, dus zonder geheugen komt er een
// databasevraag bij élke paginaweergave voor iets dat vrijwel nooit verandert.
//
// Bewust het geheugen van Next zelf en geen variabele in dit bestand: een
// variabele leeft per server, en er draaien er meerdere naast elkaar. Dan zou je
// na het vastleggen op de ene server de nieuwe stijl zien en op de andere nog
// een minuut lang de oude, afhankelijk van welke je pagina toevallig maakt. Met
// een label kan het vastleggen het geheugen van álle servers tegelijk wissen.
export const HUISSTIJL_LABEL = "huisstijl";

export const huisstijlCssGecached = unstable_cache(huisstijlCss, ["huisstijl-css"], {
  tags: [HUISSTIJL_LABEL],
  revalidate: 300,
});

/** Na het vastleggen: het geheugen leegmaken zodat het volgende scherm klopt. */
export function vergeetHuisstijl() {
  revalidateTag(HUISSTIJL_LABEL);
}
