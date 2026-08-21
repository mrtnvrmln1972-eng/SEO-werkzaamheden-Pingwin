// ═══════════════════════════════════════════════════════════
// EEN DATUM UIT DE DATABASE ALS "JJJJ-MM-DD" (één plek)
// ═══════════════════════════════════════════════════════════
// Een DATE-kolom komt niet als tekst terug maar als een JS-datum. Wie daar
// `String(...).slice(0, 10)` op loslaat krijgt geen "2026-08-17" maar
// "Sun Aug 17", en dat is precies de vorm die een datumvakje op het scherm
// stilzwijgend weggooit: het vakje staat dan leeg terwijl er wél een datum in
// de database staat. Erger nog, bij het volgende opslaan wordt die onleesbare
// waarde afgekeurd en de datum echt gewist.
//
// Dat is op 21-08-2026 opgevallen bij de extra regels onder een lead: twee
// regels toonden geen opvolgdatum, terwijl er een datum stond, en ze namen
// daardoor ook de datum van het bedrijf erboven niet over.
//
// Dus: één functie, en elke plek die een DATE-kolom uitleest gebruikt hem.
// Nooit ergens een tweede manier om dit te doen; dan lopen ze uit elkaar en is
// het volgende scherm weer de uitzondering.
// ═══════════════════════════════════════════════════════════

/**
 * Een DATE-kolom uit Postgres als "JJJJ-MM-DD". Leeg, onleesbaar of niets
 * levert `null` op; dan is er ook echt geen datum, in plaats van een half woord.
 */
export function dagUitDb(waarde: unknown): string | null {
  if (waarde === null || waarde === undefined || waarde === "") return null;

  // Een DATE komt binnen als middernacht in de tijdzone van de server. Uit de
  // losse onderdelen lezen en niet via toISOString: die rekent naar UTC, en dan
  // wordt 17 augustus in Amsterdam ineens 16 augustus.
  if (waarde instanceof Date) {
    if (Number.isNaN(waarde.getTime())) return null;
    const twee = (n: number) => String(n).padStart(2, "0");
    return `${waarde.getFullYear()}-${twee(waarde.getMonth() + 1)}-${twee(waarde.getDate())}`;
  }

  // Al tekst: dan staat de datum vooraan, met of zonder tijd erachter.
  const tekst = String(waarde).trim();
  const kop = /^(\d{4}-\d{2}-\d{2})/.exec(tekst);
  return kop ? kop[1] : null;
}
