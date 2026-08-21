// ═══════════════════════════════════════════════════════════
// HOE EEN DOCUMENT HEET IN EEN LIJST
// ═══════════════════════════════════════════════════════════
// Op een taakkaart stonden twee documenten onder elkaar, en de bovenste heette:
//
//   Geldende versie na verwerken van "Bogard_Structured-Data_Advies-en-
//   Inventarisatie v2.docx"
//
// Vier regels lang, en het enige stukje dat ertoe doet (de naam van het stuk)
// staat verstopt in de staart. Maartens oordeel op 21-08-2026: "die titel is
// absurd lang en maakt het ook een heel lelijk overzicht", en, belangrijker:
// "het is mij onduidelijk wat de bovenste versie is en welke later is".
//
// Die naam is een overblijfsel. Er heeft een stap "Verwerk" bestaan die van een
// aangeleverd document een nieuwe geldende versie maakte; die stap bestaat niet
// meer (zie lib/doc-versions.ts), maar de namen die hij schreef staan nog in de
// database. Ze weggooien kan niet (het bestand bestaat echt), en hernoemen achter
// Maartens rug om ook niet: dan verandert de naam van een bestand dat in Drive
// staat en in een mail genoemd is.
//
// Dus wordt het in de weergave rechtgezet, met terugwerkende kracht, precies
// zoals de vaste regel in CLAUDE.md voorschrijft: de lijst laat zien waar het
// stuk over gaat (de naam van het bronbestand) plus een merkje dat vertelt wat
// het is (een verwerkte kopie). De volledige naam blijft de echte naam: hij
// staat als tooltip in beeld en verschijnt zodra je hem hernoemt.
//
// Bewust NIET afkappen met puntjes. Dat is op 19-08-2026 bewust teruggedraaid:
// twee documenten over verschillende onderwerpen werden dan allebei "Natuurlijke
// zwemvijver in Zeeu…", en juist het stuk dat je nodig hebt om ze uit elkaar te
// houden viel weg. Korter maken mag alleen door tekst weg te laten die niets
// zegt, nooit door tekst af te snijden die wél iets zegt.
// ═══════════════════════════════════════════════════════════

/** "Geldende versie na verwerken van «X»" → X. Anders leeg. */
const UIT_VERWERKING = /^\s*geldende versie\s+na\s+verwerken\s+van\s*["'“”„«]?\s*(.+?)\s*["'“”„»]?\s*$/i;

/**
 * Uit welk document is dit stuk gemaakt, voor zover de naam dat verklapt?
 *
 * Geeft de naam van het bronbestand terug, of een lege tekst als deze naam niets
 * over een bron zegt. Dit is een terugval: een document dat zijn bron écht kent
 * (`bronId`) hoeft niet naar zijn eigen naam te kijken.
 */
export function bronUitNaam(naam: string): string {
  const m = UIT_VERWERKING.exec(naam || "");
  return m ? m[1].trim() : "";
}

/** Twee bestandsnamen die hetzelfde stuk aanwijzen (extensie telt niet mee). */
export function zelfdeBestand(a: string, b: string): boolean {
  const kaal = (s: string) => (s || "").trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/i, "").replace(/\s+/g, " ");
  return !!kaal(a) && kaal(a) === kaal(b);
}

export type DocLabel = {
  /** Wat er als naam in beeld komt. */
  toon: string;
  /** Het merkje erachter ("verwerkte kopie"), of leeg. */
  merk: string;
};

/** De naam zoals hij in een lijst hoort te staan, plus het merkje erachter. */
export function docLabel(naam: string): DocLabel {
  const bron = bronUitNaam(naam);
  if (bron) return { toon: bron, merk: "verwerkte kopie" };
  return { toon: (naam || "").trim() || "document", merk: "" };
}
