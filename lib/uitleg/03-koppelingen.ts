import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "koppelingen",
  titel: "Waar het mee gekoppeld is",
  intro:
    "Het dashboard verzint niets. Elk cijfer komt uit een bron, en per bron is vastgelegd wat er wel en niet " +
    "mag. Waar iets ontbreekt wordt dat als ontbrekend gemeld, niet opgevuld met een aanname.",
  uitklappers: [
    {
      titel: "Google Search Console en Google Analytics",
      kern: "Alleen-lezen, eenmalig gekoppeld, daarna per klant automatisch.",
      tekst:
        "Eén keer inloggen met een Google-account, daarna haalt het dashboard zelf de data per klant op: " +
        "vertoningen, klikken, posities en klikpercentages, per zoekwoord, per pagina en per combinatie van " +
        "die twee, met vergelijking over tijd.\n\n" +
        "Die combinatie van zoekwoord én pagina is belangrijker dan hij klinkt: het is de enige manier om te " +
        "zien dat Google voor hetzelfde zoekwoord wisselt tussen twee van jouw pagina's, en dat is het " +
        "betrouwbaarste signaal voor cannibalisatie dat er bestaat.\n\n" +
        "De datakoppeling en de documentenkoppeling (Drive) zijn bewust twee losse verbindingen. Wie de cijfers " +
        "levert geeft daarmee dus nooit per ongeluk toegang tot zijn Drive.",
    },
    {
      titel: "Ahrefs",
      kern: "Zoekvolumes, concurrentie, backlinks en AI-zichtbaarheid, met credit-bewaking.",
      tekst:
        "Ahrefs levert wat Search Console niet weet: hoe vaak er echt op een woord gezocht wordt, hoe zwaar de " +
        "concurrentie is, welke top-10 er nu staat, welke backlinks kapot zijn, en in hoeveel AI-antwoorden een " +
        "domein voorkomt.\n\n" +
        "Twee dingen zijn hier bewust ingebouwd:\n\n" +
        "- **Credits kosten geld, dus alles wordt gecachet.** Zoekvolumes ongeveer een maand, SERP-resultaten " +
        "ongeveer een kwartaal. Dezelfde vraag twee keer stellen kost één keer credits.\n" +
        "- **Een bureau kan zijn eigen Ahrefs-account gebruiken.** Per klant kan er een eigen sleutel hangen, " +
        "aangeduid met een label, waarbij de sleutel zelf nooit in de database of in een bestand staat.",
    },
    {
      titel: "Claude (de AI-laag)",
      kern: "Het oordeel en het schrijfwerk, altijd bovenop gemeten data.",
      tekst:
        "De AI doet drie dingen: analyseren, schrijven en gesprek voeren. Wat hij níet doet is bepalen of iets " +
        "op de site staat, want dat wordt gemeten.\n\n" +
        "Kostenbewaking zit erin gebouwd:\n\n" +
        "- Lichte klusjes (een label, een korte extractie, een correctie van één regel) gaan naar een goedkoper " +
        "model. Het echte werk (analyse, copy, gesprek) naar het sterke model.\n" +
        "- Het grote deel van de opdracht dat elke keer hetzelfde is wordt gecachet, wat bij een vervolgvraag " +
        "binnen een paar minuten een fractie van het normale tarief kost.\n" +
        "- Elk antwoord schrijft zijn tokengebruik weg, per klant en per actie. Er is dus een scherm waarop " +
        "staat wat welke knop kost.\n\n" +
        "Waar de informatie buiten de eigen site ligt kan de AI zelf gericht op het web zoeken, en bij " +
        "afbeeldingen kijkt hij naar de foto in plaats van naar de bestandsnaam. Dat laatste is het verschil " +
        "tussen een alt-tekst die beschrijft wat er staat en een alt-tekst die gokt.\n\n" +
        "**Onder elk antwoord staat waar het op steunt.** Ingeklapt, als één regeltje: \"Zo ben ik hieraan " +
        "gekomen\". Klap je het open, dan zie je precies wat er is geraadpleegd voor dít antwoord: welke " +
        "zoekwoorden in Ahrefs, welke pagina's gelezen, waar in de mail gezocht, welke top 10 bekeken. Dat is " +
        "geen versiering maar controle: staat er een positie in het antwoord zonder bijbehorende bronregel, " +
        "dan is dat een reden om door te vragen.\n\n" +
        "De AI mag per gesprek een flink aantal onderzoeksstappen zetten voordat hij antwoordt, met een klok " +
        "erop. Loopt de tijd, dan rondt hij af met wat hij heeft in plaats van halverwege afgekapt te worden; " +
        "halve bevindingen zijn bruikbaar, afgekapte niet.",
    },
    {
      titel: "Microsoft 365 en Superhuman (mail)",
      kern: "De volledige klantcorrespondentie als context, met terugmailen vanuit het dashboard.",
      tekst:
        "Eén keer de mailbox koppelen, daarna leest het dashboard de mails per klant: op klantdomein, op " +
        "onderwerp, en op de mensen met wie er gemaild wordt. Het kan ook antwoorden versturen.\n\n" +
        "Waarom dit belangrijk is: de helft van wat er in een SEO-traject is afgesproken staat in mail, niet in " +
        "een systeem. Door die mail als context mee te nemen weet de assistent wat er beloofd is, wat er nog " +
        "openstaat en wie er aan zet is.\n\n" +
        "Superhuman heeft geen API, dus daar is een werkende deeplink voor gebouwd: elke mailverwijzing in het " +
        "dashboard opent het gesprek rechtstreeks in Superhuman, met Outlook op het web als terugval.",
    },
    {
      titel: "Google Drive",
      kern: "Alle documenten landen automatisch in de map van de klant.",
      tekst:
        "Elke analyse, blauwdruk en copy die het dashboard maakt wordt weggeschreven naar Drive, in een map per " +
        "klant, met versiebeheer. Zo is het document zowel in het dashboard als in de gewone werkomgeving van " +
        "de klant of het bureau te vinden, en raakt er niets kwijt als iemand liever in Drive werkt.",
    },
    {
      titel: "WordPress (de site van de klant)",
      kern: "Goedgekeurde wijzigingen gaan rechtstreeks de site in, met terugcontrole.",
      tekst:
        "Per klant kan er een WordPress-koppeling hangen. Daarmee kunnen meta-titels, meta-descriptions, " +
        "alt-teksten en redirects vanuit het dashboard doorgevoerd worden op de live site.\n\n" +
        "Drie waarborgen:\n\n" +
        "- Het applicatiewachtwoord wordt versleuteld opgeslagen en is nooit terug te lezen.\n" +
        "- Na het doorvoeren leest het dashboard het veld terug van de site. Staat het er niet, dan meldt het " +
        "dat eerlijk in plaats van te doen alsof het gelukt is.\n" +
        "- Het dashboard herkent zelf welke SEO-velden de site openstelt, in plaats van één vaste aanname te " +
        "doen over het gebruikte plugin.\n\n" +
        "**Eén koppeling per klant, en die staat op elk scherm waar je hem nodig hebt (21 augustus 2026).** " +
        "Er waren er twee: één die je invulde bij Wijzigingen (voor de bewerkingshistorie) en één bij " +
        "Meta & CTR (voor het doorvoeren). Twee formulieren, twee opslagen, en dus twee waarheden: bij " +
        "GardenSwimm stond op het ene scherm \"WordPress is gekoppeld\" met de volledige historie erbij, en op " +
        "het andere in dezelfde minuut \"De site weigert de koppeling\". Allebei klopte het, want het waren " +
        "twee verschillende wachtwoorden. Nu is het er één, hij wordt vóór het opslaan altijd echt bij de site " +
        "getest, en het invulvenster verschijnt vanzelf op het scherm waar iets misgaat in plaats van achter " +
        "een knop die als statusmelding leest.\n\n" +
        "**Als de site de wijziging wel accepteert maar niet bewaart.** Rank Math (en Yoast) leggen de " +
        "paginatitel en de meta-omschrijving bij de pagina neer, maar melden die velden niet aan bij de " +
        "WordPress-API. De site antwoordt dan \"gelukt\" en gooit de waarde daarna weg. Het dashboard leest het " +
        "veld terug en ziet dat, dus het meldt nooit ten onrechte dat iets doorgevoerd is. Er zijn twee " +
        "uitwegen, in deze volgorde: eerst wordt de eigen schrijfroute van Rank Math geprobeerd (dan is er " +
        "niets te installeren, en de uitkomst wordt op de pagina zelf nagekeken); lukt dat niet, dan staat er " +
        "op het scherm een knop \"Uitleg voor de sitebouwer\" met een bestand van twintig regels, de " +
        "instructie om door te sturen en de code om te plakken. Dat bestand meldt vier bestaande velden aan " +
        "bij de API, met een rechtencontrole erbij; het verstuurt niets, leest niets uit en is met één " +
        "handeling weer weg.",
    },
    {
      titel: "Moneybird (de boekhouding)",
      kern: "Uitsluitend lezen: omzet, kosten en openstaande facturen per klant.",
      tekst:
        "De financiële laag haalt de winst-en-verliescijfers en de openstaande facturen op, uitgesplitst per " +
        "post en per klant, met een deeplink naar de factuur in Moneybird.\n\n" +
        "Deze koppeling doet alleen leesverzoeken. Er wordt nooit iets aangemaakt of gewijzigd in de " +
        "boekhouding. Wat het wél doet is signaleren: staat er bij een klant een factuur te lang open, dan " +
        "verschijnt dat in de cockpit van die klant, precies op het moment dat je met die klant bezig bent.",
    },
    {
      titel: "PageSpeed en de eigen crawler",
      kern: "Snelheid uit Google, inhoud uit de pagina zelf.",
      tekst:
        "Snelheidscijfers komen uit de PageSpeed-API. De inhoud van een pagina komt uit een eigen crawl: " +
        "titel, description, koppenstructuur, woordaantal, afbeeldingen met alt-teksten, interne links met " +
        "ankertekst en de aanwezige structured data.\n\n" +
        "Voor pagina's die pas met JavaScript hun inhoud tonen wordt een echte browser opgestart. Voor de rest " +
        "de snelle route. Dat scheelt tijd en geld zonder gaten in de meting.",
    },
    {
      titel: "Google Sheets",
      kern: "De maandstaat van de klant blijft waar hij al stond.",
      tekst:
        "Het maandoverzicht dat de klant ziet (werkzaamheden, uren, budget) kan uit een gepubliceerde Google " +
        "Sheet per klant komen. Dat is bewust zo gebleven: het bureau dat al in een sheet werkt hoeft zijn " +
        "manier van werken niet te veranderen om een dashboard te kunnen geven.",
    },
    {
      titel: "Bronnen-gezondheid: houdt zichzelf in de gaten",
      kern: "Elke koppeling hierboven schrijft bij elk gebruik weg of het lukte; een storing is dus meteen te zien.",
      tekst:
        "Negen koppelingen hangen aan dit dashboard, en elke koppeling kan een dag stil zijn: een verlopen " +
        "toegang, een limiet, een storing. Er is nu één scherm waar dat per koppeling staat: werkt hij, " +
        "wanneer ging het voor het laatst goed, en wat is er precies mis als het niet werkt.\n\n" +
        "Elke keer dat dat scherm opent, wordt elke koppeling meteen opnieuw en écht getest, niet uit een " +
        "oud cijfer voorgelezen. Een koppeling die je bewust losmaakt is dus binnen een minuut op het scherm " +
        "te zien, met een knop om hem meteen opnieuw te leggen waar dat kan (Google en Microsoft rechtstreeks; " +
        "Ahrefs en Moneybird via hun sleutel in Vercel). WordPress hangt per klant, dus die koppelingen staan " +
        "los onder elkaar, met een link naar de klant zelf.",
    },
  ],
};
