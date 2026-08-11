// De twee vormen waar de hele uitlegpagina uit bestaat. Ze staan apart zodat
// elk hoofdstukbestand ze kan gebruiken zonder de index te importeren; dat zou
// een kringetje opleveren (index leest de hoofdstukken, hoofdstuk leest index).

export type Uitklapper = {
  titel: string;
  /** Eén regel die de kern samenvat, staat naast de titel in de dichte staat. */
  kern?: string;
  /** Markdown. Wordt gerenderd via lib/markdown.ts, dus nooit ruwe tekens in beeld. */
  tekst: string;
  sub?: Uitklapper[];
};

export type Hoofdstuk = {
  id: string;
  titel: string;
  /** Korte staande tekst boven de uitklappers. */
  intro: string;
  /** Alleen zichtbaar met een admin-sessie. */
  intern?: boolean;
  uitklappers: Uitklapper[];
};
