import type { Uitklapper } from "../types";

// Interne links: autoriteit gericht doorsturen.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Interne links: autoriteit gericht doorsturen",
    kern: "Niet 'meer links', maar de juiste links, gewogen op waarde en relevantie.",
    tekst:
      "Deze motor bouwt de interne linkgraaf uit een echte crawl van de belangrijkste pagina's: per pagina de " +
      "uitgaande interne links met hun ankertekst. Daar komt de Search Console-data bij (positie en klikken " +
      "per pagina), de zoekvolumes uit Ahrefs en de autoriteit van elke losse pagina.\n\n" +
      "Wat er dan berekend wordt:\n\n" +
      "- **Welke bronpagina's het beste naar een doelpagina linken**, gewogen op hoeveel waarde die " +
      "bronpagina kan doorgeven én hoe inhoudelijk relevant hij is. Beide, niet één van de twee.\n" +
      "- **Click depth vanaf de homepage.** Hoeveel klikken is een pagina verwijderd van de voordeur?\n" +
      "- **Welke pagina's het waard zijn om te versterken, met het aantal extra bezoekers erbij.** Je krijgt " +
      "een lijstje met pagina's die al in de buurt van de top staan, en per pagina hoeveel bezoekers per " +
      "maand het ongeveer oplevert als hij een paar plekken stijgt. Die schatting gebruikt dezelfde " +
      "klikkans-curve als de rest van het dashboard, dus het is geen tweede rekensom naast de " +
      "prioriteitenscan. De doelpositie is bewust bescheiden: van plek 8 naar 4, niet naar 1, want interne " +
      "links geven een zet en geen sprong.\n" +
      "- **Bewaking van het ankerprofiel**, zodat je niet twintig keer dezelfde ankertekst plaatst en de " +
      "pagina over-optimaliseert.\n\n" +
      "**Autoriteit per pagina is gemeten, niet geschat** (6 augustus 2026). Van elke pagina wordt bij Ahrefs " +
      "de kracht van het eigen linkprofiel opgehaald: een cijfer van 0 tot 100 waarin zowel links van buiten " +
      "als interne links meetellen. Die schaal is logaritmisch, dus 8 is fors sterker dan 5, niet anderhalf " +
      "keer. Dat cijfer bepaalt nu voor de helft welke bronpagina's bovenaan het advies staan; de rest is het " +
      "aantal interne links dat er al binnenkomt en het verkeer van die pagina.\n\n" +
      "Twee dingen houden dat eerlijk. **Bij elke voorgestelde bronpagina staat het cijfer met de datum " +
      "erbij**, en of het gemeten is of benaderd: kent Ahrefs een pagina niet, dan krijgt hij de middenwaarde " +
      "van de site en staat dat er zichtbaar bij, in plaats van dat het als harde meting leest. En **het " +
      "cijfer op het scherm komt uit de meting zelf**, niet uit de tekst die de analyse erover schreef. " +
      "Ophalen gebeurt gebundeld (honderd pagina's per aanvraag) en blijft een maand geldig, dus een tweede " +
      "analyse kost geen nieuwe Ahrefs-credits.\n\n" +
      "Eén detail dat bijna een stille fout werd, en het staat er omdat het terug kan komen: de schuine " +
      "streep aan het eind van een adres. Ahrefs kent `/hovenier-den-bosch/` met autoriteit 6 en " +
      "`/hovenier-den-bosch` (dezelfde pagina, zonder die streep) helemaal niet. Die tweede geeft geen " +
      "foutmelding maar een nul, en het dashboard bewaart adressen zonder streep. Elke pagina van elke klant " +
      "zou dus \"geen autoriteit\" hebben geheten zonder dat iemand het merkte. Nu wordt van elk adres " +
      "allebei de vorm opgevraagd en telt de hoogste, en een proef legt dat vast.",
  },
];
