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
      "2. **De kennisbank.** Waartegen we een pagina houden, te zien op `/admin/pagina-lab`.\n" +
      "3. **Gedrag.** Wat bezoekers er werkelijk deden, uit Analytics en Clarity.\n" +
      "4. **Het oordeel.** Sinds 28 augustus 2026 beoordeelt het lab één pagina zelf, met die drie lagen " +
      "naast elkaar. Zie de uitklapper hieronder.\n\n" +
      "**Wat er nog niet is:** er komt geen taak uit voort en er wordt niets bewaard. Elke beoordeling is " +
      "een nieuwe, en het lab schrijft nergens iets weg zolang het naast het SEO-werk staat.",
  },
  {
    titel: "Het oordeel: criteria, meting en foto naast elkaar",
    kern: "Per criterium één bevinding, met eronder waar hij op rust. Wat niet te meten valt, heet ook zo.",
    tekst:
      "Op `/admin/pagina-lab` staat onder Oordeel een veld voor één adres. Het lab bezoekt die pagina twee " +
      "keer, op een desktopscherm en op een telefoon, en doet per bezoek drie dingen tegelijk: lezen, meten " +
      "en fotograferen. Tegelijk, want twee losse bezoeken kunnen twee verschillende pagina's opleveren, en " +
      "dan gaat het oordeel over iets anders dan de foto laat zien.\n\n" +
      "**Wat er nu gemeten wordt.** Het contrast van elke soort tekst tegen de achtergrond waar hij " +
      "werkelijk op ligt, de tekstgrootte en de regellengte, het aantal invulvelden en hoeveel daarvan een " +
      "zichtbaar label hebben, of je kunt inzoomen, of de inhoud op een smal scherm past, knoppen die te " +
      "klein zijn om te raken, links die zelf niet zeggen waar ze heen gaan, wat er bij binnenkomst over de " +
      "pagina heen ligt, beweging die vanzelf doorgaat, en de laadtijd plus het verspringen tijdens het " +
      "opbouwen.\n\n" +
      "**Drie grenzen zitten in de code, niet in een afspraak.** Een bevinding zonder geldige criteriumcode " +
      "wordt weggegooid, want anders komt er een zesendertigste criterium bij dat plausibel klinkt en " +
      "nergens op rust. Een criterium dat uit een meting hoort te komen terwijl die meting er niet is, wordt " +
      "\"niet vast te stellen\" in plaats van een indruk in de vorm van een cijfer. En het waarom plus het " +
      "bronadres onder een bevinding komen letterlijk uit de kennisbank, nooit uit het model, zodat een " +
      "advies aan een klant geen verzonnen onderzoek als onderbouwing kan meekrijgen. " +
      "`proeven/pagina-lab-oordeel.proef.ts` voert bij elke bouw precies die vier fouten in om te zien of de " +
      "poort dichtzit.\n\n" +
      "**Wat er eerlijk in beeld blijft.** Onderaan staat wat er is afgevallen en waarom, met naam en " +
      "toenaam van de criteria die niet beoordeeld zijn; die zijn dus niet stilzwijgend goedgekeurd. De " +
      "snelheidscijfers zeggen erbij dat ze uit onze eigen browser op een server komen en niet van echte " +
      "bezoekers, want Google kijkt naar dat laatste en dat valt vrijwel altijd trager uit. En de volgorde " +
      "van de bevindingen is berekend uit de stand en het gewicht van het criterium, niet gevoeld, dus hij " +
      "is elke keer hetzelfde en uit te leggen.\n\n" +
      "**Eén ding blijft nog een grens:** er wordt niets bewaard en er komt geen taak uit voort. Zolang het " +
      "lab naast het lopende SEO-werk staat, leest het alleen mee.",
  },
  {
    titel: "Gedrag: wat bezoekers werkelijk deden, naast wat je ziet",
    kern: "Analytics telt, Clarity toont wrijving. Zonder die twee is elk oordeel een oordeel over een plaatje.",
    tekst:
      "Een pagina kan er goed uitzien en toch niets opleveren. Daarom staat naast de kennisbank een derde bron: " +
      "wat bezoekers er werkelijk deden.\n\n" +
      "**Google Analytics** was al gekoppeld voor de site-brede cijfers; daar is nu de stand van één pagina bij " +
      "gekomen, met de verdeling over mobiel en desktop. Dat laatste verandert vaak het hele oordeel: als acht " +
      "van de tien bezoekers op een telefoon zitten en juist daar niemand doorklikt, is dat een ander gesprek dan " +
      "een gemiddelde over alles heen. Het dashboard zoekt de property zelf op bij het domein; lukt dat niet, dan " +
      "kun je het nummer met de hand vastleggen.\n\n" +
      "**Microsoft Clarity** is nieuw en meet iets anders: wrijving. Dode klikken (mensen klikken op iets dat geen " +
      "knop is), woedeklikken, terugspringen naar de vorige pagina, en hoe ver mensen scrollen. Dat zijn precies " +
      "de dingen die je aan de code van een pagina niet ziet en op een schermfoto ook niet.\n\n" +
      "Twee grenzen van Clarity bepalen hoe dit gebouwd is: je mag maar tien keer per dag per project cijfers " +
      "opvragen, en nooit verder terug dan drie dagen. Elke opvraging wordt daarom bewaard, en alles wat daarna " +
      "kijkt leest die bewaarde meting. Dat archief kan alleen groeien: wat je vandaag niet ophaalt, is over vier " +
      "dagen niet meer op te halen.\n\n" +
      "Te vinden op `/admin/pagina-lab` onder Gedrag: per klant of Analytics en Clarity bekend zijn, waar je de " +
      "Clarity-sleutel plakt, en een veld om één pagina uit te proberen.\n\n" +
      "**Wat er nog niet is:** een Clarity-account. De koppeling is gebouwd en wacht op de eerste sleutel, dus de " +
      "cijfers die eruit komen zijn nog niet één keer in het echt gezien.",
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
