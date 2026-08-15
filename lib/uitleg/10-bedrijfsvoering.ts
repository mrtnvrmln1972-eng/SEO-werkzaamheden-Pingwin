import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "bedrijfsvoering",
  titel: "Bedrijfsvoering: geld, verbruik en team",
  intro:
    "Een werkplek die niet weet wat het werk kost is een hobby. Deze laag maakt van het dashboard een " +
    "bedrijfssysteem.",
  uitklappers: [
    {
      titel: "Financiën",
      kern: "Omzet en kosten per post en per klant, met openstaande facturen.",
      tekst:
        "Uit de boekhouding komen de winst-en-verliescijfers, uitklapbaar in drie niveaus: de post, daarbinnen " +
        "de klant of leverancier, en daarbinnen de losse facturen met een deeplink naar de boekhouding.\n\n" +
        "Openstaande facturen komen niet alleen op het financiënscherm, maar ook als signaal in de cockpit van " +
        "de betreffende klant. Dat is het verschil tussen weten dat er iets openstaat en het zien op het moment " +
        "dat je die klant toch al open hebt.",
    },
    {
      titel: "Prognose: wat gaat er de komende maanden verdiend worden",
      kern: "Lopende klanten plus leads naar kans, min de kosten, maand voor maand richting een doelbedrag.",
      tekst:
        "Het financiënscherm heeft twee blikken op hetzelfde geld. De boekhouding kijkt terug: wat is er " +
        "werkelijk binnengekomen. De prognose kijkt vooruit: wat gaat er verdiend worden, en wanneer staat " +
        "de teller op het doel.\n\n" +
        "De rekensom is expres simpel genoeg om te vertrouwen. Een lopende klant telt vol mee: zijn " +
        "maandbedrag min zijn linkbuilding en overige kosten. Een lead telt mee naar de kans dat hij " +
        "doorgaat, en dan **inclusief zijn kosten**: een lead van 1.500 met 40% kans telt voor 600 aan " +
        "omzet én voor 40% van zijn linkbuilding. Daaronder gaan de eigen vaste lasten er één keer per " +
        "maand af, niet per klant.\n\n" +
        "Die weging is het hele punt. Een lijst met alle leads erin op vol bedrag is een wensenlijst; een " +
        "lijst zonder leads doet alsof er niets aankomt. Met een kans erbij is het een verwachting waar je " +
        "een besluit op kunt nemen.\n\n" +
        "**Klik een maand open en je ziet waar het bedrag vandaan komt**: elke klant, elke lead met zijn " +
        "percentage, de losse posten en de vaste lasten, met per regel de omzet, de kosten en wat er netto " +
        "overblijft. Geen totaal zonder onderbouwing.\n\n" +
        "Losse posten zijn alles wat niet aan een vaste klant hangt: een website die in oktober wordt " +
        "opgeleverd, een tool die vanaf januari geld kost. Eenmalig telt in die ene maand, terugkerend " +
        "vanaf die maand elke maand.\n\n" +
        "Bovenaan staan vier cijfers: waar je deze maand staat, wat het doel is, hoeveel er nog te gaan is " +
        "(ook uitgedrukt in hoeveel klanten dat ongeveer zijn) en in welke maand het doel gehaald wordt. " +
        "Het doel is instelbaar, en of het op de omzet of op het netto gemeten wordt ook.\n\n" +
        "Twee dingen die het eerlijk houden. Het maandbedrag en de linkbuilding staan maar op één plek, " +
        "namelijk in de klantrij zelf; wijzig je ze op het prognosescherm, dan wijzigen ze in de cockpit " +
        "mee, zodat er nooit twee bedragen naast elkaar bestaan. En wat niet ingevuld is wordt niet " +
        "geschat: een lead zonder maandbedrag telt voor nul mee en krijgt de melding dat er nog een " +
        "bedrag mist.\n\n" +
        "*Wat er nog niet is:* de leads komen uit het dashboard zelf, nog niet automatisch uit HubSpot.",
    },
    {
      titel: "De prognose vullen vanuit de boekhouding",
      kern: "Wat elke klant werkelijk factureert komt uit Moneybird, de linkbuilding uit de facturen van de linkbuilder.",
      tekst:
        "De bedragen stonden al in de boekhouding. Ze daarna met de hand in het dashboard overtypen is niet " +
        "alleen werk, het is ook de garantie dat de twee er na een paar maanden niet meer hetzelfde over " +
        "zeggen. Eén knop leest ze uit.\n\n" +
        "Wat er gebeurt: alle verkoopfacturen van de laatste zes afgesloten maanden, gegroepeerd per klant " +
        "per maand. Daaruit komt wat die klant per maand factureert. De lopende maand telt niet mee, want " +
        "die is halverwege en zou elke klant goedkoper laten lijken dan hij is.\n\n" +
        "**Maandelijks en niet-maandelijks worden uit elkaar gehouden**, en dat is het hele verschil tussen " +
        "een bruikbaar en een misleidend getal. Bij een klant die elke maand factureert is het maandbedrag " +
        "het middelste bedrag van die maanden, zodat één eenmalige projectfactuur het niet optilt. Bij een " +
        "klant die per kwartaal factureert wordt het totaal omgerekend naar een maandbedrag, want het " +
        "middelste bedrag zou daar drie keer te hoog uitkomen. Wisselt het sterk, dan staat de bandbreedte " +
        "erbij.\n\n" +
        "De linkbuilding komt uit de inkoopfacturen van de linkbuilder, die je uit een keuzelijst van je " +
        "Moneybird-contacten kiest. Bewust een keuzelijst en geen zoekveld: zoeken op het mailadres dat je " +
        "kent gaat mis zodra de leverancier in de boekhouding onder zijn bedrijfsnaam staat, en dan vindt " +
        "hij niets zonder te zeggen waarom.\n\n" +
        "Er wordt naar de **factuurregels** gekeken en niet naar het factuurtotaal, want alleen in die regels " +
        "kan staan om welke klant het gaat. Staat er een klantnaam of domein in, dan gaat het bedrag naar die " +
        "klant. Staat dat er niet in, en dat is bij een factuur met de omschrijving \"Linkbuilding februari " +
        "2026\" de normale situatie, dan wordt het **niet** verdeeld over de klanten die wel herkend zijn. " +
        "Uitsmeren maakt van de marge per klant een schatting die niemand later nog als schatting herkent.\n\n" +
        "Die kosten zijn wel echt, dus verdwijnen ze ook niet. Ze komen apart in beeld met hun maandbedrag " +
        "en een knop om ze als vaste maandpost mee te nemen; dan tellen ze gewoon in de prognose, alleen " +
        "niet toegerekend aan een klant. Gaat de leverancier later per klant specificeren, dan haal je die " +
        "post weg en verdeelt het zich vanzelf.\n\n" +
        "**Er wordt niets automatisch overschreven.** De knop levert een voorstel: naast elkaar wat het " +
        "dashboard nu zegt en wat de boekhouding zegt, met per regel waarom, en per klant een maandoverzicht " +
        "om het na te kijken. Pas als je vinkt en op overnemen drukt verandert er iets. Een knop die twintig " +
        "bedragen in één klik omzet is precies de knop waarvan je later niet meer weet wat hij gedaan heeft.\n\n" +
        "Twee dingen die de stilte hoorbaar maken. Een bedrijf dat wél factureert maar geen klant of lead in " +
        "het dashboard heeft, komt apart in beeld: dat is omzet die nu buiten de prognose valt. En een klant " +
        "in het dashboard waar de boekhouding niets over zegt, blijft in de lijst staan met die melding erbij, " +
        "want een klant zonder facturen is zelf een signaal.",
    },
    {
      titel: "Verbruik en kosten per actie",
      kern: "Wat kost welke knop, per klant en per periode, met AI en Ahrefs samengeteld.",
      tekst:
        "Elke betaalde aanroep schrijft een regel weg: welke klant, welke actie, hoeveel tokens of units, en " +
        "de geschatte kosten. Op het verbruiksscherm staan de acties met leesbare namen, dus 'analyse-document " +
        "(diep)' in plaats van een technische code.\n\n" +
        "Waarom dat er is: bij een dashboard dat AI en betaalde API's gebruikt is de marge per klant een " +
        "gevolg van hoe vaak welke knop wordt ingedrukt. Zonder deze meting weet je dat pas als de rekening " +
        "komt.\n\n" +
        "**Bovenaan staan de drie meters naast elkaar**, want ze heten alle drie ongeveer hetzelfde en tellen " +
        "niet bij elkaar op:\n\n" +
        "- **Ahrefs**: een tegoed aan units dat elke maand op nul gaat, binnen het vaste abonnement. Raakt het " +
        "op, dan valt de zoekwoorddata stil.\n" +
        "- **Claude via het dashboard**: alles wat het dashboard zelf denkt en schrijft, op een eigen sleutel " +
        "met een eigen rekening. Dit loopt per gebruik en wordt achteraf betaald.\n" +
        "- **Het eigen Claude-abonnement**: het chatten en het bouwen in Claude Code. Dat is een derde " +
        "rekening, met vooruit gekochte credits, en die staat hier bewust zonder cijfer: op een persoonlijk " +
        "abonnement is dat saldo niet op te halen, dus staat er een knop naar de plek waar het wél staat.\n\n" +
        "Onder de meters staan de tips per meter: welke knop duur is, waarom een lang gesprek meer kost dan " +
        "een kort, en waar afremmen wél en niet helpt. Die staan in het scherm zelf en niet in een document " +
        "ernaast, zodat ze meegroeien met wat er echt in het dashboard zit.\n\n" +
        "**Daaronder staat het echte totaal per klant, deze maand**: AI en Ahrefs samen in één bedrag, met " +
        "erbij welke actie dat bedrag die maand het meest opstuwde en hoe het zich verhoudt tot het " +
        "maandbudget van de klant. Dat laatste is een ruwe vergelijking (dollarkosten tegenover het " +
        "eurobudget, zonder wisselkoers), maar wel genoeg om in één oogopslag te zien welke klant krap zit op " +
        "marge.\n\n" +
        "Ahrefs zelf rekent per maand af, niet per unit; er bestaat dus geen officiële prijs per unit om hard " +
        "te coderen. Daarom is dat één instelbare knop (de omgevingsvariabele " +
        "`AHREFS_PRIJS_PER_UNIT_USD`): je maandbedrag gedeeld door de units in je abonnement, en elke Ahrefs-" +
        "regel krijgt vanaf dat moment een echt bedrag in plaats van 0. Zonder die instelling blijft Ahrefs " +
        "zichtbaar in units en aanroepen, maar telt het nog met €0 mee in de marge, en het scherm zegt dat " +
        "er expliciet bij in plaats van een onvolledig totaal als compleet te tonen.",
    },
    {
      titel: "De Ahrefs-teller in de kopbalk",
      kern: "Op elk beheerscherm staat hoeveel zoekwoord-tegoed er nog over is.",
      tekst:
        "Ahrefs, de bron van vrijwel alle zoekwoord- en concurrentiedata, werkt met een tegoed aan units per " +
        "abonnementsmaand. Elke analyse eet daarvan. Raakt het op, dan stopt de data en staan de motoren stil. " +
        "Rechtsboven in elk beheerscherm staat daarom een klein tellertje: een stip, het woord Ahrefs en een " +
        "percentage. Groen is rustig, oranje is opletten, rood is krap.\n\n" +
        "Het toont bewust geen kaal percentage maar een oordeel. Zestig procent op is prima als de maand bijna " +
        "om is, en een waarschuwing als hij net begonnen is. Het tellertje rekent daarom mee hoe ver de " +
        "abonnementsmaand is, en zegt in gewone taal of het tegoed het tot de reset gaat halen.\n\n" +
        "Klap je het open, dan staat het hele Ahrefs-account naast wat dit dashboard er zelf van verbruikte, " +
        "deze maand en de afgelopen zeven dagen, met de klant die het meeste kostte. Dat onderscheid is de kern: " +
        "loopt de teller vol terwijl het dashboard bijna niets deed, dan zit er iemand in Ahrefs zelf te werken " +
        "en heeft afremmen in het dashboard geen zin. Herhaalde vragen komen uit onze eigen cache en kosten niets.",
    },
    {
      titel: "De Claude-teller in de kopbalk",
      kern: "Wat het denkwerk deze maand kost, en of dat uit de pas loopt.",
      tekst:
        "Naast het Ahrefs-tegoed hangt er een tweede tellertje: wat het dashboard deze maand aan AI " +
        "uitgaf. Het verschil met Ahrefs is belangrijk. Bij Ahrefs is er een tegoed dat op kan raken, bij " +
        "de AI loopt de rekening gewoon door. De vraag is hier dus niet hoeveel er nog is, maar of het uit " +
        "de pas loopt.\n\n" +
        "Het ijkpunt is de vorige maand: uitkomen op hetzelfde bedrag is rustig, op het dubbele is een " +
        "signaal, ook zonder dat er een grens bestaat. Staat er een maandbudget ingesteld, dan werkt de " +
        "teller net als die van Ahrefs, met een percentage. Het tempo telt in beide gevallen mee, want " +
        "veertig dollar op de derde van de maand is iets anders dan veertig dollar op de achtentwintigste. " +
        "In de eerste twee dagen van een maand rekent hij geen tempo uit; één zwaar analysedocument zou " +
        "daar anders een alarm van maken.\n\n" +
        "Opengeklapt staan de laatste zeven dagen erbij, de duurste functie, de duurste klant en het " +
        "totaal van vorige maand. Het bedrag is een schatting op basis van tokens tegen de " +
        "standaardtarieven, dus het kan een paar procent van de echte rekening afwijken.\n\n" +
        "**Er lopen drie meters, elk met een eigen ingang in de kopbalk.** Ze heten alle drie ongeveer " +
        "hetzelfde en tellen niet bij elkaar op, dus ze staan bewust naast elkaar in plaats van samengevoegd:\n\n" +
        "- **Ahrefs**: het tegoed hierboven.\n" +
        "- **Claude**: wat het dashboard zelf verstookt, dit tellertje.\n" +
        "- **Abo**: het eigen Claude-abonnement (chatten en Claude Code). Zonder cijfer, want dat saldo is " +
        "op een persoonlijk abonnement niet op te halen; buiten team- en bedrijfsaccounts om biedt " +
        "Anthropic daar geen koppeling voor. In plaats van een gefingeerd getal staat er de uitleg over de " +
        "vooruit gekochte usage credits, plus twee knoppen naar de plek waar het saldo écht staat.\n\n" +
        "**Elke teller heeft zijn eigen tips onderin**, want een tip zonder de rekening erbij is een " +
        "algemeenheid: welke Ahrefs-actie duur is hoort niet bij het Claude-tellertje, en andersom. Dezelfde " +
        "tips staan ook gebundeld op `/admin/usage`, zodat je ze ook kunt terugvinden zonder eerst een " +
        "teller te hoeven openklikken.",
    },
    {
      titel: "Teamgebruikers en rechten",
      kern: "Gasten met eigen inlog en beperkte toegang.",
      tekst:
        "Naast de eigenaar kunnen er teamgebruikers zijn met een eigen inlognaam en wachtwoord. Zo'n gebruiker " +
        "ziet alleen de klanten die hem zijn toegewezen, en al dan niet de mail en de status.\n\n" +
        "De eigenaar kan meekijken vanuit het perspectief van een teamgebruiker om te zien wat die ziet. Met " +
        "nul teamgebruikers gedraagt het dashboard zich exact als een eenmansomgeving: de rechtenlaag ligt " +
        "erbovenop en zit niemand in de weg.",
    },
    {
      titel: "Meekijken zonder wijzigingsrechten",
      kern: "Een alleen-lezen sessie voor ondersteuning en ontwikkeling.",
      tekst:
        "Er kan een alleen-lezen sessie worden uitgedeeld waarmee iemand (bijvoorbeeld de ontwikkelaar die aan " +
        "het dashboard werkt) precies ziet wat de gebruiker ziet, terwijl elke wijziging geweigerd wordt.\n\n" +
        "Dat scheelt in de praktijk enorm: een probleem beschrijven kost meer tijd dan het laten zien, en " +
        "meekijken zonder wijzigingsrechten is veilig.",
    },
  ],
};
