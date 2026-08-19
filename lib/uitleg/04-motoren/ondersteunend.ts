import type { Uitklapper } from "../types";

// Een aangeleverd stuk ondersteunend maken aan een landingspagina.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Een blog ondersteunend maken in plaats van concurrerend",
    kern: "Eén knop bij een aangeleverd document: de landingspagina houdt zijn zoekwoord, het stuk pakt de vragen eromheen en geeft zijn kracht door.",
    tekst:
      "Een klant levert een blog of een projectverhaal aan en dat gaat over hetzelfde onderwerp als een " +
      "landingspagina die het van precies dat zoekwoord moet hebben. Publiceer je dat stuk zoals het is, dan " +
      "gebeurt er één van twee dingen. Google kiest de blog in plaats van de landingspagina, en dan lees je " +
      "een leuk verhaal maar vraagt niemand een offerte aan. Of de twee wisselen elkaar af in de " +
      "zoekresultaten, en dan zakken ze allebei. Dat heet cannibalisatie, en het is niet het randgeval maar " +
      "de normale uitkomst.\n\n" +
      "**Bij elk document in een taak staat daarom een knop \"Ondersteunend maken\".** Je kiest één of twee " +
      "landingspagina's die er sterker van moeten worden, eventueel de zoekwoorden waarop die moeten winnen, " +
      "en de Drive-map waar het resultaat komt te staan. De rest zoekt het dashboard zelf op: wat er nu op die " +
      "pagina's staat en waarop ze de afgelopen negentig dagen in Search Console gevonden zijn.\n\n" +
      "**De verdeling die het werkend maakt.** De landingspagina blijft de baas op zijn commerciële hoofdterm, " +
      "de term waarmee iemand een opdracht zoekt. Het aangeleverde stuk mikt op de informatieve vragen " +
      "ernaast: hoe, wat kost, welke soorten, hoe onderhoud je, een praktijkverhaal. En het stuk geeft zijn " +
      "kracht door met een interne link waarvan de linktekst juist wél de hoofdterm bevat. Dat is precies " +
      "andersom dan de tekst zelf: de term staat in de link, niet in de kop.\n\n" +
      "**De tekst blijft van de klant.** Er wordt niets herschreven omdat het mooier kan. Alleen de titel, de " +
      "koppen die op de hoofdterm zitten, de meta-gegevens en de zinnen waar een link in komt schuiven; elke " +
      "aanpassing staat op een rijtje in het document. Het aangeleverde stuk blijft gewoon in de lijst staan, " +
      "er komt een nieuw document naast met \"(ondersteunend aan /pad/)\" in de naam.\n\n" +
      "**Drie dingen worden nagerekend in plaats van beloofd.** Een instructie aan een taalmodel is een " +
      "verzoek, geen poort, dus het dashboard controleert zelf: staat de hoofdterm niet in de titel, de " +
      "meta-title of de eerste kop; loopt er echt een link naar elke gekozen landingspagina; en staat de " +
      "hoofdterm in de linktekst van die link. Klopt er iets niet, dan staat dat als waarschuwing in beeld " +
      "én in het document, in plaats van dat het er goed uitziet en het tegenovergestelde doet.\n\n" +
      "**Wat er in het document komt:** wat dit stuk nu doet, een tabel met de rolverdeling (welke pagina " +
      "blijft de baas op welke term, en waar mikt dit stuk op), wat er is aangepast, de paginatitel en " +
      "meta-description, de links die de sitebouwer moet leggen met hun linktekst, welke bestaande pagina's " +
      "naar dit stuk zouden moeten linken, en daaronder de volledige aangepaste tekst.\n\n" +
      "Deze motor raakt geen Ahrefs-units aan: hij leest de pagina's zelf en gebruikt Search Console.",
  },
];
