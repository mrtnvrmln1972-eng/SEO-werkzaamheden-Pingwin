// Wat voor werk is een bevinding, en waar gebeurt dat werk?
//
// Bewust een APART bestand zonder server-afhankelijkheden: het scherm draait in de
// browser en mag dus niets importeren dat een bestand van schijf leest (de
// rekenkern doet dat wel, voor scoring-config.json). Zo kunnen scherm en motor
// dezelfde tabel gebruiken zonder dat de browser de halve serverkant meesleept.
//
// Eerder stond hier een skill-naam ("seo-analyse-landingpage, dan seo-copywriting").
// Dat leest niemand als werk. Het is nu de gewone naam van de klus, en tegelijk het
// adres ernaartoe: de naam op het scherm, de knop waarop je filtert en de plek waar
// je landt horen niet uit elkaar te kunnen lopen.
//
// - `tab`     : naar welk tabblad de link springt.
// - `taaktype`: het soort werk op de weekplan-kaart. Zorgt dat de kaart vanuit de
//               planning ook weer terugspringt naar het juiste tabblad.
// - `kaart`   : maakt klikken een taakkaart aan? Alleen voor paginawerk, want dat
//               loopt over meerdere fases en weken. Meta, opruimen en interne links
//               houden hun eigen voortgang al bij op hun eigen scherm; daar een
//               kaart bij maken is dubbele administratie.

export type Categorie = { naam: string; tab: string; taaktype: string; kaart: boolean };

export const CATEGORIE: Record<string, Categorie> = {
  striking_distance: { naam: "Pagina optimaliseren", tab: "paginas", taaktype: "pijplijn", kaart: true },
  verouderde_topper: { naam: "Pagina optimaliseren", tab: "paginas", taaktype: "pijplijn", kaart: true },
  featured_snippet:  { naam: "Pagina optimaliseren", tab: "paginas", taaktype: "copy", kaart: true },
  content_gap:       { naam: "Nieuwe pagina", tab: "paginas", taaktype: "pijplijn", kaart: true },
  ctr_underperform:  { naam: "Meta & klikdoor", tab: "meta", taaktype: "meta", kaart: false },
  cannibalisatie:    { naam: "Opruimen", tab: "cannibalisatie", taaktype: "overig", kaart: false },
  interne_links:     { naam: "Interne links", tab: "interne-links", taaktype: "intern", kaart: false },
  schema_gap:        { naam: "Structured data", tab: "paginas", taaktype: "structured", kaart: false },
  aeo:               { naam: "AI-zichtbaarheid", tab: "resultaten", taaktype: "overig", kaart: false },
};

// Er stond hier een vaste volgorde van categorieën, voor de filterknoppen boven de
// tabel. Die knoppen zijn er niet meer: het scherm bundelt de lijst per categorie en
// zet de bundels op te winnen opbrengst, want waar de winst zit verschilt per klant.

export function categorieVan(type: string): Categorie {
  return CATEGORIE[type] || { naam: "Overig", tab: "paginas", taaktype: "overig", kaart: false };
}
