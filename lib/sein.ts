// ═══════════════════════════════════════════════════════════
// HET SEIN: ÉÉN KLEURTAAL VOOR ALLE TELLERS IN DE KOPBALK
// ═══════════════════════════════════════════════════════════
// Er hangt inmiddels meer dan één teller rechtsboven (Ahrefs-tegoed, Claude-kosten)
// en er komen er waarschijnlijk meer. Zouden die elk hun eigen kleuren kiezen, dan
// betekent groen op de ene teller iets anders dan groen op de andere, en dat is
// precies het soort verschil dat niemand opmerkt maar dat wel verkeerd leest.
//
// Vandaar één plek: vier standen en vier kleuren. Wie een teller bijbouwt, gebruikt
// deze en verzint er geen eigen palet bij.
// ═══════════════════════════════════════════════════════════

/** Hoe een teller ervoor staat. Bepaalt de kleur in de kopbalk. */
export type Sein = "rustig" | "let-op" | "krap" | "onbekend";

/** Kleur per sein. Eén plek, zodat kopbalk en paneel nooit uit elkaar lopen. */
export const SEIN_KLEUR: Record<Sein, string> = {
  rustig: "var(--brand-teal)",
  "let-op": "var(--orange)",
  krap: "var(--red)",
  onbekend: "var(--gray)",
};
