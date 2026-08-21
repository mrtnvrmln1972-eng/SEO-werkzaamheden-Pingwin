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
      "hoofdterm in de linktekst van die link. Klopt er iets niet, dan staat dat op het scherm bij het " +
      "document, in plaats van dat het er goed uitziet en het tegenovergestelde doet.\n\n" +
      "**Het onderwerp mag gewoon in de kop staan (21 augustus 2026).** De regel was: de hoofdterm van " +
      "de landingspagina mag niet in de titel, de meta-title of de H1 van het stuk. Dat is te grof gebleken. " +
      "Bij een hoofdterm die één generiek woord is (\"natuurzwembad\") kun je dat woord niet missen in een " +
      "stuk dat er nu eenmaal over gaat, en het weghalen kost meer dan het oplevert: dan snapt Google niet " +
      "waar het stuk over gaat en is de interne link vanuit dat stuk juist mínder waard. Een ondersteunend " +
      "stuk hoort over hetzelfde onderwerp te gaan; dat is het punt. Wat wél botst, is een kop die in de kern " +
      "de zoekterm zélf is: er blijft te weinig eigen betekenis over als je de hoofdterm eruit haalt " +
      "(\"Ons natuurzwembad\"), of er staat een koopwerkwoord tegenaan (\"natuurzwembad aanleggen\", " +
      "\"laten maken\", \"kosten\", \"offerte\"), of de kop begint met een hoofdterm van meer dan één " +
      "woord. Zo mag \"Strak natuurzwembad in IJsselmuiden, een kijkje in dit project\" gewoon blijven " +
      "staan, en wordt \"Natuurzwembad aanleggen in IJsselmuiden\" wél vervangen.\n\n" +
      "**Eén link per landingspagina, niet twee.** Google telt binnen één stuk vooral de eerste link naar een " +
      "adres, dus een tweede voegt niets toe en leest als opgevuld. Een link naar een ándere relevante pagina " +
      "mag er wel bij.\n\n" +
      "**Titel, kop en meta's staan als feit in één tabel.** Wat er stond en wat er nu staat, naast elkaar, " +
      "door het dashboard zelf ingevuld. Daarvóór beschreef de tekst dat zelf, en dan sprak het document " +
      "zichzelf tegen: bovenaan stond dat de titel gewijzigd was, verderop dat de H1 grotendeels ongewijzigd " +
      "was. Het geschreven stukje \"wat er in de tekst is aangepast\" gaat sindsdien alleen nog over de " +
      "inhoud.\n\n" +
      "**Onder \"wat er in de tekst is aangepast\" staat alleen wat er écht is aangepast.** Er stonden vijf " +
      "punten waarvan er vier begonnen met \"ongewijzigd gelaten\", met de reden erbij; dat leest voor een " +
      "klant als vier dingen die niet gebeurd zijn. Wat je niet noemt, heb je niet veranderd, dus hoeft het " +
      "er ook niet bij te staan. Is er aan de tekst zelf niets veranderd, dan zegt het document dat in één " +
      "zin.\n\n" +
      "**En elke kop krijgt zijn H-nummer ervoor** (H1, H2, H3), zodat de sitebouwer niet alleen ziet dát " +
      "iets een kop is maar ook wélke. In de tabel met de rolverdeling staan hooguit drie zoekwoorden in " +
      "plaats van een waslijst in een smalle kolom.\n\n" +
      "**Het document is een oplevering, geen lijst met huiswerk (21 augustus 2026).** Er stond een kopje " +
      "\"Let op\" in met daaronder de opmerkingen, en dat document gaat naar de klant en de sitebouwer. Die " +
      "lazen daar dus dingen als \"het verdient aanbeveling om ook de meta-description van de landingspagina " +
      "te optimaliseren\" en \"controleer of dit aansluit bij de interne linkstrategie\". Allebei geen " +
      "klantboodschap: het eerste is werk dat wij gewoon doen, het tweede is een interne afweging. Sindsdien " +
      "geldt: kunnen we het zelf, dan doen we het. Een betere paginatitel of omschrijving voor de " +
      "landingspagina wordt geschreven en staat kant-en-klaar bij \"Voor de sitebouwer\"; kan de hoofdterm " +
      "niet uit de titel of de kop, dan wordt er een ándere titel voorgesteld in plaats van een opmerking dat " +
      "het lastig is. Wat er daarna nog overblijft, is voor jou en staat alleen op het scherm.\n\n" +
      "**Wat er in het document komt:** wat dit stuk nu doet, een tabel met de rolverdeling (welke pagina " +
      "blijft de baas op welke term, en waar mikt dit stuk op), wat er is aangepast, de paginatitel en " +
      "meta-description, eventueel de betere meta voor de landingspagina zelf, de links die de sitebouwer " +
      "moet leggen met hun linktekst, welke bestaande pagina's naar dit stuk zouden moeten linken, en " +
      "daaronder de volledige aangepaste tekst.\n\n" +
      "**En het staat in de lijst pal onder het stuk waar het uit komt.** Een ondersteunende versie krijgt " +
      "vaak met opzet een andere titel, en daardoor las hij als een los project: er schoof een document van " +
      "iets heel anders tussen. Het dashboard onthoudt nu waar een document uit voortkomt, dus die twee staan " +
      "altijd bij elkaar, met een oranje streepje ernaast.\n\n" +
      "Deze motor raakt geen Ahrefs-units aan: hij leest de pagina's zelf en gebruikt Search Console.",
  },
];
