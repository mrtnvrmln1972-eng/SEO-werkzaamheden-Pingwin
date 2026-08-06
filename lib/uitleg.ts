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
          "| **Taken** | Het startscherm: je prioriteiten, de gesprekken en de planning per dag en week |\n" +
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
          "maar dezelfde kaart.",
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
          "hoeveel er staat en wat er mist.",
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
    titel: "Eerlijke agenda en routekaart",
    intern: true,
    intro:
      "Dit hoofdstuk is alleen zichtbaar met een beheerderssessie, en het is tegelijk de ontwikkelagenda. " +
      "Dertien punten, genummerd R1 tot R13, in drie golven plus een lijst met wat we bewust níet doen. Elk " +
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
          "opbrengst en inspanning. Wat er echt eerst gebeurt bepaalt de vraag van klanten.",
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
          "| **R1** | Autoriteit per pagina aansluiten | Klein werk, groot effect |\n" +
          "| **R2** | Prioriteren op conversies in plaats van klikken | Middel werk, grootst effect |\n" +
          "| **R3** | AI-vindbaarheid op onderwerpniveau | Middel werk, groot verkoopeffect |\n" +
          "| **R4** | Verbruik compleet: de Ahrefs-credits erbij | Klein werk, nodig voor licentie |",
        sub: [
          {
            titel: "R1. Autoriteit per pagina aansluiten",
            tekst:
              "**Wat er nu mis is.** De interne-links-motor weegt bronpagina's op hoeveel waarde ze kunnen " +
              "doorgeven, maar de echte autoriteitswaarde per losse pagina is niet aangesloten. Dat wordt nu " +
              "eerlijk als ontbrekend gemarkeerd in de datakwaliteit, en de weging leunt op een benadering uit de " +
              "eigen linkgraaf en de Search Console-cijfers.\n\n" +
              "**Wat het oplevert.** Interne links zijn nu al een van de sterkste onderdelen, en dit is het enige " +
              "gat erin. Met echte waarde per pagina wordt het advies \"link vanaf deze vijf pagina's\" hard in " +
              "plaats van aannemelijk. Dat is ook precies het advies dat het snelst resultaat geeft bij pagina's " +
              "die net buiten de top staan.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. De autoriteitswaarde per URL ophalen bij Ahrefs voor de pagina's die al in de linkgraaf zitten, " +
              "in gebundelde verzoeken en met dezelfde cachetermijn als de andere Ahrefs-data (credits sparen).\n" +
              "2. De waarde opslaan bij de pagina, zodat de motor en de prioriteitenscan uit dezelfde bron lezen.\n" +
              "3. De weging in de motor omzetten van benadering naar echte waarde, met de benadering als terugval " +
              "voor pagina's waar Ahrefs niets weet.\n" +
              "4. De datakwaliteit-melding aanpassen: van \"ontbreekt\" naar \"aangesloten, op deze datum " +
              "opgehaald\".\n\n" +
              "**Waaraan je ziet dat het af is.** Bij een doelpagina staan de voorgestelde bronpagina's in een " +
              "andere volgorde dan vóór de wijziging, en bij elke bronpagina staat de waarde met de datum. De " +
              "datakwaliteit meldt geen ontbrekende autoriteit meer.\n\n" +
              "**Wat het raakt.** De interne-links-tab, de prioriteitenscan (die deze lens uitvraagt) en het " +
              "verbruiksscherm (extra Ahrefs-verzoeken).",
          },
          {
            titel: "R2. Prioriteren op conversies in plaats van op klikken",
            tekst:
              "**Wat er nu mis is.** De prioriteitenscan rekent de verwachte opbrengst van elke bevinding uit in " +
              "extra klikken. Klikken zijn niet het doel; klanten binnenhalen is het doel. Twee pagina's met " +
              "duizend vertoningen kunnen tien keer in waarde verschillen, en dat verschil zit nu niet in de " +
              "rangorde. De Analytics-koppeling is er al en levert de conversies al site-breed en per kanaal, maar " +
              "niet per pagina, en de scoring gebruikt ze helemaal niet.\n\n" +
              "**Wat het oplevert.** Dit is het punt met het grootste effect van de hele lijst, om drie redenen:\n\n" +
              "- **Betere besluiten.** De rangorde gaat over geld in plaats van over bezoek. Een pagina die " +
              "converteert klimt, een pagina die alleen leest zakt.\n" +
              "- **Een ander gesprek met de klant.** \"Deze aanpassing levert naar verwachting zoveel aanvragen " +
              "op\" is een heel ander gesprek dan \"dit levert klikken op\". Dat rechtvaardigt ook een hoger " +
              "budget.\n" +
              "- **Het maakt het nameten scherp.** De wijziging-effect-meting die er al is (Search Console plus " +
              "gedrag, voor en na) krijgt er de enige uitkomst bij die echt telt.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Conversies per pagina uit Analytics halen, met dezelfde voorzichtigheid die er al zit: niet elke " +
              "property heeft conversies ingericht, dus zonder conversies moet het gewoon werken zoals nu.\n" +
              "2. Per klant één instelling: welke gebeurtenis is een aanvraag, en wat is die gemiddeld waard? Twee " +
              "velden, in het bestaande klantgegevens-formulier, met een lege waarde als \"onbekend\".\n" +
              "3. De verwachte opbrengst in de scoring uitbreiden: extra klikken maal het conversiepercentage van " +
              "díe pagina maal de waarde. Ontbreekt de waarde, dan blijft de bestaande berekening op klikken " +
              "staan, en dat wordt zichtbaar gemeld bij de bevinding.\n" +
              "4. De uitkomst overal in dezelfde eenheid tonen: verwachte aanvragen per maand, en waar bekend het " +
              "bedrag.\n\n" +
              "**Waaraan je ziet dat het af is.** Bij een klant met conversies staat de prioriteitenlijst in een " +
              "andere volgorde dan op klikken alleen, met bij elke bevinding de verwachte aanvragen. Bij een klant " +
              "zonder conversies is er niets veranderd, met de melding waarom.\n\n" +
              "**Wat het raakt.** De prioriteitenscan, de scoringslaag, het klantgegevens-formulier, de " +
              "wijziging-effect-meting en de KPI-tab. Let op de regel: dit cijfer krijgt één plek en wordt door de " +
              "andere lenzen uitgevraagd, nooit opnieuw berekend.",
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
              "**Wat het raakt.** De prioriteitenscan (de vierde lens wordt volwassen), de zoekwoordenlijst, het " +
              "verbruiksscherm en het maandelijkse verhaal naar de klant.",
          },
          {
            titel: "R4. Verbruik compleet: de Ahrefs-credits erbij",
            tekst:
              "**Wat er nu mis is.** Het verbruiksscherm meet de AI-kosten per klant en per actie nauwkeurig. De " +
              "Ahrefs-credits worden per aanroep wel geteld waar de dienst dat teruggeeft, maar niet volledig " +
              "doorgerekend naar kosten per klant. De marge per klant is daarmee een schatting.\n\n" +
              "**Wat het oplevert.** Dit is klein werk met één groot gevolg: het cijfer waar een licentiegesprek " +
              "en een prijsstelling op rusten. Zonder dit kun je niet zeggen wat een klant in dit systeem kost, en " +
              "dus ook niet wat een bureau ervoor zou moeten betalen. Het is ook het cijfer dat je nodig hebt om " +
              "te zien welke knop te duur is voor wat hij oplevert.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. De teller die er al is per aanroep wegschrijven met dezelfde velden als de AI-regels, zodat er " +
              "één verbruikstabel blijft in plaats van twee.\n" +
              "2. De prijs per eenheid instelbaar maken op één plek, net als de modelprijzen nu, zodat een " +
              "tariefwijziging één regel is.\n" +
              "3. Het scherm uitbreiden met een totaal per klant per maand, uitgesplitst naar dienst, en de " +
              "verhouding met wat de klant betaalt.\n\n" +
              "**Waaraan je ziet dat het af is.** Op het verbruiksscherm staat per klant per maand een totaal in " +
              "euro's dat AI en Ahrefs samen dekt, en de duurste actie van die maand is met naam te zien.\n\n" +
              "**Wat het raakt.** Het verbruiksscherm, de financiënpagina (kosten naast omzet per klant) en de " +
              "Ahrefs-laag.",
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
          "| **R6** | Tweede sitekoppeling, en copy doorvoeren | er een klant niet op WordPress zit |\n" +
          "| **R7** | Bronnen-gezondheid: welke bron is stil? | je een conclusie trekt op stille data |\n" +
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
              "**Wat het raakt.** De mailkoppeling, de tijdlijn, de mailcontroles, de assistent-context en de " +
              "rechtenlaag.",
          },
          {
            titel: "R6. Tweede sitekoppeling, en copy doorvoeren",
            tekst:
              "**Wat er nu mis is.** Twee dingen tegelijk. Doorvoeren op de site werkt alleen voor WordPress. En " +
              "binnen WordPress gaan alleen meta-teksten en alt-teksten automatisch; de copy zelf, het grootste " +
              "werkstuk van de hele keten, gaat nog met de hand.\n\n" +
              "**Wat het oplevert.** De keten is af tot aan de site en breekt daar. Dit is de plek waar het meeste " +
              "handwerk overblijft, dus ook waar de meeste uren te winnen zijn. En zolang doorvoeren " +
              "merkafhankelijk is, kun je een klant op een ander systeem alleen de halve dienst leveren.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Eerst de vorm goed zetten: de doorvoerlaag scheiden van WordPress, met per systeem een eigen " +
              "koppelstuk en dezelfde drie regels erboven (versleuteld wachtwoord, altijd terugcontrole, eerlijk " +
              "melden als het niet lukte).\n" +
              "2. Copy doorvoeren als concept, nooit direct live: het dashboard zet de nieuwe tekst als " +
              "conceptversie in de site, met een link om te bekijken. Publiceren blijft een mensenklik.\n" +
              "3. Daarna het tweede koppelstuk, gekozen op wat de klanten echt gebruiken.\n" +
              "4. De werklijst voor de sitebouwer blijft bestaan als terugval, want er blijven altijd systemen " +
              "zonder koppeling.\n\n" +
              "**Waaraan je ziet dat het af is.** Een goedgekeurd copydocument staat als concept in de site, met " +
              "een voorbeeldlink, zonder dat er iets gekopieerd is. En hetzelfde werkt op een tweede systeem.\n\n" +
              "**Wat het raakt.** De documentenketen (de laatste fase), de werklijst, de fases per pagina en \"wat " +
              "we gedaan hebben\".",
          },
          {
            titel: "R7. Bronnen-gezondheid: welke bron is vandaag stil?",
            tekst:
              "**Wat er nu mis is.** Er hangen tien koppelingen aan dit systeem, en elke koppeling kan een dag " +
              "stil zijn: een verlopen toegang, een limiet, een storing. Per onderdeel wordt dat netjes " +
              "opgevangen, en bij interne links wordt ontbrekende data zelfs expliciet gemeld. Maar er is geen " +
              "enkele plek waar staat: dit werkt vandaag, dit niet, en dit cijfer is dus ouder dan het lijkt.\n\n" +
              "**Wat het oplevert.** Dit is het enige punt op deze lijst dat een fout voorkomt in plaats van iets " +
              "toevoegt. Het hele dashboard rust op de belofte dat cijfers uit een bron komen en dat ontbrekende " +
              "data ontbrekend heet. Een stille bron ondermijnt precies die belofte, en je merkt het pas als een " +
              "advies verkeerd blijkt. Bij een tweede bureau dat zijn eigen sleutels beheert is het onmisbaar.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. Elke koppeling schrijft bij elk gebruik weg: gelukt of niet, wanneer, en bij een fout de reden " +
              "in gewone taal.\n" +
              "2. Eén scherm met per bron: werkt hij, wanneer voor het laatst goed gegaan, en wat er aan de hand " +
              "is als het niet werkt (verlopen toegang, limiet bereikt, storing).\n" +
              "3. Een stille bron is zichtbaar op de plek waar het uitmaakt: staat een cijfer op oude data, dan " +
              "zegt de kaart dat erbij in plaats van dat je het moet weten.\n" +
              "4. Alleen wat handelen vraagt komt naar voren, en dan met de knop erbij (opnieuw koppelen), niet " +
              "met een instructie.\n\n" +
              "**Waaraan je ziet dat het af is.** Eén koppeling opzettelijk losgetrokken, en dat is binnen een " +
              "minuut te zien op het bronnenscherm én bij het cijfer dat erop leunt, met een knop om het te " +
              "herstellen.\n\n" +
              "**Wat het raakt.** Alle koppelingen, en de kaarten en scores die erop leunen. Klein per koppeling, " +
              "maar het moet er wel bij álle tien in.",
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
              "**Wat het raakt.** De meta-motor, interne links, de prioriteitenscan, de documentenketen en de " +
              "bestaande opruim-regels (die hierin opgaan, niet ernaast blijven staan).",
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
            titel: "R9. Het klantdashboard op echte data",
            tekst:
              "**Wat er nu mis is.** De cockpit weet alles: posities, klikken, wat er is uitgevoerd, wat het " +
              "opleverde. Het dashboard dat de klant ziet leest een spreadsheet met werkzaamheden, uren en " +
              "budget. De rijkste data van het hele systeem komt dus niet bij de persoon die betaalt.\n\n" +
              "**Wat het oplevert.** Dit is het punt met de meeste verkoopwaarde van de hele lijst. Een klant die " +
              "elke maand ziet wat er gedaan is én wat het deed, vertrekt niet. Het is ook het onderdeel dat je " +
              "aan een lead kunt laten zien: dit krijg jij erbij.\n\n" +
              "**Hoe we het zouden bouwen.**\n\n" +
              "1. De spreadsheet blijft. Die is de bron voor uren en budget, en een bureau dat er al in werkt " +
              "hoeft niets om te gooien. Er komt alleen iets bij.\n" +
              "2. Per klant een blok met de ontwikkeling in gewone taal: hoe staan we er nu voor, wat is er " +
              "veranderd, en wat leverden de aanpassingen van deze maand op. De meting daarvoor bestaat al " +
              "(wijziging, voor en na); dit is die uitkomst in klanttaal.\n" +
              "3. Streng filteren op wat een klant moet zien. Geen ruwe tabellen, geen jargon, geen interne " +
              "afwegingen. Dezelfde regel als bij de documenten: wat de klant leest is niet wat de uitvoerder " +
              "leest.\n" +
              "4. Niets gaat automatisch naar de klant. Je ziet eerst de voorbeeldweergave die er al is, en jij " +
              "besluit dat het klaar is.\n\n" +
              "**Waaraan je ziet dat het af is.** Een klant ziet in zijn eigen dashboard zonder jouw tussenkomst " +
              "de ontwikkeling van deze maand, in gewone taal, en jij hebt dat vooraf in de voorbeeldweergave " +
              "kunnen nalopen.\n\n" +
              "**Wat het raakt.** Het klantdashboard, de voorbeeldweergave, de wijziging-effect-meting en de " +
              "maandelijkse ronde.",
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
              "**Wat het raakt.** De achtergrondtaken, de wijzigingen-laag, de trends en de prioriteitenscan.",
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
              "**Wat het raakt.** Alle koppelingen, de beheerpagina en de beveiligingslaag. Dit is het zwaarste " +
              "punt op de lijst, en het heeft R4 en R7 nodig om echt af te zijn.",
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
              "**Wat het raakt.** De rekenlagen. Niets van de werking verandert, dus dit is het veiligste punt op " +
              "de lijst om tussendoor te doen.",
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
              "**Wat het raakt.** De schrijvende handelingen, de rechtenlaag en de kaarten waar het bij hoort.",
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
              "**Wat het raakt.** De uitlegpagina, de verkooppitch en de interne browser.",
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
              "**Wat het raakt.** De uitlegpagina (de bron) en een nieuwe pagina.",
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
