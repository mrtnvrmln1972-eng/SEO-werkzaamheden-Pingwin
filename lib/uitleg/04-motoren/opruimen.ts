import type { Uitklapper } from "../types";

// Opruimen: pagina's die elkaar in de weg zitten.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Opruimen: pagina's die elkaar in de weg zitten",
    kern: "Echte cannibalisatie onderscheiden van de valse meldingen van gewone tools.",
    tekst:
      "Gangbare tools melden cannibalisatie zodra twee pagina's op hetzelfde woord ranken. Dat is meestal " +
      "geen probleem. Deze motor zoekt het enige signaal dat echt betrouwbaar is: **wisselt Google over tijd " +
      "tussen twee van jouw pagina's voor hetzelfde zoekwoord?** Dat heet URL-flipping, en het is meetbaar in " +
      "de historische zoekwoord-pagina-data uit Search Console.\n\n" +
      "Wat de motor oplevert is geen waarschuwing maar een besluit: welke pagina blijft, welke gaat weg, waar " +
      "hij naartoe redirect en waarom. Inclusief de volledige redirectlijst en de mogelijkheid die redirects " +
      "door te voeren.\n\n" +
      "**Twee remmen zorgen dat opruimen geen schade doet.** Ze zijn er allebei gekomen doordat de motor een " +
      "voorstel deed dat op papier klopte en in de praktijk geld had gekost.\n\n" +
      "1. **Zoekintentie.** \"soa test kopen\" en \"wat is een soa test\" delen bijna alle woorden, maar de " +
      "een wil bestellen en de ander wil het begrijpen. Google toont daar ook een ander soort pagina voor. Die " +
      "twee worden dus nooit samengevoegd: dat kost een van beide groepen bezoekers. Wat om die reden apart " +
      "blijft staan, staat zichtbaar in beeld met de reden erbij, in plaats van stil weg te vallen.\n" +
      "2. **Haalbaarheid.** De moeilijkheid van een zoekterm gaat af tegen de autoriteit van het domein. Een " +
      "term met moeilijkheid 70 bij een domein van 30 is geen kans maar een illusie, en daar een maand werk in " +
      "steken verdringt werk dat wel kan lukken. Elke regel krijgt daarom kansrijk, pittig of buiten bereik, en " +
      "de lijsten staan op volgorde van wat kan in plaats van wat groot is. Er verdwijnt niets: buiten bereik " +
      "gaat onderaan. Eén meting weegt zwaarder dan de schatting: staat de pagina er al mee in de top 20, dan " +
      "is bewezen dat het kan.\n\n" +
      "**En er wordt ook gekeken naar wat er niet is.** Zoektermen met volume waar geen enkele pagina op mikt, " +
      "gezocht rond de onderwerpen waarin de site al meedoet. Ligt er een bestaande pagina dichtbij, dan is het " +
      "een uitbreiding daarvan en geen nieuwe pagina; anders zou het opruimen zelf nieuwe cannibalisatie " +
      "aanleggen. Dit is het enige deel dat over groeien gaat in plaats van over opruimen.\n\n" +
      "Er hangt ook een structuurlaag onder: uit de bestaande URL's en zoekwoorden wordt de beoogde " +
      "eindstructuur van de site voorgesteld, met de takken benoemd zoals het woord in de URL staat, en " +
      "vraagwoorden en te brede termen expliciet niet als tak.",
    sub: [
      {
        titel: "Waar een pagina die weggaat naartoe gaat (de keuzeladder)",
        tekst:
          "De lijst zei wél dát een pagina weg kon, maar niet waarheen. Dat laatste is precies waar een " +
          "301 zijn waarde wint of verliest: een omleiding draagt alleen iets over als de doelpagina een " +
          "**redelijke vervanging** is, gezien vanuit de bezoeker. Is dat niet zo, dan behandelt Google hem " +
          "als een soft 404. Hij werkt technisch, maar er gaat niets over.\n\n" +
          "Elke pagina die weggaat krijgt daarom een voorgestelde bestemming, gekozen langs een vaste ladder. " +
          "De eerste die past wint:\n\n" +
          "1. **De inhoudelijke opvolger:** hetzelfde onderwerp én dezelfde zoekintentie.\n" +
          "2. **De dichtstbijzijnde zusterpagina:** zelfde niveau en type, net een andere invulling. Bij een\n" +
          "plaatspagina is dat de dichtstbijzijnde vestiging, met een opgezochte afstand.\n" +
          "3. **De categorie of hub erboven:** het onderwerp bestaat wel, de bezoeker kiest zelf verder.\n" +
          "4. **410, bewust weg:** er is geen relevant doel. Eerlijker en schoner dan de homepage.\n" +
          "5. **De homepage:** laatste redmiddel, en eigenlijk alleen bij pagina's met externe links.\n\n" +
          "Bij het voorstel staat welke trede het werd, waarom de hogere treden afvielen, en hoe zwaar de " +
          "keuze weegt. Dat laatste hangt van twee dingen af: heeft de oude pagina externe links (dan is " +
          "relevantie cruciaal) en haalt hij nog verkeer of vertoningen (dan bepaalt het doel of die posities " +
          "meeverhuizen of verdampen). Bij nul links en nul verkeer maakt de bestemming weinig uit en gaat " +
          "het vooral om het opruimen zelf.\n\n" +
          "**Bij een plaatspagina is 'dichtstbijzijnde' letterlijk te nemen, en dus te meten.** De ligging " +
          "van elke plaats wordt opgezocht bij de plaatsendienst van de overheid, en de bestemming is de " +
          "vestiging die het dichtst bij ligt. Alleen een plaats waar de klant echt zit telt mee, want dat " +
          "staat al in de bedrijfsgegevens; anders zou een tussenplaats zonder vestiging de bestemming worden " +
          "en landt de bezoeker op een pagina zonder kliniek. Boven veertig kilometer houdt het op: dan is een " +
          "andere stad geen vervanging meer maar een verwijzing, en gaat de pagina alsnog naar het " +
          "locatie-overzicht.\n\n" +
          "Dat dit uitmaakt, bleek meteen bij One Day Clinic: het locatie-overzicht haalt nul bezoekers, " +
          "terwijl de vijf stadspagina's er samen ruim vijftienhonderd per maand halen. Alles naar het " +
          "overzicht sturen voedt dus precies de zwakste pagina van de familie.\n\n" +
          "**410 is een volwaardige uitkomst, geen fout:** massaal naar de homepage omleiden doet " +
          "functioneel hetzelfde, maar zonder het duidelijke signaal aan Google.\n\n" +
          "Naast het voorstel staan twee knoppen. **Plaats redirect** zet de 301 (of de 410) in de website en " +
          "meet daarna zelf na of hij er echt staat; er wordt niets als gelukt gemeld dat niet gemeten is. " +
          "**Test redirect** opent het oude adres en vertelt wat er echt gebeurt: welke status, hoeveel " +
          "tussenstappen, waar je uitkomt, en of dat eindpunt zelf 200 geeft, indexeerbaar is en met zijn " +
          "canonical naar zichzelf wijst. Alles in één keer doorvoeren kan ook; dan wordt elke regel " +
          "afzonderlijk nagemeten.",
      },
      {
        titel: "De zelflerende laag: correcties worden vaste regels",
        tekst:
          "Dit is de meest onderschatte functie van het hele dashboard, en hij is simpeler dan hij klinkt. " +
          "Corrigeer je een regel in de opruimlijst ('deze pagina houden we', 'dit doel klopt niet, hij hoort " +
          "bij Den Haag'), dan wordt die correctie vastgelegd als regel. De volgende analyse krijgt die " +
          "regels mee als harde randvoorwaarden en maakt dezelfde fout nooit meer.\n\n" +
          "Het gevolg is dat de analyse per klant beter wordt naarmate je hem gebruikt, in plaats van elke " +
          "keer bij nul te beginnen. Dat is ook waar de waarde van een licentie zit: de opgebouwde regels " +
          "zijn niet overdraagbaar naar een concurrerende tool.",
      },
      {
        titel: "Nameten na 30 en 90 dagen",
        tekst:
          "Na het doorvoeren van een opruimactie wordt er gemeten of het gewerkt heeft: rankt nu de bedoelde " +
          "pagina, en is het wisselen gestopt? Zonder die stap is opruimen een geloofsartikel.\n\n" +
          "Dat gebeurt met een vaste nulmeting. Op het moment dat een redirect live gaat wordt vastgelegd hoe " +
          "de overblijvende pagina er dan voor staat (klikken, vertoningen, beste positie). Na 30 en na 90 " +
          "dagen wordt hetzelfde opnieuw gemeten, automatisch. Achteraf reconstrueren kan niet, want dan is de " +
          "data in Search Console al verschoven en meet je iets anders dan je denkt.\n\n" +
          "Na 30 dagen is een daling nog normaal: Google heeft weken nodig om een redirect te verwerken. Dat " +
          "staat er ook bij. Pas de meting na 90 dagen is een oordeel.",
      },
      {
        titel: "Wat het waard is, in euro's",
        tekst:
          "Zoekvolume is geen taal waarin je een besluit uitlegt. \"Deze pagina is 500 zoekopdrachten waard\" " +
          "zegt een klant niets; \"ongeveer 900 euro per maand\" wel. De som is zoekvolume, maal de kans dat " +
          "iemand doorklikt op een realistische positie, maal de conversie, maal wat een klant oplevert. Die " +
          "klikkans komt uit dezelfde tabel als de prioriteitenscan, zodat er geen tweede versie kan ontstaan " +
          "die stil uit elkaar loopt.\n\n" +
          "De conversie en de klantwaarde worden per klant ingevuld. Zonder die twee getallen rekent het " +
          "dashboard niets uit en blijft alles op zoekvolume staan; een verzonnen standaard zou eruitzien als " +
          "een meting.\n\n" +
          "**En dan de eerlijkheid erbij, want die hoort erbij.** Niemand kan precies meten welk deel van de " +
          "bezoekers klant wordt: wie na drie bezoeken belt staat nergens geregistreerd. Elke conversie is dus " +
          "een schatting. Dat is minder erg dan het lijkt, want het is voor elke regel dezelfde " +
          "vermenigvuldiging: het verandert de volgorde van de lijst niet, alleen de hoogte van de bedragen. " +
          "Voor de vraag waar je begint maakt 1 procent of 3 procent niets uit; het maakt alleen uit op het " +
          "moment dat je een bedrag aan een klant laat zien. Daarom staat overal waar een bedrag staat ook het " +
          "aantal extra bezoekers: dat getal leunt niet op de aanname.",
      },
      {
        titel: "Het eindbeeld: hoe de site eruitziet na het doorvoeren",
        tekst:
          "Vier lijsten met samen honderd beslissingen laten werk zien, geen resultaat. Onderaan het scherm " +
          "staat daarom wat er overblijft: de site als boom, per tak de hoofdpagina met de pagina's die " +
          "daaronder horen, plus vier getallen (nu, straks, gaat op in een andere, komt erbij).\n\n" +
          "\"We halen 68 pagina's weg\" klinkt als verlies. \"Van 433 losse pagina's naar 386 in twintig " +
          "duidelijke takken\" is hetzelfde besluit, maar dan als resultaat. Dit blok staat ook op de deelbare " +
          "leeslink voor de klant, want daar begint het gesprek.\n\n" +
          "De berekening is bewust simpel en herhaalbaar, zonder AI: neem wat er live staat, haal eraf wat " +
          "wordt omgeleid, haal eraf wat in een thuisbasis opgaat, tel erbij op wat er nog moet komen, en " +
          "groepeer de rest. Twee keer draaien geeft twee keer hetzelfde beeld. Wat in geen enkele tak past " +
          "blijft zichtbaar als \"staat los\", en dat aantal is zelf een signaal: is het een fors deel van de " +
          "site, dan ontbreekt er structuur die er hoort te zijn.",
      },
      {
        titel: "De deelbare leeslink laat nu hetzelfde zien als de cockpit",
        tekst:
          "De werklijst (één regel per pagina, met per regel de volledige onderbouwing uitklapbaar) stond tot " +
          "7 augustus alleen in de cockpit; de deellink toonde nog de oudere, losse blokken. Beide lezen nu " +
          "uit dezelfde component, zodat een volgende verbetering automatisch op allebei de plekken landt en " +
          "de klantversie niet meer een ronde achter kan raken. Alles wat een besluit vastlegt (op de " +
          "planning zetten, corrigeren) blijft achter de adminroutes; de deellink is en blijft alleen lezen.",
      },
    ],
  },
];
