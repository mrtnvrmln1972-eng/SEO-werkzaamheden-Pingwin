// Plank 2: het vakoordeel van Pingwin. Geen bron, en dat mag hier.
//
// WAAROM DEZE PLANK BESTAAT
// ═════════════════════════
// Een deel van het vak is ervaring die (nog) niet in een onderzoek staat. Die
// weggooien maakt de kennisbank armer; hem tussen de onderbouwde criteria
// zetten maakt hem onbetrouwbaar, want dan draagt een mening de schijn van
// bewijs. Vandaar twee planken en één harde regel: wat hier staat gaat nooit
// als onderbouwing een klantrapport in. Als advies mag het, met de naam erbij.
//
// PROMOVEREN
// ══════════
// Vinden we later een bron, dan verhuist het punt naar het bestand van zijn
// discipline en krijgt het een bewijsniveau en een datum. Blijkt het niet te
// kloppen, dan gaat het weg. Een vakoordeel dat jaren blijft staan zonder dat
// iemand er iets mee doet, is geen kennis maar gewoonte.
//
// EERLIJK OVER DE HERKOMST
// ════════════════════════
// Bij het vullen van deze kennisbank (19-08-2026) is één punt echt uit onze
// eigen meting gekomen (VAK-06, de cookiemelding). De rest is opgeschreven als
// werkhypothese: plausibel, herkenbaar uit het werk, nog niet getoetst aan onze
// eigen klantcijfers. Dat staat er per punt bij, zodat niemand later denkt dat
// hier vastigheid ligt die er niet is.

import type { Vakoordeel } from "./types";

const WERKHYPOTHESE =
  "Werkhypothese, opgeschreven bij het vullen van de kennisbank op 19-08-2026. Nog niet getoetst " +
  "aan onze eigen klantcijfers, en er ligt geen onderzoek onder.";

export const VAKOORDELEN: Vakoordeel[] = [
  {
    id: "VAK-01",
    discipline: "conversie",
    titel: "Bij een lokale dienstverlener staat het telefoonnummer meteen in beeld",
    waarNaarKijken:
      "Is het nummer zichtbaar zonder scrollen en zonder menu openklappen, op mobiel, en staat " +
      "het werkgebied erbij?",
    waarom:
      "Wie een hovenier, kliniek of installateur zoekt, wil vaak gewoon bellen. Een formulier als " +
      "enige weg naar binnen kost dan aanvragen die je nooit ziet, want een gemiste beller meldt " +
      "zich niet.",
    grond: WERKHYPOTHESE,
    sinds: "2026-08-19",
    weegt: "hoog",
    vaststellen: "beeld",
  },
  {
    id: "VAK-02",
    discipline: "conversie",
    titel: "Een vanaf-bedrag levert minder maar betere aanvragen op",
    waarNaarKijken:
      "Staat er een prijsindicatie, een vanaf-bedrag of een bandbreedte op de pagina, of moet je " +
      "daarvoor eerst je gegevens achterlaten?",
    waarom:
      "Zonder enig houvast over de prijs vraagt iedereen aan, ook wie het budget nooit gaat " +
      "hebben. Dat kost de klant tijd aan gesprekken die nergens toe leiden, en het maakt de " +
      "cijfers van de pagina mooier dan de opbrengst.",
    grond: WERKHYPOTHESE + " Weeg dit altijd met de klant af, want het verlaagt bewust het aantal aanvragen.",
    sinds: "2026-08-19",
    weegt: "midden",
    vaststellen: "oordeel",
  },
  {
    id: "VAK-03",
    discipline: "conversie",
    titel: "De zoekvraag waarmee iemand binnenkomt, staat in de eerste zinnen terug",
    waarNaarKijken:
      "Sluit de eerste alinea aan op waar de pagina op gevonden wordt, in de woorden die de " +
      "bezoeker zelf gebruikt?",
    waarom:
      "Een bezoeker controleert in twee tellen of hij goed zit. Staat zijn vraag er niet, dan " +
      "gaat hij terug naar Google, ook als het antwoord verderop wel degelijk op de pagina staat.",
    grond:
      "Komt uit onze SEO-criteria, waar het primaire zoekwoord in de eerste honderd woorden hoort. " +
      "Als conversieregel is het niet apart onderbouwd, daarom staat het hier.",
    sinds: "2026-08-19",
    weegt: "hoog",
    vaststellen: "oordeel",
  },
  {
    id: "VAK-04",
    discipline: "vormgeving",
    titel: "Eigen beeld van het echte werk verslaat een mooier ontwerp met gekochte foto's",
    waarNaarKijken:
      "Staan er foto's van het eigen werk, de eigen mensen en de eigen locatie, of zijn het " +
      "gekochte beelden die op elke site van die branche kunnen staan?",
    waarom:
      "Bij het MKB is het verschil met de concurrent zelden de dienst, maar wie het doet. Eigen " +
      "beeld laat dat in één oogopslag zien, en gekocht beeld maakt van een specifieke partij een " +
      "willekeurige.",
    grond: WERKHYPOTHESE + " Sluit aan bij VORM-04, dat wél onderbouwd is, maar gaat een stap verder.",
    sinds: "2026-08-19",
    weegt: "midden",
    vaststellen: "beeld",
  },
  {
    id: "VAK-05",
    discipline: "interactie",
    titel: "Een chatvenster dat vanzelf opengaat, werkt op een dienstenpagina averechts",
    waarNaarKijken:
      "Springt er een chat open zonder dat je erom vraagt, en hoe lang na binnenkomst?",
    waarom:
      "Op het moment dat iemand net begint te lezen, is een vraag van de site een onderbreking en " +
      "geen hulp. Een knop die stil in de hoek staat, is er ook op het moment dat de vraag " +
      "wél komt.",
    grond: WERKHYPOTHESE + " Verwant aan INT-05, dat over schermvullende onderbrekingen gaat; deze is smaller en zwakker onderbouwd.",
    sinds: "2026-08-19",
    weegt: "laag",
    vaststellen: "beeld",
  },
  {
    id: "VAK-06",
    discipline: "bruikbaarheid",
    titel: "Wat wij bij het meten moeten wegklikken, is een bevinding",
    waarNaarKijken:
      "Alles wat er tussen zit voordat je de pagina kunt lezen of fotograferen: meldingen, " +
      "overlays, toestemmingsvensters, een lege pagina die nog aan het laden is.",
    waarom:
      "Bij de eerste metingen van het lab vervuilde een cookiemelding zowel de gelezen tekst als " +
      "de foto, en die melding moest eerst worden weggeklikt. Een bezoeker heeft precies datzelfde " +
      "obstakel, alleen klaagt hij niet: hij gaat weg.",
    grond:
      "Uit onze eigen meting op 18-08-2026, bij het bouwen van de brug van het Pagina-lab. Eigen " +
      "waarneming, één keer, dus wel echt gebeurd maar niet breed getoetst.",
    sinds: "2026-08-19",
    weegt: "midden",
    vaststellen: "meting",
  },
];
