// ═══════════════════════════════════════════════════════════
// WELKE VERSIE IS DE LAATSTE? (één regel, voor élke documentenlijst)
// ═══════════════════════════════════════════════════════════
// Wat er misging (20-08-2026, /hovenier-oss/): Maarten opende "Mail vanuit deze
// kaart" om de copy naar de bouwer te sturen, en kreeg negen aanvinkvakjes.
// Twee keer Copy, twee keer Blauwdruk, een analyse van 2 augustus naast een
// analyse van vandaag. Allemaal echt, want elke ronde levert een nieuw document
// op en er wordt nooit iets weggegooid. Maar je stuurt geen negen documenten
// mee; je stuurt de laatste copy.
//
// Deze module beantwoordt die ene vraag: van elke soort (analyse, blauwdruk,
// copy, structured data) is er één versie die geldt, en de rest is archief. Het
// archief verdwijnt niet, het staat alleen dichtgeklapt.
//
// De volgorde waarin een versie wint, van sterk naar zwak:
//
//   0. Jij hebt hem aangemerkt als de geldende versie. Dan is het die, punt.
//      Een teruggeredigeerde tekst van de klant is nieuwer dan onze eigen copy,
//      ook al is ons document later gemaakt.
//   1. Hij komt uit de documentketen (de laatste run van analyse/blauwdruk/copy).
//      Dat is waar alle motoren mee rekenen, dus dat is de geldende tekst.
//   2. Hij hangt los aan deze kaart (het copy-veld van de taak).
//   3. Archief: dan wint de nieuwste datum.
//
// Alles zonder soort (de pagina zelf, een stappenplan, bespreekpunten, een
// "overig" document) doet hier niet aan mee en blijft altijd staan: daar bestaat
// geen oudere of nieuwere versie van.
// ═══════════════════════════════════════════════════════════

/** De soorten waarvan er versies naast elkaar kunnen bestaan. Leeg = geen versie-soort. */
export type DocSoort = "analyse" | "blauwdruk" | "copy" | "structured" | "";

/** Hoe sterk een kandidaat is; lager wint. Zie de uitleg hierboven. */
export const RANG = { goedgekeurd: 0, keten: 1, kaart: 2, archief: 3 } as const;

export type VersieKandidaat = {
  label: string;
  url: string;
  soort: DocSoort;
  rang: number;
  /** ISO-datum van de inhoud, of leeg als we die niet weten. */
  datum: string;
};

export type VersieDoc = {
  label: string;
  url: string;
  /** Van welke soort dit document een versie is ("" = geen versie-soort). */
  soort?: DocSoort;
  /** Er is een nieuwere versie van dezelfde soort; standaard dichtgeklapt. */
  ouder?: boolean;
};

/** Een `kind` uit de database naar een soort waar versies van bestaan. */
export function soortUitKind(kind: string): DocSoort {
  const k = String(kind || "").trim().toLowerCase();
  return k === "analyse" || k === "blauwdruk" || k === "copy" || k === "structured" ? k : "";
}

/**
 * Zet bij elk document of er een nieuwere versie van dezelfde soort bestaat.
 *
 * De volgorde van de lijst blijft precies zoals hij binnenkwam: die is elders
 * bepaald (de pagina vooraan, dan de keten, dan het archief) en daar gaat deze
 * functie niet over. Hij zet alleen een vlaggetje.
 */
export function markeerOudeVersies(kandidaten: VersieKandidaat[]): VersieDoc[] {
  // Per soort de sterkste kandidaat zoeken. Bij gelijke rang wint de nieuwste
  // datum; is die er van geen van beide, dan wint wie het eerst in de lijst
  // stond (dat is de volgorde waarin ze zijn opgehaald, nieuwste eerst).
  const winnaar = new Map<string, VersieKandidaat>();
  for (const k of kandidaten) {
    if (!k.soort) continue;
    const huidig = winnaar.get(k.soort);
    if (!huidig || sterker(k, huidig)) winnaar.set(k.soort, k);
  }
  return kandidaten.map((k) => {
    const doc: VersieDoc = { label: k.label, url: k.url };
    if (!k.soort) return doc;
    doc.soort = k.soort;
    if (winnaar.get(k.soort)?.url !== k.url) doc.ouder = true;
    return doc;
  });
}

function sterker(a: VersieKandidaat, b: VersieKandidaat): boolean {
  if (a.rang !== b.rang) return a.rang < b.rang;
  if (a.datum && b.datum) return a.datum > b.datum;
  return !!a.datum && !b.datum;    // een bekende datum wint van een onbekende
}

/**
 * De documenten die standaard in beeld staan: alles zonder oudere-versie-vlag,
 * plus wat je zelf hebt aangevinkt (anders verdwijnt een bewuste keuze uit
 * beeld terwijl hij wél meegaat).
 */
export function zichtbaar<T extends { ouder?: boolean }>(docs: T[], aangevinkt: (d: T) => boolean, toonOud: boolean): T[] {
  return docs.filter((d) => !d.ouder || toonOud || aangevinkt(d));
}
