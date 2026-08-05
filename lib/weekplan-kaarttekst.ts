// ═══════════════════════════════════════════════════════════
// DE TEKST VAN EEN PROJECTKAART OPBOUWEN
// ═══════════════════════════════════════════════════════════
// Een kaart in de weekplanning is pas een volwaardige projectkaart als zijn
// toelichting in drie blokken staat: waarom deze pagina (Achtergrond), wat er
// is afgesproken (Afspraken en herkomst) en de sturing per fase (Aanpak per
// fase). lib/card-info.ts leest precies dat formaat en zet het om in
// "Waarom deze pagina", "Aanpak en afspraken" en de zeven fase-rijen.
//
// De assistent schreef zo'n tekst al wanneer een kaart uit een gesprek komt.
// De knoppen in het scherm (Pagina's, Prioriteitenscan) maakten hun kaarttekst
// zelf, elk net anders en zonder fase-sturing, waardoor die kaarten half leeg
// opengingen. Vandaar één bron voor alle knoppen.
//
// Let op: de fase-rijen zelf verschijnen zodra de kaart een `url` heeft die de
// site-scan kent. Zonder URL blijft de fase-blok leeg, hoe goed de tekst ook is.

export type FaseSleutel = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

const VOLGORDE: [FaseSleutel, string][] = [
  ["strategie", "Strategie"],
  ["gelieerde", "Gelieerde"],
  ["analyse", "Analyse"],
  ["blauwdruk", "Blauwdruk"],
  ["copy", "Copy"],
  ["bouw", "Bouw"],
  ["structured", "Structured data"],
];

export function kaartTekst(opts: {
  achtergrond: string[];
  afspraken?: string[];
  fases?: Partial<Record<FaseSleutel, string>>;
}): string {
  const regels: string[] = [];
  const acht = (opts.achtergrond || []).map((s) => s.trim()).filter(Boolean);
  if (acht.length) {
    regels.push("Achtergrond:");
    for (const a of acht) regels.push(`- ${a}`);
  }
  const afs = (opts.afspraken || []).map((s) => s.trim()).filter(Boolean);
  if (afs.length) {
    regels.push("", "Afspraken en herkomst:");
    for (const a of afs) regels.push(`- ${a}`);
  }
  const fases = opts.fases || {};
  const heeft = VOLGORDE.filter(([k]) => (fases[k] || "").trim());
  if (heeft.length) {
    regels.push("", "Aanpak per fase:");
    for (const [k, label] of heeft) regels.push(`- ${label}: ${(fases[k] || "").trim()}`);
  }
  return regels.join("\n");
}

// Sturing per fase voor een pagina-klus. Bewust concreet (het zoekwoord en het
// doel staan er letterlijk in), want een generieke regel als "Dev bouwt en
// publiceert de pagina" wordt door de kaart-weergave juist weggefilterd als ruis.
export function faseVoorstel(opts: {
  nieuw?: boolean;              // nieuwe pagina bouwen i.p.v. bestaande verbeteren
  zoekwoord?: string;
  positie?: number | null;      // huidige positie, 0/leeg = rankt nog niet
  doel?: number | null;         // gewenste positie
  pad?: string;                 // pad of URL van de pagina
}): Partial<Record<FaseSleutel, string>> {
  const kw = (opts.zoekwoord || "").trim();
  const opKw = kw ? ` op "${kw}"` : "";
  const voorKw = kw ? ` voor "${kw}"` : "";
  const doelTekst = opts.doel ? `doel is positie ${opts.doel}` : "";
  const nu = opts.positie ? `staat nu op ${opts.positie}` : "";
  const sprong = [nu, doelTekst].filter(Boolean).join(", ");

  if (opts.nieuw) {
    return {
      strategie: `bepaal de rol van deze pagina${voorKw} en welke bestaande pagina's ermee overlappen.`,
      analyse: `check de top-10${voorKw}: wie ranken er, met wat voor pagina, en kunnen we daar realistisch tussen.`,
      blauwdruk: `koppenstructuur en secties op basis van de top-10${voorKw}.`,
      copy: `tekst schrijven vanuit de blauwdruk${opKw ? `, met${opKw} als hoofdzoekwoord` : ""}.`,
      bouw: "pagina bouwen, publiceren en vanaf de juiste pagina's intern aanlinken.",
      structured: "schema toevoegen dat bij dit paginatype past.",
    };
  }
  return {
    analyse: `toets deze pagina${opKw ? ` op de zoekintentie achter${opKw}` : ""} en op overlap met andere eigen pagina's${sprong ? ` (${sprong})` : ""}.`,
    blauwdruk: `vergelijk de koppenstructuur met de top-10${voorKw} en bepaal wat er mist.`,
    copy: `tekst aanscherpen${opKw}${doelTekst ? `, richting positie ${opts.doel}` : ""}.`,
    bouw: "wijzigingen doorvoeren, publiceren en de interne links nalopen.",
  };
}
