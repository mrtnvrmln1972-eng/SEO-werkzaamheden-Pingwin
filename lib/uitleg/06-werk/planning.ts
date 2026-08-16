import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
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
      "deze pagina en de documenten. Niet een tweede, magere samenvatting die kan achterlopen, " +
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
      "daardoor op 183 tekens. Losse opdrachten staan nu ín de kaart, onder \"Aanpak en afspraken\" (tot " +
      "14 augustus 2026 was dat nog een apart vak \"Opdrachten\"; dat vak is weg, want de herkomst van zo'n " +
      "regel, chat, mail, scan of eigen tekst, was er niet aan af te zien, en dus ook niet te vertrouwen). " +
      "Schrijf je zelf een titel, dan blijft die staan.\n\n" +
      "**Elke kaart heeft een archief.** Wat van de kaart af gaat blijft bewaard met datum: een eerdere titel, " +
      "een kaarttekst voordat hij werd opgeschoond, en regels die niet meer pasten. Daarvóór werd de tekst op " +
      "vierduizend tekens afgekapt zonder melding, en stonden er kaarten precies op die grens. Er verdween dus " +
      "informatie die niemand miste. Nu schuift wat niet past naar het archief in plaats van te verdwijnen.\n\n" +
      "**Alles staat op één plek.** De vinkjes van de fases stonden ook nog als losse chips in het paginablok, " +
      "opgehaald via een tweede aanvraag, dus ze konden zelfs iets anders zeggen. Doorzetten naar de sitebouwer " +
      "stond op drie plekken. Dat is teruggebracht tot één.\n\n" +
      "**Het mail-dossier op de kaart is weg.** Er stond een apart blok \"Waar deze pagina staat\" dat live " +
      "meelas met de mailbox, met een eigen \"Mail erbij zoeken\" en \"Ververs\". Dat matchte lang niet altijd " +
      "de juiste mails en voegde weinig toe naast wat er al stond: de link naar de pagina en naar analyse, " +
      "blauwdruk en copy staan bij de fases, en eigen punten om te onthouden horen in de aantekeningen. " +
      "\"Waarom deze pagina\" en \"Aanpak en afspraken\", de geschreven kant van de kaart, staan er nu daarom " +
      "altijd, in plaats van pas als het mailblok niets had gevonden.\n\n" +
      "**Een blok dat niets te zeggen heeft, is er niet.** \"Waarom deze pagina\" moest altijd gevuld worden, " +
      "dus een kaart die zonder cijfers werd opgepakt kreeg gegarandeerd zinnen als \"nog geen Search " +
      "Console-data\" en \"nog geen vastgelegde strategie\", plus de opdrachtregel waarmee de kaart was " +
      "aangemaakt en het aantal fases dat toen af was. Dat is geen reden maar de afwezigheid van een reden, " +
      "en dat aantal fases staat live in het fase-blok eronder. Die regels worden er nu uitgefilterd in de " +
      "weergave, dus ook op alle kaarten die er al stonden. Is er een echte reden (een kans, een positie, " +
      "cijfers, een afspraak), dan staat die er gewoon; is die er niet, dan is er geen blok.\n\n" +
      "**De documenten staan onder een dichte uitklapper.** De analyse, de blauwdruk en de copy open je al " +
      "vanuit de fase-rijen, dus als vaste lijst waren het regels die je op elke kaart voorbij scrolde. De " +
      "lijst blijft compleet (hernoemen, voorvertonen, weggooien, aanwijzen welke versie geldt), maar hij " +
      "staat dicht. Hij gaat vanzelf open als er meerdere versies van hetzelfde soort liggen en je nog niet " +
      "hebt aangewezen welke geldt, want daar wachten de mail en de sitebouwer op. In dat geval staat het " +
      "tijdstip erbij, anders zijn drie documenten van dezelfde dag niet uit elkaar te houden.",
  },
];
