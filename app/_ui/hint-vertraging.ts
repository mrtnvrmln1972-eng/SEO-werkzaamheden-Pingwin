// ═══════════════════════════════════════════════════════════
// HOE LANG JE STIL HANGT VOORDAT ER IETS VERSCHIJNT (één bron)
// ═══════════════════════════════════════════════════════════
// Alles wat vanzelf opkomt bij hover (het donkere uitleg-bolletje, de
// link-preview) wacht even, zodat er niets meer flikkert terwijl je met de muis
// over het scherm beweegt. Het getal zelf staat als `--hint-vertraging` in
// app/globals.css, want daar staan alle andere maten ook; hier wordt het alleen
// gelezen. Nooit een tweede wachttijd ergens in een scherm uitschrijven: dan
// lopen ze uit elkaar en voelt het ene bolletje anders dan het andere.
// ═══════════════════════════════════════════════════════════

const TERUGVAL_MS = 700;

export function leesHintVertraging(): number {
  try {
    const waarde = getComputedStyle(document.documentElement).getPropertyValue("--hint-vertraging").trim();
    if (waarde.endsWith("ms")) return Math.max(0, parseFloat(waarde));
    if (waarde.endsWith("s")) return Math.max(0, parseFloat(waarde) * 1000);
  } catch { /* geen berekende stijl beschikbaar, dan de terugval */ }
  return TERUGVAL_MS;
}
