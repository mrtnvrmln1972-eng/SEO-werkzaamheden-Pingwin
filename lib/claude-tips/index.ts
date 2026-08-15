import type { Hoofdstuk } from "./types";
import { HOOFDSTUK as start } from "./01-start";
import { HOOFDSTUK as model } from "./02-model";
import { HOOFDSTUK as vastzitten } from "./03-vastzitten";
import { HOOFDSTUK as scherp } from "./04-scherp";
import { HOOFDSTUK as kosten } from "./05-kosten";
import { HOOFDSTUK as onderhoud } from "./06-onderhoud";

// ═══════════════════════════════════════════════════════════
// DE GEBRUIKSAANWIJZING VOOR HET WERKEN MET CLAUDE
// ═══════════════════════════════════════════════════════════
// Geen instructie ván Claude aan Claude (dat staat in de CLAUDE.md's), maar het
// spiegelbeeld: waar Maarten zelf op let, zodat hij niet elke keer opnieuw hoeft
// te ontdekken waarom een chat traag, duur of onbetrouwbaar aanvoelt.
//
// DIT BESTAND IS ALLEEN DE VOLGORDE. De tekst staat per hoofdstuk in zijn eigen
// bestand, en dat is een botsmaatregel, geen netheid: stond alles in één bestand
// (eerst in de pagina zelf), dan moet élke chat die een tip toevoegt in datzelfde
// bestand schrijven, en botsen twee chats op één dag gegarandeerd. Precies de
// fout die lib/uitleg.ts en LAATST_BIJGEWERKT eerder maakten.
//
// EEN TIP TOEVOEGEN: zoek het hoofdstuk waar hij thuishoort, zet er één blok bij,
// klaar. Nooit een bestaande tip herschrijven om er iets in te proppen, en nooit
// een tweede lijst beginnen; dit is de enige plek. Past hij nergens, dan pas een
// nieuw hoofdstuk, en dan komt hij hier in de lijst.
// ═══════════════════════════════════════════════════════════

export const HOOFDSTUKKEN: Hoofdstuk[] = [
  start, model, vastzitten, scherp, kosten, onderhoud,
];

export type { Hoofdstuk, Tip } from "./types";

/** Een anker voor de snelmenu-links bovenaan de pagina. */
export function anker(titel: string): string {
  return titel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
