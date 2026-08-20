import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Wat er meegaat naar de developer",
    kern: "De aantekeningen bij een taak zijn het verhaal; die gaan mee, met alle links erin.",
    tekst:
      "Een taak doorzetten naar de sitebouwer stuurt meer mee dan de titel. Wat hij krijgt:\n\n" +
      "- de opdracht zoals jij hem formuleert in het doorzet-venster;\n" +
      "- de pagina waar het om gaat;\n" +
      "- de documenten die je aanvinkt (copy, blauwdruk, analyse, een teruggekregen klantversie);\n" +
      "- **de aantekeningen bij de taak, volledig**, opgemaakt zoals ze op de kaart staan, dus met " +
      "werkende links en uitklappers;\n" +
      "- **elke link uit de kaart en de aantekeningen**, nog eens los op een rij.\n\n" +
      "Dat laatste is nieuw sinds 20 augustus 2026, en het was een echt gat. De aantekeningen zijn het " +
      "enige veld op een kaart dat geen enkele automatische stap aanraakt: wat daar staat, staat er " +
      "bewust. Bij een taak over het aanhaken van vestigingen stond daar het hele verhaal (vijf " +
      "vestigingen met adressen en mailadressen, een link naar het stappenplan, een link naar de " +
      "bespreekpunten), en de sitebouwer kreeg daar niets van te zien. Hij las \"kun jij die vijf " +
      "vestigingen aanmaken?\" en moest de gegevens alsnog opvragen.\n\n" +
      "In het doorzet-venster staan die links tussen de documenten, met een vinkje. Ze staan standaard " +
      "aan, want je hebt ze er niet voor niets bij gezet. Ook een kaal webadres of mailadres in de tekst " +
      "telt mee; daar hoeft geen link omheen te staan.\n\n" +
      "**In de mail hetzelfde.** De links komen als klikbare regels in de mail, de aantekeningen als " +
      "gewone tekst eronder (een mail blijft simpel: aanhef, korte alinea's, geen tabellen), en de " +
      "assistent die de mail schrijft kent ze nu ook. Hij schrijft dus niet langer om adressen en namen " +
      "heen die er gewoon staan.",
  },
  {
    titel: "Doorvoeren op de site en nameten",
    kern: "Wijziging, terugcontrole, en daarna het effect.",
    tekst:
      "Goedgekeurde meta-teksten, alt-teksten en redirects kunnen rechtstreeks de site in. Daarna wordt het " +
      "veld teruggelezen van de site (staat het er echt?) en later het effect gemeten in Search Console " +
      "(klikpercentage voor en na).\n\n" +
      "Alt-teksten hangen in WordPress aan de afbeelding zelf. Dat werkt goed voor unieke afbeeldingen; een " +
      "afbeelding die op meerdere plekken staat zou site-breed dezelfde alt krijgen en gaat daarom niet " +
      "automatisch, maar wordt in de werklijst voor de sitebouwer gemarkeerd.\n\n" +
      "**En op de projectkaart staat in de Implementatie-rij de knop \"Gedaan?\"** (op de developerlijst heet " +
      "dezelfde knop \"Is dit doorgevoerd?\"). Die meet de live pagina op precies de " +
      "punten die bij het doorzetten zijn afgesproken: staat hij live, staan de geschreven koppen erop, staat " +
      "de structured data erop. Het antwoord landt op drie plekken: bovenin de kaart met het bewijs per punt, " +
      "als één regel in de kaarttekst die de vorige controle vervángt, en in de tijdlijn met de pagina als " +
      "bewijs. Klopt alles, dan gaat het vinkje bij Implementatie om; klopt het niet, dan biedt de kaart een " +
      "mail aan de sitebouwer aan met de gemeten waarde erin.\n\n" +
      "Eén regel is belangrijker dan de meting zelf: **een mislukte meting is nooit een oordeel.** Weigert de " +
      "site ons of laadt de pagina niet, dan is de uitslag \"kon ik niet meten\" en verandert er niets. " +
      "Beweren dat iets niet gedaan is terwijl je het niet gezien hebt, is erger dan niets weten. De aanleiding " +
      "is concreet: in januari 2026 kon niemand vaststellen of zes interne links nu wel of niet verdwenen waren.\n\n" +
      "**Sinds 11 augustus 2026 telt die meting ook echt mee als bewijs voor de copy.** Eerder " +
      "controleerde de knop alleen wat er bij het doorzetten was afgesproken; is dat destijds alleen \"staat hij " +
      "live\" geweest, dan werd de copy zelf nooit vergeleken, ook niet als er inmiddels een copy-document lag. " +
      "En zelfs wanneer de koppen wél gemeten werden, verdween die uitslag in de kaarttekst en wist de rest van " +
      "het dashboard (de fase Bouw en publicatie, het bordoverzicht, de paginasignalen die de assistent leest) " +
      "er niets van. Twee losse metingen van dezelfde vraag konden zo elkaar tegenspreken: de kaart toonde " +
      "\"in orde\" terwijl de sitebrede stand nog \"nog niet doorgevoerd\" beweerde. Nu meet de knop altijd óók " +
      "de copy zodra er een document is, en het resultaat landt in dezelfde gedeelde stand die de rest van het " +
      "dashboard raadpleegt. Een bevroren tekstregel op een oudere kaart die nog \"nog geen wijziging " +
      "gedetecteerd\" zegt, wordt op het scherm automatisch vervangen zodra de meting het tegendeel bevestigt.\n\n" +
      "**Diezelfde dag nog een scheve uitkomst rechtgezet: de controle zei \"er is geen copydocument om tegen " +
      "te vergelijken\" terwijl het copydocument één regel lager in dezelfde kaart als link stond.** Dat kwam " +
      "doordat de controle de tekst maar op één plek zocht, en de pagina-URL daarbij letterlijk vergeleek: één " +
      "schuine streep of een www ervoor, en het werk bestond volgens het dashboard niet. Nu wordt de copy " +
      "gezocht op alle plekken waar hij kan liggen (de geldende tekst in het dashboard, het versie-archief, en " +
      "anders het gekoppelde document zelf, dat gewoon uit Drive wordt uitgelezen, ook als het een Word-bestand " +
      "is), en telt een pagina-adres als hetzelfde zodra het over dezelfde pagina gaat. In het bewijs staat er " +
      "voortaan bij wélk document er vergeleken is. Valt er echt niets te lezen, dan zegt de melding welk van " +
      "de twee het is: er ligt geen copydocument, of hij ligt er wél maar de tekst kwam er niet uit. Dat eerste " +
      "is werk dat nog moet gebeuren, het tweede is een leesprobleem aan onze kant, en dat vraagt om iets " +
      "anders.\n\n" +
      "**Daarna bleek de controle nog steeds het verkeerde te vergelijken, en dat was het echte probleem.** " +
      "Op dezelfde pagina meldde hij \"0 van de 5 koppen gevonden\", terwijl de teksten er gewoon op stonden. " +
      "Die vijf koppen waren de hoofdstukken van ons eigen copydocument (\"1. Waar de nieuwe teksten over " +
      "gaan\"), en die horen per definitie niet op een pagina te staan. De echte paginakoppen stonden er wel " +
      "in, maar met de aanduiding \"H1:\" met een dubbele punt, terwijl er alleen op een streepje werd " +
      "gezocht. Drie dingen zijn daarop veranderd: de aanduiding wordt herkend in alle vormen waarin we hem " +
      "schrijven, de begeleidende hoofdstukken tellen niet meer mee, en van meerdere documenten bij één " +
      "pagina wordt degene gekozen die de webteksten daadwerkelijk bevat. Levert geen enkel document " +
      "webteksten op, dan is de uitslag \"niet te meten\" met de reden erbij, nooit \"niet gedaan\". " +
      "Dezelfde pagina meet nu 11 van de 11 koppen.\n\n" +
      "**En de controle laat voortaan zien wat hij vergeleken heeft.** Onder het koppenpunt zit een " +
      "uitklapper met de koppen die we zochten, een vinkje of kruisje per kop, en uit welk document ze " +
      "komen. Een getal zonder die lijst is onbruikbaar: je weet dan niet of de sitebouwer iets heeft laten " +
      "liggen of dat wij het verkeerde document naast de pagina legden, en dat bepaalt wie er aan zet is.",
  },
];
