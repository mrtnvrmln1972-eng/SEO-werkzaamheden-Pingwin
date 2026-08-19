import type { Uitklapper } from "../types";

// Het Pagina-lab: de tak naast het SEO-werk. Staat in het interne hoofdstuk,
// want het is nog niet af, en dit document mag nooit iets als werkelijkheid
// tonen dat er nog niet is.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Het Pagina-lab: een pagina beoordelen op meer dan vindbaarheid",
    kern: "Conversie, bruikbaarheid, vormgeving en interactie, naast de SEO die er al is.",
    tekst:
      "Alles wat dit dashboard tot nu toe over een pagina zegt, gaat over gevonden worden. Maar een pagina " +
      "die bovenaan staat en niets oplevert, is nog steeds een probleem, en dat probleem zien we bij bijna " +
      "elke klant. Het Pagina-lab is de tak die daarover gaat: dezelfde pagina, beoordeeld op vier andere " +
      "vakgebieden.\n\n" +
      "Het groeit bewust apart tot het goed genoeg is om ingepast te worden, en het raakt het lopende " +
      "SEO-werk niet aan. Dat is geen belofte maar een controle: `proeven/pagina-lab-schrijft-niet.proef.ts` " +
      "laat de bouw mislukken zodra het lab naar de database schrijft of een taak, werklijst of fase " +
      "aanraakt.\n\n" +
      "**Wat er nu staat.**\n\n" +
      "1. **De brug.** Het dashboard kan elke pagina buiten dit domein ophalen én fotograferen, op desktop " +
      "en op mobiel, met de cookiemelding weggeklikt. Een oordeel over vormgeving haal je namelijk niet uit " +
      "HTML, dat moet je zien.\n" +
      "2. **De kennisbank.** Waartegen we een pagina houden, te zien op `/admin/pagina-lab`.\n\n" +
      "**Wat er nog niet staat:** het oordeel zelf. Het lab meet en kijkt, het beoordeelt nog niet, en er " +
      "gaat nog geen bevinding of taak uit voort.",
  },
  {
    titel: "De kennisbank van het lab: twee planken, en dat verschil is de hele waarde",
    kern: "Onderbouwde criteria met bron en datum, en apart daarvan ons eigen vakoordeel.",
    tekst:
      "Op `/admin/pagina-lab` staan tweeëndertig criteria, verdeeld over conversie, bruikbaarheid, " +
      "vormgeving en interactie. Elk criterium zegt waar we naar kijken, waarom het uitmaakt, wanneer het " +
      "niet opgaat, en, dat is het belangrijkste, uit welke bron het komt en wanneer we die bron voor het " +
      "laatst hebben nagekeken. De bronnen zijn de norm zelf (WCAG van het W3C), de meetwaarden van Google " +
      "(Core Web Vitals) en onderzoek van instituten als Baymard en Nielsen Norman Group.\n\n" +
      "Daarnaast, en nadrukkelijk apart, staat de tweede plank: wat wij uit ervaring vinden zonder dat er " +
      "onderzoek onder ligt. Dat mag meewegen in een advies, maar het draagt nooit de schijn van bewijs en " +
      "gaat nooit als onderbouwing een klantrapport in. Vinden we later een bron, dan verhuist het punt naar " +
      "plank 1; klopt het niet, dan gaat het weg.\n\n" +
      "Die scheiding is nagerekend in plaats van afgesproken: " +
      "`proeven/pagina-lab-kennisbank.proef.ts` wordt rood als een criterium zonder bron of zonder datum " +
      "wordt toegevoegd, als een datum in de toekomst ligt, of als een vakoordeel zich als onderzoek " +
      "voordoet met een adres, een percentage of onderzoekstaal.\n\n" +
      "Elk criterium zegt ook hóe het is vast te stellen: uit de pagina zelf (meting), alleen op de foto " +
      "(beeld), of met een oordeel erbij. Dat is de voorbereiding op de volgende stap, want daarmee is " +
      "straks te zien welk deel van een beoordeling hard is en welk deel een mening blijft.",
  },
];
