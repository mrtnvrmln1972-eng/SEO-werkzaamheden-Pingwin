// ═══════════════════════════════════════════════════════════
// DE KENNISBANK VAN HET PAGINA-LAB: DE INGANG
// ═══════════════════════════════════════════════════════════
// Eén hoofdstuk is één bestand hiernaast, per discipline, plus `vakoordeel.ts`
// voor de tweede plank. Dit bestand voegt ze samen en is verder alleen de
// volgorde en het opzoeken. Schrijf hier dus geen criteria; die horen in het
// bestand van hun eigen discipline. Zelfde reden als bij `lib/uitleg/index.ts`:
// er wordt vanuit meerdere chats aan dit dashboard geschreven, en één gedeeld
// bestand is een botsing die staat te wachten.
//
// Deze laag WEET wat goed is, hij OORDEELT niet over een pagina. Dat oordeel
// komt later en ergens anders, met de meting en de foto van `lib/pagina-lab/
// bron.ts` ernaast. Het onderscheid is hetzelfde als bij de brug: een model dat
// een plausibel verhaal kan vertellen doet dat ook zonder criteria.
// ═══════════════════════════════════════════════════════════

import { BRUIKBAARHEID } from "./bruikbaarheid";
import { CONVERSIE } from "./conversie";
import { INTERACTIE } from "./interactie";
import { VAKOORDELEN } from "./vakoordeel";
import { VORMGEVING } from "./vormgeving";
import { DISCIPLINES, VAKOORDEEL_WAARSCHUWING } from "./types";
import type { Criterium, Discipline, Vakoordeel } from "./types";

export type { Bewijs, Bron, Criterium, Discipline, Stand, Vakoordeel, Vaststellen, Weegt } from "./types";
export { DISCIPLINES, DISCIPLINE_UITLEG, VAKOORDEEL_WAARSCHUWING } from "./types";
export { VAKOORDELEN };

/** Plank 1: alles wat onderbouwd is, in de volgorde van de disciplines. */
export const CRITERIA: Criterium[] = [...CONVERSIE, ...BRUIKBAARHEID, ...VORMGEVING, ...INTERACTIE];

export function criteriaVan(discipline: Discipline): Criterium[] {
  return CRITERIA.filter((c) => c.discipline === discipline);
}

export function vakoordelenVan(discipline: Discipline): Vakoordeel[] {
  return VAKOORDELEN.filter((v) => v.discipline === discipline);
}

/** Eén punt opzoeken op zijn code, van welke plank dan ook. */
export function opId(id: string): Criterium | Vakoordeel | null {
  const code = id.trim().toUpperCase();
  return CRITERIA.find((c) => c.id === code) || VAKOORDELEN.find((v) => v.id === code) || null;
}

/** Hoe vol de kennisbank is, per discipline. Voor op het scherm. */
export function telling(): { discipline: Discipline; onderbouwd: number; vakoordeel: number }[] {
  return DISCIPLINES.map((d) => ({
    discipline: d,
    onderbouwd: criteriaVan(d).length,
    vakoordeel: vakoordelenVan(d).length,
  }));
}

/**
 * De oudste datum waarop een bron is nagekeken. Kennis over conversie en
 * vormgeving veroudert langzamer dan SEO, maar niet oneindig langzaam: als dit
 * getal een jaar oud wordt, is het tijd voor een ronde langs de bronnen.
 */
export function oudsteControle(): string {
  return CRITERIA.map((c) => c.gecheckt).sort()[0] || "";
}

/**
 * De kennisbank als tekst, klaar om aan een beoordeling mee te geven.
 *
 * De twee planken blijven hier gescheiden, met de waarschuwing ertussen. Dat is
 * geen opmaak maar de kern: zodra onderbouwde criteria en eigen vakoordeel in
 * één lijst belanden, komt een mening als bewijs in een klantrapport terecht.
 */
export function alsTekst(disciplines: Discipline[] = DISCIPLINES): string {
  const stukken: string[] = [];
  for (const d of disciplines) {
    const regels = criteriaVan(d).map(
      (c) => `- **${c.id} ${c.titel}** (weegt ${c.weegt}, bewijs ${c.bewijs}). ${c.waarNaarKijken} Waarom: ${c.waarom}${c.nuance ? ` Nuance: ${c.nuance}` : ""}`,
    );
    if (regels.length) stukken.push(`### ${d}, onderbouwd\n${regels.join("\n")}`);
  }
  const eigen = disciplines.flatMap((d) => vakoordelenVan(d));
  if (eigen.length) {
    const regels = eigen.map((v) => `- **${v.id} ${v.titel}** (weegt ${v.weegt}). ${v.waarNaarKijken} Waarom: ${v.waarom}`);
    stukken.push(`### Vakoordeel van Pingwin, zonder bron\n${VAKOORDEEL_WAARSCHUWING}\n${regels.join("\n")}`);
  }
  return stukken.join("\n\n");
}
