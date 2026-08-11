import type { Uitklapper } from "../types";

// Het Google-bedrijfsprofiel.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Het Google-bedrijfsprofiel",
    kern: "Hoe de klant ervoor staat op de kaart, met de concurrenten in de buurt ernaast.",
    tekst:
      "Voor een lokaal bedrijf is het Google-bedrijfsprofiel vaak het eerste en soms het enige wat iemand " +
      "ziet voordat hij belt of de route opvraagt. Het bepaalt of je in het lokale blok bovenaan de " +
      "zoekresultaten komt, en dat blok wordt niet door de website gewonnen maar door het profiel.\n\n" +
      "Het dashboard meet per vestiging, want een bedrijf met vijf locaties heeft vijf profielen en die " +
      "staan er niet allemaal even goed voor. Zes brillen kijken mee: is het profiel compleet, klopt het met " +
      "wat er op de site en in de bedrijfsgegevens staat, hoe staat het met de reviews, met de foto's, met " +
      "de activiteit (posts en vragen), en hoe verhoudt dat zich tot de concurrenten.\n\n" +
      "Die laatste is waar de waarde zit. \"42 reviews\" zegt niets; \"42 tegenover 180, en zij halen er zes " +
      "per maand bij\" is een gesprek met de klant en een taak in de planning.",
    sub: [
      {
        titel: "Twee deuren, en het verschil staat in beeld",
        tekst:
          "De **meetdeur** werkt altijd zodra er een Maps-sleutel in de omgeving staat, en meet ook de " +
          "profielen van de concurrenten. Die geeft naam, adres, telefoon, website, openingstijden, " +
          "categorie, reviewaantal, gemiddelde, de laatste reviews en het aantal foto's.\n\n" +
          "De **beheerdeur** gaat alleen open voor profielen waar Pingwin beheerder van is, en pas nadat " +
          "Google het project heeft goedgekeurd. Die levert wat de meetdeur nooit kan: de bezoekcijfers " +
          "(hoe vaak gezien in zoeken en op de kaart, hoe vaak gebeld, hoeveel routes, hoeveel klikken naar " +
          "de site), de volledige reviewlijst inclusief of er geantwoord is, de posts en de vragen.\n\n" +
          "Wat er niet gemeten kon worden staat er altijd bij, met de reden erbij. Een lege uitslag mag " +
          "nooit lezen als \"er is niets aan de hand\".",
      },
      {
        titel: "Zonder beheertoegang is de inventarisatie tóch compleet",
        tekst:
          "Een deel van het profiel zit achter de beheertoegang: de bedrijfsomschrijving, de attributen, de " +
          "feestdagen, de posts en de vragen. Zonder die toegang kunnen we niet zien hóe die ervoor staan.\n\n" +
          "Ze verdwijnen daarom niet uit beeld, want dan lijkt het profiel af terwijl de halve etalage " +
          "ongezien is. Ze staan als eigen blok op het scherm, gemarkeerd als niet gemeten, met wat er moet " +
          "gebeuren erbij. Je kunt ze net zo goed aanvinken en op de planning zetten; het werk is bekend, " +
          "alleen de stand niet.",
      },
      {
        titel: "Bij meerdere vestigingen: de dubbelen",
        tekst:
          "De grootste fout bij een bedrijf met meerdere locaties is zelden een zwak profiel. Het is een " +
          "dubbel of vergeten profiel: een oude vestiging die nog leeft, of twee vermeldingen die om " +
          "dezelfde plaats vechten. Dat splitst de reviews en de signalen, en Google kan de verkeerde tonen.\n\n" +
          "De scan zoekt daar actief naar en meldt wat hij vindt als richtinggevend, niet als hard oordeel: " +
          "alleen een mens kan zien of het echt een dubbel is of gewoon een tweede vestiging.",
      },
      {
        titel: "Reviews: seintje, concept, en een mens die verstuurt",
        tekst:
          "Komt er een review van drie sterren of lager binnen, dan verschijnt er een seintje in de " +
          "tijdlijn van die klant, één keer per review en niet bij elke scan opnieuw. Op het profielscherm " +
          "staan die reviews bij elkaar met een knop die er een concept-antwoord bij schrijft, in de stem " +
          "van de klant, uit het klantprofiel dat al in het dashboard staat.\n\n" +
          "Het dashboard plaatst dat antwoord niet zelf. Reageren op een review is iets wat de klant hoort " +
          "te doen, en het gaat over álle reviews, ook de goede: Google noemt reageren zelf een factor, en " +
          "voor een twijfelende bezoeker is een antwoord het bewijs dat er iemand oplet.",
      },
      {
        titel: "Van signaal naar taak op de planning",
        tekst:
          "Een bevinding die alleen op een scherm staat, gebeurt niet. Daarom kan elk punt op dit scherm " +
          "met een vinkje een kaart worden in de weekplanning: losse punten, alles van één vestiging, of " +
          "de hele suggestielijst in één keer.\n\n" +
          "Zo'n kaart hangt niet aan een pagina van de site, en dat maakt de context extra belangrijk. Er " +
          "gaat daarom altijd hetzelfde mee: wat je doet (de concrete actie, niet een herhaling van het " +
          "probleem), wat er gemeten is als bewijs, waarom het uitmaakt, de link naar het profiel zelf, en " +
          "een link terug naar exact dit punt op dit scherm. Zonder die laatste is er over drie weken geen " +
          "weg terug naar waar de kaart vandaan kwam.\n\n" +
          "De uitnodiging om beheerder te worden kan op dezelfde manier op de planning, want dat is bij een " +
          "nieuwe klant meestal de allereerste stap.\n\n" +
          "**Dit is bewust geen knop van dit ene scherm.** Het dashboard signaleert op steeds meer plekken " +
          "iets dat gedaan moet worden, en als elk scherm zijn eigen weg naar de planning krijgt, gaan die " +
          "vijf wegen uit elkaar lopen zonder dat iemand het merkt. Daarom is er één gedeelde laag: een " +
          "scherm levert alleen wélke punten er op de planning moeten, en wát er dan in de kaart komt te " +
          "staan (de drie vaste onderdelen, de terugweg-link, het samenvoegen met een bestaande kaart) " +
          "staat op één plek. Een volgend scherm aansluiten is daarmee een blok van vijftien regels in " +
          "plaats van een verbouwing.\n\n" +
          "Aangesloten is nu het Google-bedrijfsprofiel. De prioriteitenscan, Meta en CTR, Opruimen en de " +
          "interne links hebben nog hun eigen weg naar een taak, uit de tijd dat die laag er niet was; die " +
          "gaan er per scherm doorheen, zodat er nooit een moment is waarop er twee manieren naast elkaar " +
          "staan.",
      },
      {
        titel: "De uitnodigingsmail gaat door het gewone mailvenster",
        tekst:
          "De mail waarmee je de klant om beheertoegang vraagt is vaste tekst, geen AI: het stappenplan " +
          "moet elke keer kloppen, en variatie voegt daar niets aan toe.\n\n" +
          "Twee dingen zijn wél instelbaar, één keer voor alle klanten. Het **Google-adres** waarmee we " +
          "toegang vragen, en dat is bewust niet het Pingwin-mailadres: toegang tot Google-diensten hangt " +
          "aan het Google-account waarmee je in Chrome zit. Het verkeerde adres levert een uitnodiging op " +
          "die de klant wél verstuurt en die bij niemand aankomt.\n\n" +
          "De mail zelf gaat door **hetzelfde mailvenster** als de weekplan-kaarten en de prioriteitenscan. " +
          "De uitnodiging met het stappenplan staat er als achtergrondtekst in; je schrijft je eigen intro " +
          "erboven en past aan wat je wilt, precies zoals bij elke andere mail uit het dashboard. Er is dus " +
          "geen apart sjabloon met plaatshouders om te onderhouden.",
      },
      {
        titel: "Waarom het dashboard het profiel niet zelf aanpast",
        tekst:
          "Het profiel is de etalage van de klant, en Google kan een profiel schorsen bij wijzigingen die " +
          "het niet vertrouwt. Daarom geldt hier dezelfde staande regel als bij het doorvoeren van " +
          "meta-teksten: het dashboard schrijft voor, een mens keurt per stuk goed.\n\n" +
          "Naast de gemeten punten staat er een lijst suggesties die losstaat van de metingen: de dingen " +
          "die je met een profiel kúnt doen, afgestemd op wat voor bedrijf het is (posts, productenblok, " +
          "dienstenblok, eigen vragen, feestdagen, locatiepagina's). Ook een profiel waar niets mis mee is " +
          "heeft daar nog werk liggen.",
      },
    ],
  },
];
