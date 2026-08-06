// ═══════════════════════════════════════════════════════════
// "DOCUMENT TOEGEVOEGD AAN HET DOSSIER"-BLOKKEN HERKENNEN
// ═══════════════════════════════════════════════════════════
// Sleepte je vroeger een document in een gesprek, dan schreef het scherm daar een
// heel blok bij: de melding, de Drive-link en de complete samenvatting van dat
// document. Dat blok stond tussen je eigen vragen in en kostte per document een
// halve schermhoogte, terwijl je in de dropzone eronder allang zag dat het bestand
// er was.
//
// Nieuwe bestanden melden zich niet meer op die manier. Maar bestaande gesprekken
// zitten er vol mee, en die tekst gooien we niet weg (afspraak: niets weggooien wat
// er al staat). Daarom herkennen we het patroon bij het tonen en vouwen we het
// samen tot één regel; de samenvatting blijft één klik weg.
//
// Herkennen gebeurt op de vaste openingszin die het scherm zelf schreef, dus een
// vraag die je zelf typte wordt hier nooit per ongeluk door opgeslokt.

export type BestandMelding = {
  /** "Document" of "Afbeelding", zoals het er destijds stond. */
  wat: string;
  naam: string;
  /** De Drive-link, als die erbij stond. */
  link: string;
  /** De samenvatting die eronder stond (kan leeg zijn). */
  kern: string;
};

const KOP = /^(Document|Afbeelding) toegevoegd aan het dossier:\s*(.*)$/;

/**
 * Is dit bericht zo'n oude bestandsmelding? Zo ja: uit elkaar gehaald in naam,
 * link en samenvatting. Zo nee: null, en het bericht wordt gewoon getoond.
 */
export function bestandMelding(content: string): BestandMelding | null {
  const regels = (content || "").split("\n");
  const m = KOP.exec((regels[0] || "").trim());
  if (!m) return null;

  const rest = (m[2] || "").trim();
  const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(rest);
  const naam = (link ? link[1] : rest).trim();
  if (!naam) return null;

  return {
    wat: m[1],
    naam,
    link: link ? link[2].trim() : "",
    kern: regels.slice(1).join("\n").trim(),
  };
}
