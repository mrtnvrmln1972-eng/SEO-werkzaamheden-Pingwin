import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "werk",
  titel: "Van bevinding naar uitgevoerd werk",
  intro:
    "Een advies dat niet wordt uitgevoerd is geen advies. Daarom zit de hele weg van signaal naar live " +
    "wijziging in hetzelfde systeem, met een vaste voortgang per pagina.",
  uitklappers: [
    {
      titel: "Als de sitebouwer iets afvinkt, weet je het meteen",
      kern: "Een melding in de kopbalk in plaats van een mailtje.",
      tekst:
        "De sitebouwer werkt in haar eigen deel van het dashboard en vinkt daar af wat af is. Tot 6 augustus " +
        "2026 gebeurde er dan niets zichtbaars: de status ging stil de database in, en zij moest er een mail bij " +
        "sturen om het te laten weten. Dat mailtje was dus werk dat het dashboard zelf had kunnen doen.\n\n" +
        "Nu verschijnt het als **melding in de kopbalk**, op elk beheerscherm, met een oranje telletje zolang je " +
        "het nog niet gezien hebt. In de melding staat welke klant, welke taak, en de terugkoppeling die zij erbij " +
        "typte. Klik erop en je staat bij de taak.\n\n" +
        "Drie keuzes die het rustig houden:\n\n" +
        "- **Openklappen is lezen.** Geen aparte knop \"markeer als gelezen\"; dat is een handeling erbij die " +
        "niets oplevert. Er wordt één moment onthouden: tot wanneer je gekeken hebt.\n" +
        "- **Ontvinken haalt de melding weg.** Anders blijft er staan dat iets af is terwijl dat niet meer zo is.\n" +
        "- **Je eigen vinkje geeft geen melding**, en de sitebouwer ziet deze meldingen niet: het zijn er niet " +
        "twee van, het is er één, voor de eigenaar.\n\n" +
        "Wat er nog niet is: een mail of telefoonmelding als je het dashboard een dag niet opent. Dat kan erbij, " +
        "maar bewust nog niet gedaan; eerst kijken of het belletje volstaat.\n\n" +
        "**De mailknop bij een taak verstuurt sinds 11 augustus 2026 vanuit het dashboard zelf.** Daarvoor " +
        "sprong hij naar je eigen mailprogramma, en dat werkt alleen zolang er in díe browser een mailprogramma " +
        "aan mailadressen gekoppeld is. Viel dat weg, dan gebeurde er letterlijk niets: geen venster, geen " +
        "melding, geen foutje. De knop leek stuk terwijl er niets aan veranderd was. Nu opent hetzelfde " +
        "mailvenster als overal elders in het dashboard, met de klant, de taak, de pagina en de documenten er al " +
        "in, en verstuurt hij via de mailkoppeling. Het adres staat erboven en is aan te passen (je onthoudt " +
        "wie je er de vorige keer voor pakte), want de één mailt zijn sitebouwer en de ander mailt juist terug. " +
        "Is er geen mailkoppeling, dan biedt hetzelfde venster \"open in mailprogramma\" en \"kopieer mailtekst\" " +
        "aan, dus je staat nooit voor een dood knopje.\n\n" +
        "Diezelfde constructie stond op drie plekken los in de code, dus dezelfde storing lag drie keer klaar. " +
        "Ze lopen nu allemaal over één stukje code, en een proef bij elke bouw houdt tegen dat er een nieuwe " +
        "mailknop bijkomt die stilzwijgend niets kan doen.",
    },
    {
      titel: "De zeven fases per pagina",
      kern: "Eén vaste route, dus altijd duidelijk wat de volgende stap is.",
      tekst:
        "Elke pagina loopt langs zeven fases, in deze volgorde:\n\n" +
        "| Fase | Wat er gebeurt |\n" +
        "|---|---|\n" +
        "| Strategie | Doel, doelgroep, primair zoekwoord |\n" +
        "| Gelieerde pagina's | Welke pagina's hier omheen horen |\n" +
        "| Analyse | Wat de pagina nu doet, met bewijs |\n" +
        "| Blauwdruk | Hoe de pagina eruit moet gaan zien |\n" +
        "| Copy | De volledige tekst, getoetst aan de criteria |\n" +
        "| Implementatie | Het bouwen en live zetten |\n" +
        "| Structured data | Het schema-blok voor deze pagina |\n\n" +
        "Uit die stand volgt automatisch twee dingen: wat de volgende stap is, en wie er aan zet is (het " +
        "bureau of de developer). Dat wordt op één plek berekend, want eerder deden de kaart en de server dat " +
        "elk apart en dan zei de ene 'volgende: strategie' terwijl de knop ernaast een blauwdruk startte.\n\n" +
        "**Een chat is nog geen strategie.** Over elke pagina kun je vrij sparren; er wordt nooit stilzwijgend " +
        "iets tot strategie gebombardeerd. Pas de knop **\"Vat samen & leg strategie vast\"** maakt de conclusie " +
        "officieel: het hele gesprek wordt samengevat, die conclusie wordt de vastgelegde strategie die de " +
        "volgende fases (gelieerde pagina's, analyse, blauwdruk, copy) als basis meekrijgen, en er komt een net " +
        "Pingwin-document van in de Drive-map van de pagina, vastgelegd als werkzaamheid. Die ene knop staat op " +
        "beide plekken waar de chat staat: bij de pagina in Pagina's én op de projectkaart in de planning. " +
        "Zonder die klik draaien de volgende fases op de live data alleen, zonder de conclusies uit het " +
        "gesprek.\n\n" +
        "**Alle documenten van een pagina komen in één Google Drive-map**, en die kies je bovenaan het " +
        "fase-blok: de knop staat naast \"Alles in één keer\", want daar worden ze ook gemaakt. Strategie, " +
        "analyse, blauwdruk en copy landen er alle vier in. Kies je niets, dan blijven de documenten in het " +
        "dashboard zelf staan en is er nog steeds een link.\n\n" +
        "Bij een nieuwe pagina bestaat die map nog niet, en dat is de normale situatie. Daarom maak je hem in " +
        "hetzelfde venster: het naamveld staat al ingevuld met een voorstel uit het pad van de pagina " +
        "(`/hovenier/oosterhout/` wordt \"Hovenier Oosterhout\"), en zodra de map er is sta je er meteen in, " +
        "zodat de knop onderin hem ook echt vastlegt. Dat laatste ging eerder mis: de map werd gemaakt, maar " +
        "niet gekozen, en de documenten landden een niveau hoger.\n\n" +
        "**De fases zeggen alleen wat af is, niet wat je moet doen.** Vroeger kreeg elke fase bij het " +
        "aanmaken van een kaart een standaardzin mee (\"tekst aanscherpen\", \"toets deze pagina op " +
        "overlap\"). Die herhaalde de naam van de fase, en werd nooit herschreven: op een kaart waar de copy " +
        "al goedgekeurd was stond nog steeds \"tekst aanscherpen\", pal naast een groen vinkje. Die zinnen " +
        "zijn uit beeld. Een uitleg-knopje verschijnt nu alleen nog bij sturing die echt over deze pagina " +
        "gaat en uit een gesprek of een mail komt.\n\n" +
        "Eén uitzondering zit erin: bestaat de pagina nog niet, dan wordt de analyse overgeslagen. Je kunt een " +
        "pagina die er niet is niet analyseren.",
    },
    {
      titel: "De planning: per dag, per week en over alle klanten",
      kern: "Vandaag bovenaan, plannen door te slepen, afvinken in de kaart.",
      tekst:
        "De planning kijkt op twee manieren naar hetzelfde werk. **Per moment**: kaarten voor Te laat, Vandaag, " +
        "Morgen, Verder deze week, Volgende week, Later, en wat nog geen dag heeft. **Per week**: een kaart per " +
        "week, zoals een klassieke weekplanning. Vandaag staat standaard open, de rest klap je zelf open en die " +
        "keuze blijft staan.\n\n" +
        "Binnen een kaart staat het werk gegroepeerd per klant, met een kopregel en een streep ernaast, zodat " +
        "je ziet wat bij elkaar hoort. Op het tabblad Taken zie je alleen deze klant; op de volle-breedte-versie " +
        "zie je alle klanten door elkaar, want een werkdag begint niet bij een klant maar bij een dag.\n\n" +
        "**Slepen betekent overal hetzelfde: je verzet de dag.** Laat je een taak op Morgen los, dan staat hij " +
        "morgen. Laat je hem op een week los, dan houdt hij dezelfde weekdag, of hij krijgt de maandag als hij " +
        "nog geen dag had. Zo kan de datum nooit iets anders zeggen dan het vak waar de taak in staat. De dag " +
        "kiezen kan ook rechtstreeks, met een uitklapbare maandkalender op de regel.\n\n" +
        "De planning is bewust een **signaalscherm** en geen bedieningspaneel: één regel per taak, met " +
        "welke pagina, de zeven fases als gekleurde letters, de volgende stap en de dag. Die letters zijn expres " +
        "geen knoppen. Afvinken hoort in de kaart waar het werk gebeurt, en dan kleuren ze hier vanzelf mee. " +
        "Anders bestaan er twee wegen naar dezelfde stand, en dan lopen ze uiteen.\n\n" +
        "Klap je een regel open, dan verschijnt de échte projectkaart: de fases met hun knoppen, de chat over " +
        "deze pagina, de documenten en het mailvenster. Niet een tweede, magere samenvatting die kan achterlopen, " +
        "maar dezelfde kaart. **De opengeklapte taak wordt daarbij uit de lijst gelicht**: een eigen blok met een " +
        "rand, een oranje streep ernaast en lucht eromheen, terwijl de andere regels in dezelfde kaart zolang op " +
        "de achtergrond stappen. Zonder dat onderscheid liep de open kaart visueel door in de taak eronder, en " +
        "leek die er nog bij te horen.\n\n" +
        "**Aantekeningen bewaren zichzelf, ook als je meteen wegklikt.** Er stond al een wachtklok tijdens het " +
        "typen, maar die dekte maar één geval. Klapte je de taak dicht voordat die klok afliep, dan was je tekst " +
        "weg, en datzelfde gold voor doorklikken naar een ander scherm of het tabblad sluiten. Nu wordt er " +
        "weggeschreven na een korte stilte tijdens het typen, zodra je buiten het veld klikt, op het moment dat " +
        "de taak dichtklapt, en als het tabblad naar de achtergrond gaat. De laatste twee gaan mee met een " +
        "verzoek dat de browser afmaakt ook als het scherm al weg is; anders sneuvelt het precies dán.\n\n" +
        "**Zelf een taak toevoegen is één regel typen.** Er stonden eerder drie dingen bij: een apart veld voor " +
        "de pagina, een keuze SEO / sitebouwer / klant, en een regel die herhaalde op welke dag hij zou komen. " +
        "Alle drie eruit. De dag zet je zelf met de datumknop op de regel, het werk komt hoe dan ook langs " +
        "Maarten, en over welke pagina het gaat wordt uit je eigen zin gelezen: typ je een pad of een link " +
        "(\"/hovenier/oosterhout/ ontwikkelen\"), dan hangt de taak meteen aan die pagina, met de zeven fases " +
        "erbij. Om dezelfde reden is de badge SEO/DEV vóór elke taaknaam verdwenen.\n\n" +
        "**De kaart heeft een vaste titel:** het pad plus wat we ermee doen, bijvoorbeeld " +
        "\"/hovenier/etten-leur/ · herstellen\". Dat is geen opmaak-keuze maar een reparatie: er werd bij elke keer " +
        "laden een nieuwe opdracht met een plusje achter de titel geplakt, tot 190 tekens, en één kaart stond " +
        "daardoor op 183 tekens. Losse opdrachten staan nu ín de kaart onder \"Opdrachten\". Schrijf je zelf een " +
        "titel, dan blijft die staan.\n\n" +
        "**Elke kaart heeft een archief.** Wat van de kaart af gaat blijft bewaard met datum: een eerdere titel, " +
        "een kaarttekst voordat hij werd opgeschoond, en regels die niet meer pasten. Daarvóór werd de tekst op " +
        "vierduizend tekens afgekapt zonder melding, en stonden er kaarten precies op die grens. Er verdween dus " +
        "informatie die niemand miste. Nu schuift wat niet past naar het archief in plaats van te verdwijnen.\n\n" +
        "**Alles staat op één plek.** De vinkjes van de fases stonden ook nog als losse chips in het paginablok, " +
        "opgehaald via een tweede aanvraag, dus ze konden zelfs iets anders zeggen. Doorzetten naar de sitebouwer " +
        "stond op drie plekken. Dat is teruggebracht tot één.\n\n" +
        "**Het verhaal komt niet meer dubbel te staan.** \"Waarom deze pagina\" en \"Aanpak en afspraken\" zijn de " +
        "geschreven kant van een kaart; \"Waar deze pagina staat\" leest live mee met de mailbox. Zodra dat laatste " +
        "blok echt iets gevonden heeft, is dat actueler dan de geschreven tekst, dus verdwijnen de eerste twee: " +
        "hetzelfde verhaal twee keer, op een ander moment opgeschreven, is geen extra informatie. Bij een verse " +
        "kaart zonder mailgeschiedenis, of een taak zonder pagina, blijft de geschreven tekst gewoon de enige bron.",
    },
    {
      titel: "De paginalijst bouwt op vier bronnen, niet alleen de sitemap",
      kern: "Een live pagina die niet in de sitemap staat, valt niet meer stil weg.",
      tekst:
        "De paginalijst (de spiegel van de live site) bouwde eerst alleen op de sitemap. Daardoor was een " +
        "pagina die live stond maar niet in de sitemap zat, voor het hele dashboard onzichtbaar; bij One Day " +
        "Clinic gold dat voor een pagina die op ruim twintig zoektermen rankte.\n\n" +
        "Bij het inlezen van de website worden nu vier bronnen verenigd: de **sitemap**, de pagina's die " +
        "**Search Console** kent, de **Ahrefs**-toppagina's en de **interne links** die tijdens het scannen op " +
        "de pagina's zelf gevonden worden. Per pagina wordt bewaard waar hij vandaan komt. Een live pagina " +
        "zonder sitemap-vermelding krijgt het label **niet in sitemap**: dat is zelf een bevinding, want zo'n " +
        "pagina bestaat wel maar wordt door de site niet opgegeven, en dat maakt hem voor Google slechter " +
        "vindbaar. Boven de lijst staat hoeveel van zulke pagina's er zijn.\n\n" +
        "Sinds 12 augustus 2026 hoort daar de **sitemap-check** bij (link bij Zoekwoorden & links en bij de " +
        "paginalijst): die haalt de sitemap van de klant vers op en laat drie dingen zien: of de sitemap zelf " +
        "bereikbaar is en of robots.txt ernaar verwijst, welke live pagina's erin missen (met hun vertoningen, " +
        "belangrijkste bovenaan), en welke regels erin naar een omgeleide of verdwenen pagina wijzen. Daarmee " +
        "is \"de sitemap is niet actueel\" geen vermoeden meer maar een lijst die je aan de sitebeheerder geeft.",
    },
    {
      titel: "De werklijst voor de sitebouwer",
      kern: "Eén link, alleen zijn eigen werk, geen inlog nodig.",
      tekst:
        "Wie de site bouwt heeft geen dashboard nodig, alleen zijn lijstje. Daarom is er een deelbare link " +
        "zonder inlog met precies de punten die hij moet afwerken, bijvoorbeeld de suggesties over beeld.\n\n" +
        "Dezelfde lijst heeft in de cockpit een tweede gezicht, met de huidige tekst boven het voorstel, de " +
        "knop om het rechtstreeks in de site te zetten, en de keuze of een afbeelding uniek moet zijn.\n\n" +
        "Waarom die splitsing er is: eerst stond alles per pagina uitgeklapt onder elkaar en was vrijwel elke " +
        "regel geblokkeerd tot iemand een foto verving. Dat werd een muur van tientallen schermen hoog waar " +
        "niemand aan begon.\n\n" +
        "**Sinds 6 augustus 2026 staat het paginawerk er ook op.** Zet je een projectkaart door met de knop " +
        "\"Zet klaar voor de sitebouwer\", dan kiest een venster wat hij krijgt: de opdracht in jouw woorden, welke " +
        "teksten meegaan (de herziene versie van de klant of onze eigen copy, dat is een keuze) en wat er straks " +
        "meetbaar af moet zijn. Dat verschijnt als eigen blok op ditzelfde adres, boven de meta- en alt-teksten.\n\n" +
        "Dat was een gat: een doorgezette kaart belandde op een scherm achter de inlog, terwijl de deelbare lijst " +
        "alleen losse velden bevatte. Zijn grootste werk stond dus op een plek waar hij niet komt. Ook met een " +
        "WordPress-koppeling blijft dit blok staan, want een hele pagina live zetten kan geen knop van ons.",
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
        "**En op de projectkaart staat de knop \"Is dit doorgevoerd?\"** Die meet de live pagina op precies de " +
        "punten die bij het doorzetten zijn afgesproken: staat hij live, staan de geschreven koppen erop, staat " +
        "de structured data erop. Het antwoord landt op drie plekken: bovenin de kaart met het bewijs per punt, " +
        "als één regel in de kaarttekst die de vorige controle vervángt, en in de tijdlijn met de pagina als " +
        "bewijs. Klopt alles, dan gaat het vinkje bij Implementatie om; klopt het niet, dan biedt de kaart een " +
        "mail aan de sitebouwer aan met de gemeten waarde erin.\n\n" +
        "Eén regel is belangrijker dan de meting zelf: **een mislukte meting is nooit een oordeel.** Weigert de " +
        "site ons of laadt de pagina niet, dan is de uitslag \"kon ik niet meten\" en verandert er niets. " +
        "Beweren dat iets niet gedaan is terwijl je het niet gezien hebt, is erger dan niets weten. De aanleiding " +
        "is concreet: in januari 2026 kon niemand vaststellen of zes interne links nu wel of niet verdwenen waren.\n\n" +
        "**Sinds 11 augustus 2026 telt \"Is dit doorgevoerd?\" ook echt mee als bewijs voor de copy.** Eerder " +
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
    {
      titel: "Wat we gedaan hebben",
      kern: "Per maand een compleet overzicht van het uitgevoerde werk.",
      tekst:
        "Alles wat er voor een klant is uitgevoerd staat per maand op één plek: copy, meta's, alt-teksten, " +
        "structured data en redirects. Dat is niet alleen verantwoording naar de klant, het is ook het antwoord " +
        "op 'wat hebben we hier vorig jaar eigenlijk gedaan' als er iemand anders op het account komt.",
    },
  ],
};
