import type { Uitklapper } from "../types";

// De drie remmen die het opruimen veilig houden. Ze stonden in `opruimen.ts`, maar
// dat bestand liep daarmee over de 250 regels heen. De regel is dan niet de maat
// verhogen maar splitsen op onderwerp, en dit is één onderwerp: wat het opruimen
// NIET doet, en waarom. Alle drie komen ze uit een voorstel dat op papier klopte
// en in de praktijk geld had gekost.

export const VEILIGHEID: Uitklapper[] = [
  {
    titel: "Een tweede taal is een eigen boom, geen dubbeling",
    tekst:
      "Op de lijst met advertentiepagina's van One Day Clinic stond de regel `/en/`. Zo'n regel dekt " +
      "alles eronder, dus die ene regel zette 315 pagina's buiten élke analyse. Dat klopte niet: die " +
      "pagina's staan op `index, follow` met een eigen canonical, en 211 ervan hebben een echte positie " +
      "in Google.\n\n" +
      "**Een advertentiepagina is een landingspagina, geen sectie.** Een regel die een hele tak dekt " +
      "wordt daarom genegeerd, en op het scherm gemeld zodat je hem kunt weghalen. Een gewone " +
      "landingspagina blijft gewoon werken, ook als hij op de wortel staat.\n\n" +
      "Maar die Engelse pagina's zomaar in het gewone opruimen gooien is óók fout, en dat is het punt " +
      "dat makkelijk misgaat. De Nederlandse en de Engelse versie verwijzen via hreflang netjes naar " +
      "elkaar. Google ziet ze dus als taalvarianten, niet als duplicaten, en samenvoegen zou een " +
      "werkende taalstructuur slopen. **Een taalvariant wordt daarom nooit samengevoegd met zijn " +
      "tegenhanger in de hoofdtaal**, en een Engelse plaatspagina hoort bij de Engelse boom in plaats " +
      "van bij de Nederlandse.\n\n" +
      "Waarom ze nu tóch in de weg zitten: de titel is vertaald, de tekst eronder niet. Daardoor rankt " +
      "`/en/een-soa-test-doen-in-utrecht/` op \"soa test utrecht\", een Nederlandse term, en " +
      "concurreert hij met de Nederlandse pagina. Vertaal je hem echt, dan richt hij zich op Engelse " +
      "termen en verdwijnt die concurrentie vanzelf.\n\n" +
      "**De vraag is dus niet of hij dubbel is, maar of er zoekvraag in die taal is.** Dat wordt " +
      "gemeten: per pagina wordt gekeken op hoeveel vertoningen hij binnenkomt via zoekopdrachten in " +
      "de eigen taal, tegenover die in de hoofdtaal. De taal van een zoekopdracht volgt uit " +
      "functiewoorden en vakwoorden (\"soa\" tegenover \"std\" en \"sti\"); is er geen signaal, dan telt " +
      "hij voor geen van beide mee. Liever een eerlijk \"weet ik niet\" dan een verkeerde helft van een " +
      "besluit.\n\n" +
      "- **Geen eigen zoekvraag** → een vertaling die niemand zoekt en die zijn tegenhanger in de weg " +
      "zit. Hij gaat erin op, en de hreflang-verwijzing gaat eraf. Zonder die laatste stap blijft " +
      "Google een vertaling verwachten die er niet meer is.\n" +
      "- **Wel eigen zoekvraag** → hij blijft en gaat de vertaalwachtrij in.\n\n" +
      "En dat laatste bepaalt de volgorde: **eerst beslissen of een pagina blijft, dan pas vertalen.** " +
      "Vertalen is contentwerk en hoort in fase 2, om precies dezelfde reden als alle andere " +
      "inhoudelijke stappen: een pagina vertalen die je daarna wegstuurt is weggegooid werk.",
  },
  {
    titel: "Een advertentiepagina doet mee, maar gaat nooit weg",
    tekst:
      "Ads-landingspagina's werden helemaal buiten de opruim-analyse gehouden. Dat leek veilig en was " +
      "te grof: het is óók een SEO-pagina, en juist bij de grote steden staan er vier of vijf andere " +
      "pagina's voor in de weg. Erger nog, de motor herkent een stad aan de pagina in de vaste " +
      "stadsvorm, en dat is nou net de Ads-pagina. Eén pagina overslaan liet daardoor de héle stad uit " +
      "het plan vallen.\n\n" +
      "Nu doet hij gewoon mee, met één harde regel eromheen: **een advertentiepagina is altijd de " +
      "pagina die blijft, en er gaat nooit iets van hem weg.** De andere pagina's van die stad wijzen " +
      "naar hem toe, en op het scherm staat het label \"Ads-pagina\" erbij zodat zichtbaar is waaróm er " +
      "niets mee gebeurt. Dat slot zit op de plek waar de winnaar wordt gekozen én op de plek waar de " +
      "lijst wordt gebouwd, zodat een latere wijziging hem niet alsnog per ongeluk kan omleiden.",
  },
  {
    titel: "Een omleiding naar een doel dat niet bestaat wordt tegengehouden",
    tekst:
      "Het plan stelde voor om `/soa-poli-zoetermeer/` om te leiden naar " +
      "`/soa-klinieken/soa-test-zoetermeer/`. Die eerste pagina staat op positie 2 en haalt echte " +
      "klikken. Die tweede bestaat helemaal niet: hij is opgebouwd uit de gekozen URL-vorm, en op de " +
      "site is het een omleiding die via `/soa-test-locaties/soa-test-zoetermeer/` terugkomt op de " +
      "bronpagina. Doorvoeren zou een oneindige lus maken en een rankende pagina offline halen. Bij " +
      "Purmerend was het een directe ping-pong tussen twee adressen.\n\n" +
      "De oorzaak is dat een doel uit een patroon werd gebouwd en nooit tegen de werkelijkheid werd " +
      "gehouden. Dat gebeurt nu wel: elk doel moet een pagina zijn die echt bestaat. Is dat niet zo, " +
      "dan blijft de bevinding staan (er ís cannibalisatie) maar krijgt de regel een waarschuwing met " +
      "de reden erbij, zichtbaar bij de knop en niet alleen diep in een uitklapper. Er kan dus niets " +
      "doorgevoerd worden op een verzonnen adres, en de rest van het blok kan gewoon door.",
  },
  {
    titel: "Het plan zegt wat het weglaat, en waarom",
    tekst:
      "Zoeken op \"Utrecht\" in het werkplan gaf alleen titelwerk terug. Daar zijn twee verklaringen " +
      "voor, en ze zijn tegengesteld: de motor heeft de cannibalisatie gemist, of er valt niets op te " +
      "ruimen. Het scherm zei niets, dus je kon niet kiezen. Dat is het probleem met stil weglaten: een " +
      "weglating zonder reden is niet te onderscheiden van een gat.\n\n" +
      "Onder de zoekregel staat nu \"Wat er buiten dit plan valt\", en dat blok beweegt mee met waar je " +
      "op zoekt. Zoek je op een stad, dan zie je precies welke pagina's van die stad buiten de analyse " +
      "vielen, met per pagina de reden. Er zijn er drie:\n\n" +
      "- **Advertentiepagina.** De pagina staat op de lijst met Ads-landingspagina's. Die worden bewust " +
      "overgeslagen: ze staan meestal op noindex, dus een voorstel om ze samen te voegen of op te ruimen " +
      "zou fout zijn. Dit is de reden waarom Utrecht en Rotterdam geen opruimblok hebben.\n" +
      "- **Plaats valt buiten de analyse.** Dit is geen keuze maar een gevolg, en het is de reden dat dit " +
      "blok er kwam. De motor herkent een plaats aan de pagina in de vaste stadsvorm. Is juist díe pagina " +
      "een advertentiepagina, dan valt de hele plaats uit het plaats-advies, inclusief pagina's die zelf " +
      "niets met adverteren te maken hebben. Bij One Day Clinic gaat het om achttien pagina's in Utrecht, " +
      "Rotterdam, Den Haag en Eindhoven. Daar kan echt werk blijven liggen, dus die krijgen een eigen " +
      "reden in plaats van dat ze op één hoop gaan met \"geen aanleiding\".\n" +
      "- **Geen aanleiding gevonden.** Geen enkele analyse is op deze pagina uitgekomen.\n\n" +
      "In hetzelfde blok staan de blokken waarin álles al doorgevoerd is, als \"al afgerond\". Die " +
      "verdwenen eerder stil uit het plan omdat er geen minuten werk meer in zaten, wat klopt voor een " +
      "planning maar niet voor het scherm: zoeken op een plaats die vorige maand is opgeruimd gaf nul " +
      "blokken, precies hetzelfde beeld als een plaats die nooit is bekeken.",
  },
];
