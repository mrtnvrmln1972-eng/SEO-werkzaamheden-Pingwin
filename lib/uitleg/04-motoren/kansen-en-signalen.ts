import type { Uitklapper } from "../types";

// Zoekwoordkansen, wijzigingen op de site en AI-vindbaarheid.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Zoekwoordkansen en de gaten in de site",
    kern: "Waar staat de klant net niet, en waar staat hij helemaal niet.",
    tekst:
      "Twee soorten kansen worden apart bijgehouden:\n\n" +
      "- **Bijna binnen.** Zoekwoorden waarop de site op positie 5 tot 20 staat met echt zoekvolume. Dat is " +
      "werk met een korte terugverdientijd.\n" +
      "- **Gaten.** Zoekwoorden waar concurrenten wel op ranken en de klant niet, en onderwerpen waarvoor er " +
      "nog helemaal geen pagina bestaat. Dat is werk met een langere horizon, en het hoort dus in een ander " +
      "bakje van de prioriteitenscan.\n\n" +
      "Beide worden getoetst aan de afgesproken zoekwoordenlijst en de beoogde landingspagina's. Een kans die " +
      "niet in de strategie past is geen kans, het is een afleiding.",
  },
  {
    titel: "Wijzigingen op de site bijhouden",
    kern: "Van elke pagina een momentopname, en een leesbaar verschil als er iets verandert.",
    tekst:
      "Van elke pagina wordt de volledige inhoud opgeslagen als momentopname met een vingerafdruk: meta, H1, " +
      "koppen, alt-teksten, interne links, woordaantal en schema. Verandert die vingerafdruk bij de volgende " +
      "scan, dan komt er een gebeurtenis met een leesbaar verschil: wat is er precies veranderd?\n\n" +
      "Waarom dit onmisbaar is in de praktijk: sites veranderen zonder dat het bureau het weet. Een " +
      "webbouwer zet een pagina live, iemand herschrijft een titel, een plugin gooit alt-teksten weg. Zonder " +
      "deze laag ontdek je dat pas als de posities al gezakt zijn.",
  },
  {
    titel: "AI-vindbaarheid",
    kern: "Hoe vaak het merk voorkomt in AI-antwoorden, als aparte lens.",
    tekst:
      "Zoeken gebeurt niet meer alleen in Google. Daarom is de aanwezigheid in AI-antwoorden een eigen lens " +
      "in de prioriteitenscan: in hoeveel AI-antwoorden komt het domein voor, en op welke onderwerpen dus " +
      "niet.\n\n" +
      "Dit is de jongste lens en dus de minst uitgewerkte van de vier, maar hij zit er expliciet in omdat de " +
      "vraag van klanten hier het snelst groeit.",
  },
];
