// Wat vóór een punt in een assistent-antwoord staat: is het werk, een
// constatering, of een vraag aan iemand anders?
//
// Waarom dit bestaat: de Bird's eye hing de vier knopjes (+ kaart, » bespreeklijst,
// × negeren, ✓ gedaan) aan ELK bullet-punt, zonder te kijken wat er stond. Daardoor
// kreeg "wat er live is en hoe het presteert" een plusje, terwijl dat gewoon een
// tekstregel is. De prompt zegt juist expliciet dat de tekst ALLEEN de stand van
// zaken is en dat taken als kaarten komen; scherm en prompt spraken elkaar dus tegen.
//
// Dit staat bewust in de WEERGAVE-laag (zoals card-info.ts), niet alleen in de
// prompt: zo geldt het meteen voor alle antwoorden die er al staan, niet pas voor
// nieuwe. Nieuwe antwoorden mogen het zelf zeggen met een "Doen:"-prefix; die wint.

export type PuntSoort = "werk" | "feit" | "vraag";

// Expliciete markering die de assistent zelf meegeeft. Wordt vóór het renderen
// weggehaald, dus Maarten ziet dit nooit in beeld.
const MARKER = /^\s*(doen|werk|taak|actie|vraag|overleg|constatering|feit|stand)\s*:\s*/i;

// Werkwoorden waarmee een echte opdracht begint. Zelfde vangrail als de
// instructie-herkenning in card-info.ts, hier iets breder omdat een bird's eye-punt
// vaker vrij geformuleerd is.
const OPDRACHT = new RegExp(
  "^(schrijf|herschrijf|maak|hermaak|voeg|verwerk|controleer|check|corrigeer|optimaliseer|herstel|" +
  "verkort|verleng|plaats|bouw|publiceer|pas|zet|update|actualiseer|implementeer|vul|vervang|" +
  "verwijder|koppel|stuur|verstuur|plan|splits|breid|hernoem|redirect|richt|meet|start|finaliseer|" +
  "lever|regel|plaatst|plak|draai|hang|plan|neem|plaatsen|toevoegen|aanpassen|doorvoeren)\\b",
  "i",
);

// Aanwijzingen dat een punt bij iemand anders ligt in plaats van bij Maarten zelf.
const OVERLEG = /\b(vraag (aan|bij)|overleg(gen)? met|navragen bij|bespreken met|voorleggen aan|afstemmen met|bij (sander|de klant|de sitebouwer)|klantvraag)\b/i;

// Losse regel die alleen een groep aankondigt ("Lokale hovenierspagina's:").
export function isGroepskop(tekst: string): boolean {
  return /:\s*$/.test((tekst || "").trim());
}

/** Haalt de expliciete markering weg, zodat die nooit in beeld komt. */
export function stripMarker(tekst: string): string {
  return (tekst || "").replace(MARKER, "").trim();
}

/**
 * De soort van één punt.
 *
 * Bewust streng: alleen wat echt als opdracht leest telt als werk. Een
 * constatering die tóch werk blijkt kun je altijd nog via de sectieknop "+ Taak"
 * of via de bespreeklijst oppakken. Andersom is erger: een plusje bij een
 * statusregel maakt de hele lijst onbruikbaar, en dat is precies de klacht.
 */
export function puntSoort(tekst: string): PuntSoort {
  const kaal = (tekst || "").trim();
  if (!kaal) return "feit";

  // 1. De assistent heeft het zelf gezegd: dat wint altijd.
  const m = MARKER.exec(kaal);
  if (m) {
    const woord = m[1].toLowerCase();
    if (woord === "vraag" || woord === "overleg") return "vraag";
    if (woord === "constatering" || woord === "feit" || woord === "stand") return "feit";
    return "werk";
  }

  // 2. Ligt het bij iemand anders, of is het letterlijk een vraag?
  if (OVERLEG.test(kaal)) return "vraag";
  if (/\?\s*$/.test(kaal)) return "vraag";

  // 3. Leest het als een opdracht? Een leidend fase-woord ("Copy: herschrijf de
  //    intro") telt niet mee; het gaat om wat erachter staat.
  const zonderFase = kaal.replace(/^\*{0,2}(analyse|blauwdruk|copy|strategie|structured data|schema|bouw|meta|dev|seo)\*{0,2}\s*:\s*/i, "");
  const eersteZin = zonderFase.replace(/^[-*•\s]+/, "").replace(/^\*\*([^*]+)\*\*\s*/, "$1 ");
  if (OPDRACHT.test(eersteZin)) return "werk";

  // 4. Alles wat overblijft is een constatering: een stand, een cijfer, een
  //    bevinding. Geen knopjes om er een taak van te maken.
  return "feit";
}

/** Welke knopjes horen bij deze soort? Eén plek, zodat scherm en tellers gelijk lopen. */
export function knopjesVoor(soort: PuntSoort): { plus: boolean; lijst: boolean; weg: boolean; vink: boolean } {
  if (soort === "werk") return { plus: true, lijst: true, weg: true, vink: true };
  // Een vraag aan iemand anders is geen kaart in jouw weekplanning, maar je wilt
  // hem wel kunnen wegzetten en afvinken zodra hij beantwoord is.
  if (soort === "vraag") return { plus: false, lijst: true, weg: true, vink: true };
  // Een constatering kun je hooguit willen bespreken. Afvinken kan niet: er is
  // niets gedaan, het is een stand van zaken.
  return { plus: false, lijst: true, weg: false, vink: false };
}
