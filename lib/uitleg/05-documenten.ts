import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
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
        "van dat zoekwoord en de snelheidscijfers. Met pass of fail per criterium. De pagina wordt op het " +
        "meetmoment vers uitgelezen en het document vermeldt die datum (\"feiten live gecheckt op ...\"), " +
        "zodat altijd te zien is op welke paginaversie het oordeel rust. De aanbevelingen doseren de " +
        "commerciële laag naar de top-10: is die overwegend informatief, dan geen zware verkoopsecties maar " +
        "een kort blok met een interne link.\n" +
        "3. **Blauwdruk.** Hoe moet de pagina eruit gaan zien: koppenstructuur met zoekwoorddekking, " +
        "meta-templates met tekenaantallen, de interne linkkaart, briefings voor de afbeeldingen, de " +
        "zoekersvragen en de structured data. De belangrijkste zoekersvragen krijgen een eigen kop in de " +
        "tekst zelf; alleen restvragen komen in een kort blok \"Veelgestelde vragen\" onderaan, want " +
        "FAQ-blokjes in de zoekresultaten bestaan sinds mei 2026 niet meer en de waarde zit in het antwoord " +
        "zelf.\n" +
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
        "gereedschapsjargon. Wat de klant leest is niet wat de uitvoerder leest.\n\n" +
        "**Een link opent het document, geen kijkscherm.** Klik je een document aan, dan gaat het meteen open " +
        "in Google Docs, in bewerkmodus, met de huisstijl-opmaak erin. Eerder kwam je op het kijkscherm van " +
        "Drive terecht en moest je daar nog een keer op \"Openen met\" klikken voor je iets kon nalezen of " +
        "aanpassen. Dat geldt ook voor de documenten die er al maanden staan. Een pdf of afbeelding houdt zijn " +
        "gewone Drive-link, want die kan Docs niet openen.\n\n" +
        "**Een kop staat nooit alleen onderaan een bladzijde.** Word breekt een pagina waar hij uitkomt, en zo " +
        "belandde een kop soms onderin met zijn eigen tekst pas op de volgende bladzijde: het las als een lege " +
        "sectie. Elke kop, elk kopje in een tabel en elke witregel die bij een kop hoort schuift nu mee naar de " +
        "volgende bladzijde in plaats van achter te blijven. Dat zit in de bouwstenen, dus het geldt voor elk " +
        "Pingwin-document, en een proef controleert het bij elke bouw in het echte Word-bestand.\n\n" +
        "**Welke versie geldt.** Van een soort document (analyse, blauwdruk, copy) kunnen er meerdere naast " +
        "elkaar liggen, bijvoorbeeld als de klant zijn eigen versie terugstuurt. Eén ervan is de versie waar de " +
        "rest mee rekent: die gaat mee in een mail, staat op de werklijst voor de sitebouwer, en is de tekst " +
        "die \"Zet copy als concept in de site\" oppakt. Ligt er maar één document van een soort, dan is die " +
        "het vanzelf. Pas als er een tweede bij komt, verschijnt het vinkje **geldt** en kies je zelf. Dat was " +
        "eerder altijd een leeg vinkje dat je moest aanzetten, ook als er niets te kiezen viel, en vergat je " +
        "het dan viel de rest stil zonder te zeggen waarom.",
    },
    {
      titel: "Wat de klant krijgt is al perfect gemaakt, niet alleen beoordeeld",
      kern: "Een oplevering bevat geen oordeel meer over ons eigen werk.",
      tekst:
        "In de copy-briefing staat een blok **De paginatitel en omschrijving in Google**: de twee regels " +
        "zoals iemand ze in Google ziet voordat hij klikt, gemeten met de pixel-motor. Google kapt namelijk " +
        "niet af op tekens maar op breedte: een W is breed, een i smal. De motor meet die breedte in het " +
        "lettertype van de zoekresultaten.\n\n" +
        "In dat blok staat de opgeleverde tekst met de meting, en daaronder de verificatie: elk criterium " +
        "waaraan de titel en de omschrijving getoetst zijn, met de gemeten waarde erachter. Dat is exact " +
        "dezelfde criterialijst als het meta-paneel in het dashboard gebruikt, inclusief de pixelbreedte, " +
        "dus het document kan niet iets anders beweren dan het scherm. Die lijst verschijnt alleen als " +
        "álles klopt: een kruisje in een oplevering is een oordeel over eigen werk, en dan is het aan ons " +
        "om het eerst te repareren.\n\n" +
        "Er zat een gat in die keten. De motor mat goed, maar de poort waar onze eigen teksten doorheen " +
        "moesten keek alleen naar wat écht kapot is: te breed, een pijp, vierkante haken. Een titel die " +
        "alleen te kort was kwam er zo doorheen, en verscheen daarna in het klantdocument mét het oordeel " +
        "'te kort, ruimte onbenut'. De klant las dus in onze oplevering dat ons eigen werk niet voldeed.\n\n" +
        "Dat is nu omgedraaid. Er zijn twee oordelen, en ze staan los van elkaar:\n\n" +
        "1. **Over wat er live staat** (vaak niet door ons geschreven): alleen wat echt kapot is, zodat een " +
        "signaallijst geen alarm slaat bij een titel die alleen wat kort is.\n" +
        "2. **Over wat wij opleveren:** de volledige criterialijst, inclusief onbenutte ruimte, het zoekwoord " +
        "vooraan, een concreet feit en een actieve uitnodiging. Komt een tekst daar niet doorheen, dan gaat " +
        "hij terug de correctielus in, met de meting erbij, tot hij het venster van Google netjes vult.\n\n" +
        "Die lus staat op één plek, dus de documenten, de meta-voorstellen en de klantversie leveren dezelfde " +
        "kwaliteit. Verbetert de lus een tekst in het klantdocument, dan gaat die verbetering ook terug de " +
        "opgeslagen copy in: één tekst voor het document, voor de site en voor het nameten.\n\n" +
        "**En het omslagbeeld liegt niet meer.** De omslag fotografeert de pagina waar het document over " +
        "gaat. Bij een pagina die nog gebouwd moet worden bestaat die nog niet, dus stond er een 404-scherm " +
        "als hoofdbeeld op een klantdocument. Nu wordt eerst gekeken of de pagina echt bestaat (ook als de " +
        "site netjes een foutpagina teruggeeft), en anders komt de site van de klant zelf op de omslag. Die " +
        "controle kijkt niet meer alleen naar de titel en de eerste kop, maar ook naar het begin van de " +
        "zichtbare tekst: lang niet elk thema zet '404' in een echte kop, en dan glipte de foutpagina er " +
        "alsnog doorheen.",
    },
    {
      titel: "Waarom de paginatitel en de omschrijving niet altijd klopten",
      kern: "We gaven het model een regel in tekens en rekenden het af in pixels.",
      tekst:
        "De vraag was terecht: waarom komt er niet altijd een titel en omschrijving uit die aan alle " +
        "criteria voldoen, terwijl de motor tot op de pixel kan meten? Het antwoord bleek na te rekenen, " +
        "en het was geen toeval maar een weeffout.\n\n" +
        "**Wij gaven twee regels die niet hetzelfde zeiden.** Tegen het model zeiden we: een omschrijving " +
        "is 120 tot 155 tekens. Daarna toetsten we op breedte: 800 tot 920 pixels. Maar 800 pixels komt " +
        "voor gewone Nederlandse tekst neer op ongeveer 135 tekens. Alles tussen 120 en 134 tekens haalde " +
        "dus onze eigen tekenregel wél en het pixelvenster niet. Bij de titel hetzelfde: wij vroegen 40 tot " +
        "60 tekens, terwijl het venster pas bij ongeveer 45 tekens begint. Het model schreef keurig naar de " +
        "regel die het kon uitvoeren (tekens tellen kan het), en werd afgerekend op de regel die het niet " +
        "kon zien (pixels meten kan het niet). Zo kwam er een titel van 40 tekens uit die 380 pixels breed " +
        "was, ruim onder de 430 die Google toont.\n\n" +
        "Er is nu **één norm: de pixel.** Het tekenaantal wordt daaruit afgeleid en aan de tekst zelf " +
        "gemeten, want een zin vol hoofdletters is per teken breder dan een zin vol i-tjes. Wat we het " +
        "model vertellen en waarop we het beoordelen is vanaf nu dezelfde regel.\n\n" +
        "Daar bovenop drie dingen die van een poging een garantie maken:\n\n" +
        "1. **Het model hoort hoevéél het scheelt,** niet alleen dát het mis is: \"je komt 20 pixels tekort, " +
        "schrijf er ongeveer vier tot twaalf tekens bij\".\n" +
        "2. **Drie varianten per ronde in plaats van één.** Bij één variant kreeg het model na een afkeuring " +
        "exact dezelfde vraag opnieuw, en dus vaak hetzelfde antwoord. Nu worden er drie gemeten en wint de " +
        "beste.\n" +
        "3. **De vijl:** een laatste slag die alleen rekent, zonder model. Te breed wordt ingekort op een " +
        "natuurlijke grens (eerst het merkstaartje, dan een komma, dan een hele zin), te kort wordt " +
        "aangevuld met eigen woorden van de klant. De vijl doet alleen iets als het resultaat het venster " +
        "écht haalt en de zin netjes afloopt. Lukt dat niet, dan blijft de tekst ongemoeid: liever niets dan " +
        "een half afgeknipte zin.\n\n" +
        "En als het dan nóg niet lukt, blijft dat niet stil. Het dashboard meldt bij de oplevering dat de " +
        "titel of de omschrijving onze eigen lat niet haalt, zodat het opvalt vóórdat een klant het ziet in " +
        "plaats van erna.",
    },
    {
      titel: "Waarom vier blokken zonder titel in beeld stonden",
      kern: "Een tabel in een kader tekent niet elke lezer.",
      tekst:
        "In het hoofdstuk \"Hoe deze nieuwe tekst tot stand kwam\" staan vier stappen, elk met een genummerd " +
        "bolletje en een titel. In het opgeleverde document waren die titels weg: vier naamloze blokken met " +
        "alleen tekst, en een kader dat onderaan te veel ruimte overhield.\n\n" +
        "De oorzaak: het bolletje en de titel stonden in een klein tabelletje **binnen** het kader. Dat is " +
        "toegestaan, maar niet elke lezer tekent een tabel binnen een tekstvak, en de voorvertoning liet hem " +
        "gewoon weg. Het kader hield in zijn hoogte wél rekening met die titelregel, en daardoor bleef er " +
        "onderin lucht over.\n\n" +
        "De titel staat nu **boven** het kader, als gewone tekst met het bolletje ernaast, precies zoals een " +
        "hoofdstuktitel is opgebouwd. Die tekent overal. Het kader eronder bevat alleen nog de tekst en " +
        "sluit daar strak omheen. En omdat een hoofdstuktitel nu gevolgd wordt door een korte titelregel in " +
        "plaats van meteen door een groot kader, blijft hij ook veel minder snel alleen onder aan een pagina " +
        "achter.",
    },
    {
      titel: "Eén uitleg per briefing, en de webteksten daaronder",
      kern: "De copy-briefing zei alles twee keer; nu één keer, en vers.",
      tekst:
        "Het copy-document dat de motor opslaat is zelf al een briefing: het opent met hoofdstukken over " +
        "waar de teksten over gaan, welke zoekwoorden erin zitten en wat dat voor de vindbaarheid betekent, " +
        "en daarónder staan pas de echte webteksten. Het klantdocument bouwt diezelfde uitleg opnieuw op, " +
        "maar dan vers: met de zoekwoorden en de posities zoals ze vandaag in Search Console staan.\n\n" +
        "Die twee stonden achter elkaar in hetzelfde document. De klant las de uitleg dus twee keer, met de " +
        "verse en de opgeslagen versie door elkaar, en ook de paginatitel en de omschrijving stonden er twee " +
        "keer in. Nu wordt uit het opgeslagen document alleen het deel overgenomen dat er nog niet staat: de " +
        "webteksten. Staat een hoofdstuk niet op de lijst van bekende briefing-koppen, dan blijft het gewoon " +
        "staan; er verdwijnt niets stilzwijgend.\n\n" +
        "Daarmee klopt ook de niveau-aanduiding weer. De labels **H1**, **H2** en **H3** zijn een instructie " +
        "aan de sitebouwer over het kopniveau op de site. Ze stonden ook boven de hoofdstukken van de " +
        "briefing zelf, die nooit op de site komen. Nu staan ze alleen nog bij de daadwerkelijke " +
        "paginatekst.\n\n" +
        "Verder: de kaders in een document (de openingstekst, de stappenkaarten, het citaat) rekenen hun " +
        "hoogte nu uit door de tekst echt af te breken zoals hij op het scherm afbreekt, in plaats van het " +
        "aantal tekens te delen door een vast getal. Dat vaste getal rekende met te veel tekens per regel en " +
        "een te lage regelhoogte, waardoor de laatste zin onder het kader uit liep. En een hoofdstuktitel " +
        "krijgt lucht boven zich en blijft aan zijn eerste alinea vastgeplakt: past dat niet meer op de " +
        "pagina, dan begint het hoofdstuk op de volgende in plaats van als losse regel onderaan achter te " +
        "blijven.",
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
};
