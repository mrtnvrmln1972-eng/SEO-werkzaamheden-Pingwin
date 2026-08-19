import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De planning: één lijst, op datum",
    kern: "Alles onder elkaar, eerstvolgende datum bovenaan, slepen verzet de dag.",
    tekst:
      "De planning is één lijst. Alles staat onder elkaar op volgorde van datum: de eerstvolgende " +
      "bovenaan, wat over de datum heen is staat daar vanzelf boven met een rood streepje ernaast, en " +
      "wat nog geen datum heeft staat onderaan onder het kopje **Nog geen datum**.\n\n" +
      "Daarvoor waren het er twee tegelijk: zeven vakken (Te laat, Vandaag, Morgen, Verder deze week, " +
      "Volgende week, Later, Nog geen dag) én daaronder nog een kaart per week, met dezelfde taken erin. " +
      "Eén taak stond dus op twee plekken op hetzelfde scherm, allebei met een eigen open-of-dicht stand, " +
      "en je scrolde langs zes koppen voor je bij het werk was. Wie wil weten wat er te doen staat, wil " +
      "een lijst, geen indeling.\n\n" +
      "**Slepen betekent één ding: je verzet de dag.** Laat je een taak op een andere taak los, dan neemt " +
      "hij diens datum over en gaat hij ernaast staan; twee taken op dezelfde dag houden hun eigen " +
      "volgorde. Laat je hem onderaan los, bij wat nog geen datum heeft, dan raakt hij zijn dag kwijt. De " +
      "dag kiezen kan ook rechtstreeks, met de datumknop op de regel.\n\n" +
      "**Slepen werkt sinds 18 augustus 2026 ook bij \"Nog geen datum\".** Daar zag je wel de oranje streep " +
      "waar de taak zou komen, maar bij loslaten sprong hij terug naar zijn oude plek. De reden: de volgorde " +
      "werd berekend binnen een week, en een taak zonder datum heeft geen week die ergens op slaat, dus de " +
      "som stopte er stilzwijgend mee. Voor die lijst telt nu alleen de onderlinge volgorde. De streep staat " +
      "boven de regel waar je boven hangt, en daar landt hij ook; loslaten in de lege ruimte onder de lijst " +
      "zet hem achteraan.\n\n" +
      "**Waar een taak ligt, zet je op de regel zelf.** Rechts op elke regel staat een keuzelijstje met vier " +
      "standen: **gepland** (ligt bij ons), **bij developer**, **bij klant** en **afgerond**. Daar stond " +
      "alleen het woord \"gepland\", dus je las de stand wel maar kon hem niet zetten; dat kon alleen in de " +
      "opengeklapte kaart. Kies je \"bij developer\", dan komt de kaart ook echt op de developerlijst te " +
      "staan (dat is dezelfde vlag als de knop op de kaart), en haal je hem daar weer af door een andere " +
      "stand te kiezen.\n\n" +
      "**Afgerond haalt de taak uit de lijst en zet hem twee plekken neer.** Onderaan de planning, in een " +
      "blok **Afgeronde taken** dat dicht begint (je wilt het kunnen terugzien, niet er elke dag langs " +
      "scrollen), en met datum in **Wat we doen**, voor de verantwoording naar de klant en voor de eigen " +
      "urenvraag. Omdat een regel die zomaar verdwijnt als weggegooid voelt, blijft hij bovenaan de lijst nog " +
      "even staan met een knop **Terugzetten**, en in dat blok onderaan kun je de stand gewoon weer " +
      "terugzetten.\n\n" +
      "Op het tabblad Taken zie je alleen deze klant; op de volle-breedte-versie zie je alle klanten, daar " +
      "gegroepeerd per klant zodat je ziet van wie iets is.\n\n" +
      "De planning is bewust een **signaalscherm** en geen bedieningspaneel: één regel per taak, met " +
      "welke pagina, de zeven fases als gekleurde letters, de volgende stap en de dag. Die letters zijn expres " +
      "geen knoppen: een fase afvinken hoort in de kaart waar het werk gebeurt, en dan kleuren ze hier vanzelf " +
      "mee. Anders bestaan er twee wegen naar dezelfde stand, en dan lopen ze uiteen. Waar de hele taak ligt " +
      "is iets anders dan een fase, en dat zet je wél op de regel (het keuzelijstje rechts).\n\n" +
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
      "**En sinds 19 augustus 2026 zie je dat ook terug.** Het wegschrijven klopte, maar wat je daarna " +
      "terugzag niet: de takenlijst eromheen hield de tekst vast zoals die bij het laden van de pagina was. " +
      "Klapte je de taak dicht en weer open, dan stond je aantekening er weer af, en typte je daarop verder, " +
      "dan ging de goede tekst er alsnog aan. In het overzicht over álle klanten was het nog een slag erger: " +
      "daar werd de aantekening helemaal niet meegeleverd, dus was het veld daar altijd leeg. Allebei " +
      "gerepareerd: wat je bewaart komt meteen in de lijst te staan, en een proef bewaakt nu dat een kaart " +
      "geen veld kan uitlezen dat de vraag aan de database niet ophaalt.\n\n" +
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
      "tijdstip erbij, anders zijn drie documenten van dezelfde dag niet uit elkaar te houden. **De naam van " +
      "het document wordt sinds 19 augustus 2026 helemaal getoond** in plaats van afgekapt met puntjes, en het " +
      "tijdstip komt erbij zodra twee documenten van hetzelfde soort dezelfde dag dragen. Reden: liggen er " +
      "twee stukken copy voor twee verschillende onderwerpen in één taak, dan is juist het staartje van de " +
      "titel het enige waaraan je ze uit elkaar houdt, en dat viel weg. **En de vraag \"welke versie geldt?\" " +
      "wordt alleen nog gesteld waar hij bestaat:** twee documenten van hetzelfde soort golden als twee " +
      "versies van elkaar, ook als het twee losse projecten waren, en dan leek het stuk dat je niet aanvinkte " +
      "vervallen. Nu telt het onderwerp mee (uit de naam): een teruggestuurde klantversie hoort bij zijn " +
      "origineel, twee losse stukken gelden allebei gewoon.\n\n" +
      "**De kaart heeft één rij uitklappers en hooguit één open paneel (18 augustus 2026).** " +
      "\"Achtergrond en afspraken\", \"Documenten\" en \"Oude versies van deze kaart\" staan als drie knopjes " +
      "naast elkaar, direct boven je aantekeningen; klik je er een open, dan vult die de hele breedte van de " +
      "kaart en gaat de vorige dicht. Ze hadden alle drie hun eigen klepje op hun eigen plek, met een " +
      "scheidingslijn ertussen, dus je scrolde langs drie koppen voordat je bij je eigen tekst was. Ligt er " +
      "een keuze open (twee versies van hetzelfde document zonder dat je hebt aangewezen welke geldt), dan " +
      "gaat het documentenblok nog steeds vanzelf open. **De verse meting staat nu rechts op de kopregel**, " +
      "naast \"Over deze pagina\", in plaats van als losse grijze balk boven de tekst.\n\n" +
      "**\"Waarom deze pagina\" en \"Aanpak en afspraken\" staan sinds 17 augustus 2026 achter zo'n " +
      "uitklapper.** Ze vulden het halve scherm met de stand van de zoekwoorden op " +
      "het moment dat de kaart werd gemaakt, en dat is bevroren tekst: de posities en vertoningen erin " +
      "kloppen na een paar weken niet meer, terwijl wat er echt met de pagina gebeurt in de wijzigingen en " +
      "in de rankings van díe pagina staat. Helemaal weghalen kan niet, want precies deze tekst reist als " +
      "sturing mee naar de kaart-chat en naar de documenten; verdwijnt hij van het scherm, dan werken die " +
      "motoren met een opdracht die jij niet meer kunt lezen of bijstellen. Eén klik en hij staat er weer.\n\n" +
      "**Onderaan de kaart staat alleen nog wat nergens anders staat.** De link naar de live pagina stond " +
      "daar én bovenaan in de titel; de knop \"Pagina's\" is verhuisd naar de rij van de chat, waar hij in " +
      "dezelfde vorm naast \"Chat over deze pagina\" staat, want het is dezelfde soort stap. \"Developer\" en " +
      "\"Mail\" staan er alleen nog bij een taak zonder pagina, want die heeft geen fase-rij waar ze in horen.\n\n" +
      "**Het klokje \"herinner me over X dagen\" is bij elke taak weggehaald.** Elke regel had er een, en die " +
      "herinneringen kwamen allemaal bij het belletje in de kopbalk terecht. Een taak in de planning heeft " +
      "al een datum; een tweede, onzichtbare wekker erbij maakt van de takenlijst een tweede lijst om af te " +
      "werken. Wil je jezelf laten porren over iets dat bij de sitebouwer ligt, dan kan dat nog steeds in " +
      "het doorzet-venster.\n\n" +
      "**De knop \"Ruim alle kaarten op\" is weg (18 augustus 2026).** Eén klik liet de assistent tot twintig " +
      "kaartteksten herschrijven. Dat was reparatiewerk voor de kaarten uit de begintijd, die vol dubbelingen " +
      "stonden, en die zijn allang opgeruimd; het knopje dat hetzelfde per kaart deed was om precies die reden " +
      "al eerder verdwenen. Opschonen bestaat nog en gebeurt vanzelf op het enige moment dat het nodig is: " +
      "als twee kaarten over dezelfde pagina worden samengevoegd. Er is dus niets bijgekomen dat je zelf moet " +
      "doen, er is alleen een knop weg die op elk moment twintig kaarten kon herschrijven zonder dat iemand " +
      "ernaar keek.\n\n" +
      "**De regel zelf is rechtgezet.** Het kruisje om een taak weg te halen stond als een brede knop in " +
      "beeld: de rij is een vast kolomraster, en daar stond nog een kolom in van de badge SEO/DEV die er in " +
      "augustus uitging. Daardoor schoof alles één plek op en kreeg het kruisje de brede kolom die voor de " +
      "datumknop bedoeld was. Het is nu weer een klein kruisje rechts. De kop van de lijst zegt bovendien " +
      "\"Open\" met het aantal in een grijs bolletje, precies zoals \"Nog geen datum\" eronder, in plaats van " +
      "als hele zin; en \"Taak toevoegen\" heeft dezelfde compacte maat als de andere knoppen op dit scherm.",
  },
];
