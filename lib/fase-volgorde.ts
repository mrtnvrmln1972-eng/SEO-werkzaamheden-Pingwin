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

export const FASE_VOLGORDE: { key: FaseKey; label: string; kort: string }[] = [
  { key: "strategie", label: "Strategie", kort: "Strategie" },
  { key: "gelieerde", label: "Gelieerde pagina's", kort: "Gelieerd" },
  { key: "analyse", label: "Analyse", kort: "Analyse" },
  { key: "blauwdruk", label: "Blauwdruk", kort: "Blauwdruk" },
  { key: "copy", label: "Copy", kort: "Copy" },
  { key: "bouw", label: "Bouw en publicatie", kort: "Bouw" },
  { key: "structured", label: "Structured data", kort: "Schema" },
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
