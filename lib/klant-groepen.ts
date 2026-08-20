// ═══════════════════════════════════════════════════════════
// WIE IS EEN KLANT? (één plek waar dat bepaald wordt)
// ═══════════════════════════════════════════════════════════
// Vier schermen beantwoordden deze vraag zelf, en alle vier op dezelfde manier:
// "alles wat geen lead is, is een klant" (`fase !== "lead"`). Dat klopte zolang
// klanten met de hand werden aangemaakt. Sinds de HubSpot-koppeling komen deals
// vanzelf binnen, en een deal die niet doorgaat krijgt fase "verloren". Die viel
// dus uit de leadlijst en belandde ómhoog, tussen de echte klanten.
//
// Wat Maarten op 20-08-2026 op zijn scherm zag: 124 rijen onder "Mijn eigen
// klanten", met hostingdeals en websitedeals ertussen, allemaal met een
// "onboarding 2/18"-badge. Zijn elf eigen SEO-klanten waren daarin niet meer
// terug te vinden. De bulk-onboarding rekende ze ook nog eens mee, want die
// gebruikte precies dezelfde regel.
//
// Vandaar deze module. Een klant is fase "klant"; al het andere heeft zijn eigen
// plek. Alles wat klanten groepeert, vraagt het hier. Nooit ergens opnieuw een
// eigen regel op `fase` of `grp`; dan loopt het weer uiteen zonder dat iemand
// het merkt, en dan staat er over een maand weer een lijst van 124.
// ═══════════════════════════════════════════════════════════

/** Het minimum dat een rij moet hebben om ingedeeld te kunnen worden. */
export type KlantRij = { fase?: string | null; grp?: string | null };

/**
 * De levensfase, met "klant" als terugval.
 *
 * Waarom die terugval: rijen van vóór de HubSpot-koppeling hebben geen fase, en
 * dat zijn stuk voor stuk echte klanten. Een lege waarde mag dus nooit als
 * "verloren" gelezen worden; die kant op is de fout onherstelbaar (een klant die
 * uit beeld verdwijnt), de andere kant op alleen zichtbaar (een rij te veel).
 */
export function faseVan(c: KlantRij): string {
  return (c.fase || "klant").trim() || "klant";
}

/** Een bedrijf dat nog klant moet worden. Heeft geen inlog, sheet of budget. */
export function isLead(c: KlantRij): boolean {
  return faseVan(c) === "lead";
}

/** Beheerd door Multimedia Concepts: wel in de cockpit, niet ons eigen werk. */
export function isMmc(c: KlantRij): boolean {
  return (c.grp || "") === "mmc";
}

/** Een lopende klant: hier doen we werk voor, hier hoort een cockpit bij. */
export function isKlant(c: KlantRij): boolean {
  return faseVan(c) === "klant";
}

/**
 * Afgesloten: niet doorgegaan ("verloren") of niet langer klant ("oud"). Deze
 * horen niet tussen de lopende klanten en niet tussen de leads; ze hebben hun
 * eigen, dichte blok. Weggooien doen we ze niet: de geschiedenis (mails,
 * notities, dealwaarde) is de reden dat ze zijn opgeslagen.
 */
export function isAfgesloten(c: KlantRij): boolean {
  const f = faseVan(c);
  return f === "verloren" || f === "oud";
}

/** Mijn eigen klanten: lopend, en niet van Multimedia Concepts. */
export function isEigenKlant(c: KlantRij): boolean {
  return isKlant(c) && !isMmc(c);
}

export type KlantGroepen<T> = {
  /** Mijn eigen (SEO-)klanten. */
  eigen: T[];
  /** Lopende klanten van Multimedia Concepts. */
  mmc: T[];
  /** Nog geen klant. */
  leads: T[];
  /** Niet doorgegaan ("verloren"). */
  verloren: T[];
  /** Ooit klant geweest ("oud"). */
  oud: T[];
};

/**
 * De hele lijst in één keer ingedeeld. Elke rij komt in precies één groep
 * terecht, dus wat je optelt is altijd het totaal: geen rij die twee keer
 * meetelt en geen rij die nergens meer opduikt.
 */
export function groepeerKlanten<T extends KlantRij>(lijst: T[]): KlantGroepen<T> {
  const uit: KlantGroepen<T> = { eigen: [], mmc: [], leads: [], verloren: [], oud: [] };
  for (const c of lijst) {
    if (isLead(c)) uit.leads.push(c);
    else if (faseVan(c) === "verloren") uit.verloren.push(c);
    else if (faseVan(c) === "oud") uit.oud.push(c);
    else if (isMmc(c)) uit.mmc.push(c);
    else uit.eigen.push(c);
  }
  return uit;
}
