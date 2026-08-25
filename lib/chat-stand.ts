// ═══════════════════════════════════════════════════════════
// LOOPT ER NOG EEN ANTWOORD, OF IS HET NOOIT AFGEMAAKT?
// ═══════════════════════════════════════════════════════════
// Eén regel, en die staat hier omdat zowel de server als het scherm hem nodig
// heeft: `lib/chat.ts` trekt de database en de Claude-koppeling mee en kan dus
// niet in een browsercomponent geladen worden. Dit bestandje heeft geen enkele
// import, dus het kan overal heen. Nooit een tweede versie van deze grens
// opschrijven; dan zegt het scherm iets anders dan de database (25-08-2026).

/**
 * Hoe lang een "bezig" nog geloofwaardig is.
 *
 * De functie op Vercel stopt sowieso na 300 seconden (zie `maxDuration` op de
 * chat-route), dus wat daarna nog op "bezig" staat is nooit afgemaakt: een
 * deploy heeft de functie omgehakt, of hij is geklapt. Zonder deze grens zou zo'n
 * gesprek voor altijd "bezig sinds vanochtend" blijven zeggen, en dan is het
 * merkteken niets meer waard. Dit vervangt een opruim-cron: de waarheid wordt bij
 * het lezen bepaald, niet door iets dat later langs moet komen.
 */
export const BEZIG_GELDIG_MS = 6 * 60 * 1000;

export type BezigStand = "nee" | "bezig" | "afgebroken";

/** Wat een opgeslagen `bezig_sinds` op dít moment betekent. */
export function bezigStand(bezigSinds: string | null | undefined, nu = Date.now()): BezigStand {
  const t = Date.parse(bezigSinds || "");
  if (!bezigSinds || Number.isNaN(t)) return "nee";
  return nu - t <= BEZIG_GELDIG_MS ? "bezig" : "afgebroken";
}
