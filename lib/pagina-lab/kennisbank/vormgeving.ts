// Plank 1, discipline VORMGEVING: hoe ziet de pagina eruit, en helpt dat?
//
// Dit is de discipline waarvoor de brug van het Pagina-lab een FOTO maakt. Je
// kunt uit HTML aflezen dat er een kop staat, niet of het beeld rust geeft, of
// de aandacht naar de juiste plek gaat, of dat er drie dingen tegelijk om
// voorrang schreeuwen. Daarom staat bij bijna alles hieronder `beeld` als
// manier om het vast te stellen.

import type { Criterium } from "./types";

const GOOGLE_EERSTE_INDRUK = {
  naam: "Google en Universiteit Basel, The role of visual complexity and prototypicality regarding first impression of websites",
  url: "https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/",
  soort: "onderzoek",
} as const;
const NNG_NABIJHEID = { naam: "Nielsen Norman Group, Proximity Principle in Visual Design", url: "https://www.nngroup.com/articles/gestalt-proximity/", soort: "vakinstituut" } as const;
const NNG_FOTOS = { naam: "Nielsen Norman Group, Photos as Web Content", url: "https://www.nngroup.com/articles/photos-as-web-content/", soort: "onderzoek" } as const;
const NNG_HIERARCHIE = { naam: "Nielsen Norman Group, Visual Hierarchy in UX", url: "https://www.nngroup.com/articles/visual-hierarchy-ux-definition/", soort: "vakinstituut" } as const;
const NNG_HEURISTIEKEN = { naam: "Nielsen Norman Group, 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", soort: "vakinstituut" } as const;
const NNG_BANNERBLINDHEID = { naam: "Nielsen Norman Group, Banner Blindness Revisited", url: "https://www.nngroup.com/articles/banner-blindness-old-and-new-findings/", soort: "onderzoek" } as const;
const WCAG_NIET_TEKST = { naam: "W3C, Understanding SC 1.4.11 Non-text Contrast", url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html", soort: "norm" } as const;
const WCAG_TEKST_IN_BEELD = { naam: "W3C, WCAG 2.2 SC 1.4.5 Images of Text", url: "https://www.w3.org/TR/WCAG22/#images-of-text", soort: "norm" } as const;

export const VORMGEVING: Criterium[] = [
  {
    id: "VORM-01",
    discipline: "vormgeving",
    titel: "Rust wint: een druk beeld wordt binnen een oogwenk afgestraft",
    waarNaarKijken:
      "Hoeveel er tegelijk om aandacht vraagt in de eerste schermvulling: aantal kleuren, aantal " +
      "blokken, aantal knoppen, hoeveel tekst er tegelijk staat.",
    waarom:
      "In het onderzoek van Google en de Universiteit Basel oordelen mensen al binnen 50 " +
      "milliseconden over de aantrekkelijkheid van een pagina, en een lage visuele complexiteit " +
      "wordt in die flits als mooier beoordeeld. Dat oordeel valt dus vóór het lezen, en het " +
      "kleurt alles wat daarna komt.",
    bewijs: "sterk",
    bronnen: [GOOGLE_EERSTE_INDRUK],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
  },
  {
    id: "VORM-02",
    discipline: "vormgeving",
    titel: "Herkenbaar als wat het is",
    waarNaarKijken:
      "Ziet de pagina eruit zoals mensen dit soort pagina's kennen? Staat het menu waar een menu " +
      "hoort, ziet een knop eruit als een knop, staat het contact waar je het zoekt?",
    waarom:
      "Uit hetzelfde onderzoek: pagina's die sterk lijken op wat mensen van dat soort pagina " +
      "verwachten, worden mooier gevonden. Origineel zijn in de opbouw kost begrip, en dat betaalt " +
      "zich zelden terug.",
    bewijs: "sterk",
    bronnen: [GOOGLE_EERSTE_INDRUK, NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "beeld",
    nuance:
      "Dit gaat over de opbouw, niet over de stijl. Een eigen gezicht in kleur, beeld en toon " +
      "botst hier niet mee.",
  },
  {
    id: "VORM-03",
    discipline: "vormgeving",
    titel: "Wat bij elkaar hoort staat bij elkaar",
    waarNaarKijken:
      "De witruimte: staat een kop dichter bij zijn eigen tekst dan bij de vorige alinea, hoort " +
      "een prijs zichtbaar bij zijn pakket, staat een knop bij het blok waar hij over gaat?",
    waarom:
      "Nabijheid is het sterkste groeperingssignaal dat er is en overstemt zelfs kleur en vorm. " +
      "Verkeerd verdeelde witruimte laat mensen dingen bij elkaar zien die niet bij elkaar horen, " +
      "en dat verwart zonder dat iemand kan uitleggen waarom.",
    bewijs: "sterk",
    bronnen: [NNG_NABIJHEID, NNG_HIERARCHIE],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
  },
  {
    id: "VORM-04",
    discipline: "vormgeving",
    titel: "Beeld draagt informatie, of het kan weg",
    waarNaarKijken:
      "Wat de foto's tonen: het echte product, het echte werk, de echte mensen, of een gekochte " +
      "foto van een lachend model. En of een blok eruitziet als een advertentie.",
    waarom:
      "In de oogmetingen van NN/g kijken mensen naar beelden die informatie dragen en negeren ze " +
      "decoratieve stockfoto's volledig. Blokken die op reclame lijken worden zelfs actief " +
      "overgeslagen, ook als er de eigen boodschap in staat.",
    bewijs: "sterk",
    bronnen: [NNG_FOTOS, NNG_BANNERBLINDHEID],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "beeld",
  },
  {
    id: "VORM-05",
    discipline: "vormgeving",
    titel: "Knoppen en velden zijn als zodanig te zien",
    waarNaarKijken:
      "De rand of het vlak van een knop, een invulveld, een keuzerondje of een actief tabblad " +
      "tegen zijn omgeving: minstens 3 op 1 verschil.",
    waarom:
      "Een knop die alleen bestaat uit lichtgrijze tekst op wit is voor iemand met matig slecht " +
      "zicht geen knop. Dit is het contrast van de bediening, los van de leesbaarheid van de " +
      "tekst erin.",
    bewijs: "sterk",
    bronnen: [WCAG_NIET_TEKST],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
  {
    id: "VORM-06",
    discipline: "vormgeving",
    titel: "Belangrijke tekst staat niet ín een afbeelding",
    waarNaarKijken:
      "Koppen, aanbiedingen, openingstijden of prijzen die als plaatje op de pagina staan in " +
      "plaats van als tekst.",
    waarom:
      "Tekst in een plaatje kun je niet vergroten zonder dat hij vervaagt, niet voorlezen, niet " +
      "vertalen, niet kopiëren en niet vinden. Bovendien telt hij niet mee voor de vindbaarheid.",
    bewijs: "sterk",
    bronnen: [WCAG_TEKST_IN_BEELD],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
    nuance: "Een logo mag, dat is de uitzondering die de norm zelf noemt.",
  },
  {
    id: "VORM-07",
    discipline: "vormgeving",
    titel: "De pagina hoort bij de rest van de site",
    waarNaarKijken:
      "Dezelfde kleuren, hetzelfde lettertype, dezelfde knopvormen en dezelfde toon als de andere " +
      "pagina's. Losse landingspagina's en pagina's van een oudere bouwronde vallen hier vaak uit.",
    waarom:
      "Consistentie is een van de tien vuistregels van Nielsen: mensen hoeven niet opnieuw uit te " +
      "zoeken hoe iets werkt. Een pagina die er anders uitziet dan de site voelt bovendien als " +
      "een andere partij, en dat kost vertrouwen precies waar je het nodig hebt.",
    bewijs: "gemiddeld",
    bronnen: [NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "beeld",
  },
  {
    id: "VORM-08",
    discipline: "vormgeving",
    titel: "Eén hiërarchie, en die is te zien zonder te lezen",
    waarNaarKijken:
      "Knijp je ogen halfdicht bij de schermfoto: is dan te zien wat het belangrijkste is? " +
      "Loopt de tekstgrootte in een paar duidelijke stappen, of in zeven maten die op elkaar " +
      "lijken?",
    waarom:
      "Zonder zichtbare rangorde moet iemand alles lezen om te weten wat er toe doet, en dat doet " +
      "niemand. Een beperkt aantal maten en gewichten maakt het verschil tussen niveaus zichtbaar " +
      "in plaats van vermoedbaar.",
    bewijs: "gemiddeld",
    bronnen: [NNG_HIERARCHIE, NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
  },
];
