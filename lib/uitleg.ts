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

export const LAATST_BIJGEWERKT = "6 augustus 2026";

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
          "uren en het budget, en de documenten die voor hem klaargezet zijn.\n\n" +
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
          "| **Taken** | Het startscherm: je prioriteiten, de gesprekken en de weekplanning |\n" +
          "| **Pagina's** | Elke pagina van de site: hoe hij scoort, wat eraan gedaan is, wat er nog moet |\n" +
          "| **Site-breed** | Prioriteitenscan, Meta en CTR, Opruimen, Interne links |\n" +
          "| **Klant** | Documenten, Wat we doen, Wijzigingen, Klantgegevens |\n" +
          "| **KPI's** | Posities, vertoningen, klikken en de ontwikkeling daarvan |\n" +
          "| **Developer** | Alle developer-taken over alle klanten heen |\n\n" +
          "Daarnaast zit er aan de rechterrand een inschuifbaar zijpaneel met de zoekwoorden en de landingspagina's " +
          "die met de klant zijn afgesproken. Dat is op elk tabblad bereikbaar, want dat is de afspraak waar al " +
          "het werk aan getoetst wordt.",
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
          "tussen een alt-tekst die beschrijft wat er staat en een alt-tekst die gokt.",
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
          "pakt een achtergrondwerker een run zonder hartslag gewoon weer op.",
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
            titel: "Waarom er ook een bakje 'niet doen' is",
            tekst:
              "Elke tool die alleen kansen opsomt maakt de gebruiker onzekerder, niet zekerder. Een advies is " +
              "pas een advies als er ook iets afvalt. Wat afvalt komt met reden in beeld, zodat het een besluit " +
              "is en geen vergissing.",
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
            titel: "Nameten",
            tekst:
              "Na het doorvoeren van een opruimactie wordt er gemeten of het gewerkt heeft: rankt nu de bedoelde " +
              "pagina, en is het wisselen gestopt? Zonder die stap is opruimen een geloofsartikel.",
          },
        ],
      },
      {
        titel: "Interne links: autoriteit gericht doorsturen",
        kern: "Niet 'meer links', maar de juiste links, gewogen op waarde en relevantie.",
        tekst:
          "Deze motor bouwt de interne linkgraaf uit een echte crawl van de belangrijkste pagina's: per pagina de " +
          "uitgaande interne links met hun ankertekst. Daar komt de Search Console-data bij (positie en klikken " +
          "per pagina) en de zoekvolumes uit Ahrefs.\n\n" +
          "Wat er dan berekend wordt:\n\n" +
          "- **Welke bronpagina's het beste naar een doelpagina linken**, gewogen op hoeveel waarde die " +
          "bronpagina kan doorgeven én hoe inhoudelijk relevant hij is. Beide, niet één van de twee.\n" +
          "- **Click depth vanaf de homepage.** Hoeveel klikken is een pagina verwijderd van de voordeur?\n" +
          "- **Doelpagina's op de rand van de winst.** Pagina's op positie 5 tot 15 met genoeg vertoningen: dat " +
          "is waar interne links het meeste verschil maken.\n" +
          "- **Bewaking van het ankerprofiel**, zodat je niet twintig keer dezelfde ankertekst plaatst en de " +
          "pagina over-optimaliseert.\n\n" +
          "Wat nog niet is aangesloten (de autoriteitswaarde per losse pagina uit Ahrefs) wordt eerlijk als " +
          "ontbrekend gemarkeerd in de datakwaliteit, in plaats van stil geschat.",
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
          "bijgehouden van wat wél meetelt. Een zwarte lijst van hulptypes loopt altijd één stap achter.",
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
        titel: "De planning: taken, weken en het bord",
        kern: "Plannen door te slepen, afvinken in de kaart.",
        tekst:
          "Taken hangen aan een week en aan het onderwerp waar ze uit voortkwamen. Slepen naar een andere week " +
          "is de planning bijwerken.\n\n" +
          "Het planningsbord is bewust een **signaalscherm** en geen bedieningspaneel: één regel per taak, met " +
          "wie, welke pagina, de zeven fases als gekleurde letters, de volgende stap en de dag. De bolletjes zijn " +
          "expres geen knoppen. Afvinken hoort in de kaart waar het werk gebeurt, en dan kleuren ze hier vanzelf " +
          "mee. Anders bestaan er twee wegen naar dezelfde stand, en dan lopen ze uiteen.",
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
          "niemand aan begon.",
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
          "automatisch, maar wordt in de werklijst voor de sitebouwer gemarkeerd.",
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
          "bruikbaar antwoord krijgt.",
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
        kern: "Wat kost welke knop, per klant en per periode.",
        tekst:
          "Elke betaalde aanroep schrijft een regel weg: welke klant, welke actie, hoeveel tokens in en uit, en " +
          "de geschatte kosten. Op het verbruiksscherm staan de acties met leesbare namen, dus 'analyse-document " +
          "(diep)' in plaats van een technische code.\n\n" +
          "Waarom dat er is: bij een dashboard dat AI en betaalde API's gebruikt is de marge per klant een " +
          "gevolg van hoe vaak welke knop wordt ingedrukt. Zonder deze meting weet je dat pas als de rekening " +
          "komt.",
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
          "2. Rechts staat de stand van zaken uit de mail, de afgesproken zoekwoorden en landingspagina's, en de " +
          "laatste correspondentie.\n" +
          "3. Pak het bovenste punt. Is het een pagina, dan ga je naar die pagina en zie je meteen wat er is en " +
          "wat de volgende fase is.\n" +
          "4. Laat het dashboard het zware werk doen: het document, het voorstel, de meting. Jij keurt goed.",
      },
      {
        titel: "Een nieuwe klant erin zetten",
        kern: "Naam, domein, en de rest bouwt zichzelf op.",
        tekst:
          "Een klant aanmaken is een naam en een domein. Daarna:\n\n" +
          "- Er wordt een wachtwoord gegenereerd (één keer zichtbaar) als de klant een eigen dashboard krijgt.\n" +
          "- Het klantprofiel en de bedrijfsgegevens worden vanaf de website gevuld.\n" +
          "- De bedrijfsgegevens gaan als link naar de klant om na te lopen, en worden daarna vergrendeld.\n" +
          "- De site wordt gescand: pagina's, meta's, koppen, links, schema, snelheid.\n" +
          "- De prioriteitenscan draait en zegt waar te beginnen.",
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
    titel: "Eerlijke agenda: wat nog niet af is",
    intern: true,
    intro:
      "Dit hoofdstuk is alleen zichtbaar met een beheerderssessie. Het staat er zodat dit document ook naar " +
      "binnen werkt: waar zitten de gaten, de risico's en de dingen die beter kunnen? Wat hier staat is bekend " +
      "en benoemd, niet verzwegen.",
    uitklappers: [
      {
        titel: "Gaten in de data",
        tekst:
          "- **Autoriteit per losse pagina** is niet aangesloten in de interne-links-motor. Dat wordt eerlijk " +
          "als ontbrekend gemarkeerd, maar het betekent dat de weging op linkwaarde nu op een benadering leunt.\n" +
          "- **Backlinks per pagina** idem: kapotte backlinks komen wel binnen, het volledige profiel niet.\n" +
          "- **AI-vindbaarheid** is de jongste lens en nog de dunste: het aantal AI-antwoorden waarin een domein " +
          "voorkomt, zonder onderwerpniveau erachter.\n" +
          "- **Verbruiksmeting** dekt de AI-kosten wel en de Ahrefs-credits nog niet volledig. De marge per " +
          "klant is daarmee nog niet compleet.",
      },
      {
        titel: "Afhankelijkheden die kunnen bijten",
        tekst:
          "- **Eén mailbox als bron.** De correspondentie hangt aan één gekoppelde mailbox. Voor een bureau met " +
          "meerdere accountmanagers is dat een echte beperking.\n" +
          "- **WordPress als enige sitekoppeling.** Doorvoeren op de site werkt voor WordPress. Andere systemen " +
          "vallen terug op handwerk via de werklijst.\n" +
          "- **Serverless tijdsvensters.** Dat is opgelost met hervatbare runs, maar elke nieuwe zware analyse " +
          "moet die vorm bewust aanhouden. Wie dat vergeet bouwt de oude fout opnieuw.\n" +
          "- **Prijzen van modellen** staan als schatting in de code. Bij een tariefwijziging kloppen historische " +
          "kosten wel (die zijn vastgelegd) maar moet de prijstabel bij.",
      },
      {
        titel: "Wat het meeste zou opleveren",
        tekst:
          "Op volgorde van verhouding tussen opbrengst en inspanning:\n\n" +
          "1. **Autoriteit per pagina aansluiten.** Dat maakt de interne-links-motor in één keer volwaardig, en " +
          "die is nu al een van de sterkste onderdelen.\n" +
          "2. **Verbruiksmeting compleet maken** (Ahrefs-credits erbij). Zonder dat is de marge per klant een " +
          "schatting, en dat is precies het cijfer dat bij een licentiemodel telt.\n" +
          "3. **Meerdere mailboxen.** Dit is de eerste harde blokkade als een tweede bureau dit gaat gebruiken.\n" +
          "4. **AI-vindbaarheid op onderwerpniveau.** Dit is de vraag die bij klanten het snelst groeit, en de " +
          "lens waar we nu het minst hard over kunnen zijn.\n" +
          "5. **Een tweede sitekoppeling** naast WordPress, zodat 'doorvoeren' niet merkafhankelijk is.",
      },
      {
        titel: "Risico's om in de gaten te houden",
        tekst:
          "- **Groei van het oppervlak.** Het dashboard is groot. Elke nieuwe motor is ook een nieuwe plek waar " +
          "een cijfer anders kan gaan staan. De regel dat lenzen elkaar uitvragen in plaats van opnieuw ophalen " +
          "is daarom geen stijlvoorkeur maar een noodzaak.\n" +
          "- **Twee wegen naar hetzelfde resultaat.** Dit is de fout die telkens terugkomt: twee knoppen die " +
          "allebei een kaart maken. Bij elke uitbreiding is dit de eerste vraag.\n" +
          "- **Documentatie die achterloopt op de code.** Deze pagina zelf is daar het risico. Vandaar dat het " +
          "onderhoud eronder een vaste stap is en geen goede bedoeling.",
      },
      {
        titel: "Hoe dit document wordt bijgehouden",
        tekst:
          "De uitleg is geen apart document maar een bestand in de code van het dashboard zelf " +
          "(`lib/uitleg.ts`). Dat is bewust: wie het dashboard uitbreidt heeft de uitleg in dezelfde map open " +
          "staan, en een uitbreiding zonder bijgewerkte uitleg valt op in de wijziging.\n\n" +
          "Vaste stap na een noemenswaardige uitbreiding: de betreffende uitklapper aanvullen, en de datum " +
          "bovenaan verzetten. Hoofdstukken met de interne markering blijven achter de beheerderslogin, dus de " +
          "gaten hoeven niet te worden weggeschreven om de pagina deelbaar te houden.",
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
