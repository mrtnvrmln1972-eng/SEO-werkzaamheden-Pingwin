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
