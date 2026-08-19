// ═══════════════════════════════════════════════════════════
// WELKE SCHERMEN BESTAAN ER OP EEN KLANTVOORDEUR?
// ═══════════════════════════════════════════════════════════
// Eén regel, gebruikt op twee plekken: de poort op de server (middleware en
// lib/klantvenster.ts) en de kopbalk in de browser, die anders links zou tonen
// naar schermen die op de voordeur niet bestaan.
//
// Daarom staat hij hier apart, zonder ook maar één import: alles wat de server
// nodig heeft (next/server) mag niet mee in een pagina die in de browser draait.
// Zou deze regel op twee plekken uitgeschreven worden, dan lopen ze uit elkaar
// zodra er een scherm bijkomt, en dat is precies de fout die dit dashboard al
// een paar keer gemaakt heeft.
//
// De regel is omgekeerd bedoeld: alles is dicht, behálve wat hieronder
// expliciet openstaat. Een nieuw scherm is daarmee vanzelf dicht op de voordeur.
// ═══════════════════════════════════════════════════════════

/**
 * Mag dit pad geopend worden in een omgeving die op één klant staat?
 * `venster` is de slug van die klant, of null als er geen venster is (dan mag
 * alles, want dat is het gewone dashboard).
 */
export function padHoortBijVenster(pad: string, venster: string | null): boolean {
  if (!venster) return true;
  const kaal = (pad.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (!kaal.startsWith("/admin")) return true;
  if (kaal === "/admin/login" || kaal === "/admin/enter" || kaal === "/admin/logout") return true;
  if (kaal === "/admin/developer" || kaal.startsWith("/admin/developer/")) return true;
  for (const basis of [`/admin/client/${venster}`, `/admin/preview/${venster}`]) {
    if (kaal === basis || kaal.startsWith(basis + "/")) return true;
  }
  return false;
}
