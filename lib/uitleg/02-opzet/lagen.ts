import type { Uitklapper } from "../types";

// De twee lagen, de navigatie ertussen, en wat er per klant klaarstaat.
export const BLOKKEN: Uitklapper[] = [
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
        "**Klantgegevens is gesplitst in twee.** De tab heet nu **Dossier** en bevat alleen nog wat je over " +
        "de klant weet: het fundament, het profiel met de tone of voice, de afgesproken zoekwoorden en links, " +
        "de bedrijfsgegevens, de kennisbank en de concurrenten. Wat de klant zelf ziet na inloggen stond daar " +
        "onderaan verstopt en is iets heel anders: dat is geen dossierkennis maar het scherm dat je deelt. Dat " +
        "heet nu **Klantweergave** en staat in de groep \"wat hebben we geleverd\", naast de documenten. Oude " +
        "links naar Klantgegevens komen gewoon op het dossier uit.\n\n" +
        "**Het klantprofiel staat in het dossier, het vrije veld \"Overzicht\" staat bij Taken.** Het " +
        "klantprofiel (met de tone of voice) stond boven de paginalijst en hoort bij de vraag wie deze klant " +
        "is: het is de vaste briefing die bijna elke motor leest. Het vrije tekstveld dat vroeger " +
        "'Zoekwoorden & links' heette, is een tijd met datzelfde argument naar het dossier verhuisd, maar " +
        "in de praktijk staat er veel meer in dan zoekwoorden en houd je het bij terwijl je werkt. Sinds " +
        "17 augustus 2026 heet het daarom **Overzicht** en staat het weer bij Taken, in de rechterkolom " +
        "onder de mails en boven \"Waar we naartoe werken\". Eén plek, niet twee.\n\n" +
        "In dat tekstveld kun je naast vet, bullets en links ook een **afvinklijstje** maken (selecteer een " +
        "rijtje regels en klik 'vinklijst', dan wordt elke regel een eigen vinkpunt) en een **uitklapper** " +
        "(een onderwerp met een driehoekje, met alles wat erbij hoort eronder). Elk onderdeel is te " +
        "**verslepen**: zweef erover, pak het grijpvlekje in de strook links van het tekstvak en zet het boven " +
        "of onder een andere regel neer. Dat vlekje blijft sinds 18 augustus 2026 ook staan terwijl je ernaartoe " +
        "beweegt. Daarvóór verscheen het netjes boven de tekst en verdween het precies op het moment dat je hem " +
        "wilde pakken: onderweg naar links kom je door de inspringing van een lijst, en daar staat geen regel " +
        "maar het lege tekstvak, dus dacht het scherm dat je nergens meer boven zweefde. Nu wordt er op de " +
        "hoogte van je muis gekeken in plaats van alleen recht eronder.\n\n" +
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
        "waar nog niets voor gedaan wordt.\n\n" +
        "**Op het overzicht staat 'Mijn klanten' bovenaan en open; al het andere staat eronder en dicht.** Leads, " +
        "de omzetstrook, de klanten van een aangesloten bureau, de onboardingrij, klantwaarde en meekijken zijn " +
        "allemaal blokken met een kopbalk en een pijltje; je klapt open wat je nodig hebt in plaats van langs " +
        "alles heen te scrollen. De knop die bij een blok hoort staat rechts in diezelfde kopbalk ('+ Nieuwe klant' " +
        "bij de klanten, '+ Nieuwe lead' bij de leads), dus hij is ook zichtbaar als het blok dicht staat; hij " +
        "stond eerst helemaal onderaan, achter alle rijen.\n\n" +
        "**Het beheerscherm (klanten en team) werkt sinds 24 augustus 2026 net zo:** de klantenlijst bovenaan en " +
        "open, en team, instellingen, de Google-koppelingen en HubSpot eronder als losse blokken die dicht staan. " +
        "De klanten staan daar in jouw eigen volgorde en die sleep je aan het greepje links, dezelfde volgorde als " +
        "op het overzicht. En in élke lijst in het dashboard blijft de zwarte kolomkop nu onder de bovenbalk staan " +
        "terwijl je scrolt, zodat je bij rij dertig nog steeds ziet welke kolom je invult.",
    },
    {
      titel: "Fundament: wat er per klant gekoppeld en ingevuld is, in één oogopslag",
      kern: "Tegels in plaats van een lijst, live afgelezen uit dezelfde stand als de Onboarding-tab.",
      tekst:
        "Bovenaan de tab **Dossier** staat het Fundament: hoe ver deze klant staat, met de knop die aanvult " +
        "wat nog zonder jou kan, en daaronder alle stappen als tegels in vier blokken: **aansluiten** (de " +
        "koppelingen waar de data vandaan komt), **wie is de klant**, **meten** (de site-brede scans) en " +
        "**aan het werk**. Die volgorde is niet vrijblijvend: wat hier niet staat kan niet gemeten worden, " +
        "want geen enkele scan start voordat de inventarisatie erachter klopt.\n\n" +
        "**Dit was tot 16 augustus 2026 verdeeld over twee schermen.** Het Fundament toonde twee van de vier " +
        "blokken op het dossier, en een eigen tabblad Onboarding toonde alle vier plus de voortgangsbalk. " +
        "Allebei rekenden ze met dezelfde bron (`lib/onboarding.ts`) en toonden ze dezelfde cijfers, dus het " +
        "waren twee antwoorden op dezelfde vraag en had je altijd de verkeerde open. Nu is het één scherm. " +
        "Oude links naar het tabblad Onboarding komen op het dossier uit.\n\n" +
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
];
