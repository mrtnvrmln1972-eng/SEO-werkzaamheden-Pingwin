// Gedeelde bouwstenen voor Maartens agenda: checklist/subtaken-vorm, prioriteit-
// en herinnering-presets, kleurenpalet en datumhelpers. Gebruikt door de
// weekagenda (tijdblokken) en de hele-dag-taken, zodat een taak overal
// dezelfde velden en hetzelfde gedrag heeft. Poort van LifeMax' Weekplanner
// (zie pingwin-brein voor de achtergrond van die verhuizing).

export type TaakItem = { id: string; tekst: string; done: boolean };

// Hele-dag-taak: een taak op een dag (of meerdere, via eind_datum), zonder
// tijdsaanduiding.
export type DagTaak = {
  id: number;
  titel: string;
  kleur: string;
  datum: string;
  eind_datum: string | null;
  done: boolean;
  notities: string;
  checklist: TaakItem[];
  subtaken: TaakItem[];
  prioriteit: number;
  lijst: string;
  tags: string[];
  herinneringen_dagen: number[];
};

// Lijsten die er altijd zijn, ook als je ze nog nooit gebruikt hebt. Het veld
// "Lijst" is vrije tekst met suggesties uit wat je eerder typte, en dat is prima
// voor eenmalige lijstjes, maar een categorie die je élke week gebruikt hoort
// niet elke keer opnieuw ingetypt te worden (en dan een keer als "AI werk", een
// keer als "AI-werk", waarna het twee categorieën zijn).
//
// Deze lijst mag groeien, maar houd hem kort: hij is bedoeld voor wat er altijd
// is, niet voor alles wat je ooit een keer gebruikt hebt.
export const VASTE_LIJSTEN = ["AI-werk"];

/** De suggesties bij het veld "Lijst": de vaste lijsten plus wat je zelf gebruikte. */
export function lijstSuggesties(gebruikt: string[]): string[] {
  const kleine = new Set(gebruikt.map((l) => l.toLowerCase()));
  return [...VASTE_LIJSTEN.filter((l) => !kleine.has(l.toLowerCase())), ...gebruikt];
}

export const PRIORITEITEN: [number, string][] = [
  [0, "Geen"],
  [1, "Laag"],
  [2, "Gemiddeld"],
  [3, "Hoog"],
];

// Herinneringen: presets voor tijdblokken (minuten vooraf) en hele-dag-taken
// (dagen vooraf, altijd om 09:00). Meerdere tegelijk aan mag.
export const HERINNERING_MIN_PRESETS: [number, string][] = [
  [10080, "1 week"], [1440, "1 dag"], [60, "1 uur"], [15, "15 min"], [0, "Exact"],
];
export const HERINNERING_DAGEN_PRESETS: [number, string][] = [
  [7, "1 week"], [1, "1 dag"], [0, "Vandaag"],
];

// Kleurenpalet voor blokken en taken: een brede, onderscheidbare spreiding
// (geen merkkleuren, dit is een agenda-kleurkiezer, geen huisstijl-element).
export const COLORS = [
  "#dd0000",
  "#9d2346", "#e35178", "#e96d1b", "#f7a823", "#ffde14", "#bbc934",
  "#603f90", "#224271", "#1d78af", "#369cd1", "#006e79", "#1d724a", "#56a446",
  "#75848b", "#683f31", "#b37127", "#758a50", "#1d1d1b",
];

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Snap een willekeurige kleur naar de dichtstbijzijnde paletkleur, zodat er
// nooit een kleur buiten het palet in beeld komt.
export function blokKleur(color: string): string {
  const hex = color.startsWith("#") ? color : COLORS[0];
  if (COLORS.includes(hex.toLowerCase())) return hex.toLowerCase();
  const [r, g, b] = rgb(hex);
  let best = COLORS[0], bestD = Infinity;
  for (const c of COLORS) {
    const [cr, cg, cb] = rgb(c);
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "YYYY-MM-DD" + N dagen → "YYYY-MM-DD", los van tijdzone.
export function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toKey(new Date(y, m - 1, d + days));
}

// Korte, leesbare datumtekst voor de datumknop-badge: Vandaag/Morgen/"ma 10 aug"
export function fmtDatumLabel(datum: string, todayKey: string): string {
  if (!datum) return "Geen datum";
  if (datum === todayKey) return "Vandaag";
  if (datum === shiftDate(todayKey, 1)) return "Morgen";
  const [y, m, d] = datum.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtTaakBadge(datum: string, eindDatum: string, todayKey: string): string {
  const start = fmtDatumLabel(datum, todayKey);
  if (eindDatum && eindDatum !== datum) return `${start} – ${fmtDatumLabel(eindDatum, todayKey)}`;
  return start;
}

// Centrale herhaal-logica voor agenda_blocks: "elke week (of elke N weken) op
// deze dagen, tot deze datum of voor altijd". Skip-marks (agenda_marks) blijven
// bewust buiten deze functie: dat is een runtime-override per losse dag, geen
// eigenschap van de herhaalregel zelf.
export type HerhaalBron = {
  weekdays: number[] | null;
  eind_datum: string | null;
  herhaal_interval?: number | null;
  herhaal_anker_datum?: string | null;
};

// 1 = maandag .. 7 = zondag, uit een "YYYY-MM-DD"-string. Via Date.UTC, dus
// onafhankelijk van de tijdzone waarin dit draait (browser of server).
export function weekdagVan(datum: string): number {
  const [j, m, d] = datum.split("-").map(Number);
  const wd = new Date(Date.UTC(j, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function datumPlusDagen(datum: string, dagen: number): string {
  const [j, m, d] = datum.split("-").map(Number);
  const dt = new Date(Date.UTC(j, m - 1, d + dagen));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function mondayVan(datum: string): string {
  return datumPlusDagen(datum, -(weekdagVan(datum) - 1));
}

function wekenTussen(a: string, b: string): number {
  const [aj, am, ad] = mondayVan(a).split("-").map(Number);
  const [bj, bm, bd] = mondayVan(b).split("-").map(Number);
  const diffMs = Date.UTC(bj, bm - 1, bd) - Date.UTC(aj, am - 1, ad);
  return Math.round(diffMs / (7 * 86400000));
}

// Geldt deze herhaalregel op deze datum? Alleen voor het herhalende geval
// (weekdays gezet); een eenmalig blok (alleen `date`) checkt zijn aanroeper
// zelf met een simpele gelijkheid.
export function geldtOp(bron: HerhaalBron, datum: string): boolean {
  if (!bron.weekdays || bron.weekdays.length === 0) return false;
  if (!bron.weekdays.includes(weekdagVan(datum))) return false;
  if (bron.eind_datum && datum > bron.eind_datum) return false;
  const interval = bron.herhaal_interval ?? 1;
  if (interval > 1 && bron.herhaal_anker_datum) {
    const weken = wekenTussen(bron.herhaal_anker_datum, datum);
    if (((weken % interval) + interval) % interval !== 0) return false;
  }
  return true;
}
