// ═══════════════════════════════════════════════════════════
// WEKEN EN DAGEN: ÉÉN REKENREGEL VOOR ALLE PLANNINGSSCHERMEN
// ═══════════════════════════════════════════════════════════
// Het overzicht over alle klanten, de planning per klant en het tabblad Taken
// rekenen alle drie met weken en dagen. Die som hoort één keer te bestaan.
// Stond hij drie keer, dan zegt het ene scherm week 33 en het andere week 32,
// en niemand die merkt welke van de twee liegt (de les van 2 augustus).
//
// Alles rekent in UTC. Een kalenderdag is hier een label ("2026-08-06"), geen
// tijdstip; met lokale tijdzones erin verschuift een dag rond middernacht.

export type IsoWeek = { year: number; week: number };

/** De maandag van een ISO-week (jaar plus weeknummer). */
export function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

/** In welke ISO-week valt deze dag. */
export function isoVan(d: Date): IsoWeek {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const eersteDo = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  eersteDo.setUTCDate(eersteDo.getUTCDate() - ((eersteDo.getUTCDay() + 6) % 7) + 3);
  return { year: date.getUTCFullYear(), week: 1 + Math.round((date.getTime() - eersteDo.getTime()) / (7 * 864e5)) };
}

/** In welke ISO-week valt "2026-08-06". Lege of onzinnige datum: null. */
export function weekVanIso(iso: string | null | undefined): IsoWeek | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return isoVan(d);
}

/** Een Date als "2026-08-06". */
export const isoVanDatum = (d: Date) => d.toISOString().slice(0, 10);

/** De maandag van deze week als "2026-08-06". */
export const maandagVanWeek = (jaar: number, week: number) => isoVanDatum(mondayOfISOWeek(jaar, week));

/**
 * Waar komt de dag te staan als een kaart naar een andere week verhuist.
 *
 * Had de kaart al een dag, dan houdt hij dezelfde weekdag: sleep je een klus van
 * woensdag naar volgende week, dan staat hij daar weer op woensdag. Had hij nog
 * geen dag, dan wordt het de maandag van die week. Een kaart zonder dag in een
 * week zetten en hem dan tóch dagloos laten zou betekenen dat hij nergens in de
 * dagplanning opduikt, terwijl je hem net bewust ergens neerlegde.
 */
export function datumNaVerplaatsing(iso: string | null | undefined, jaar: number, week: number): string {
  const maandag = mondayOfISOWeek(jaar, week);
  if (!iso) return isoVanDatum(maandag);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoVanDatum(maandag);
  const dag = (d.getUTCDay() + 6) % 7;                     // maandag = 0
  maandag.setUTCDate(maandag.getUTCDate() + dag);
  return isoVanDatum(maandag);
}

/** Hoeveel hele dagen zit "2026-08-10" van "2026-08-06" af. Negatief = verleden. */
export function dagenTussen(vanIso: string, totIso: string): number {
  const a = new Date(`${vanIso}T00:00:00Z`).getTime();
  const b = new Date(`${totIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 864e5);
}
