import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
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
      kern: "Eén mega menu, met de vraag die elk scherm beantwoordt als kop.",
      tekst:
        "De cockpit had op een gegeven moment elf tabjes naast elkaar, en dat is precies één tabje meer dan een " +
        "mens overziet. Daarna werden het zes ingangen met twee uitklapmenu's, en ook dat werkte maar half: die " +
        "menu's toonden een kaal lijstje zonder uitleg, en het menu \"Klant\" bundelde twee verschillende vragen " +
        "door elkaar (wie de klant is, en wat wij voor hem geleverd hebben).\n\n" +
        "**De navigatie is één mega menu.** Klik op \"Alles over deze klant\" en je ziet in één keer elk " +
        "scherm dat er voor deze klant is, verdeeld over vijf kolommen die geen categorie maar een vraag " +
        "als kop hebben: wat moet ik nu doen, hoe staat de site ervoor, waar zit winst te halen, wie is deze " +
        "klant, en wat hebben we geleverd. Bij elk scherm staat de regel uitleg zichtbaar onder de naam. Dat " +
        "vervangt twee uitklapmenu\'s met een kaal lijstje, waarvan er één (\"Klant\") twee verschillende " +
        "vragen door elkaar bundelde. Taken en Pagina\'s blijven ook los in de balk staan, want daar ga je " +
        "tien keer per dag heen, en Developer staat er los achter omdat dat scherm over álle klanten gaat.\n\n" +
        "De indeling is een regel en geen smaak: elk scherm staat bij de vraag die het beantwoordt. Zonder " +
        "zo\'n regel wordt elke plek een kwestie van wie er die dag iets bouwde, en zo belandde het " +
        "klantprofiel boven een lijst van 65 URL\'s. Komt er een scherm bij, dan is de vraag welke van de " +
        "vijf het beantwoordt, niet waar nog ruimte was.\n\n" +
        "Daarnaast zit er aan de rechterrand één inschuifbaar zijpaneel, op elk tabblad bereikbaar: " +
        "'Zoekwoorden & links' heeft de afgesproken strategie links in een vrij tekstveld en rechts een kolom " +
        "met snel aan te klikken landingspagina's. Het losse 'Links'-zijpaneel (de koppelingen als " +
        "uitklaplijstje) is vervallen; die koppelingen staan nu als tegels bovenaan de tab Klantgegevens, zie " +
        "hieronder.\n\n" +
        "In dat tekstveld kun je naast vet, bullets en links ook een **afvinklijstje** maken (selecteer een " +
        "rijtje regels en klik 'vinklijst', dan wordt elke regel een eigen vinkpunt) en een **uitklapper** " +
        "(een onderwerp met een driehoekje, met alles wat erbij hoort eronder). Elk onderdeel is te " +
        "**verslepen**: zweef erover, pak het grijpvlekje in de strook links van het tekstvak en zet het boven " +
        "of onder een andere regel neer.\n\n" +
        "Op een vinkregel werkt Enter zoals je het van een lijstje verwacht: aan het eind krijg je een nieuw " +
        "punt eronder, middenin splitst de regel (de tekst achter je cursor gaat mee), en op een lege regel " +
        "stap je uit de lijst. Backspace helemaal vooraan haalt alleen het vinkje weg; je tekst blijft staan " +
        "als gewone regel. Enter in het kopje van een uitklapper springt naar de inhoud eronder, en klapt hem " +
        "eerst open als hij dicht stond.\n\n" +
        "**De vorm van het veld wordt na elke bewerking nagelopen en zo nodig rechtgezet** (invoegen, slepen, " +
        "plakken, Enter, en als je het veld verlaat). Die controle mag nooit iets weggooien: staat er iets op " +
        "een plek waar het niet hoort, dan verhuist het naar de dichtstbijzijnde plek waar het wél hoort. Zo " +
        "heelt oude, scheefgeraakte inhoud vanzelf zodra je het veld opent. Waarom dat nodig was: de browser " +
        "maakt er zelf een potje van zodra je iets invoegt terwijl je cursor midden in een lijst of een kopje " +
        "staat, en dat was de echte oorzaak van 'hij reageert raar als ik een enter doe'.\n\n" +
        "Het veld slaat tijdens het typen vanzelf op, en **bewaart bij elke wijziging de vorige versie**. Ging " +
        "er iets mis, dan zet je die met één klik terug via het scherm 'Veld terugzetten' in het Intern-menu. " +
        "Dat vangnet is er gekomen na 11 augustus 2026, toen een fout in het slepen inhoud buiten het tekstvak " +
        "zette en de automatische opslag die daarna wegschreef: er was toen geen enkele weg terug.\n\n" +
        "**Wisselen van klant gaat via de kiezer linksboven.** Die toont de eigen klanten meteen; de klanten van " +
        "een aangesloten bureau en de leads staan elk achter één regel die je openklikt, want die heb je meestal " +
        "niet nodig en ze duwen de rest uit beeld. Zit je zelf in zo'n groep, dan staat die vanzelf open. " +
        "Bovenin staat een zoekveldje, en zodra je typt gaan alle groepen open, anders zou een treffer in een " +
        "dichtgeklapte groep onvindbaar zijn. Leads staan bewust niet meer tussen de klanten: dat is een bedrijf " +
        "waar nog niets voor gedaan wordt.",
    },
    {
      titel: "Fundament: wat er per klant gekoppeld en ingevuld is, in één oogopslag",
      kern: "Tegels in plaats van een lijst, live afgelezen uit dezelfde stand als de Onboarding-tab.",
      tekst:
        "Bovenaan de klant-tab **Klantgegevens** staat het Fundament: alle koppelingen en klantkennis als " +
        "tegels, gegroepeerd in 'Aansluiten' en 'Wie is de klant'. Dit stond eerder op twee plekken (deze " +
        "kaart met zes punten, en een los 'Links'-zijpaneel met een uitklaplijstje) die soms een ander " +
        "verhaal vertelden over dezelfde koppeling. Nu is er één bron: dezelfde live berekening als de " +
        "Onboarding-tab (`lib/onboarding.ts`), hier als tegels getoond in plaats van als afvinklijst. Wat hier " +
        "staat kan dus nooit meer afwijken van wat Onboarding zegt.\n\n" +
        "**Aansluiten:** website-adres, Search Console, Ahrefs-project, pagina's ingelezen, beheeromgeving van " +
        "de site, Ads-account.\n\n" +
        "**Wie is de klant:** klantprofiel, tone of voice, bedrijfsgegevens (structured data), werkgebied, " +
        "klantwaarde en conversie, concurrenten, Google-bedrijfsprofiel, beheerder van dat profiel, " +
        "positioneringsadvies, huisstijl, documenten in de kennisdatabase.\n\n" +
        "Elke tegel toont de status, één zin wat erin staat, en een knop die er direct naartoe brengt. " +
        "Positionering, huisstijl en het Ads-account zijn losse linkjes (Drive-document of accountpagina): " +
        "er is geen API-koppeling, dus dat is bewust alleen 'de link staat hier', nooit een geverifieerde " +
        "meting. De site-brede scans en de strategie staan hier niet nog eens (die hebben al hun eigen " +
        "tabblad en staan met dezelfde cijfers op de Onboarding-tab).\n\n" +
        "**/admin/fundament** (alle klanten naast elkaar) is een apart scherm en gebruikt nog zijn eigen, " +
        "oudere rekenregel met zes punten (`lib/fundament.ts`); dat is nog niet meegetrokken in deze slag.",
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
        "een database en de sleutels van de koppelingen. Niet een migratietraject.\n\n" +
        "Sinds 11 augustus 2026 gebeurt dat repareren ook één keer in plaats van steeds opnieuw. De app draaide " +
        "die honderd controles namelijk bij élke koude server, en dat waren honderd losse rondjes naar de " +
        "database vóórdat er iets in beeld kwam. Nu staat er een stempel in de database met de versie van het " +
        "schema: klopt die met de code, dan wordt het hele blok overgeslagen. Eén korte leesopdracht in plaats " +
        "van honderd schrijfopdrachten. Vergeten die versie op te hogen kan niet, want de bouw rekent de " +
        "vingerafdruk van de code na en mislukt als het niet meer klopt.",
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
};
