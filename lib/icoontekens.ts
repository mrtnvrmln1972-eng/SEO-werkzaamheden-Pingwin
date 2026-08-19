// ═══════════════════════════════════════════════════════════
// ICOONTJES DIE ALS LETTER IN BEELD STAAN
// ═══════════════════════════════════════════════════════════
// Een pijltje, een vinkje of een driehoekje is geen letter. Toch staan ze zo in
// de code, want ▸ typen is makkelijker dan een tekening maken. Dat gaat goed tot
// het lettertype dat teken niet heeft: dan pakt de browser een ander lettertype
// (dus staat het er in een andere letter bij) of hij tekent een leeg vierkantje.
//
// WAT ER ECHT AAN DE HAND WAS (19-08-2026)
// ────────────────────────────────────────
// Op /admin/stijl stond "Icoontjes als letter in beeld: 18 plekken → 0". Dat
// getal was met de hand ingetypt en klopte niet: er stonden er 419, verdeeld
// over 40 verschillende tekens. Er werd bovendien gegokt wélke tekens Montserrat
// mist. Dat is nu gemeten in de woff2-bestanden die Google Fonts uitlevert, dus
// het staat niet meer ter discussie.
//
// DE OPLOSSING IS NIET VIERHONDERD KEER ZOEKEN EN VERVANGEN
// ─────────────────────────────────────────────────────────
// Dat duurt weken en de volgende chat typt er weer een. In plaats daarvan worden
// de tekens die Montserrat mist er als klein terugval-lettertype bíj geladen:
// precies die tekens en geen letter meer. Google Fonts kan met `text=` een
// lettertype uitknippen tot alleen de opgegeven tekens, dus dit kost een paar
// honderd bytes. Vanaf dat moment ziet élk teken er op élk apparaat hetzelfde
// uit, ook in tekst die wij niet schrijven: een antwoord van de AI, een geplakte
// strategie, de inhoud van een mail.
//
// Wat overblijft zijn de tekens die geen enkel van deze lettertypes heeft. Die
// moeten wél met de hand weg, en dat zijn er achtentwintig in plaats van
// vierhonderd. `proeven/icoontekens.proef.ts` bewaakt het: hij leest élk scherm
// en wordt rood zodra er een teken in beeld komt dat niemand kan tekenen.
//
// Een getekend icoontje blijft beter voor een knop: het erft de kleur van de
// tekst, het schaalt mee met de lettergrootte en je bepaalt de lijndikte zelf
// (zie app/_ui/Pijl.tsx). Die twee bijten elkaar niet. De bijlading zorgt dat
// niets kápot in beeld staat, de tekeningen maken de bediening mooier, en de
// meter op /admin/stijl laat zien hoeveel er nog te vertekenen valt.
// ═══════════════════════════════════════════════════════════

/**
 * De tekens die Montserrat mist en die wij tóch in beeld brengen. Deze worden
 * als terugval-lettertype bijgeladen, dus ze renderen overal hetzelfde.
 *
 * Voeg hier alleen iets toe als het teken echt nodig is én in een van de twee
 * Noto-symbolenfamilies zit; anders is deze lijst een belofte die niet
 * waargemaakt wordt en staat er alsnog een leeg vierkantje. De proef controleert
 * dat niet voor je, want die kan tijdens een bouw geen lettertype downloaden.
 */
const PIJLEN = "→←↗↘";
const SYMBOLEN = "✓✔✕✖✗▸▾▴▲▼▶◀▷◦○◍●★☆☑☐⚠⠿✎✉";

export const BIJGELADEN = PIJLEN + SYMBOLEN;

/**
 * Losse tekens die Montserrat zélf heeft en die dus altijd goed staan. Gemeten,
 * niet geraden. `›` is het opsommingsteken van de gedeelde opmaak, `·` de
 * scheiding tussen twee links, `×` het kruisje om iets te sluiten.
 */
export const MONTSERRAT_HEEFT = "↑↓×›‹»«·−–—±•…€°“”‘’„";

/**
 * Alles wat op het scherm mag staan zonder dat het een leeg vierkantje wordt.
 * Letters met een accent vallen hier niet onder; die worden apart afgehandeld,
 * zie de proef.
 */
export const TOEGESTAAN = MONTSERRAT_HEEFT + BIJGELADEN;

/** De namen zoals ze in de opmaak-stapel moeten staan, direct ná Montserrat. */
export const SYMBOOL_FAMILIES = ["Noto Sans Symbols 2", "Noto Sans Symbols"];

/**
 * De adressen voor in de kop van de pagina. Uitgeknipt met `text=`, dus een paar
 * honderd bytes per familie in plaats van honderden kilobytes.
 */
export function symboolFontUrls(): string[] {
  return [
    `https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&text=${encodeURIComponent(SYMBOLEN)}&display=swap`,
    `https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&text=${encodeURIComponent(PIJLEN)}&display=swap`,
  ];
}
