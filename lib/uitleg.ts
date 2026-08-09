// ═══════════════════════════════════════════════════════════
// HET VERHAAL VAN HET DASHBOARD (levend document)
// ═══════════════════════════════════════════════════════════
// Dit bestand IS de uitleg. Eén bron, drie doelgroepen: klanten die willen
// weten wat ze kopen, bureaus die het willen gebruiken, en investeerders die
// willen weten wat hier eigenlijk gebouwd is. De pagina eromheen
// (app/uitleg/page.tsx) doet niets anders dan dit renderen als hoofdstukken met
// uitklappers.
//
// Twee regels houden dit document eerlijk:
//
//  1. NIETS ERIN WAT NIET IN DE CODE STAAT. Geen roadmap-taal die klinkt als
//     werkelijkheid. Wat nog niet werkt hoort in het hoofdstuk "Eerlijke
//     agenda", niet weggelaten en niet mooier gemaakt.
//  2. HOOFDSTUKKEN MET `intern: true` ZIJN ALLEEN VOOR INGELOGDE OGEN. De
//     gaten en de zwakke plekken staan er dus wél in, maar een klant of een
//     lead die de link krijgt ziet ze niet. Zo kan dit één document blijven in
//     plaats van twee versies die uit elkaar gaan lopen.
//
// Bijwerken: na elke noemenswaardige uitbreiding van het dashboard hier de
// betreffende uitklapper aanvullen en LAATST_BIJGEWERKT verzetten.
// ═══════════════════════════════════════════════════════════

export const LAATST_BIJGEWERKT = "9 augustus 2026 (R6: copy als concept naar WordPress; R9: ontwikkeling deze maand op het klantdashboard, gebouwd)";

export type Uitklapper = {
  titel: string;
  /** Eén regel die de kern samenvat, staat naast de titel in de dichte staat. */
  kern?: string;
  /** Markdown. Wordt gerenderd via lib/markdown.ts, dus nooit ruwe tekens in beeld. */
  tekst: string;
  sub?: Uitklapper[];
};

export type Hoofdstuk = {
  id: string;
  titel: string;
  /** Korte staande tekst boven de uitklappers. */
  intro: string;
  /** Alleen zichtbaar met een admin-sessie. */
  intern?: boolean;
  uitklappers: Uitklapper[];
};

// Drie leesroutes bovenaan. Bewust vier hoofdstukken per route en niet alles wat
// enigszins past: een route die bijna de hele inhoudsopgave herhaalt filtert
// niets en helpt dus niemand. De volledige lijst staat eronder.
export const LEESROUTES: { label: string; regel: string; hoofdstukken: string[] }[] = [
  {
    label: "Ik ben klant",
    regel: "Wat er voor mijn site gebeurt, en wat ik ervan zie.",
    hoofdstukken: ["waarom", "koppelingen", "documenten", "werk"],
  },
  {
    label: "Ik ben bureau",
    regel: "Hoe ik dit voor mijn eigen klanten zou gebruiken.",
    hoofdstukken: ["gebruik", "motoren", "opzet", "veiligheid"],
  },
  {
    label: "Ik kijk zakelijk",
    regel: "Wat hier gebouwd is, en waarom dat moeilijk na te maken is.",
    hoofdstukken: ["onderscheid", "motoren", "opzet", "bedrijfsvoering"],
  },
];

export const HOOFDSTUKKEN: Hoofdstuk[] = [

  // ── 1 ────────────────────────────────────────────────────
  {
    id: "waarom",
    titel: "Waarom dit bestaat",
    intro:
      "SEO is geen gebrek aan informatie, het is een gebrek aan besluitvorming. Er zijn tientallen tools die " +
      "problemen kunnen opsommen. Er is bijna niets dat zegt: dít eerst, dat later, dit nooit, en dat vervolgens " +
      "ook uitvoert en naderhand nameet.",
    uitklappers: [
      {
        titel: "Het Google-profiel: de beheerdeur staat nog dicht",
        tekst:
          "De profielscan draait op de meetdeur (Google Maps), en die werkt zodra er een `GOOGLE_MAPS_API_KEY` " +
          "in de omgeving staat. De beheerdeur (de Business Profile API) is gebouwd en aangesloten, maar Google " +
          "geeft daar pas data op na een goedkeuringsaanvraag met een beoordelingstermijn van maximaal twee " +
          "weken, en het profiel moet minstens zestig dagen geverifieerd zijn.\n\n" +
          "Zolang die goedkeuring er niet is blijven zes dingen ongemeten: de bezoekcijfers, de " +
          "bedrijfsomschrijving, de feestdagen, de posts, de vragen en of er op reviews geantwoord is. Het " +
          "scherm zegt dat met zoveel woorden in plaats van die punten weg te laten, maar het blijft een gat.\n\n" +
          "Twee dingen zijn ook mét beheertoegang nog niet aangesloten: de attributen van een profiel " +
          "(rolstoeltoegankelijk, parkeren) worden niet opgehaald, en de reviewteksten van concurrenten worden " +
          "niet geanalyseerd op waar hun klanten over schrijven. Dat laatste is waarschijnlijk het meest " +
          "waardevolle dat er nog bij kan.",
      },
      {
        titel: "Het probleem waar elk SEO-bureau tegenaan loopt",
        kern: "Veel data, weinig besluit, en niemand die het bijhoudt.",
        tekst:
          "Een gemiddeld SEO-traject leunt op vier of vijf losse systemen: Search Console voor de cijfers, Ahrefs " +
          "voor zoekwoorden en links, een crawler voor de techniek, een spreadsheet voor de planning en mail voor " +
          "de communicatie. Niemand van die vijf weet wat de andere vier al hebben gezegd.\n\n" +
          "Dat levert drie voorspelbare problemen op:\n\n" +
          "- **Hetzelfde cijfer op twee plekken, met twee uitkomsten.** Wie dan wint is willekeur.\n" +
          "- **Adviezen zonder rangorde.** Een lijst van 240 bevindingen is geen plan. Het is uitstelgedrag met een export-knop.\n" +
          "- **Geen geheugen.** Wat vorige maand is aangepast, waarom, en wat het opleverde: dat zit in iemands hoofd of in een mailbox.\n\n" +
          "Het gevolg is dat de meeste uren in een SEO-traject niet naar het werk gaan, maar naar het herbepalen " +
          "van wat het werk was.",
      },
      {
        titel: "Wat dit dashboard daar anders in doet",
        kern: "Meten, oordelen en uitvoeren zitten in één keten, met één geheugen.",
        tekst:
          "Het dashboard is geen zesde tool naast de andere vijf. Het is de laag eronder die ze allemaal uitleest " +
          "en er één werkelijkheid van maakt, per klant, per pagina, met datum.\n\n" +
          "Vier keuzes maken het verschil:\n\n" +
          "1. **Meten en oordelen zijn streng gescheiden.** Wat er op een pagina staat wordt gemeten uit de live " +
          "HTML en draagt zijn eigen bewijs mee (de gevonden ankertekst, het gevonden pad, op hoeveel pagina's). " +
          "Pas daarna mag een AI er iets van vinden, en alleen bovenop die cijfers.\n" +
          "2. **Elke bevinding krijgt een rangorde en een prijskaartje.** Niet 240 punten, maar vier bakjes: deze " +
          "week, deze maand, dit kwartaal, strategisch. Plus een bakje 'niet doen', met de reden erbij.\n" +
          "3. **Van bevinding naar uitvoering is één klik.** Een zwakke meta-title wordt een voorstel, een " +
          "goedkeuring, een wijziging op de live site en daarna een meting van het effect.\n" +
          "4. **Alles wordt onthouden.** Ongeveer tachtig tabellen houden per klant bij wat er gemeten is, wat " +
          "er besloten is, wat er uitgevoerd is en wat het deed.",
      },
      {
        titel: "Voor wie het gebouwd is",
        kern: "Eén codebase, drie soorten gebruikers, drie merken al live.",
        tekst:
          "- **Het bureau (de dagelijkse gebruiker).** Opent een klant, ziet wat er te doen is, kiest een paar " +
          "acties en laat het dashboard het zware werk doen.\n" +
          "- **De klant.** Logt in op een eigen dashboard en ziet in gewone taal wat er gebeurt, wat het kost en " +
          "wat het oplevert. Geen jargon, geen ruwe data.\n" +
          "- **De sitebouwer of externe partij.** Krijgt een link zonder inlog naar precies dat ene lijstje dat " +
          "hij moet afwerken, en niets anders.\n\n" +
          "Dat is geen theorie: dezelfde codebase draait al onder drie merken (Pingwin, het Nationaal Oogcentrum " +
          "en een derde omgeving), waarbij het project zelf bepaalt welke naam, favicon en huisstijl je ziet.",
      },
    ],
  },

  // ── 2 ────────────────────────────────────────────────────
  {
    id: "opzet",
    titel: "Hoe het is opgezet",
    intro:
      "Twee lagen in één applicatie, één vaste URL, en de login bepaalt wie wat ziet. Daaronder een database die " +
      "zichzelf op orde houdt en een reeks koppelingen die de data ophalen.",
    uitklappers: [
      {
        titel: "De twee lagen: cockpit en klantdashboard",
        kern: "Hetzelfde ontwerp, andere diepte, gescheiden door de login.",
        tekst:
          "**De cockpit** is de werkplek van het bureau. Per klant een eigen commandocentrum met alles erin: " +
          "taken, pagina's, analyses, documenten, mail, resultaten en de site-brede gereedschappen.\n\n" +
          "**Het klantdashboard** is wat de klant ziet na inloggen: het maandoverzicht van de werkzaamheden, de " +
          "uren en het budget, en de documenten die voor hem klaargezet zijn. Er kan ook een blok " +
          "\"Ontwikkeling deze maand\" bij staan, in gewone taal: hoe de klikken en vertoningen vanuit Google " +
          "zich ontwikkelden en welke aanpassingen er op de site zijn doorgevoerd. Dat blok staat standaard uit " +
          "en gaat pas aan als het bureau het per klant heeft aangezet, vanuit de voorbeeldweergave.\n\n" +
          "Er is één URL voor alles. Wie inlogt bepaalt wat er verschijnt. Een klant kan niet bij een andere " +
          "klant komen, en het bureau kan bij iedereen, inclusief een voorbeeldweergave van hoe het dashboard " +
          "van die klant er voor de klant zelf uitziet.",
      },
      {
        titel: "De navigatie van de cockpit",
        kern: "Zes knoppen, niet elf tabjes.",
        tekst:
          "De cockpit had op een gegeven moment elf tabjes naast elkaar, en dat is precies één tabje meer dan een " +
          "mens overziet. Nu zijn het zes ingangen, waarvan twee uitklapmenu's:\n\n" +
          "| Ingang | Wat je er doet |\n" +
          "|---|---|\n" +
          "| **Taken** | Het startscherm: je prioriteiten, de gesprekken en de planning per dag en week |\n" +
          "| **Pagina's** | Elke pagina van de site: hoe hij scoort, wat eraan gedaan is, wat er nog moet |\n" +
          "| **Site-breed** | Prioriteitenscan, Meta en CTR, Opruimen, Interne links, Google-profiel |\n" +
          "| **Klant** | Documenten, Wat we doen, Wijzigingen, Klantgegevens |\n" +
          "| **KPI's** | Posities, vertoningen, klikken en de ontwikkeling daarvan |\n" +
          "| **Developer** | Alle developer-taken over alle klanten heen |\n\n" +
          "Daarnaast zitten er aan de rechterrand twee inschuifbare zijpanelen, op elk tabblad bereikbaar. " +
          "'Zoekwoorden & links' heeft de afgesproken strategie links in een vrij tekstveld en rechts een kolom " +
          "met snel aan te klikken landingspagina's. 'Links' bundelt de bronnen die het overzicht voeden of zouden " +
          "moeten voeden (Search Console, Analytics, Ads, Google-profiel, klantprofiel, tone of voice, " +
          "concurrentieanalyse, structured data, documenten): elke regel springt naar het scherm waar je hem " +
          "beheert en laat pas na openklikken zien of hij gevuld of gekoppeld is.\n\n" +
          "**Wisselen van klant gaat via de kiezer linksboven.** Die toont de eigen klanten meteen; de klanten van " +
          "een aangesloten bureau en de leads staan elk achter één regel die je openklikt, want die heb je meestal " +
          "niet nodig en ze duwen de rest uit beeld. Zit je zelf in zo'n groep, dan staat die vanzelf open. " +
          "Bovenin staat een zoekveldje, en zodra je typt gaan alle groepen open, anders zou een treffer in een " +
          "dichtgeklapte groep onvindbaar zijn. Leads staan bewust niet meer tussen de klanten: dat is een bedrijf " +
          "waar nog niets voor gedaan wordt.",
      },
      {
        titel: "Fundament: wat er per klant al staat en wat nog moet",
        kern: "Tone of voice, structured data, concurrenten, concurrentieanalyse, bedrijfsprofiel en positionering, in één oogopslag.",
        tekst:
          "Twee schermen, dezelfde rekenregel. **/admin/fundament** toont alle klanten naast elkaar: per klant " +
          "zes statuspunten, en bovenaan hoeveel klanten elk punt al hebben staan. Op de klant-tab " +
          "**Klantgegevens** staat hetzelfde overzicht voor die ene klant, met de knoppen om het af te maken " +
          "erbij.\n\n" +
          "De zes punten:\n\n" +
          "| Punt | Bron |\n" +
          "|---|---|\n" +
          "| Tone of voice | de tone of voice-sectie in het klantprofiel (Pagina's-tab) |\n" +
          "| Bedrijfsprofiel | de klantprofiel-sectie in datzelfde veld |\n" +
          "| Structured data | de bedrijfsgegevens: leeg, ingevuld, of vergrendeld |\n" +
          "| Concurrenten | de gap-analyse-lijst: 2 tot 4 domeinen |\n" +
          "| Concurrentieanalyse | geen los document: volgt automatisch uit positionering |\n" +
          "| Positionering | het afgeronde positioneringsadvies, als Drive-link |\n\n" +
          "Concurrentieanalyse heeft bewust geen eigen invoerveld. De positionering-skill benchmarkt altijd al " +
          "tegen de concurrenten, dus een los document ervoor uitvragen zou vragen om iets dat nooit apart " +
          "bestaat.",
      },
      {
        titel: "Technisch: waar het op draait",
        kern: "Next.js op Vercel, Postgres, geen UI-library.",
        tekst:
          "- **Applicatie:** Next.js 14 (App Router) met TypeScript en React 18. Server-side waar het om data " +
          "gaat, client-side waar het om interactie gaat.\n" +
          "- **Database:** eigen Postgres (Neon), ongeveer tachtig tabellen, alles per klant gescheiden.\n" +
          "- **Hosting:** Vercel. Een push naar de hoofdlijn is een productie-deploy.\n" +
          "- **Vormgeving:** handgeschreven CSS op een vast fundament van schaal-tokens (afstanden, tekstgroottes, " +
          "rondingen, schaduwen) met gedeelde bouwstenen. Geen Tailwind, geen componentbibliotheek, dus geen " +
          "vreemde huisstijl die er doorheen komt.\n" +
          "- **Documenten:** Word-documenten worden in de applicatie zelf opgebouwd in de Pingwin-huisstijl, " +
          "Excel-exports idem.\n" +
          "- **Crawlen:** een echte browser (headless Chromium) voor pagina's die JavaScript nodig hebben, en een " +
          "snelle HTML-modus voor de rest.",
      },
      {
        titel: "De database houdt zichzelf op orde",
        kern: "Geen migratiescripts, de app repareert haar eigen schema.",
        tekst:
          "Een nieuwe kolom of tabel wordt niet met een handmatig script uitgerold, maar bij het eerste gebruik " +
          "aangemaakt als hij nog niet bestaat. Dat is een bewuste keuze: het bureau dat dit gebruikt hoeft geen " +
          "database-beheerder te zijn, en een nieuwe omgeving is binnen een minuut werkend.\n\n" +
          "Praktisch gevolg: dit dashboard uitrollen voor een tweede bureau is een kwestie van een leeg project, " +
          "een database en de sleutels van de koppelingen. Niet een migratietraject.",
      },
      {
        titel: "De opmaak kan niet meer per scherm afwijken",
        kern: "Eén set bouwstenen, en een poort die de bouw stopt als een scherm zijn eigen gang gaat.",
        tekst:
          "Elk scherm dat je hier ziet is opgebouwd uit dezelfde bouwstenen: een paneel, een blok, een stuk " +
          "tekst, een signaal, een label, een tabel. Wat die eruit laten zien staat op één plek, en niet per " +
          "scherm opnieuw. Losse tekst gaat altijd door dezelfde renderlaag, dus er komen nooit ruwe " +
          "opmaaktekens in beeld, en elk pad naar een pagina wordt vanzelf een klikbare link.\n\n" +
          "Belangrijker is wat er gebeurt als iemand dat tóch omzeilt. **Vóór elke keer dat het dashboard " +
          "opnieuw gebouwd wordt, draait er een controle** die kijkt of een scherm zijn eigen lettergroottes, " +
          "afstanden, kleuren of rondingen verzint, of tekst ongerenderd doorlaat. Gebeurt dat, dan mislukt de " +
          "bouw en komt het niet live. De opmaak hangt dus niet af van wie er die dag oplet.\n\n" +
          "De schermen van vóór 6 augustus 2026 staan op een lijst met uitzonderingen, want die in één keer " +
          "verbouwen zou werkende schermen breken. Die lijst mag alleen korter worden: een verbouwd scherm gaat " +
          "eraf en kan daarna niet meer terugvallen. Het kan dus alleen nog beter worden, nooit slechter. " +
          "Aanleiding was simpel: de opmaakregel stond al twintig keer opgeschreven en werd toch gemist, omdat " +
          "een regel in een document op geheugen leunt en een poort niet.",
      },
      {
        titel: "Eén codebase, meerdere merken",
        kern: "Het project bepaalt het merk, niet de code.",
        tekst:
          "De naam, de favicon en de accenten volgen uit welke omgeving er draait. Dezelfde code levert dus een " +
          "Pingwin-dashboard, een dashboard voor een zorginstelling met hun eigen merk, en een derde omgeving, " +
          "zonder aparte takken of losse kopieën.\n\n" +
          "Dat is de basis onder een licentiemodel: een bureau krijgt zijn eigen omgeving met zijn eigen merk, " +
          "zijn eigen database en zijn eigen sleutels, terwijl de motor voor iedereen dezelfde blijft en dus " +
          "voor iedereen tegelijk beter wordt.",
      },
    ],
  },

  // ── 3 ────────────────────────────────────────────────────
  {
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
          "doen over het gebruikte plugin.",
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
  },

  // ── 4 ────────────────────────────────────────────────────
  {
    id: "motoren",
    titel: "De motoren: hoe de analyses werkelijk gebeuren",
    intro:
      "Dit is het hart. Elke motor hieronder is een zelfstandige analyse met een eigen scherm, eigen opslag en " +
      "eigen bewijsvoering. Ze delen dezelfde metingen, zodat hetzelfde cijfer nooit op twee tabjes anders staat.",
    uitklappers: [
      {
        titel: "De meetlaag: staat het er echt op?",
        kern: "Geen model bepaalt of iets gedaan is. Dat wordt gemeten, met bewijs.",
        tekst:
          "Alles begint hier. Van elke pagina wordt uit de live HTML gehaald wat er werkelijk staat, en elke " +
          "uitkomst draagt zijn eigen bewijs mee: de gevonden ankertekst, het gevonden pad, op hoeveel pagina's " +
          "iets voorkomt.\n\n" +
          "Waarom dit zo streng gescheiden is van de AI: een model dat een plausibel verhaal kan vertellen doet " +
          "dat ook als de meting ontbreekt. Wat in de meetlaag staat kan niet liegen. Wat een model ervan vindt " +
          "komt pas daarna, en alleen bovenop die cijfers.\n\n" +
          "Het belangrijkste onderscheid van deze laag: een link in het menu of de footer is iets anders dan een " +
          "link in de lopende tekst. Zonder dat verschil haalt elke pagina automatisch een voldoende op interne " +
          "links, en dat is dan een meting die niets meet.",
      },
      {
        titel: "De paginascore: een thermometer per pagina",
        kern: "Nul tot honderd, puur rekenwerk, elke keer dezelfde uitkomst.",
        tekst:
          "Een score van 0 tot 100 per pagina, gerekend op de gegevens die de wekelijkse scan toch al vastlegt. " +
          "Geen AI, dus gratis, direct klaar en reproduceerbaar.\n\n" +
          "Twee correcties houden de score eerlijk:\n\n" +
          "1. **Menu en footer tellen niet mee.** Die staan op elke pagina, dus zonder correctie scoort iedereen " +
          "hetzelfde op interne links en zakt iedereen op alt-teksten.\n" +
          "2. **Wat niet van toepassing is kost geen punten.** Heeft een pagina geen eigen afbeeldingen, dan " +
          "vervalt dat onderdeel uit de som in plaats van dat de pagina er eeuwig onder blijft hangen.\n\n" +
          "De score is bedoeld om in één oogopslag te zien welke pagina's het meeste werk nodig hebben, niet om " +
          "een analyse te vervangen.",
      },
      {
        titel: "De prioriteitenscan: dit eerst, dat later, dit niet",
        kern: "Site-breed, in vier tiers, met verwachte opbrengst per bevinding.",
        tekst:
          "Dit is de motor die van een berg signalen een werkplan maakt. Hij kijkt site-breed en levert vier " +
          "bakjes op: deze week, deze maand, dit kwartaal, strategisch. Plus een vijfde bakje: niet doen, met de " +
          "reden erbij.\n\n" +
          "Twee dingen zijn hier expliciet zo gebouwd:\n\n" +
          "1. **De vier lenzen die al als motor in het dashboard draaien (meta en CTR, opruimen, interne links, " +
          "AI-vindbaarheid) worden uitgevraagd, niet opnieuw opgehaald.** Anders staat hetzelfde cijfer op twee " +
          "tabjes verschillend, en dat is precies de fout die dit dashboard wil uitsluiten.\n" +
          "2. **De scan draait in hervatbare stappen met een tussenstand na elke stap.** Serverless kapt een lang " +
          "venster af, en dan stond een analyse veertig minuten op 'bezig' zonder ooit iets op te leveren. Nu " +
          "pakt een achtergrondwerker een run zonder hartslag gewoon weer op.\n\n" +
          "**De volgorde op het scherm komt uit de kansrijkheid, niet uit het zoekvolume** (6 augustus 2026). " +
          "Zoekvolume maal klikkans weet niet of iemand wil kopen en niet of een zoekwoord bij deze klant past; " +
          "daarmee stond bij een hovenier het landelijke woord 'voortuin' bovenaan. De kolom Kansrijk (1 tot 100) " +
          "weegt de te winnen bezoekers, de koopgerichtheid, de merk-fit en de hoeveelheid werk samen, en bepaalt " +
          "nu de volgorde. Honderd is de beste kans van díe scan, dus het is een onderlinge vergelijking en geen " +
          "rapportcijfer.\n\n" +
          "**De mail aan de klant is een gewone mail, geen rapport** (6 augustus 2026). Hij ging eerst langs de " +
          "opgemaakte weg, met een oranje kopbalk en vier vaste kaders, en las daardoor als een reclamemail uit een " +
          "tool. Nu is het een persoonlijke mail: aanhef, korte alinea's, ondertekening onderaan. Drie dingen zorgen " +
          "dat hij niet alsnog een sjabloon wordt. **Eén:** het dashboard leidt uit Maartens eigen verzonden mails " +
          "aan klanten een schrijfprofiel af, dat in élke klantmail meegaat (te lezen en bij te stellen op " +
          "`/admin/schrijfstijl`; mails aan collega's en mails die het dashboard zelf schreef tellen niet mee). " +
          "**Twee:** de mail krijgt de klantkennis mee die er al is, dus de propositie, het werkgebied, de diensten " +
          "en de concurrenten, met de opdracht er één concreet ding uit te noemen en niets bij te verzinnen. " +
          "**Drie:** per mail wordt een andere invalshoek gekozen (de zoekvraag, hun eigen site, wie de zoeker is, " +
          "de concurrentie) en een ander stuk werkwijze genoemd; wat een klant al gehad heeft wordt onthouden. " +
          "Zonder dat laatste openen tien nieuwe-pagina-mails alle tien hetzelfde, en dat is precies het risico " +
          "wanneer 36 van de 50 kansen van dezelfde soort zijn.\n\n" +
          "**Elke kans heeft een onderbouwing in klanttaal:** wat we zagen, waarom het de moeite waard is, wat we " +
          "gaan doen en wat het kan opleveren. Die ene tekst voedt drie plekken (het scherm, de kaart in de " +
          "weekplanning en de mail aan de klant), zodat er geen drie versies van hetzelfde verhaal ontstaan.",
        sub: [
          {
            titel: "Hoe een bevinding gescoord wordt",
            tekst:
              "Elke bevinding krijgt een score uit vier onderdelen:\n\n" +
              "- **Verwachte opbrengst.** Hoeveel extra klikken kan dit realistisch opleveren? Dat wordt gerekend " +
              "met een conservatieve tabel van verwachte klikpercentages per Google-positie, tegen de vertoningen " +
              "die de pagina nu al haalt. Geen bedachte cijfers.\n" +
              "- **Zekerheid.** Hoe hard is het signaal? Een gemeten CTR-gat is harder dan een vermoeden over " +
              "zoekintentie, en dat verschil zit in de score.\n" +
              "- **Inspanning.** Een meta-title herschrijven is geen nieuwe landingspagina bouwen.\n" +
              "- **Past het bij deze klant?** Een koopgericht zoekwoord binnen het werkgebied van de klant weegt " +
              "zwaarder dan een informatieve term daarbuiten. Het werkgebied wordt uit de eigen data van de klant " +
              "gehaald, niet gevraagd.",
          },
          {
            titel: "Die zin hoeft niet zelf bedacht te worden (7 augustus 2026)",
            tekst:
              "Naast het invulveld staat een knop **'Stel een zin voor'**. Die vult het veld met een voorstel op " +
              "basis van wat er al over de klant bekend is: het klantprofiel en de bedrijfsgegevens. Geen nieuwe " +
              "analyse van de site, want die twee leveren dat al op; dit hergebruikt dat werk. Is er nog geen " +
              "klantprofiel en geen dienst ingevuld, dan zegt de knop dat en blijft het veld leeg. Het voorstel " +
              "wordt nooit vanzelf opgeslagen; dat gebeurt pas na een klik op 'Bewaren'.",
          },
          {
            titel: "Waarom er ook een bakje 'niet doen' is",
            tekst:
              "Elke tool die alleen kansen opsomt maakt de gebruiker onzekerder, niet zekerder. Een advies is " +
              "pas een advies als er ook iets afvalt. Wat afvalt komt met reden in beeld, zodat het een besluit " +
              "is en geen vergissing.",
          },
          {
            titel: "Aanvragen in plaats van bezoek, waar dat gemeten kan worden (7 augustus 2026)",
            tekst:
              "Bezoekers zijn niet waar een klant voor betaalt; hij betaalt voor aanvragen. Twee pagina's kunnen " +
              "even vaak in Google verschijnen terwijl de ene tien keer zo veel klanten oplevert als de andere, " +
              "en dat verschil zag de volgorde tot nu toe nergens.\n\n" +
              "Meet Google Analytics voor een klant al hoeveel bezoekers op een pagina daadwerkelijk een aanvraag " +
              "doen (een ingevuld formulier, een telefoontje, een bestelling, ingericht als GA4-conversie), dan " +
              "gebruikt de scan dat gemeten cijfer per pagina in plaats van een schatting. Een pagina die beter " +
              "converteert dan het gemiddelde van de site schuift dan omhoog in de kansrijkheid, een pagina die " +
              "slechter converteert zakt; bij de meeste kansen staat het aantal verwachte aanvragen per maand " +
              "erbij in plaats van het aantal bezoekers. Is er een geldbedrag per aanvraag bekend (hetzelfde " +
              "getal dat ook de opruimlijst in euro's zet), dan telt dat bedrag automatisch mee.\n\n" +
              "Heeft een klant geen GA4-conversies ingericht, of is er voor een pagina te weinig verkeer gemeten " +
              "om op te vertrouwen, dan verandert er niets: de scan blijft gewoon in bezoekers rekenen, met een " +
              "zin in de samenvatting die dat zegt.",
          },
        ],
      },
      {
        titel: "Meta en CTR: de klikwinst die er al ligt",
        kern: "Veel vertoningen, te weinig klikken, en dat is direct te repareren.",
        tekst:
          "Dit is de snelste winst in SEO en tegelijk de meest verwaarloosde: pagina's die al goed staan maar te " +
          "weinig klikken krijgen voor hun positie. Die motor rekent het gat uit tussen wat een pagina op die " +
          "positie hoort te halen en wat hij echt haalt.\n\n" +
          "Drie bronnen komen hier samen:\n\n" +
          "1. **Search Console:** hoe vaak vertoond, hoe vaak geklikt, hoeveel klikken blijven liggen.\n" +
          "2. **De laatste meting van de pagina zelf:** wat staat er nu, en voldoet dat aan de harde regels " +
          "(lengte, pixelbreedte, zoekwoord voorin, geen dubbele titels). Daardoor komen ook pagina's in beeld " +
          "die te weinig vertoningen hebben voor Search Console maar wél een kapotte meta hebben.\n" +
          "3. **Het copydocument:** staat de meta daar al in, dan is dát de tekst.\n\n" +
          "De reden waarom een pagina in de lijst staat gaat mee naar het scherm, zodat 'laat klikken liggen' en " +
          "'is stuk' niet door elkaar lopen. Op dit tabblad staat bewust élke pagina, niet alleen de dertig " +
          "grootste kansen, want dit is het werkstuk voor meta's.\n\n" +
          "De keten is af: voorstel, goedkeuren, doorvoeren op de site, terugcontroleren, en daarna het effect " +
          "nameten in Search Console (klikpercentage voor en na).",
      },
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
      {
        titel: "Interne links: autoriteit gericht doorsturen",
        kern: "Niet 'meer links', maar de juiste links, gewogen op waarde en relevantie.",
        tekst:
          "Deze motor bouwt de interne linkgraaf uit een echte crawl van de belangrijkste pagina's: per pagina de " +
          "uitgaande interne links met hun ankertekst. Daar komt de Search Console-data bij (positie en klikken " +
          "per pagina), de zoekvolumes uit Ahrefs en de autoriteit van elke losse pagina.\n\n" +
          "Wat er dan berekend wordt:\n\n" +
          "- **Welke bronpagina's het beste naar een doelpagina linken**, gewogen op hoeveel waarde die " +
          "bronpagina kan doorgeven én hoe inhoudelijk relevant hij is. Beide, niet één van de twee.\n" +
          "- **Click depth vanaf de homepage.** Hoeveel klikken is een pagina verwijderd van de voordeur?\n" +
          "- **Welke pagina's het waard zijn om te versterken, met het aantal extra bezoekers erbij.** Je krijgt " +
          "een lijstje met pagina's die al in de buurt van de top staan, en per pagina hoeveel bezoekers per " +
          "maand het ongeveer oplevert als hij een paar plekken stijgt. Die schatting gebruikt dezelfde " +
          "klikkans-curve als de rest van het dashboard, dus het is geen tweede rekensom naast de " +
          "prioriteitenscan. De doelpositie is bewust bescheiden: van plek 8 naar 4, niet naar 1, want interne " +
          "links geven een zet en geen sprong.\n" +
          "- **Bewaking van het ankerprofiel**, zodat je niet twintig keer dezelfde ankertekst plaatst en de " +
          "pagina over-optimaliseert.\n\n" +
          "**Autoriteit per pagina is gemeten, niet geschat** (6 augustus 2026). Van elke pagina wordt bij Ahrefs " +
          "de kracht van het eigen linkprofiel opgehaald: een cijfer van 0 tot 100 waarin zowel links van buiten " +
          "als interne links meetellen. Die schaal is logaritmisch, dus 8 is fors sterker dan 5, niet anderhalf " +
          "keer. Dat cijfer bepaalt nu voor de helft welke bronpagina's bovenaan het advies staan; de rest is het " +
          "aantal interne links dat er al binnenkomt en het verkeer van die pagina.\n\n" +
          "Twee dingen houden dat eerlijk. **Bij elke voorgestelde bronpagina staat het cijfer met de datum " +
          "erbij**, en of het gemeten is of benaderd: kent Ahrefs een pagina niet, dan krijgt hij de middenwaarde " +
          "van de site en staat dat er zichtbaar bij, in plaats van dat het als harde meting leest. En **het " +
          "cijfer op het scherm komt uit de meting zelf**, niet uit de tekst die de analyse erover schreef. " +
          "Ophalen gebeurt gebundeld (honderd pagina's per aanvraag) en blijft een maand geldig, dus een tweede " +
          "analyse kost geen nieuwe Ahrefs-credits.\n\n" +
          "Eén detail dat bijna een stille fout werd, en het staat er omdat het terug kan komen: de schuine " +
          "streep aan het eind van een adres. Ahrefs kent `/hovenier-den-bosch/` met autoriteit 6 en " +
          "`/hovenier-den-bosch` (dezelfde pagina, zonder die streep) helemaal niet. Die tweede geeft geen " +
          "foutmelding maar een nul, en het dashboard bewaart adressen zonder streep. Elke pagina van elke klant " +
          "zou dus \"geen autoriteit\" hebben geheten zonder dat iemand het merkte. Nu wordt van elk adres " +
          "allebei de vorm opgevraagd en telt de hoogste, en een proef legt dat vast.",
      },
      {
        titel: "Structured data",
        kern: "Van bedrijfsgegevens naar geldige schema-blokken, per pagina en site-breed.",
        tekst:
          "Er is één formulier per klant met de bedrijfsgegevens die een schema-blok nodig heeft. Dat wordt " +
          "automatisch gevuld vanaf de website, kan met de klant gedeeld worden via een link zonder inlog om na " +
          "te lopen en aan te vullen, en kan daarna vergrendeld worden.\n\n" +
          "Na die vergrendeling is dit de vaste bron voor alle structured data die het dashboard genereert: het " +
          "site-brede blok én het blok per pagina. Zo staat het adres van de klant op één plek en niet in dertig " +
          "losse stukjes code die uit elkaar gaan lopen.\n\n" +
          "Van elke pagina wordt ook gemeten welke schema-types er nú op staan, waarbij bewust een lijst wordt " +
          "bijgehouden van wat wél meetelt. Een zwarte lijst van hulptypes loopt altijd één stap achter.\n\n" +
          "Het hele formulier (algemene gegevens, vestigingen, bereikbaarheid, artsen, webshop-gegevens, " +
          "diensten, opmerkingen) staat standaard dicht onder één klapkopje 'Verzamelde structured data' " +
          "met het aantal dat nog ontbreekt; zo blijft de kaart compact, ook bij tientallen vestigingen of " +
          "artsen.\n\n" +
          "**Aanvullend op de plugin, niet vervangend.** Staat er al organisatie-schema van een SEO-plugin " +
          "(Yoast, Rank Math, AIOSEO) op de homepage, dan leest het dashboard dat eerst uit en knoopt het " +
          "site-brede blok aan diezelfde @id vast: naam, adres, telefoon en openingstijden blijven van de " +
          "plugin (die ze vanzelf actueel houdt), en Pingwins blok voegt alleen toe wat de plugin niet levert " +
          "(vestigingen, reviewcijfer, KVK/BTW, social-profielen). Zo hoeft de plugin niet aangepast te " +
          "worden en overleeft de aanvulling een plugin-update. Is er geen bestaand schema gevonden, dan " +
          "levert het dashboard het volledige, zelfstandige blok.\n\n" +
          "**Eén compacte knoppenrij bovenaan de kaart**, bewust tot zes knoppen teruggebracht: ontbrekende " +
          "gegevens ophalen, opslaan, vergrendelen, 'Delen met developer', 'Delen met klant', en de laatste " +
          "stand van de schema.org-richtlijnen (achter een 'vraagteken'-knop). 'Genereer site-brede schema' en " +
          "'Deel JSON' waren twee knoppen voor dezelfde stap en zijn samengevoegd tot 'Delen met developer': in " +
          "één klik het site-brede blok bouwen (aanvullend op een eventuele plugin), als .json-bestand naar " +
          "Drive zetten, een Dev-taak aanmaken in Werkzaamheden, en een mailvenster openen met een kant-en-klare " +
          "introductie. De ruwe JSON-code bekijken of los kopiëren kan in dat mailvenster, onder 'Bekijk de " +
          "JSON-code'; die staat standaard dicht. Zo ook 'Link kopiëren' en 'Mail naar klant': dat waren twee " +
          "knoppen voor bijna hetzelfde, nu is dat 'Delen met klant', één mailvenster met de deel-link erin én " +
          "een eigen kopieerknop voor die link.\n\n" +
          "**Geen mailto meer.** Beide mailvensters versturen, als er een Microsoft 365-koppeling is, de mail " +
          "rechtstreeks vanuit het dashboard (zelfde route als de mail-knoppen in Werkzaamheden); zonder " +
          "koppeling opent een knop het eigen mailprogramma via een onzichtbare link (niet via `window.open`, " +
          "dat gaf een leeg tabblad met de kale mailto-URL erin) of kopieert de mailtekst. Beide vensters zijn " +
          "hetzelfde opgemaakte compose-venster als in Werkzaamheden, geen los, onopgemaakt scherm meer.\n\n" +
          "**Kennisbank versus het formulier hierboven.** De kennisbank is de intake: een kleine 'dropzone' " +
          "(in de knoppenrij) waar documenten, foto's, tekst of een Drive-link in gaan; de AI haalt er " +
          "kandidaat-gegevens uit, per bron, en die wachten eerst op een akkoord voordat ze meetellen. Pas de " +
          "knop 'In velden zetten' brengt bevestigde kennisbank-gegevens over naar de echte velden hierboven " +
          "('Verzamelde structured data'), met 'Ontdubbelen' om dubbele aanleveringen samen te voegen. Het " +
          "detailoverzicht ('Kennisbank per categorie', tabjes met elke entiteit als kaartje) en het lijstje " +
          "'Nog aan te leveren' staan allebei standaard dicht onder een klein pijltje, zodat de kaart compact " +
          "blijft en alleen de dropzone en de knoppen meteen in beeld staan. Kortom: de kennisbank is het " +
          "ruwe-materiaal-archief mét herkomst per gegeven, het formulier erboven is de schone, bevestigde bron " +
          "waar de structured data zelf uit gebouwd wordt.",
      },
      {
        titel: "Zoekwoordkansen en de gaten in de site",
        kern: "Waar staat de klant net niet, en waar staat hij helemaal niet.",
        tekst:
          "Twee soorten kansen worden apart bijgehouden:\n\n" +
          "- **Bijna binnen.** Zoekwoorden waarop de site op positie 5 tot 20 staat met echt zoekvolume. Dat is " +
          "werk met een korte terugverdientijd.\n" +
          "- **Gaten.** Zoekwoorden waar concurrenten wel op ranken en de klant niet, en onderwerpen waarvoor er " +
          "nog helemaal geen pagina bestaat. Dat is werk met een langere horizon, en het hoort dus in een ander " +
          "bakje van de prioriteitenscan.\n\n" +
          "Beide worden getoetst aan de afgesproken zoekwoordenlijst en de beoogde landingspagina's. Een kans die " +
          "niet in de strategie past is geen kans, het is een afleiding.",
      },
      {
        titel: "Wijzigingen op de site bijhouden",
        kern: "Van elke pagina een momentopname, en een leesbaar verschil als er iets verandert.",
        tekst:
          "Van elke pagina wordt de volledige inhoud opgeslagen als momentopname met een vingerafdruk: meta, H1, " +
          "koppen, alt-teksten, interne links, woordaantal en schema. Verandert die vingerafdruk bij de volgende " +
          "scan, dan komt er een gebeurtenis met een leesbaar verschil: wat is er precies veranderd?\n\n" +
          "Waarom dit onmisbaar is in de praktijk: sites veranderen zonder dat het bureau het weet. Een " +
          "webbouwer zet een pagina live, iemand herschrijft een titel, een plugin gooit alt-teksten weg. Zonder " +
          "deze laag ontdek je dat pas als de posities al gezakt zijn.",
      },
      {
        titel: "AI-vindbaarheid",
        kern: "Hoe vaak het merk voorkomt in AI-antwoorden, als aparte lens.",
        tekst:
          "Zoeken gebeurt niet meer alleen in Google. Daarom is de aanwezigheid in AI-antwoorden een eigen lens " +
          "in de prioriteitenscan: in hoeveel AI-antwoorden komt het domein voor, en op welke onderwerpen dus " +
          "niet.\n\n" +
          "Dit is de jongste lens en dus de minst uitgewerkte van de vier, maar hij zit er expliciet in omdat de " +
          "vraag van klanten hier het snelst groeit.",
      },
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
    ],
  },

  // ── 5 ────────────────────────────────────────────────────
  {
    id: "documenten",
    titel: "De documentenfabriek",
    intro:
      "Van een gesprek naar een strategie, van een strategie naar een analyse, van een analyse naar een " +
      "blauwdruk, van een blauwdruk naar copy. Elke stap leest de vorige, en elke stap wordt een echt document " +
      "in de huisstijl.",
    uitklappers: [
      {
        titel: "De keten van vier stappen",
        kern: "Elke stap bouwt voort op de vorige, dus niets wordt twee keer bedacht.",
        tekst:
          "1. **Strategie.** Wat wil deze pagina bereiken, voor wie, tegen welke concurrent, met welk zoekwoord " +
          "als primair doel? De redenering wordt bewaard, niet alleen de uitkomst.\n" +
          "2. **Analyse.** Wat doet de pagina nu, gegrond in de live meting, de Search Console-data, de top-10 " +
          "van dat zoekwoord en de snelheidscijfers. Met pass of fail per criterium.\n" +
          "3. **Blauwdruk.** Hoe moet de pagina eruit gaan zien: koppenstructuur met zoekwoorddekking, " +
          "meta-templates met tekenaantallen, de interne linkkaart, briefings voor de afbeeldingen, de " +
          "vragen-en-antwoorden en de structured data.\n" +
          "4. **Copy.** De volledige tekst, getoetst aan harde criteria (zoekwoord in de eerste honderd woorden, " +
          "dekking van de koppen, zoekwoorddichtheid, antwoordlengte bij vragen) met een scorekaart die pas " +
          "groen is als het klopt.\n\n" +
          "Het primaire zoekwoord komt uit het plan als het daar gekozen is, en anders uit de Search " +
          "Console-data. Dat is bewust die volgorde: we optimaliseren juist naar nieuw gekozen zoekwoorden, die " +
          "van de huidige ranking mogen afwijken.",
      },
      {
        titel: "Waarom de analyse de redenering bewaart en niet de takenlijst",
        tekst:
          "Het analysedocument houdt de afweging vast: de huidige situatie, het zoekwoordonderzoek met volumes, " +
          "de concurrentie, de zoekintentie, de onderbouwde aanbeveling en wat er nog mist. Niet de losse " +
          "uitvoeringstaken, want die worden in de latere stappen uitgewerkt.\n\n" +
          "Dat klinkt als een detail maar het is de reden dat de keten werkt: als de analyse al taken bevat, " +
          "gaat de blauwdruk die herhalen en de copy nog een keer. Dan heb je drie documenten die hetzelfde " +
          "zeggen en elkaar tegenspreken.",
      },
      {
        titel: "Documenten in de huisstijl, met versies",
        kern: "Word en Excel, opgebouwd in de app, met alle versies bewaard.",
        tekst:
          "Documenten worden in de applicatie zelf opgebouwd in de Pingwin-huisstijl (het lettertype, het " +
          "accent, de gradient, een sfeerbeeld per klant), en landen in Drive in de map van de klant. Elke " +
          "generatie is een versie, dus een eerdere versie is nooit weg.\n\n" +
          "Er is ook een klantversie van een documenttype: dezelfde inhoud, maar zonder het interne " +
          "gereedschapsjargon. Wat de klant leest is niet wat de uitvoerder leest.",
      },
      {
        titel: "Generaties draaien op de achtergrond",
        kern: "Een lange generatie hoort niet af te breken omdat een browser dichtgaat.",
        tekst:
          "Een diep analysedocument kan minuten kosten. Daarom is het een run met een status, die door een " +
          "achtergrondwerker wordt opgepakt en afgemaakt, ook als het tabblad dicht gaat. Een run zonder " +
          "hartslag wordt opnieuw opgepakt.\n\n" +
          "Dat is ook waarom er in de werkwijze staat dat je na een push niet nog eens handmatig deployt: elke " +
          "extra deploy breekt lopende achtergrondtaken een keer af.",
      },
      {
        titel: "Van een gesprek een document",
        kern: "Wat in de chat besloten is kan direct een document worden.",
        tekst:
          "Een gesprek over een pagina eindigt vaak in een besluit. Dat besluit kan met één knop een " +
          "strategiedocument, een blauwdruk of een taak worden, zonder dat iemand het gesprek eerst samenvat in " +
          "een ander programma. De inhoud van het gesprek is de bron.",
      },
    ],
  },

  // ── 6 ────────────────────────────────────────────────────
  {
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
          "maar bewust nog niet gedaan; eerst kijken of het belletje volstaat.",
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
          "De planning is bewust een **signaalscherm** en geen bedieningspaneel: één regel per taak, met wie, " +
          "welke pagina, de zeven fases als gekleurde letters, de volgende stap en de dag. Die letters zijn expres " +
          "geen knoppen. Afvinken hoort in de kaart waar het werk gebeurt, en dan kleuren ze hier vanzelf mee. " +
          "Anders bestaan er twee wegen naar dezelfde stand, en dan lopen ze uiteen.\n\n" +
          "Klap je een regel open, dan verschijnt de échte projectkaart: de fases met hun knoppen, de chat over " +
          "deze pagina, de documenten en het mailvenster. Niet een tweede, magere samenvatting die kan achterlopen, " +
          "maar dezelfde kaart.\n\n" +
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
          "stond op drie plekken. Dat is teruggebracht tot één.",
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
          "is concreet: in januari 2026 kon niemand vaststellen of zes interne links nu wel of niet verdwenen waren.",
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
  },

  // ── 7 ────────────────────────────────────────────────────
  {
    id: "assistent",
    titel: "De assistent: chatten met alles wat bekend is",
    intro:
      "Een lijst is een scherm, een oordeel is een gesprek. De assistent is de plek waar de losse motoren " +
      "samenkomen, en hij is bewust terughoudend gebouwd.",
    uitklappers: [
      {
        titel: "Wat er automatisch meekomt in het gesprek",
        kern: "De klant, de afspraken, de cijfers en de mail. Zonder dat je iets hoeft te uploaden.",
        tekst:
          "Als je een gesprek begint over een klant of een pagina, ligt het volgende al op tafel:\n\n" +
          "- de recente mailcorrespondentie met die klant;\n" +
          "- de Search Console-cijfers van de site en van die pagina;\n" +
          "- de strategie, de afgesproken zoekwoorden en de beoogde landingspagina's;\n" +
          "- wat er al gemeten is op de pagina en welke fases af zijn;\n" +
          "- de bedrijfsgegevens en het klantprofiel;\n" +
          "- wat er in eerdere gesprekken over deze pagina besloten is.\n\n" +
          "Dat is het verschil met een los AI-gesprek: je hoeft de situatie niet uit te leggen voordat je een " +
          "bruikbaar antwoord krijgt.\n\n" +
          "**Zelf iets erbij leggen kan ook.** Sleep een document of een screenshot in een open gesprek (of plak " +
          "hem) en hij landt op twee plekken tegelijk: in de klantmap in Drive, en in dit gesprek, zodat de " +
          "assistent hem meteen meeleest. Hij verschijnt als regeltje onder het gesprek, met de naam als link naar " +
          "Drive. De assistent maakt er een korte samenvatting van; die staat achter een pijltje bij dat regeltje, " +
          "dus je ziet hem als je hem wilt zien en niet als muur tekst tussen je vragen in.",
      },
      {
        titel: "Waarom de assistent niet ongevraagd proactief is",
        kern: "Eerst sparren in tekst, pas actiekaarten als je erom vraagt.",
        tekst:
          "Dit is een bewuste beperking. Een assistent die uit zichzelf voorstellen doet, produceert precies de " +
          "waslijst die dit dashboard wil vermijden. Dus: eerst gewoon een gesprek, en pas actiekaarten met " +
          "knoppen als de gebruiker daar om vraagt.\n\n" +
          "De regel achter alles wat de assistent oplevert: nooit vulzinnen. Zinnen die alleen aankondigen dat " +
          "er iets komt kosten leestijd en ruimte, en werden op een gegeven moment zelfs als taak aangeboden.",
      },
      {
        titel: "Kaarten met knoppen: de mens blijft aan het stuur",
        kern: "De assistent stelt voor, de gebruiker keurt goed, het dashboard voert uit.",
        tekst:
          "Een voorstel komt als kaart met een knop. Pas na goedkeuren gebeurt er iets: een taak aanmaken, een " +
          "document genereren, een meta doorvoeren, een redirect zetten, een mail klaarzetten.\n\n" +
          "Er gaat nooit iets zelfstandig naar de klant of naar de site. Dat is geen technische beperking maar " +
          "een ontwerpkeuze, en hij staat er bewust in: een systeem dat autonoom naar buiten mag kan niet " +
          "vertrouwd worden op het moment dat het één keer misgaat.",
      },
      {
        titel: "De assistent stuurt de gedetailleerde gereedschappen aan",
        kern: "Een signaal in het gesprek gebruikt daarna de volwaardige motor.",
        tekst:
          "Signaleert het gesprek een zwakke meta-title, dan gebruikt de knop niet een snelle AI-suggestie maar " +
          "de volledige meta-motor, met alle regels tot en met de pixelbreedte. Idem voor structured data, voor " +
          "de hele documentenketen en voor alt-teksten.\n\n" +
          "Zo is er één weg naar hetzelfde resultaat. Twee knoppen die allebei een kaart maken leveren twee " +
          "verschillende kaarten op, en die botsen daarna.",
      },
      {
        titel: "Overview denkt diep: strategie in plaats van inventarislijst",
        kern: "De bird's eye draait op het zware model, met zoekwoordonderzoek in handen, en mag de opzet zelf afkeuren.",
        tekst:
          "Overview is het gesprek waarin je niet vraagt hoe een pagina ervoor staat, maar of de hele aanpak wel " +
          "deugt. Dat vraagt drie dingen, en die staan er nu alle drie in.\n\n" +
          "- **Het zware model.** Alleen dit gesprek, want alleen hier is de vraag een oordeel. De motoren, de " +
          "pagina-chat en het extractiewerk blijven op het gewone model. In de kop van Overview staat de knop " +
          "**Diep denken**; die kost meer per antwoord en is daarom uit te zetten zonder dat er code aan te pas komt.\n" +
          "- **Zoekwoordonderzoek in eigen hand.** Het gesprek kon alles nameten wat de site al doet, maar niets " +
          "zeggen over een zoekterm waar we nog niets mee doen. Nu haalt het zelf zoekvolume, moeilijkheid en " +
          "zoekintentie op voor een hele kandidatenlijst tegelijk, zoekt het ideeën rond een thema, en meet het de " +
          "autoriteit van de concurrenten die er nu staan.\n" +
          "- **Concurrenten uit twee bronnen.** De partijen in de top 10 zijn wie er op déze zoekterm staan; " +
          "de concurrentenlijst op het KPI's-tabje is wie het bureau als de concurrentie ziet. Die lijst voedde " +
          "eerder alleen de prioriteitenscan en de kansenlijst en bereikte dit gesprek helemaal niet. Nu ligt hij " +
          "op tafel, en kan het gesprek opzoeken waar een concurrent verkeer haalt dat wij missen. Is de lijst nog " +
          "leeg, dan zegt het dat in plaats van er stilzwijgend omheen te werken.\n" +
          "- **De opdracht om tegen te spreken.** Krijgt het gesprek een zoekwoordenlijst of een plan voorgelegd, " +
          "dan beoordeelt het eerst of dat de juiste aanpak is en pas daarna de invulling. Volume telt niet als " +
          "kans zolang de moeilijkheid niet tegen de eigen autoriteit is afgezet; bij een lokale zoekterm waar " +
          "vooral het kaartblok staat, ligt de winst bij het Google-bedrijfsprofiel en niet bij een landingspagina; " +
          "en een matrix van vier diensten maal tien plaatsen is veertig dunne pagina's die elkaar in de weg zitten. " +
          "Het antwoord is een gelaagde keuze met een volgorde, plus wat we bewust niet doen en waarom.\n\n" +
          "**Een antwoord raakt niet meer zoek.** Deed het gesprek eenentwintig metingen en lukte alleen het " +
          "opschrijven niet, dan verscheen er \"ik kon het niet netjes afronden\" en was al dat werk weg. Twee " +
          "oorzaken, allebei verholpen: de feitencontrole verving het antwoord onvoorwaardelijk door haar eigen " +
          "uitkomst (ook als die leeg was), en er was geen laatste stap die het antwoord alsnog uitschreef uit wat " +
          "er al opgehaald was. Die stap is er nu, zonder nieuwe metingen, dus zonder extra wachttijd.\n\n" +
          "De remmen blijven onverkort staan: elk cijfer komt uit een verse meting, elk pad uit de echte " +
          "URL-lijst, en de feitencontrole leest het antwoord na. Tegenspraak is iets anders dan vrijheid om te gokken.",
      },
      {
        titel: "Grondigheid boven vlotheid",
        kern: "De assistent mag zeggen dat hij het niet weet.",
        tekst:
          "Waar een meting ontbreekt, meldt de assistent dat als ontbrekend. Hij concludeert niet zelf of iets " +
          "gedaan is, want dat hoort bij de meetlaag. Dat maakt de antwoorden soms minder vlot en altijd " +
          "betrouwbaarder.",
      },
    ],
  },

  // ── 8 ────────────────────────────────────────────────────
  {
    id: "communicatie",
    titel: "Communicatie met de klant",
    intro:
      "Mail is geen bijzaak in een SEO-traject, het is waar de helft van de afspraken staat. Daarom zit het in " +
      "het dashboard en niet ernaast.",
    uitklappers: [
      {
        titel: "De correspondentie per klant",
        kern: "Alle mail rond deze klant op één plek, doorzoekbaar op onderwerp.",
        tekst:
          "Per klant staan de recente mails in de cockpit, met de mogelijkheid om te zoeken op onderwerp " +
          "('alles over de nieuwe stedenpagina's binnen deze klant') in plaats van alleen op afzender. Een " +
          "mailverwijzing opent het gesprek rechtstreeks in de mailclient.\n\n" +
          "Uit die mails wordt ook een tijdlijn van de stand van zaken samengevat, die stil op de achtergrond " +
          "wordt bijgewerkt als hij meer dan twee dagen achterloopt. Je opent een klant dus nooit met verouderde " +
          "context.",
      },
      {
        titel: "Mailcontroles",
        kern: "Uitgaande mail wordt eerst getoetst aan de afspraken.",
        tekst:
          "Voordat een mail de deur uit gaat wordt hij nagelopen: klopt de aanhef, staan de afspraken erin, " +
          "wordt er niets beloofd dat niet is gedaan, en is de opmaak simpel genoeg voor mail (aanhef, korte " +
          "alinea's, simpele bullets, afsluiting, geen tabellen en geen vet-spam).\n\n" +
          "Deze controles draaien ook periodiek op de achtergrond, zodat een openstaand punt niet blijft liggen " +
          "tot iemand er weer aan denkt.",
      },
      {
        titel: "Wat de klant zelf ziet",
        kern: "Een eigen dashboard, in gewone taal, zonder ruwe data.",
        tekst:
          "De klant logt in en ziet zijn maandoverzicht: welke werkzaamheden er zijn gedaan, hoeveel uren en " +
          "welk budget daarbij hoort, en de documenten die voor hem klaarstaan. Alleen de regels die " +
          "klant-zichtbaar zijn gemarkeerd komen daarin terecht.\n\n" +
          "Het bureau kan van elke klant een voorbeeldweergave openen en zo precies zien wat de klant ziet, " +
          "voordat hij de link verstuurt.",
      },
      {
        titel: "Delen zonder inlog",
        kern: "Lange, onraadbare links voor precies één ding.",
        tekst:
          "Voor onderdelen die met iemand buiten het bureau gedeeld moeten worden zijn er links zonder inlog: " +
          "de werklijst voor de sitebouwer, de bedrijfsgegevens die de klant moet nalopen, en het opruimvoorstel. " +
          "Elke link geeft toegang tot dat ene onderdeel en niets anders, en kan vernieuwd worden waarmee de " +
          "oude link direct dood is.\n\n" +
          "Er is ook een loginvrije link naar het klantdashboard zelf voor klanten die geen wachtwoord willen " +
          "onthouden. Staat de login van die klant uit, dan werkt die link ook niet: dezelfde spelregel, geen " +
          "achterdeur.",
      },
    ],
  },

  // ── 9 ────────────────────────────────────────────────────
  {
    id: "leads",
    titel: "Nieuwe klanten en leads",
    intro:
      "Een lead is een klant die nog niet ja heeft gezegd. Daarom krijgt hij dezelfde omgeving, met een eigen " +
      "startscherm en een dossier dat nooit iets weggooit.",
    uitklappers: [
      {
        titel: "De leadomgeving",
        kern: "Gesprek, dossier en documenten op één plek, vanaf het eerste contact.",
        tekst:
          "Zodra er een lead in het systeem staat is er een werkplek: het gesprek, alles wat we over dat bedrijf " +
          "weten, en de documenten die we voor hem maken (een voorstel, een quickscan, een positioneringsadvies). " +
          "Wordt het een klant, dan verandert alleen het startscherm; het dossier gaat gewoon mee.",
      },
      {
        titel: "Het dossier: append-only",
        kern: "Er wordt nooit iets overschreven.",
        tekst:
          "Alles wat we over een bedrijf weten landt op één plek: aangeleverde documenten (een advertentie-analyse " +
          "van een collega, een uitdraai, hun propositie of huisstijl), eigen metingen, en losse notities die in " +
          "het gesprek vallen ('budget mag 1500', 'vindt duurzaamheid belangrijk').\n\n" +
          "De regel die dit bruikbaar houdt naarmate het groeit: er wordt nooit iets overschreven. Een herziening " +
          "komt erbij als nieuwe regel, met datum. Zo kun je later zien wat we wanneer dachten, en dat is precies " +
          "wat je nodig hebt als een traject een jaar duurt.",
      },
      {
        titel: "Klantprofiel automatisch opbouwen",
        kern: "Van een domein naar een volledig profiel, zonder vragenlijst.",
        tekst:
          "Op basis van de website en wat er publiek te vinden is wordt een klantprofiel opgebouwd: wat het " +
          "bedrijf doet, voor wie, in welk gebied, met welke concurrenten. Dat profiel is daarna de context voor " +
          "elke analyse, elk document en elk gesprek over die klant.\n\n" +
          "Het uitgangspunt is dat het systeem zelf opzoekt wat het zelf kan vinden. Een gebruiker hoeft geen " +
          "domein, URL of cijfer aan te leveren dat op de site of in de gekoppelde bronnen staat.",
      },
      {
        titel: "Concurrenten",
        kern: "Per klant vastgelegd, en gebruikt in elke vergelijking.",
        tekst:
          "Concurrenten worden per klant bijgehouden en gebruikt in de zoekwoordgaten, de top-10-analyses en de " +
          "positioneringsvraag. Een analyse zonder benoemde concurrent is een analyse in het luchtledige.",
      },
    ],
  },

  // ── 10 ───────────────────────────────────────────────────
  {
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
  },

  // ── 11 ───────────────────────────────────────────────────
  {
    id: "zelfstandig",
    titel: "Wat er gebeurt terwijl niemand kijkt",
    intro:
      "Het dashboard is geen scherm dat wacht op een klik. Er draaien vaste taken op de achtergrond, en zware " +
      "analyses zijn zo gebouwd dat ze een onderbreking overleven.",
    uitklappers: [
      {
        titel: "De vaste achtergrondtaken",
        kern: "Van elke vijf minuten tot één keer per week.",
        tekst:
          "| Wanneer | Wat er gebeurt |\n" +
          "|---|---|\n" +
          "| Elke 5 minuten | Openstaande opruim-analyses oppakken en afmaken |\n" +
          "| Elke 5 minuten | Mailcontroles afwerken |\n" +
          "| Elke 30 minuten | Openstaande documentgeneraties oppakken en afmaken |\n" +
          "| Elke nacht | De ontwikkeling per klant bijwerken (posities, klikken, trends) |\n" +
          "| Elke nacht | De prioriteitenscans doorrekenen |\n" +
          "| Elke week | De volledige inhoudsscan van alle sites, met verschildetectie |\n" +
          "| Elke week | Het factuursignaal per klant |\n\n" +
          "Het gevolg is dat je op maandagochtend een dashboard opent dat al weet wat er in het weekend op de " +
          "sites is veranderd, in plaats van een dashboard dat begint met wachten.",
      },
      {
        titel: "Hervatbare analyses",
        kern: "Een afgekapt venster is geen mislukte analyse.",
        tekst:
          "Zware analyses draaien in stappen, met na elke stap een opgeslagen tussenstand. Wordt de run " +
          "onderbroken (een serverless venster is begrensd, een deploy komt ertussen), dan pakt een " +
          "achtergrondwerker hem weer op waar hij was.\n\n" +
          "Dit is er niet uit voorzorg maar uit ervaring: er stond eens een analyse veertig minuten op 'bezig' " +
          "zonder ooit iets op te leveren. Dat mag één keer gebeuren, niet twee keer.",
      },
      {
        titel: "Caches met een reden",
        kern: "Betaalde data wordt bewaard zolang hij geldig is, niet langer.",
        tekst:
          "Zoekvolumes ongeveer een maand, top-10-resultaten ongeveer een kwartaal, boekhoudcijfers enkele uren, " +
          "de site-brede overzichten ongeveer een halve dag. Elke bewaartermijn volgt uit hoe snel dat cijfer " +
          "echt verandert, niet uit een standaardinstelling.",
      },
    ],
  },

  // ── 12 ───────────────────────────────────────────────────
  {
    id: "veiligheid",
    titel: "Veiligheid en privacy",
    intro:
      "Er staat klantdata in dit systeem: correspondentie, cijfers, wachtwoorden van sites en boekhouding. De " +
      "regels daarvoor staan vast en zijn niet per omgeving anders.",
    uitklappers: [
      {
        titel: "Wachtwoorden en sleutels",
        kern: "Nooit plat, nooit in de code, nooit in een bestand.",
        tekst:
          "- Klantwachtwoorden worden gegenereerd en alleen als versleutelde afdruk opgeslagen. Ook de beheerder " +
          "kan ze niet lezen; het platte wachtwoord is één keer zichtbaar bij het aanmaken.\n" +
          "- Sessies zijn ondertekende cookies. Een gemanipuleerde cookie wordt geweigerd.\n" +
          "- Wachtwoorden voor de site van de klant worden versleuteld bewaard en zijn niet terug te lezen.\n" +
          "- API-sleutels staan uitsluitend in de omgevingsvariabelen van de hosting, nooit in een bestand in de " +
          "code. Een bestand mag hoogstens de naam van de variabele noemen.",
      },
      {
        titel: "Beveiliging staat standaard aan, niet standaard uit",
        kern: "Een ingang zonder sleutel bestaat niet.",
        tekst:
          "Er was een snelle beheerder-ingang waarvan het slot standaard uit stond. Dat betekende dat wie het " +
          "adres kende binnen was, en het adres stond in een openbare code-omgeving. Dat is aangetroffen en " +
          "dichtgezet.\n\n" +
          "De regel die daaruit volgt en die voor elke omgeving geldt: is de sleutel niet ingesteld, dan bestaat " +
          "de ingang niet. Beveiliging hoort niet iets te zijn dat je aan moet zetten.",
      },
      {
        titel: "Scheiding tussen klanten",
        kern: "Elke tabel is per klant gescheiden, op elk niveau.",
        tekst:
          "Alle klantgegevens hangen aan de klant, in elke tabel. Een klant kan alleen bij zijn eigen dashboard. " +
          "Een teamgebruiker alleen bij de klanten die hem zijn toegewezen. Een deellink alleen bij dat ene " +
          "onderdeel.",
      },
      {
        titel: "Twee poorten in plaats van één",
        kern: "Snelle afwijzing aan de rand, echte controle in de kern.",
        tekst:
          "Bij de eerste poort wordt alleen gekeken of er een sessie aanwezig is. De echte controle van de " +
          "ondertekening gebeurt daarna op de server bij de pagina zelf, die een vervalste sessie alsnog " +
          "wegstuurt. Dat is bewust die verdeling, omdat de buitenste laag geen zware crypto kan doen.",
      },
      {
        titel: "Wat de koppelingen wel en niet mogen",
        kern: "Zo min mogelijk rechten, per koppeling vastgelegd.",
        tekst:
          "- Search Console en Analytics: alleen lezen.\n" +
          "- Boekhouding: alleen lezen, geen enkele schrijfmogelijkheid in de code.\n" +
          "- Drive: een aparte koppeling, los van de datakoppeling, zodat wie de cijfers levert nooit zijn Drive " +
          "openzet.\n" +
          "- Mail: lezen en versturen, maar versturen gebeurt alleen na goedkeuring.\n" +
          "- De site van de klant: schrijven is mogelijk, maar alleen op de velden die er expliciet voor " +
          "opengezet zijn, en altijd met terugcontrole.",
      },
    ],
  },

  // ── 13 ───────────────────────────────────────────────────
  {
    id: "gebruik",
    titel: "Hoe je het gebruikt",
    intro:
      "De bedoeling is dat je niet hoeft na te denken over waar je moet beginnen. Hieronder de dag, de week en " +
      "de maand, en hoe een nieuwe klant erin komt.",
    uitklappers: [
      {
        titel: "Een gewone werkdag",
        kern: "Klant openen, prioriteiten lezen, een paar knoppen.",
        tekst:
          "1. Open een klant. Je landt op Taken, met je prioriteiten, de lopende gesprekken en de weekplanning " +
          "in drie blokken die dicht beginnen. Je kiest zelf wat je openzet.\n" +
          "2. Rechts staat een lijstje bespreekpunten per persoon en de laatste correspondentie, allebei dicht " +
          "tot je ze openklikt; de mails zet je desgewenst los en groot in beeld. De afgesproken zoekwoorden en " +
          "landingspagina's, en de bronnen die het overzicht voeden, zitten in de twee zijpanelen aan de rechterrand.\n" +
          "3. Pak het bovenste punt. Is het een pagina, dan ga je naar die pagina en zie je meteen wat er is en " +
          "wat de volgende fase is.\n" +
          "4. Laat het dashboard het zware werk doen: het document, het voorstel, de meting. Jij keurt goed.",
      },
      {
        titel: "Een nieuwe klant erin zetten",
        kern: "Naam, domein, en de rest bouwt zichzelf op.",
        tekst:
          "Een klant aanmaken is een naam en een domein. Daarna staat er op het tabblad **Onboarding** één " +
          "lijst met de vaste volgorde, en één knop die alles doet wat zonder mens kan:\n\n" +
          "- Er wordt een wachtwoord gegenereerd (één keer zichtbaar) als de klant een eigen dashboard krijgt.\n" +
          "- De pagina's van de site worden ingelezen.\n" +
          "- Het klantprofiel en de tone of voice worden geschreven op basis van de echte pagina's.\n" +
          "- De bedrijfsgegevens worden uit de site gehaald, gaan als link naar de klant om na te lopen, en " +
          "worden daarna vergrendeld.\n" +
          "- De concurrenten worden opgezocht: wie staat er het vaakst naast deze klant in de top 10.\n" +
          "- De zoekwoordkansen worden verzameld en de drie site-brede scans starten.\n\n" +
          "Wat alleen een mens kan (inloggen bij Search Console, de klantwaarde invullen) blijft staan als " +
          "\"dit is aan jou\", met de reden erbij.",
      },
      {
        titel: "Waarom er niets draait voordat de inventarisatie klopt",
        kern: "Een scan zonder inventarisatie is een gok met een grafiek eromheen.",
        tekst:
          "Elke stap in de onboarding noemt waar hij van afhangt, en dat wordt afgedwongen. Een prioriteitenscan " +
          "start niet zolang de pagina's niet zijn ingelezen, Search Console niet gekoppeld is, of de " +
          "concurrenten nog ontbreken. Een analyse, blauwdruk of copy start niet zonder klantprofiel en tone of " +
          "voice, want anders schrijft de tekst over een willekeurig bedrijf in een willekeurige stem.\n\n" +
          "Wordt er geweigerd, dan staat er niet \"er ging iets mis\" maar wát er ontbreekt en waar je het " +
          "regelt.\n\n" +
          "Twee dingen maken dit bruikbaar in plaats van bureaucratisch:\n\n" +
          "- **De status wordt afgelezen, niet bijgehouden.** Er zijn geen vinkjes om te zetten; het dashboard " +
          "kijkt of het profiel er echt staat, of er echt concurrenten zijn, of de scan echt gedraaid heeft. " +
          "Daardoor toont dezelfde lijst bij een klant die al jaren loopt vanzelf wat er nog ontbreekt, en is " +
          "er maar één knop nodig in plaats van een aparte voor nieuwe en bestaande klanten.\n" +
          "- **Onboarding raakt nooit af.** Concurrenten wisselen, een site verandert, een scan veroudert. " +
          "Stappen krijgen daarom vanzelf het stempel \"loopt achter\", en in de klantenlijst staat per klant " +
          "hoeveel er staat en wat er mist.\n" +
          "- **Een poort is geen perfectielijstje.** Bij de bedrijfsgegevens is onderscheid gemaakt tussen wat " +
          "moet en wat mooi meegenomen is. Moet: de naam, het type, KvK, telefoon, e-mail en het adres of " +
          "werkgebied, want zonder die velden weet niemand wélk bedrijf dit is. Mooi meegenomen: het logo, de " +
          "sociale profielen, de functie en BIG-nummers per behandelaar, de dienstomschrijvingen. Het formulier " +
          "toont alles rood zoals altijd, maar de poort struikelt niet meer over drie ontbrekende " +
          "profielpagina's bij een klant waar verder alles staat.",
      },
      {
        titel: "Alle klanten in één keer, met de prijs vooraf",
        kern: "Bulk-onboarding in golven, met een rem op het Ahrefs-verbruik.",
        tekst:
          "Klanten één voor één langslopen is zonde van de tijd, maar ze allemaal tegelijk alles laten doen kan " +
          "niet. Een volledige onboarding kost ongeveer 80.000 Ahrefs-units per klant; voor achttien klanten is " +
          "dat 1,4 miljoen, oftewel bijna vier maanden tegoed. Die tarieven zijn niet geschat maar afgelezen uit " +
          "het echte verbruik-log: een zoekwoordenlijst van een domein kost 29 units per regel, zoekwoord-ideeën " +
          "21, een zoekwoordoverzicht 32.\n\n" +
          "Daarom staat op het klantenoverzicht één blok dat de onderdelen op prijs sorteert:\n\n" +
          "- **Golf 1, de basis (± 650 units per klant).** Pagina's inlezen, klantprofiel, tone of voice, " +
          "bedrijfsgegevens uit de site, concurrenten opzoeken en de interne linkanalyse. Bijna gratis, en " +
          "precies de inventarisatie waar alle andere scans op wachten.\n" +
          "- **Golf 2, de prioriteitenscan (± 15.300 per klant).** De eerste echt dure stap.\n" +
          "- **Golf 3, opruimen en zoekwoordkansen (± 64.500 per klant).** Voor alle klanten tegelijk meer dan " +
          "twee maanden tegoed; dit doe je bij de klant waar je op dat moment aan werkt.\n\n" +
          "Drie dingen houden dat veilig. **De prijs staat er vóór de klik**: je ziet per golf wie het nog nodig " +
          "heeft, wat het samen kost en hoeveel er daarna overblijft. **De rij werkt één klant tegelijk af**, met " +
          "een cron als vangnet, dus een afgekapt tijdvenster kost hooguit één klant in plaats van de hele rij. " +
          "En **er zit een rem in**: vóór elke klant wordt bij Ahrefs opgevraagd hoeveel er nog over is, en zakt " +
          "dat onder de 50.000, dan stopt de rij zichzelf en zegt waarom. Een bulkrun kan je maand dus niet " +
          "leegtrekken.\n\n" +
          "Wat al staat wordt overgeslagen, dus een klant met volledig ingevulde bedrijfsgegevens gaat niet " +
          "opnieuw op zoek naar structured data.",
      },
      {
        titel: "De maandelijkse ronde",
        kern: "Verantwoorden en opnieuw prioriteren.",
        tekst:
          "Per maand staat vast wat er is uitgevoerd, wat het gekost heeft en wat de ontwikkeling is. Dat is " +
          "tegelijk de verantwoording naar de klant en de input voor de volgende ronde: de prioriteitenscan " +
          "rekent opnieuw door, met de correcties van vorige maand als vaste regels erin.",
      },
      {
        titel: "Wat er op de achtergrond draait, en hoe je dat ziet",
        kern: "Alles wat lang duurt draait op de server, met een rondje dat volloopt.",
        tekst:
          "Zware klussen (de site inlezen, de prioriteitenscan, de opruimanalyse, de interne links, de " +
          "documenten, de wijzigingen-scan, de zoekwoordkansen) draaien op de server en niet in je browser. " +
          "Je kunt dus wegklikken, doorklikken of het venster sluiten; het werk loopt door.\n\n" +
          "Overal waar iets draait staat hetzelfde voortgangsrondje, met daarbij:\n\n" +
          "- **Bij welke stap hij is**, als het aantal stappen bekend is. Het rondje loopt dan echt vol. Is het " +
          "aantal stappen niet bekend, dan draait het rondje rond in plaats van een verzonnen percentage te " +
          "tonen; een balk die op 90% blijft hangen is een leugen.\n" +
          "- **Wat er nu gebeurt**, in gewone taal. Een molentje zonder tekst is niet te onderscheiden van " +
          "vastgelopen.\n" +
          "- **Hoe lang hij al loopt.** Is er een kwartier geen teken van leven, dan zegt hij dat hij " +
          "waarschijnlijk vastligt, met de knop om te hervatten ernaast. Zwijgen is hier het ergste.\n\n" +
          "In de kop van de cockpit staat bovendien een klusje dat op **elk tabblad** meegaat: klik het open en " +
          "je ziet alles wat op dit moment voor deze klant draait, met de weg terug naar de plek waar het " +
          "hoort. Zo raak je een gestarte scan niet meer uit het oog doordat je ergens anders heen klikte.",
      },
      {
        titel: "Wat je als bureau moet aanleveren",
        kern: "Sleutels, geen implementatietraject.",
        tekst:
          "Om dit voor een eigen klantenportefeuille te laten draaien is nodig: een Google-account met toegang " +
          "tot de Search Console-eigendommen, een Ahrefs-sleutel, een AI-sleutel, en optioneel de mailbox, de " +
          "boekhouding en per klant een sitekoppeling. De database maakt zichzelf aan.\n\n" +
          "Wat níet nodig is: de klanten overzetten naar een nieuwe manier van werken. Het maandoverzicht kan " +
          "uit de spreadsheet blijven komen die er al is.",
      },
    ],
  },

  // ── 14 ───────────────────────────────────────────────────
  {
    id: "onderscheid",
    titel: "Wat dit onderscheidt",
    intro:
      "De eerlijke vraag is niet of dit knap is, maar waarom een concurrent het niet in een kwartaal namaakt. " +
      "Dit zijn de antwoorden waar we voor durven staan.",
    uitklappers: [
      {
        titel: "Meten en oordelen zijn gescheiden",
        tekst:
          "Vrijwel elke AI-SEO-tool laat het model concluderen of iets in orde is. Dat levert antwoorden op die " +
          "goed klinken en soms niet waar zijn, en dat is precies het soort fout dat een klant een jaar later " +
          "ontdekt. Hier komt elk feit uit een meting met bewijs, en mag de AI er daarna iets van vinden. Die " +
          "scheiding kun je niet later inbouwen; die moet vanaf het begin in de architectuur zitten.",
      },
      {
        titel: "De keten is af",
        tekst:
          "Signaal, oordeel, rangorde, document, goedkeuring, doorvoeren op de site, terugcontrole, nameten. " +
          "Er zijn tools voor elk van die stappen. Er is bijna niets dat de hele keten in één geheugen houdt, en " +
          "dat is precies waar de uren in een bureau verdwijnen.",
      },
      {
        titel: "Het wordt beter door gebruik",
        tekst:
          "Correcties van de gebruiker worden vaste regels voor de volgende analyse. De opgebouwde regels, de " +
          "momentopnames en de historie per klant zijn niet mee te nemen naar een andere tool. Dat is geen " +
          "opsluiting, dat is opgebouwde waarde.",
      },
      {
        titel: "Het is gebouwd door de gebruiker",
        tekst:
          "Dit is geen tool die is bedacht op basis van interviews met SEO-specialisten. Elke keuze erin komt uit " +
          "een echt irritatiemoment in echt klantwerk, en dat is te zien: de weglatingen zijn even doelbewust " +
          "als de toevoegingen. Elf tabjes werden zes knoppen. Een muur van geblokkeerde regels werd een " +
          "werkbare lijst. Het planningsbord werd expres een signaalscherm en geen bedieningspaneel.",
      },
      {
        titel: "Het is al meervoudig in gebruik",
        tekst:
          "Dezelfde codebase draait onder meerdere merken met eigen databases en eigen sleutels. De " +
          "meertenant-vraag is dus niet theoretisch getest maar in productie beantwoord.",
      },
    ],
  },

  // ── 15 (intern) ──────────────────────────────────────────
  {
    id: "agenda",
    titel: "Eerlijke agenda en routekaart",
    intern: true,
    intro:
      "Dit hoofdstuk is alleen zichtbaar met een beheerderssessie, en het is tegelijk de ontwikkelagenda. " +
      "Vijftien punten, genummerd R1 tot R15, in drie golven plus een lijst met wat we bewust níet doen. Elk " +
      "punt staat er met wat er nu mis is, wat het oplevert, hoe het gebouwd zou worden en waaraan je ziet dat " +
      "het af is. Zo kan één punt in één aparte werksessie opgepakt worden zonder dat het opnieuw bedacht hoeft " +
      "te worden.",
    uitklappers: [
      {
        titel: "Hoe we dit organiseren",
        kern: "Eén punt, één sessie, één meetbaar resultaat. En de lus die zichzelf versterkt.",
        tekst:
          "**Het bedieningspaneel staat in het dashboard zelf.** Op de routekaart-pagina (bereikbaar via de knop " +
          "\"Routekaart\" in het adminscherm) staat per punt de stand, waar het van afhangt, en de startregel om " +
          "te kopiëren voor een verse werksessie. Dit hoofdstuk is het verhaal en de onderbouwing; dat scherm is " +
          "de knop.\n\n" +
          "**Eén punt per chat, maximaal twee chats tegelijk.** Elke werksessie pakt precies één punt, meldt in " +
          "de routekaart dat het loopt, en koppelt terug in vier regels: wat er nu werkt, een link om te kijken, " +
          "wat er nog open is, en of er iets nodig is. Geen bestandsnamen, geen techniek, tenzij erom gevraagd " +
          "wordt. Die vorm is vastgelegd als opdracht in de repo, dus elke sessie werkt hetzelfde.\n\n" +
          "**De werkwijze per punt.** Elk punt hieronder is zo geschreven dat het in een eigen werksessie kan " +
          "worden opgepakt: \"Pak R2\" is genoeg om te beginnen. Vaste vorm per punt:\n\n" +
          "1. **Wat er nu mis is.** Het probleem, niet de oplossing.\n" +
          "2. **Wat het oplevert.** Voor het werk, voor de klant, of voor de verkoop. Levert het niets van die " +
          "drie op, dan hoort het in de lijst \"niet doen\".\n" +
          "3. **Hoe we het zouden bouwen.** De route in grote stappen, plus wat er al ligt om op voort te bouwen.\n" +
          "4. **Waaraan je ziet dat het af is.** Eén controleerbare uitkomst. Geen \"het werkt nu beter\".\n" +
          "5. **Wat het raakt.** Welke bestaande motoren of schermen meebewegen, zodat er niets stilletjes " +
          "uiteen gaat lopen.\n\n" +
          "**De drie golven.** Golf 1 maakt bestaande motoren volwaardig (het meeste effect per uur, want het " +
          "fundament ligt er al). Golf 2 haalt de remmen weg die het bureau tegenhouden bij groei. Golf 3 maakt " +
          "er een product van dat een ander bureau kan gebruiken.\n\n" +
          "**De lus die zichzelf versterkt.** Dit is het punt waar dit document meer wordt dan documentatie:\n\n" +
          "- Bouwen begint hier: een sessie leest deze routekaart en pakt één punt.\n" +
          "- Bouwen eindigt hier: hetzelfde punt wordt bijgewerkt in `lib/uitleg.ts`, het bijbehorende hoofdstuk " +
          "verderop wordt aangevuld, en de datum bovenaan gaat vooruit.\n" +
          "- Dus: het verhaal naar buiten en de agenda naar binnen zijn hetzelfde bestand. Er kan geen " +
          "verkoopversie ontstaan die te mooi is, en geen agenda die niemand meer leest.\n\n" +
          "**Volgorde is een advies, geen wet.** De nummers zijn de aanbevolen volgorde op verhouding tussen " +
          "opbrengst en inspanning. Wat er echt eerst gebeurt bepaalt de vraag van klanten.\n\n" +
          "**Waar je dit bedient.** Op `/admin/routekaart` staan dezelfde punten als knoppen: per punt de " +
          "startregel om te kopiëren, wat er loopt, en wat er op elkaar wacht. De volledige beschrijving van een " +
          "punt (deze teksten) klapt daar sinds 6 augustus 2026 open bij het punt zelf, in plaats van door te " +
          "linken naar dit document; je hoeft dus niet meer in een lang verhaal te zoeken naar het punt waar je " +
          "net op klikte. Eén bron, twee vensters. En in de kopbalk van élk beheerscherm zit een menu " +
          "**Intern** met de eerstvolgende taak en zijn startregel, plus de ingangen naar deze uitlegpagina, " +
          "zodat je daar niet eerst voor terug hoeft naar het klantenoverzicht.\n\n" +
          "**Het advies rekent mee met wat er loopt.** Een punt dat hetzelfde scherm raakt als een punt dat op dat " +
          "moment gebouwd wordt, wordt niet aangeraden; bij zo'n punt staat in plaats van de startregel dat je even " +
          "moet wachten. Kan er niets zonder botsing beginnen, dan zegt het scherm dat ook, in plaats van een leeg " +
          "vak te tonen. Dat was eerst niet zo: op 6 augustus 2026 liep R1 en werd R4 aangeraden, terwijl die elkaar " +
          "in de weg zitten. Een advies dat zijn eigen waarschuwing negeert is erger dan geen advies.",
      },

      {
        titel: "Waarom de opmaak nu wél overal klopt",
        kern: "De regel bestond drie keer en werd nul keer gecontroleerd. Nu is er een poort.",
        tekst:
          "**Wat er mis was.** Er staat een harde regel dat alles wat je ziet netjes gerenderd moet zijn: geen " +
          "sterretjes, geen pijpjes, geen ruwe kopjes in beeld. Die regel stond op drie plekken, in drie " +
          "bewoordingen, en werd door geen enkel systeem gecontroleerd. Voeg een kaal tekstvak toe met " +
          "AI-tekst erin, en de bouw slaagde, de proeven slaagden, en het ging gewoon naar productie. Vandaar " +
          "dat er steeds opnieuw stukjes ongeopmaakte tekst opdoken.\n\n" +
          "**Wat er nu gebeurt.** Er is één poort die meedraait met elke controle, en die drie dingen doet:\n\n" +
          "1. **De renderer wordt getest op wat er echt misging.** Een citaat, een codeblok, een tabel zonder " +
          "scheidingsregel, een lijst in een lijst: dat kende de renderer geen van alle, dus kwamen die tekens " +
          "letterlijk in beeld. Ze zijn nu alle vier opgelost, en de poort faalt zodra er weer een ruw " +
          "opmaakteken doorheen glipt.\n" +
          "2. **Nieuwe kale tekstvakken laten de controle falen.** Er is een lijst met plekken waar een kaal " +
          "veld terecht is (daar typ je zelf), elk met de reden erbij. Komt er een nieuwe bij, dan is dat " +
          "voortaan een bewuste keuze in plaats van een slordigheid.\n" +
          "3. **Hardgecodeerde maten en kleuren kunnen alleen nog dalen.** Er staan er nog honderden in de " +
          "opmaaklaag; die zijn niet in één keer op te ruimen. De poort legt het huidige aantal vast, zodat het " +
          "nooit meer oploopt en elke opruimronde het getal verlaagt.\n\n" +
          "**Wat er meteen is rechtgezet.** De uitwerking voor de sitebouwer stond in een monospace blok met de " +
          "sterretjes erin, en werd zo gekopieerd en gemaild. Het schrijfstijlprofiel stond als kale tekst in " +
          "een veld. De sturing per fase op een taakkaart werd niet gerenderd. De chatbubbels kregen wel " +
          "gerenderde tekst maar niet de bijbehorende typografie. Alle vier opgelost.\n\n" +
          "**Wat een machine niet kan.** Uitlijning, hiërarchie, contrast en of een scherm rustig oogt blijft " +
          "mensenwerk; daar is de design-checklist voor. De poort dekt af wat te tellen is.",
      },
      {
        titel: "Meldingen: wat iemand anders deed",
        kern: "De sitebouwer vinkt af, jij ziet het in je dashboard. Geen mail meer nodig.",
        tekst:
          "**Wat er nu mis was.** De sitebouwer vinkt taken af in haar eigen deel van het dashboard. Die status " +
          "ging stil de database in: het dashboard deed er niets mee, dus moest zij er een mail bij sturen om te " +
          "laten weten dat ze klaar was. Dat mailtje landde in de inbox in plaats van op de plek waar het werk " +
          "toch al staat.\n\n" +
          "**Wat er nu gebeurt.** Vinkt zij een taak af, dan verschijnt dat als melding in de kopbalk van elk " +
          "beheerscherm: wie het afrondde, bij welke klant, welke taak, met haar terugkoppeling erbij en een link " +
          "naar de taak zelf. Een oranje telletje laat zien hoeveel er nieuw is sinds de vorige keer. Openklappen " +
          "telt als lezen; er is geen aparte knop om iets als gelezen te markeren, want dat is een handeling die " +
          "niets oplevert. Vinkt zij iets weer uit, dan verdwijnt de melding: een melding die niet meer waar is " +
          "hoort niet te blijven staan.\n\n" +
          "**Wie het ziet.** Alleen de eigenaar. De sitebouwer werkt in hetzelfde dashboard, dus de meldingen " +
          "zitten achter dezelfde poort als de rest van het eigenaarswerk; zij krijgt geen belletje over haar " +
          "eigen taak. Van je eigen vinkje komt trouwens ook geen melding.\n\n" +
          "**Wat er bewust níet in zit.** Geen mail ernaast, want juist die mail was het probleem. En niet de " +
          "tweede afvinklijst (meta's en alt-teksten per klant): daar gaan er tientallen per keer doorheen, en " +
          "dan wordt een melding ruis in plaats van signaal. Komt dat er ooit bij, dan als één samenvatting per " +
          "dag per klant.",
      },
      {
        titel: "Hoe een werksessie begint en eindigt",
        kern: "Vaste vorm bij start en oplevering, en een link die pas komt als het écht live staat.",
        tekst:
          "Er lopen zes tot acht werksessies naast elkaar, elk over een ander onderdeel. Dat werkt, maar het " +
          "kostte per sessie opstarttijd (waar ging dit ook alweer over?) en per oplevering zoektijd (staat het " +
          "live, en wat moet ik nu doen?). Sinds 6 augustus 2026 hebben die twee momenten een vaste vorm.\n\n" +
          "- **Bij de start: drie regels.** Onderwerp, wat er laatst live ging, wat er nu open staat. Gevuld uit " +
          "een tabel *Lopende sporen* in het overdrachtsbriefje van het brein: één regel per onderwerp, en een " +
          "sessie werkt bij het afsluiten alleen zijn eigen regel bij.\n" +
          "- **Onderweg: stil.** Geen lopend commentaar met bestandsnamen en commando's. Alleen een beslissing " +
          "die genomen moet worden, of een probleem.\n" +
          "- **Aan het eind: één blok van maximaal tien regels.** Wat er gevraagd was, wat er nu live staat, welke " +
          "ene handeling er nog is, en de link naar het juiste scherm. Dezelfde vorm die de opdracht voor de " +
          "routekaartpunten al gebruikte, nu op één plek in plaats van twee.\n\n" +
          "**De link komt pas als het live staat.** Pushen is niet hetzelfde als live, en tot nu toe was er geen " +
          "manier om dat verschil te zien: je kon de site wel bekijken, maar niet aantonen dat het de nieuwe " +
          "versie was. Daarom geeft `/api/versie` de commit terug die op dat moment draait, en wacht " +
          "`scripts/wacht-op-deploy.sh` na een push tot precies die commit live staat (of tot een latere deploy " +
          "die hem bevat, want er wordt vanuit meerdere sessies en crons naar `main` gepusht). Pas daarna wordt " +
          "het scherm bekeken en de link gegeven. Loopt de tijdslimiet af, dan wordt de bouwstatus van die commit " +
          "opgevraagd via GitHub in plaats van te gokken: van buitenaf ziet een mislukte build er hetzelfde uit " +
          "als een trage.",
      },

      // ── Golf 1 ──
      {
        titel: "Golf 1: de bestaande motoren volwaardig maken",
        kern: "Vier punten waar het fundament er al ligt en er één ontbrekend stuk data tussen zit.",
        tekst:
          "Dit is de goedkoopste winst die er is: vier motoren die al draaien en op één punt op een benadering " +
          "leunen. Er hoeft niets nieuws bedacht te worden, alleen aangesloten.\n\n" +
          "| Punt | Wat het is | Verhouding |\n" +
          "|---|---|---|\n" +
          "| **R1** | Autoriteit per pagina aansluiten | ✅ af op 6 augustus 2026 |\n" +
          "| **R2** | Prioriteren op conversies in plaats van klikken | ✅ af op 7 augustus 2026 |\n" +
          "| **R3** | AI-vindbaarheid op onderwerpniveau | Middel werk, groot verkoopeffect |\n" +
          "| **R4** | Verbruik compleet: de Ahrefs-credits erbij | ✅ af op 8 augustus 2026 |",
        sub: [
          {
            titel: "R1. Autoriteit per pagina aansluiten — af op 6 augustus 2026",
            tekst:
              "**Klaar.** De interne-links-motor weegt bronpagina's niet langer op een benadering uit de eigen " +
              "linkgraaf, maar op de gemeten autoriteit van elke losse pagina uit Ahrefs. Bij elke voorgestelde " +
              "bronpagina staat het cijfer met de datum, en of het gemeten is of benaderd.\n\n" +
              "De volledige beschrijving staat nu in het hoofdstuk **Interne links: autoriteit gericht " +
              "doorsturen**, want het is werkelijkheid en geen plan meer. Wat hier blijft staan is waarom het " +
              "erop stond: dit was het enige gat in een motor die verder al af was, en juist het advies \"link " +
              "vanaf deze vijf pagina's\" geeft het snelst resultaat bij pagina's die net buiten de top staan.",
          },
          {
            titel: "R2. Prioriteren op conversies in plaats van op klikken",
            tekst:
              "**Wat er nu mis is.** Als het dashboard uitrekent wat een verbetering oplevert, rekent het in extra " +
              "bezoekers. Maar bezoekers zijn niet waar de klant voor betaalt; hij betaalt voor aanvragen. Twee " +
              "pagina's kunnen even vaak in Google verschijnen terwijl de ene tien keer zo veel klanten oplevert " +
              "als de andere, en dat verschil zie je nu nergens in de volgorde van het werk. De koppeling met " +
              "Google Analytics ligt er al en weet ook al hoeveel aanvragen de site in totaal binnenhaalt, maar " +
              "nog niet welke pagina daarvoor zorgde. En bij het bepalen van de volgorde wordt er helemaal niet " +
              "naar gekeken.\n\n" +
              "**Wat het oplevert.** Dit is het punt met het grootste effect van de hele lijst, om drie redenen.\n\n" +
              "- **Je werkt aan de pagina's die geld opleveren.** Nu bepaalt bezoek de volgorde van je werk, " +
              "straks bepaalt opbrengst hem. Een pagina waar mensen echt contact opnemen schuift naar boven; een " +
              "pagina die alleen gelezen wordt en niets oplevert zakt naar beneden.\n" +
              "- **Je hebt een ander gesprek met de klant.** In plaats van \"dit levert extra bezoekers op\" kun " +
              "je zeggen: \"deze aanpassing levert naar verwachting acht aanvragen per maand op\". Dat is het " +
              "gesprek waarin een klant makkelijker ja zegt tegen een hoger budget, omdat hij ziet wat hij ervoor " +
              "terugkrijgt.\n" +
              "- **Je kunt eerlijk nameten wat het opleverde.** Het dashboard meet nu al per aanpassing hoe een " +
              "pagina het deed vóór en ná de wijziging. Daar komt dan de enige uitkomst bij die echt telt: kwamen " +
              "er ook meer aanvragen binnen?\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Per pagina bij Google Analytics ophalen hoeveel aanvragen er binnenkwamen. Niet elke klant heeft " +
              "dat ingericht, dus zonder die gegevens moet alles gewoon blijven werken zoals het nu werkt.\n" +
              "2. Per klant twee dingen vastleggen: wat is bij deze klant een aanvraag (een ingevuld formulier, een " +
              "telefoontje, een bestelling), en wat is zo'n aanvraag gemiddeld waard? Twee velden bij de " +
              "klantgegevens, en leeg laten mag: dan blijft het onbekend.\n" +
              "3. De verwachte opbrengst omrekenen naar aanvragen: hoeveel extra bezoekers verwachten we, welk " +
              "deel daarvan neemt op déze pagina contact op, en wat is dat waard? Weten we de waarde niet, dan " +
              "blijft de oude rekenwijze staan en zegt het dashboard er zichtbaar bij dat het over bezoekers gaat.\n" +
              "4. Overal dezelfde eenheid op het scherm: verwachte aanvragen per maand, en als de waarde bekend is " +
              "ook het bedrag.\n\n" +
              "**Waaraan je ziet dat het af is.** Bij een klant waar aanvragen gemeten worden, staat de lijst met " +
              "prioriteiten in een andere volgorde dan wanneer je alleen naar bezoek kijkt, en staat bij elk punt " +
              "hoeveel aanvragen het naar verwachting oplevert. Bij een klant zonder die gegevens is er niets " +
              "veranderd, met een regel erbij waarom.\n\n" +
              "**Wat het raakt.** Dit verandert de lijst met prioriteiten, het formulier met klantgegevens, het " +
              "scherm met resultaten en de meting van wat een aanpassing opleverde. Belangrijk daarbij: het aantal " +
              "aanvragen per pagina wordt op één plek berekend, en alle andere schermen halen het daar op. Wordt " +
              "het op twee plekken gerekend, dan gaan die twee vroeg of laat verschillende getallen tonen.",
          },
          {
            titel: "R3. AI-vindbaarheid op onderwerpniveau",
            tekst:
              "**Wat er nu mis is.** De AI-lens weet één ding: in hoeveel AI-antwoorden een domein voorkomt. Dat " +
              "is een thermometer, geen advies. Je kunt er niet uit halen op welke vragen de klant ontbreekt, wie " +
              "er dan wél genoemd wordt, en welke pagina daarvoor gemaakt of aangepast moet worden.\n\n" +
              "**Wat het oplevert.** Dit is de vraag die bij klanten het snelst groeit en waar bijna geen bureau " +
              "een antwoord op heeft. Het is dus zowel de zwakste lens als de sterkste verkoopkans op deze lijst. " +
              "Met onderwerpniveau erbij wordt het een volwaardige vijfde motor naast meta, opruimen, interne " +
              "links en zoekwoordkansen.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Per klant een set vragen vastleggen zoals een klant ze aan een AI zou stellen. Die vragen " +
              "volgen uit de zoekwoordenlijst die er al is, dus dit kan voorgesteld worden in plaats van " +
              "uitgevraagd.\n" +
              "2. Per vraag ophalen: wordt de klant genoemd, welke bronnen worden aangehaald, en welk aandeel " +
              "heeft de klant in het geheel. Bij Ahrefs zit dit in de AI-rapportage; de koppeling die we al " +
              "gebruiken voor het aantal antwoorden kan dit ook leveren.\n" +
              "3. Historie bewaren, want de waarde zit in de beweging: op welke vragen komen we op, waar zakken " +
              "we weg.\n" +
              "4. De uitkomst doorzetten naar werk: een vraag waarop de klant ontbreekt terwijl er wel bronnen " +
              "worden aangehaald is een vragen-en-antwoorden-blok of een nieuwe pagina, en dat is een bevinding in " +
              "de prioriteitenscan met een knop naar de bestaande documentenketen.\n\n" +
              "**Waaraan je ziet dat het af is.** Er is een lijst vragen per klant met per vraag: genoemd of niet, " +
              "wie er wel genoemd wordt, en de beweging over tijd. En minstens één bevinding uit die lijst is via " +
              "de gewone weg (kaart met knop) een taak of een document geworden.\n\n" +
              "**Wat het raakt.** Dit verandert de lijst met prioriteiten, waar AI-vindbaarheid dan een volwassen " +
              "onderdeel wordt naast de andere vier. Verder raakt het de afgesproken zoekwoorden, het scherm met " +
              "het verbruik, en het verhaal dat je de klant elke maand vertelt.",
          },
          {
            titel: "R4. Verbruik compleet: de Ahrefs-credits erbij — af op 8 augustus 2026",
            tekst:
              "**Klaar.** Ahrefs-verbruik krijgt nu een echt bedrag zodra er een prijs per unit is ingesteld, en " +
              "het verbruiksscherm laat per klant per maand één totaal zien dat AI en Ahrefs samen dekt, met de " +
              "duurste actie van die maand erbij en de verhouding tot het maandbudget van de klant.\n\n" +
              "De volledige beschrijving staat nu in het hoofdstuk **Bedrijfsvoering: geld, verbruik en team**, " +
              "bij **Verbruik en kosten per actie**, want het is werkelijkheid en geen plan meer. Wat hier blijft " +
              "staan is waarom het erop stond: zonder dit cijfer kon je niet zeggen wat een klant in dit systeem " +
              "kost, en dus ook niet wat een bureau ervoor zou moeten betalen.",
          },
        ],
      },

      // ── Golf 2 ──
      {
        titel: "Golf 2: de remmen weghalen die groei tegenhouden",
        kern: "Vier punten die nu nog werken omdat het bureau uit één persoon bestaat.",
        tekst:
          "Deze vier zijn vandaag geen probleem en morgen wel. Ze gaan allemaal over hetzelfde: het dashboard is " +
          "gebouwd voor één mens met één mailbox en klanten op WordPress. Elk punt hier is de eerste blokkade bij " +
          "een tweede accountmanager, een klant op een ander systeem of een tweede bureau.\n\n" +
          "| Punt | Wat het is | Wordt urgent zodra |\n" +
          "|---|---|---|\n" +
          "| **R5** | Meerdere mailboxen | er iemand naast je meewerkt |\n" +
          "| **R6** | Tweede sitekoppeling, en copy doorvoeren | WordPress-deel ✅ af op 9 augustus 2026; tweede systeem: zodra er een klant niet op WordPress zit |\n" +
          "| **R7** | Bronnen-gezondheid: welke bron is stil? | ✅ af op 8 augustus 2026 |\n" +
          "| **R8** | Correcties worden regels, in élke motor | je dezelfde correctie twee keer maakt |",
        sub: [
          {
            titel: "R5. Meerdere mailboxen",
            tekst:
              "**Wat er nu mis is.** De correspondentie hangt aan één gekoppelde mailbox. Alles wat de assistent " +
              "weet over afspraken komt daaruit. Werkt er iemand anders aan een klant, dan is diens mail " +
              "onzichtbaar, en dan is de context van de assistent stil incompleet. Dat is erger dan geen context, " +
              "want het ziet er compleet uit.\n\n" +
              "**Wat het oplevert.** Dit is de eerste harde blokkade bij groei, en ook bij een tweede bureau. Met " +
              "meerdere mailboxen wordt de teamgebruiker-laag die er al is (eigen inlog, eigen klanten, wel of " +
              "geen mail) pas echt bruikbaar.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. De koppeling per gebruiker in plaats van per omgeving: dezelfde eenmalige login, maar de " +
              "bewaarde toegang hangt aan de teamgebruiker.\n" +
              "2. Per klant vastleggen welke mailboxen erbij horen, zodat de correspondentie van twee mensen in " +
              "één tijdlijn komt met de afzender erbij.\n" +
              "3. Versturen blijft persoonlijk: je stuurt vanuit je eigen mailbox, nooit vanuit die van een " +
              "collega.\n" +
              "4. De scheiding respecteren die er al is: een gast die geen mail mag zien, ziet ook hier niets.\n\n" +
              "**Waaraan je ziet dat het af is.** Twee mailboxen gekoppeld, en bij een klant staat de " +
              "correspondentie van beide door elkaar in de tijdlijn, met per bericht wie het stuurde. Een gast " +
              "zonder mailrecht ziet nul berichten.\n\n" +
              "**Wat het raakt.** Dit verandert de manier waarop mail binnenkomt, de tijdlijn per klant, de controle op " +
              "uitgaande mail en wat de assistent weet als je met hem praat. Ook de rechten gaan mee: een gast die " +
              "geen mail mag zien, blijft niets zien.",
          },
          {
            titel: "R6. Tweede sitekoppeling, en copy doorvoeren — WordPress-deel klaar op 9 augustus 2026",
            tekst:
              "**Wat er klaar is.** De copy, het grootste werkstuk van de hele keten, ging tot nu toe altijd met de " +
              "hand van het copydocument naar de site. Vanaf nu kun je bij een pagina met een goedgekeurde copy op " +
              "“Zet copy als concept in de site” drukken: het dashboard zet de volledige, goedgekeurde tekst " +
              "als NIEUW concept (nog niet zichtbaar voor bezoekers) in WordPress, met een link naar het bewerkscherm " +
              "waar je het meteen kunt zien. De bestaande, live pagina van de klant wordt hierbij niet aangeraakt; " +
              "publiceren, of de tekst overzetten naar de bestaande pagina, doe je zelf met die link, in je eigen " +
              "WordPress-inlog. Er wordt altijd teruggecontroleerd of het concept er ook echt (en nog als concept, " +
              "niet per ongeluk meteen live) staat, en een mislukte poging meldt eerlijk waarom, net als bij de meta- " +
              "en alt-teksten hiernaast.\n\n" +
              "Onder deze knop zit nu ook de vorm die volgende systemen straks kunnen hergebruiken: één klein " +
              "koppelvlak per sitesysteem (versleuteld wachtwoord, altijd terugcontrole, eerlijk melden als het niet " +
              "lukte), waar WordPress het eerste koppelstuk van is.\n\n" +
              "**Wat nog open staat.** Er is nog geen klant bekend die niet op WordPress zit, dus het tweede " +
              "koppelstuk (voor dat andere systeem) is er nog niet; zodra dat zich aandient, komt het naast het " +
              "WordPress-koppelstuk. Tot die tijd blijft de werklijst voor de sitebouwer de terugval voor elke site " +
              "zonder koppeling.\n\n" +
              "**Waaraan je ziet dat het af is.** Een goedgekeurd copydocument staat als concept in de site, met " +
              "een voorbeeldlink, zonder dat er iets gekopieerd is. En hetzelfde werkt op een tweede systeem.\n\n" +
              "**Wat het raakt.** Dit verandert de laatste stap van de documentenketen, het lijstje dat de sitebouwer " +
              "krijgt, de voortgang per pagina en het overzicht van wat we voor de klant gedaan hebben.",
          },
          {
            titel: "R7. Bronnen-gezondheid: welke bron is vandaag stil? — af op 8 augustus 2026",
            tekst:
              "**Klaar.** Elke koppeling (Ahrefs, Google, Microsoft 365, Moneybird, WordPress per klant) schrijft " +
              "nu bij elk gebruik weg of het lukte, en bij een fout waarom. Er is één scherm, " +
              "`/admin/bronnen-gezondheid`, dat elke koppeling bij het openen meteen vers test en per bron laat " +
              "zien: werkt hij, wanneer ging het voor het laatst goed, en wat er precies mis is, met een knop om " +
              "hem opnieuw te koppelen waar dat kan.\n\n" +
              "De volledige beschrijving staat nu in het hoofdstuk **Waar het mee gekoppeld is**, bij " +
              "\"Bronnen-gezondheid: houdt zichzelf in de gaten\", want het is werkelijkheid en geen plan meer. " +
              "Wat hier blijft staan is waarom het erop stond: het hele dashboard rust op de belofte dat een " +
              "cijfer uit een bron komt en dat ontbrekende data ontbrekend heet, en een stille bron ondermijnde " +
              "die belofte zonder dat iemand het zag.",
          },
          {
            titel: "R8. Correcties worden regels, in élke motor",
            tekst:
              "**Wat er nu mis is.** Bij opruimen worden jouw correcties vastgelegd als harde regels, zodat de " +
              "volgende analyse dezelfde fout niet meer maakt. Dat is een van de beste dingen in het hele " +
              "dashboard, en het bestaat op precies één plek. Corrigeer je een meta-voorstel, een linksuggestie of " +
              "een prioriteit, dan is die correctie een eenmalige aanpassing en begint de volgende ronde weer bij " +
              "nul.\n\n" +
              "**Wat het oplevert.** Dit is wat het systeem beter maakt door gebruik, en dus ook wat het verhaal " +
              "naar buiten waarmaakt (\"het wordt beter doordat je het gebruikt\"). Het is opgebouwde waarde die " +
              "niet naar een andere tool mee te nemen is. Praktisch: minder dezelfde correctie twee keer, en " +
              "voorstellen die na een paar maanden klinken zoals jij ze zou schrijven.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. De vorm die bij opruimen al werkt uit dat onderdeel halen en algemeen maken: per klant, per " +
              "motor, een regel met wat er gold en waarom, met datum.\n" +
              "2. Een correctie wordt niet stil weggeschreven; je ziet dat er een regel bij komt en kunt hem " +
              "terugdraaien. Een regel die je niet kunt zien is een systeem dat iets van je overneemt.\n" +
              "3. De motoren die met AI werken krijgen die regels als harde randvoorwaarden mee, niet als " +
              "suggestie.\n" +
              "4. Eén plek per klant waar alle geleerde regels op een rij staan, doorzoekbaar. Dat is ook het " +
              "eerste wat je wil zien als een collega een account overneemt.\n\n" +
              "**Waaraan je ziet dat het af is.** Een gecorrigeerd meta-voorstel: na de volgende ronde staat de " +
              "correctie erin, en de regel staat met datum en reden in de lijst geleerde regels van die klant.\n\n" +
              "**Wat het raakt.** Dit verandert de voorstellen voor meta-teksten, het advies over interne links, de " +
              "lijst met prioriteiten en de documenten. De regels die het opruimen nu al leert gaan hierin op, " +
              "zodat er niet twee systemen naast elkaar komen te staan die hetzelfde doen.",
          },
        ],
      },

      // ── Golf 3 ──
      {
        titel: "Golf 3: van eigen werkplek naar product",
        kern: "Vijf punten die nodig zijn voordat iemand anders dit kan gebruiken of kopen.",
        tekst:
          "Golf 1 en 2 maken het dashboard beter voor Pingwin. Deze golf maakt er iets van dat een ander bureau " +
          "kan gebruiken, en dat een investeerder kan beoordelen.\n\n" +
          "| Punt | Wat het is | Waarom het in deze golf zit |\n" +
          "|---|---|---|\n" +
          "| **R9** | Klantdashboard op echte data | Grootste verkoopwaarde, raakt de klant direct |\n" +
          "| **R10** | Signaleren in plaats van kijken | Maakt het systeem proactief zonder waslijst |\n" +
          "| **R11** | Licentie-klaar: sleutels, opzet, quota | Voorwaarde voor een tweede bureau |\n" +
          "| **R12** | Vangnet onder de rekenmotoren | Voorwaarde om snel te blijven bouwen |\n" +
          "| **R13** | Wie deed wat: een spoor van wijzigingen | Nodig zodra er gasten meewerken |\n" +
          "| **R14** | Schermafbeeldingen, door het dashboard zelf gemaakt | Maakt het verhaal zichtbaar |\n" +
          "| **R15** | De verkooppitch als eigen pagina | Overtuigt in twee minuten |",
        sub: [
          {
            titel: "R9. Het klantdashboard op echte data — gebouwd, wacht op jouw eerste klikje",
            tekst:
              "**Waar het nu staat.** De cockpit wist al alles: klikken, vertoningen, wat er is uitgevoerd. Het " +
              "dashboard dat de klant ziet, las tot nu toe alleen een spreadsheet met werkzaamheden, uren en " +
              "budget. Dat is nu aangevuld: elke klant heeft een blok **\"Ontwikkeling deze maand\"** " +
              "klaarstaan, dat in gewone taal vertelt hoe de klikken en vertoningen vanuit Google zich " +
              "ontwikkelden ten opzichte van de periode ervoor, en welke aanpassingen er de afgelopen maand op " +
              "de site zijn doorgevoerd, met wanneer. Geen nieuwe meting: het leunt op de nachtelijke " +
              "klik-vergelijking (dezelfde die de klanten-kiezer al gebruikt) en op het wijzigingenlogboek dat er " +
              "al was.\n\n" +
              "**Wat het oplevert.** Dit is het punt met de meeste verkoopwaarde van de hele lijst. Een klant die " +
              "elke maand ziet wat er gedaan is én wat het deed, vertrekt niet. Het is ook het onderdeel dat je " +
              "aan een lead kunt laten zien: dit krijg jij erbij.\n\n" +
              "**Wat je nog moet doen.** Het blok staat per klant standaard uit; er gaat dus nog niets " +
              "automatisch naar iemand toe. Open bij een klant de voorbeeldweergave (Klant-tab, knop " +
              "\"Voorbeeld\") en je ziet het blok bovenaan het dashboard staan, met een knop erboven: " +
              "\"Verborgen voor de klant – zet aan\". Klopt de tekst, klik hem aan; vanaf dat moment ziet de " +
              "klant het zelf, zonder dat jij er iets voor stuurt.\n\n" +
              "**Waaraan je ziet dat het af is.** Bij minstens één klant staat het blok aangezet, en die klant " +
              "ziet zonder jouw tussenkomst de ontwikkeling van deze maand in gewone taal. Tot dat moment blijft " +
              "dit punt op \"loopt\" staan, ook al is de code klaar: gebouwd is nog geen gebruikt.\n\n" +
              "**Wat het raakt.** Dit verandert het dashboard dat de klant zelf ziet en de voorbeeldweergave " +
              "waarin jij dat vooraf naloopt. Het leunt op de klik-trend en het wijzigingenlogboek, en het " +
              "verandert de maandelijkse ronde langs je klanten.",
          },
          {
            titel: "R10. Signaleren in plaats van kijken",
            tekst:
              "**Wat er nu mis is.** Er draait elke nacht en elke week veel op de achtergrond: sites worden " +
              "gescand, verschillen vastgelegd, trends bijgewerkt. Maar het resultaat wacht tot iemand een klant " +
              "opent. Zakt een pagina weg, verdwijnt er een schema-blok, of gooit een plugin alle alt-teksten " +
              "leeg, dan staat dat netjes vastgelegd en ziet niemand het tot het toeval jouw kant op valt.\n\n" +
              "**Wat het oplevert.** Het verschil tussen een systeem dat je moet bezoeken en een systeem dat je " +
              "waarschuwt. Bij twintig klanten kun je niet meer rondkijken; dan moet wat stuk is naar jou toe " +
              "komen. Dit is ook het soort ding waar een klant respect voor heeft: jij belt hem over een probleem " +
              "dat hij zelf nog niet zag.\n\n" +
              "**Hoe we het zouden bouwen.** Eén ding is hier belangrijker dan de techniek: dit mag geen waslijst " +
              "worden. De regel uit de assistent geldt hier net zo hard, dus terughoudend tegen de gebruiker.\n\n" +
              "1. Een korte, harde lijst van wat een signaal verdient: een pagina die echt wegzakt, een pagina " +
              "die verdwijnt, een meta of schema die stuk is, een doorgevoerde wijziging die na acht weken niets " +
              "deed.\n" +
              "2. Eén bericht per dag per klant, of niets. Nooit een bericht per bevinding.\n" +
              "3. Het bericht is een knop, geen tekst: je landt op de plek waar het werk gebeurt.\n" +
              "4. Elk signaal is stil te zetten met een reden, en die reden wordt een regel (zie R8).\n\n" +
              "**Waaraan je ziet dat het af is.** Een pagina zakt echt weg en er komt binnen een dag één bericht " +
              "met een knop naar die pagina. Een pagina die normaal schommelt levert géén bericht op.\n\n" +
              "**Wat het raakt.** Dit verandert wat er 's nachts en 's weekends op de achtergrond draait, het overzicht " +
              "van veranderingen op de site van de klant, de ontwikkeling over tijd en de lijst met prioriteiten.",
          },
          {
            titel: "R11. Licentie-klaar: sleutels, opzet en quota",
            tekst:
              "**Wat er nu mis is.** De code kan al onder meerdere merken draaien, en dat werkt in productie. " +
              "Maar de sleutels van de koppelingen staan als omgevingsvariabelen bij de hosting, en een eigen " +
              "Ahrefs-sleutel per klant loopt via een label dat naar zo'n variabele wijst. Dat is netjes en veilig " +
              "voor één of twee omgevingen, en het schaalt niet naar tien bureaus die zelf willen kunnen " +
              "koppelen.\n\n" +
              "**Wat het oplevert.** Dit is het verschil tussen \"ik kan een omgeving voor je opzetten\" en \"je " +
              "kunt hem zelf in gebruik nemen\". Zonder dit is elke nieuwe licentie handwerk van jou, en dan is " +
              "groei jouw agenda in plaats van een product.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Sleutels versleuteld in de database in plaats van bij de hosting, met dezelfde aanpak die al " +
              "gebruikt wordt voor het sitewachtwoord: versleuteld opgeslagen, nooit terug te lezen. De regel " +
              "\"nooit een sleutel in een bestand\" blijft dus overeind.\n" +
              "2. Een opzetscherm dat per koppeling zegt of hij staat en wat er nog mist, in plaats van een " +
              "handleiding met omgevingsvariabelen.\n" +
              "3. Een grens per omgeving: hoeveel klanten, hoeveel verbruik per maand, en wat er gebeurt als die " +
              "grens in zicht komt. Dat is met R4 erbij gewoon af te lezen.\n" +
              "4. Beveiliging blijft staan zoals hij staat: geen sleutel betekent dat de ingang niet bestaat, ook " +
              "in een omgeving van iemand anders.\n\n" +
              "**Waaraan je ziet dat het af is.** Een nieuwe omgeving is vanaf leeg in gebruik te nemen zonder " +
              "dat jij een omgevingsvariabele aanraakt, en het opzetscherm laat zien welke koppelingen nog " +
              "ontbreken.\n\n" +
              "**Wat het raakt.** Dit verandert de manier waarop alle koppelingen hun sleutels bewaren, het beheerscherm " +
              "en de beveiliging. Het is het zwaarste punt van de lijst, en het is pas echt af als R4 en R7 " +
              "gedaan zijn: zonder de kosten per klant en zonder zicht op stille koppelingen kun je geen omgeving " +
              "aan iemand anders overdragen.",
          },
          {
            titel: "R12. Een vangnet onder de rekenmotoren",
            tekst:
              "**Wat er nu mis is.** Er staan drie proeven in het project: op de meetlaag, op de mailteksten en " +
              "op de weging van de prioriteitenscan. Dat zijn precies de goede drie plekken om te beginnen, en " +
              "het is te weinig voor een systeem van deze grootte. De scores, de verwachte opbrengsten, de " +
              "klikpercentage-tabellen en de fase-logica zijn puur rekenwerk, en juist daar verandert een fout " +
              "stil de rangorde van het werk zonder dat er iets kapot lijkt.\n\n" +
              "**Wat het oplevert.** Snelheid. Niet netheid. Elke keer dat aan de scoring gesleuteld wordt, moet " +
              "iemand nu met de hand controleren of de rangorde nog klopt, en dat kost meer tijd dan het schrijven " +
              "van de proef. Het is ook de enige manier om te blijven bouwen in dit tempo zonder dat er " +
              "onopgemerkt iets scheef gaat.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Proeven op de rekenlagen zonder koppelingen: de paginascore, de verwachte opbrengst, de " +
              "fase-logica en de klikpercentage-tabel. Vaste invoer, vaste verwachte uitkomst.\n" +
              "2. Een vastgelegde momentopname van een uitkomst: verandert de score van een voorbeeldpagina, dan " +
              "moet dat een bewust besluit zijn en geen verrassing.\n" +
              "3. Nieuwe motoren krijgen vanaf de start een proef op hun rekenkern. Dat is de vaste stap; " +
              "achteraf toevoegen gebeurt nooit.\n\n" +
              "**Waaraan je ziet dat het af is.** Eén commando dat alle proeven draait, dat groen is, en dat rood " +
              "wordt als je met opzet een gewicht in de scoring verandert.\n\n" +
              "**Wat het raakt.** Alleen het rekenwerk onder de motoren. Aan de buitenkant verandert er niets, dus dit " +
              "is het veiligste punt van de lijst om tussendoor te doen terwijl er iets anders loopt.",
          },
          {
            titel: "R13. Wie deed wat: een spoor van wijzigingen",
            tekst:
              "**Wat er nu mis is.** Er is een rechtenlaag met teamgebruikers die eigen klanten hebben, en er is " +
              "een overzicht van wat er voor een klant is uitgevoerd. Wat er niet is: wie welke wijziging in het " +
              "dashboard deed. Wie keurde die meta goed, wie draaide dat opruimvoorstel terug, wie zette die " +
              "redirect erin.\n\n" +
              "**Wat het oplevert.** Zodra er iemand naast je meewerkt is dit het verschil tussen samenwerken en " +
              "elkaar in de weg zitten. Het is ook wat je nodig hebt als een klant vraagt waarom iets veranderd " +
              "is, en het is de basis onder een gerust gevoel bij het uitdelen van rechten: je kunt iemand meer " +
              "toevertrouwen als je kunt terugkijken.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Bij elke handeling die iets verandert vastleggen: wie, wat, wanneer, en bij welke klant. Niet " +
              "bij het lezen, want dan wordt het een berg zonder betekenis.\n" +
              "2. Zichtbaar op de plek waar het over gaat: bij de kaart, bij de pagina, bij de klant. Niet als " +
              "apart logboek dat niemand opent.\n" +
              "3. De alleen-lezen meekijk-sessie blijft doen wat hij doet, en die kan per definitie niets " +
              "veranderen.\n\n" +
              "**Waaraan je ziet dat het af is.** Bij een goedgekeurd meta-voorstel staat wie het goedkeurde en " +
              "wanneer, en dat is terug te zien bij de pagina.\n\n" +
              "**Wat het raakt.** Elke handeling die iets wijzigt krijgt hier een regel bij, en die regel verschijnt op " +
              "de kaart waar het over gaat. Verder raakt het de rechten, want dit is wat je nodig hebt om iemand " +
              "meer te durven toevertrouwen.",
          },
          {
            titel: "R14. Schermafbeeldingen, door het dashboard zelf gemaakt",
            tekst:
              "**Wat er nu mis is.** De uitleg is tekst. Wie niet in het dashboard werkt moet zich voorstellen hoe " +
              "het eruitziet, en dat is precies de groep die het verhaal moet snappen: leads, collega-bureaus, " +
              "investeerders.\n\n" +
              "**Wat het oplevert.** Het verhaal wordt zichtbaar in plaats van beschreven. En het is de bouwsteen " +
              "onder R15 en onder elke handleiding.\n\n" +
              "**Hoe we het zouden bouwen.** Niet met de hand, want dan verouderen de beelden stil zodra een scherm " +
              "verandert. Er zit al een echte browser in de app (die meet de pagina's van klanten). Die laten we " +
              "zijn eigen schermen fotograferen:\n\n" +
              "1. Eén ingang die een schermafbeelding maakt van een opgegeven scherm, op een vaste breedte, met de " +
              "eigen sessie.\n" +
              "2. **Een anonieme stand die verplicht is voor alles wat openbaar komt.** Vóór de foto worden " +
              "klantnaam, domein en mailadressen vervangen door een neutrale naam. Zonder die stand zou de data van " +
              "een echte klant op een openbare pagina belanden, en dat kan niet.\n" +
              "3. Een vaste lijst: welk scherm hoort bij welk hoofdstuk. Eén opdracht vernieuwt ze allemaal.\n" +
              "4. Waar een scherm niet zonder echte klantdata te tonen is, komt het beeld achter de " +
              "beheerderslogin te staan in plaats van dat het wordt weggelaten.\n\n" +
              "**Waaraan je ziet dat het af is.** Elk hoofdstuk op de uitlegpagina heeft een beeld, er staat geen " +
              "echte klantnaam op een openbaar beeld, en één opdracht maakt ze allemaal opnieuw.\n\n" +
              "**Wat het raakt.** Dit verandert de uitlegpagina en de verkooppitch, en het gebruikt de browser die al in " +
              "het dashboard zit om pagina's van klanten te meten.",
          },
          {
            titel: "R15. De verkooppitch als eigen pagina",
            tekst:
              "**Wat er nu mis is.** De uitlegpagina legt alles uit, en dat is precies wat hij moet doen. Maar een " +
              "lead die overtuigd moet worden leest geen zestien hoofdstukken. Er is geen versie die in twee " +
              "minuten binnenkomt.\n\n" +
              "**Wat het oplevert.** Iets om te sturen of te laten zien in een gesprek, met één duidelijke " +
              "vervolgstap. Dit is het onderdeel dat direct omzet raakt.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Een eigen, korte pagina met de beelden uit R14 als hoofdrol en de tekst als bijrol.\n" +
              "2. Opgebouwd uit dezelfde bron als de uitleg, niet ernaast geschreven. Anders lopen het verhaal en " +
              "de pitch binnen een maand uiteen.\n" +
              "3. Eén boodschap per blok, in wat de klant eraan heeft, niet in wat wij gebouwd hebben.\n" +
              "4. Eén vervolgstap onderaan, geen keuzemenu.\n\n" +
              "**Waaraan je ziet dat het af is.** Iemand die het dashboard niet kent snapt binnen twee minuten wat " +
              "het is en wat hij ermee opschiet, zonder door te klikken.\n\n" +
              "**Wat het raakt.** Er komt één nieuwe pagina bij, die zijn tekst uit de uitlegpagina haalt in plaats van " +
              "een eigen versie te krijgen.",
          },
        ],
      },

      // ── Niet doen ──
      {
        titel: "Wat we bewust níet doen (en waarom)",
        kern: "Een routekaart zonder afvallers is een wensenlijst.",
        tekst:
          "Dit is de spiegel van het bakje \"niet doen\" in de prioriteitenscan. Deze vijf komen regelmatig " +
          "langs en zijn met reden afgewezen. Verandert de reden, dan verandert het besluit.\n\n" +
          "- **Een eigen volwaardige site-audit bouwen** (alle technische controles, foutcodes, " +
          "duplicaatdetectie). Ahrefs doet dat al beter dan wij het gaan doen, en de koppeling ligt er. Wij " +
          "voegen waarde toe in het oordeel, niet in het crawlen.\n" +
          "- **Een eigen zoekwoorddatabase opbouwen** om Ahrefs-credits te sparen. De cache doet dit al waar het " +
          "nut heeft. Eigen volumes zouden verouderen en dan hebben we twee cijfers die elkaar tegenspreken, " +
          "precies de fout die we overal uitsluiten.\n" +
          "- **Een mobiele app.** Het werk in dit dashboard is bureauwerk met twee kolommen en veel tekst. Een " +
          "app zou een uitgeklede versie zijn en dus een tweede weg naar hetzelfde resultaat.\n" +
          "- **Meertaligheid.** Alles is Nederlands, en dat past bij de klanten. Dit komt pas in beeld bij een " +
          "bureau buiten Nederland, en dan is het een echt project en geen vertaalslag.\n" +
          "- **De assistent zelfstandig laten uitvoeren** zonder goedkeuring. Technisch kan het vandaag al. Het " +
          "is een ontwerpbesluit dat het niet gebeurt: een systeem dat autonoom naar buiten mag, kun je niet " +
          "vertrouwen op het moment dat het één keer misgaat.",
      },

      // ── Risico's ──
      {
        titel: "Risico's om in de gaten te houden",
        kern: "Niet op te lossen met een punt op de lijst, maar met een gewoonte.",
        tekst:
          "- **Groei van het oppervlak.** Het dashboard is groot. Elke nieuwe motor is ook een nieuwe plek waar " +
          "een cijfer anders kan gaan staan. De regel dat lenzen elkaar uitvragen in plaats van opnieuw ophalen " +
          "is daarom geen stijlvoorkeur maar een noodzaak. Bij elk punt hierboven staat daarom \"wat het raakt\".\n" +
          "- **Twee wegen naar hetzelfde resultaat.** Dit is de fout die telkens terugkomt: twee knoppen die " +
          "allebei een kaart maken. Bij elke uitbreiding is dit de eerste vraag.\n" +
          "- **Serverless tijdsvensters.** Opgelost met hervatbare runs, maar elke nieuwe zware analyse moet die " +
          "vorm bewust aanhouden. Wie dat vergeet bouwt de oude fout opnieuw (een analyse die veertig minuten op " +
          "\"bezig\" staat en niets oplevert).\n" +
          "- **Prijzen die verouderen.** De modelprijzen staan als schatting in de code. Historische kosten " +
          "blijven kloppen (die zijn vastgelegd), maar de tabel moet bij na een tariefwijziging. R4 zet die " +
          "prijzen op één plek.\n" +
          "- **Documentatie die achterloopt op de code.** Deze pagina zelf is daar het risico. Vandaar dat het " +
          "onderhoud eronder een vaste stap is en geen goede bedoeling.",
      },

      {
        titel: "Hoe dit document wordt bijgehouden",
        tekst:
          "De uitleg is geen apart document maar een bestand in de code van het dashboard zelf " +
          "(`lib/uitleg.ts`). Dat is bewust: wie het dashboard uitbreidt heeft de uitleg in dezelfde map open " +
          "staan, en een uitbreiding zonder bijgewerkte uitleg valt op in de wijziging.\n\n" +
          "Vaste stap na een noemenswaardige uitbreiding: het hoofdstuk aanvullen, het bijbehorende punt in deze " +
          "routekaart afvinken of aanpassen, en de datum bovenaan verzetten. Hoofdstukken met de interne " +
          "markering blijven achter de beheerderslogin, dus de gaten hoeven niet te worden weggeschreven om de " +
          "pagina deelbaar te houden.\n\n" +
          "Een afgerond punt verdwijnt niet uit dit hoofdstuk, het verhuist: de beschrijving gaat naar het " +
          "hoofdstuk waar het thuishoort (dan is het werkelijkheid), en hier blijft één regel staan met de datum " +
          "waarop het klaar kwam. Zo blijft zichtbaar wat er in welk tempo gebeurd is, en dat is precies wat je " +
          "later in een licentie- of investeerdersgesprek nodig hebt.",
      },
    ],
  },

  // ── 16 ───────────────────────────────────────────────────
  {
    id: "vervolg",
    titel: "Wat je hiermee kunt",
    intro:
      "Deze pagina is het fundament. Wat er nog uit voortkomt zijn afgeleiden, en die worden hierop gebouwd " +
      "zodat ze niet uit elkaar gaan lopen.",
    uitklappers: [
      {
        titel: "Voor klanten en leads",
        tekst:
          "De hoofdstukken over de koppelingen, de motoren en de documentenfabriek zijn het antwoord op de vraag " +
          "'wat krijg ik precies voor mijn geld'. Concreet, met bewijs, en zonder de belofte dat het geheim is " +
          "hoe het werkt.",
      },
      {
        titel: "Voor bureaus die het willen gebruiken",
        tekst:
          "De hoofdstukken over de opzet, de veiligheid en het gebruik zijn de basis van een handleiding en van " +
          "een licentiegesprek: wat is er nodig, wat kost het per klant, en wat verandert er in de manier van " +
          "werken (zo weinig mogelijk).",
      },
      {
        titel: "Voor een investeerder",
        tekst:
          "De hoofdstukken over de opzet, de motoren, de bedrijfsvoering en het onderscheid vormen samen het " +
          "verhaal: wat is er gebouwd, waarom is het moeilijk na te maken, wat kost het per klant, en waar zit " +
          "de opgebouwde waarde. Het interne hoofdstuk met de openstaande punten hoort daar in een gesprek bij, " +
          "want een verhaal zonder gaten is geen verhaal.",
      },
      {
        titel: "Wat er nog bij komt",
        tekst:
          "Deze pagina is de tekstuele basis. Daar bovenop komen schermafbeeldingen per hoofdstuk, een " +
          "handleiding per rol (bureau, klant, sitebouwer) en een gerichte verkoopversie per doelgroep. Die " +
          "worden uit dit document opgebouwd en niet ernaast, zodat er één verhaal blijft.",
      },
    ],
  },
];

/** De hoofdstukken die een bepaalde bezoeker mag zien. */
export function zichtbareHoofdstukken(isBeheerder: boolean): Hoofdstuk[] {
  return HOOFDSTUKKEN.filter((h) => isBeheerder || !h.intern);
}
