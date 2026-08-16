// ═══════════════════════════════════════════════════════════
// GEEN LOS LIGGEND LANG STREEPJE IN BEELD
// ═══════════════════════════════════════════════════════════
// Vaste Pingwin-schrijfregel: een em-dash of en-dash als zinsscheiding bestaat
// niet. Het wordt een komma, een dubbele punt, een puntkomma, haakjes of een
// nieuwe zin. Een koppelteken zonder spaties in een samenstelling (AI-tools,
// SEO-strategie, "Titel - Merknaam" in een meta-title) blijft gewoon staan.
//
// Waarom dit in code staat en niet alleen in een prompt: de regel staat al
// maanden in het projectgeheugen én in de instructies aan het model, en tóch
// kwam op 16 augustus 2026 een vastgelegde strategie voorbij met "SEO-STRATEGIE
// KAMSTEEG — VASTGELEGD IN GESPREK" en "Laag 1 — Dienstpagina's". Een model
// houdt zich niet met zekerheid aan een stijlregel; een functie wel.
//
// Dit draait in de WEERGAVE-laag, dus met terugwerkende kracht: elke kaart,
// elk profiel en elke chat-tekst die er al staat is er meteen vanaf, zonder dat
// er iets herschreven of opnieuw opgeslagen hoeft te worden.

/**
 * Haalt losse lange streepjes uit een tekst.
 *
 * Wat er wél verandert:
 *   "Laag 1 — Dienstpagina's"      → "Laag 1, Dienstpagina's"
 *   "prijzen — geen plaatsnamen"   → "prijzen, geen plaatsnamen"
 *   "— eerste punt" (regelbegin)   → "- eerste punt" (dat is een opsomming)
 *
 * Wat er NIET verandert:
 *   "SEO-strategie", "AI-tools"     (koppelteken zonder spaties)
 *   "Tuinaanleg Breda - Kamsteeg"   (de vaste vorm van een meta-title)
 *   "---"                           (een scheidingslijn in markdown)
 */
export function zonderLosStreepje(tekst: string): string {
  if (!tekst) return tekst;
  return tekst
    // Aan het begin van een regel is een streepje een opsommingsteken, geen
    // zinsscheiding. Dat wordt de gewone markdown-bullet.
    .replace(/^([ \t]*)[—–][ \t]+/gm, "$1- ")
    // Verder altijd een komma. Bewust geen slimmigheid die soms een dubbele punt
    // kiest: dan hangt de uitkomst af van hoe lang het stuk ervoor toevallig is,
    // en dat is precies het soort regel waar je later niet meer op kunt bouwen.
    .replace(/[ \t]+[—–][ \t]+/g, ", ")
    // Een streepje dat tegen de woorden aan geplakt zit doet hetzelfde werk,
    // maar mag geen koppelteken worden: ook een komma.
    .replace(/(\S)[—–](\S)/g, "$1, $2");
}
