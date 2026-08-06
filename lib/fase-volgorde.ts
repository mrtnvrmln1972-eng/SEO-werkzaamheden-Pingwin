// ═══════════════════════════════════════════════════════════
// DE ZEVEN FASES: VOLGORDE, VOLGENDE STAP EN WIE AAN ZET IS
// ═══════════════════════════════════════════════════════════
// Er leefden twee berekeningen naast elkaar voor "wat is de volgende stap": de
// kaart pakte de eerste fase die nog niet af was, en de server had een eigen
// nextStep die voor een pagina die nog niet bestaat "Ontwikkel" zei en analyse
// oversloeg. Bij /hovenier/ zag je dat botsen: de chip zei "Volgende: Strategie"
// terwijl de knop ernaast "Blauwdruk + copy" startte.
//
// Eén bron dus. En meteen de vraag die het bord stelt: wie is er aan zet? Dat
// hoort te volgen uit de fase, niet uit het chipje op de kaart. Een kaart kan
// aan de dev toegewezen zijn terwijl de strategie nog bepaald moet worden, en
// dan wacht hij op Maarten en niet op de dev.

export type FaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

// De namen stonden op vier plekken los opgeschreven (de kaart, het planningsbord,
// de pagina's-lijst en hier). Dat gaat vanzelf een keer scheef lopen, dus deze
// lijst is nu de enige bron; de schermen lezen hier hun labels uit.
//
// `letter` is het teken in het bolletje op het planningsbord. Strategie en
// Structured data beginnen allebei met een S; dat mag, want de plek in het rijtje
// ligt vast (strategie vooraan, structured data achteraan) en aanwijzen toont de
// volledige naam.
export const FASE_VOLGORDE: { key: FaseKey; label: string; kort: string; letter: string }[] = [
  { key: "strategie", label: "Strategie", kort: "Strategie", letter: "S" },
  { key: "gelieerde", label: "Gelieerde pagina's", kort: "Gelieerd", letter: "G" },
  { key: "analyse", label: "Analyse", kort: "Analyse", letter: "A" },
  { key: "blauwdruk", label: "Blauwdruk", kort: "Blauwdruk", letter: "B" },
  { key: "copy", label: "Copy", kort: "Copy", letter: "C" },
  { key: "bouw", label: "Implementatie", kort: "Implementatie", letter: "I" },
  { key: "structured", label: "Structured data", kort: "Schema", letter: "S" },
];

export type FaseStand = Partial<Record<FaseKey, boolean>>;

/**
 * De eerstvolgende stap die nog gedaan moet worden. Alles af = null.
 *
 * Bestaat de pagina nog niet, dan slaan we analyse over: je kunt een pagina die
 * er niet is niet analyseren. Dat is precies waarom de knop op de kaart daar
 * "Blauwdruk + copy" zegt; die uitzondering zit nu op één plek in plaats van
 * verspreid over de kaart en de server.
 */
export function volgendeFase(stand: FaseStand, live = true): FaseKey | null {
  for (const f of FASE_VOLGORDE) {
    if (!live && f.key === "analyse") continue;
    if (!stand[f.key]) return f.key;
  }
  return null;
}

export function faseLabel(key: FaseKey | null): string {
  return FASE_VOLGORDE.find((f) => f.key === key)?.label || "";
}

/**
 * Wie is er aan zet? Bouw, publicatie en structured data zijn dev-werk; de rest
 * is van Maarten. Zonder pagina valt het terug op wie de kaart toegewezen kreeg.
 */
export function aanZet(stand: FaseStand | null, live: boolean, wie?: string): "jou" | "de dev" {
  if (!stand) return /dev/i.test(wie || "") ? "de dev" : "jou";
  const f = volgendeFase(stand, live);
  if (!f) return /dev/i.test(wie || "") ? "de dev" : "jou";
  return f === "bouw" || f === "structured" ? "de dev" : "jou";
}
