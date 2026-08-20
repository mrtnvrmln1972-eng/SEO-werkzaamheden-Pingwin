// ═══════════════════════════════════════════════════════════
// DE KANS VAN EEN LEAD DIE NOG NIEMAND BEOORDEELD HEEFT
// ═══════════════════════════════════════════════════════════
// Dit getal staat apart, in een bestand zonder database-import, omdat twee
// kanten het nodig hebben: de prognose op de server (lib/prognose.ts) en de
// leadlijst in de browser, die het gewogen totaal onderaan de kolommen laat
// zien. Zou het alleen in lib/prognose.ts staan, dan sleept een scherm dat het
// wil gebruiken de hele Postgres-client mee naar de browser, en dat kan niet.
// Eén getal op één plek; nooit ergens een losse 30 neerzetten.
// ═══════════════════════════════════════════════════════════

/**
 * Waarmee een lead meetelt zolang niemand een kans heeft ingevuld. Bewust geen
 * 100: dan zou de prognose beloven wat nog niet getekend is.
 */
export const LEAD_STANDAARD_KANS = 30;
