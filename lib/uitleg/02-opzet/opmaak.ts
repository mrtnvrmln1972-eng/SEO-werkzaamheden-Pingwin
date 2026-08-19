import type { Uitklapper } from "../types";

// Hoe de opmaak overal hetzelfde blijft, en de meters die dat afdwingen.
export const BLOKKEN: Uitklapper[] = [
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
      titel: "Wat je zelf typt of plakt is net zo mooi als wat het dashboard zelf maakt",
      kern: "Bij plakken gaat de opmaak van buiten eruit, maar de structuur blijft staan.",
      tekst:
        "Overal in het dashboard staan velden waar je vrij in schrijft: de koers van een klant, wat er nu " +
        "opgepakt wordt, de bespreekpunten, de aantekeningen bij een taak. Die velden hingen aan hun eigen, " +
        "kleinere setje opmaakregels. Werkte je links in de chat een strategie uit en plakte je die rechts in " +
        "de koers, dan bleef er een muur tekst over: de kopjes waren gewone letters die aan de volgende zin " +
        "vastplakten, de opsommingen waren regelafbrekingen, de lijnen waren weg. Dezelfde tekst, een kolom " +
        "verderop, stond wél netjes.\n\n" +
        "Nu hangen die velden aan **exact dezelfde opmaak** als de tekst die het dashboard zelf rendert: " +
        "dezelfde oranje kopjes, dezelfde witruimte, dezelfde bullets, lijnen en tabellen. Bij plakken gaat " +
        "alleen weg wat van buiten komt (lettertype, kleuren, achtergronden uit Sheets, Docs of een webpagina); " +
        "de **structuur** van je tekst blijft staan: koppen, opsommingen, genummerde lijsten, lijnen, citaten, " +
        "alinea's, tabellen en klikbare links. Plak je platte tekst waar nog opmaaktekens in staan, dan wordt " +
        "die meteen gerenderd in plaats van letterlijk getoond.\n\n" +
        "Ook dit leunt niet op geheugen: er draait vóór elke bouw een controle die een echt stuk strategie " +
        "door de opschoner heen haalt en de bouw stopt zodra een kop, een bullet, een lijn, een link of een " +
        "tabel sneuvelt, of zodra een veld weer zijn eigen opmaakregels krijgt.",
    },
    {
      titel: "Een kop is overal een kop, een tabel overal dezelfde tabel",
      kern: "Eén opmaak voor alle lopende tekst, en één plek waar hij vandaan komt.",
      tekst:
        "Er waren vier uiterlijken voor dezelfde soort tekst, en niemand had dat besloten; ze waren " +
        "gegroeid. Een tabel in een chat-antwoord had een licht-oranje kop, dezelfde tabel in een rapport " +
        "een donkere, een geplakte tabel weer een andere. Kopjes waren in de chat oranje met een lijntje " +
        "eronder en elders bruin zonder. Dezelfde inhoud zag er dus anders uit, puur afhankelijk van welk " +
        "scherm hem toevallig tekende.\n\n" +
        "Er is er nu één, en het is de mooiste van de vier: oranje kopjes met een lijntje, oranje pijltjes " +
        "als opsommingsteken, oranje links, en één tabel met een licht-oranje kop en om-en-om een grijze " +
        "rij. Die staat op **één plek** en geldt voor alle drie de soorten tekst tegelijk: wat het " +
        "dashboard rendert, wat er in een chat verschijnt, en wat je zelf in een veld typt of plakt.\n\n" +
        "Datzelfde gold voor de code eronder. Negenentwintig plekken beslisten zélf hoe een stuk tekst " +
        "HTML werd; twee daarvan hadden precies dezelfde regel woordelijk uitgeschreven, en een paar deden " +
        "iets zwakkers, waardoor daar opmaaktekens gewoon in beeld kwamen. Dat is nu één functie waar " +
        "alles doorheen gaat.\n\n" +
        "Een controle vóór elke bouw houdt het zo: hij leest élke opmaakregel die ná de gedeelde staat en " +
        "stopt de bouw zodra iemand er weer een eigen setje bijzet voor een kop, een opsomming, een link " +
        "of een tabel.",
    },
    {
      titel: "Meters die maar één kant op kunnen",
      kern: "Drie controles bewaken of een scherm het goed doet. Deze tellen hoeveel keuzes er in totaal bestaan.",
      tekst:
        "De controles hierboven vragen allemaal hetzelfde: doet **dit** scherm het volgens de regels? " +
        "Alle drie groen, en toch groeide het geheel uit elkaar. Dat is geen tegenspraak maar een blinde " +
        "vlek: geen enkele controle vroeg hoeveel verschillende kleuren, tekstmaten, schaduwen of soorten " +
        "knop er in **totaal** bestaan. Een scherm mag dus keurig volgens de regels een eigen kleur kiezen, " +
        "en honderd schermen die dat allemaal netjes doen leveren honderd kleuren op. Elke keuze op zich is " +
        "verdedigbaar, de optelsom is een ratjetoe.\n\n" +
        "Er is nu een meter die de optelsom telt, en het getal mag alleen omlaag. Komt er een kleur, maat of " +
        "schaduw bij die niet uit de vaste schaal komt, dan stopt de bouw. Ruim je op, dan zakt het plafond " +
        "mee, zodat de winst er niet later ongemerkt weer in glipt.\n\n" +
        "Op **/admin/stijl** staat de spiegel: bovenaan hoe weinig keuzes het dashboard zou moeten hebben " +
        "(één schaal voor tekst, één voor ruimte, één set kleuren, één knop), daaronder hoeveel er werkelijk " +
        "in de code staan. Elke losse kleur wordt daar naast de kleur gelegd die al een naam heeft, want dat " +
        "maakt het verschil tussen ontwerpwerk en opruimwerk: verreweg de meeste zijn een kleur die al " +
        "bestaat, alleen anders opgeschreven of een tint ernaast. Dat is zoeken en vervangen, geen smaak.\n\n" +
        "En sinds 18-08-2026 kan het waar het allemaal voor was: op **/admin/stijl** staat een " +
        "speelruimte. Je kiest een richting (strak en zakelijk, zacht en luchtig, rustig en datadicht) " +
        "of je draait zelf aan de accentkleur, het lettertype, de ruimte, de tekstgrootte, de ronding en " +
        "de diepte, en het hele scherm verandert mee terwijl je kijkt. Niet in een voorbeeldblokje, maar " +
        "in de echte kopbalk, kaarten, knoppen en tabellen, want dat zijn dezelfde bouwstenen als " +
        "overal. Draaien legt niets vast: je speelt in je eigen browser, met een balkje bovenin dat zegt " +
        "dat je naar een proef kijkt, en niemand anders ziet er iets van.\n\n" +
        "Wat daar sinds 19-08-2026 bij kan: **twee standen naast elkaar zien, op je eigen schermen**. " +
        "In je browser staat er altijd maar één richting aan, dus vergelijken kwam neer op heen en weer " +
        "klikken en het uit je hoofd doen. Nu kies je in de speelruimte een scherm waar je veel zit (de " +
        "klantenlijst, de takenpagina van een klant, de prioriteitenscan, het financieel overzicht of de " +
        "agenda) en fotografeert het dashboard dat scherm twee keer: zoals het nu is, en in de richting " +
        "die je uitprobeert. Geen voorbeeldblokje, maar je eigen scherm met je eigen data erin. De foto " +
        "in de nieuwe richting is precies wat vastleggen zou opleveren, want hij rekent met dezelfde som " +
        "als de vastgelegde huisstijl.\n\n" +
        "Bevalt een richting, dan leg je hem vast met één knop onderaan datzelfde paneel. Vanaf dat moment " +
        "is het gewoon hoe het dashboard eruitziet, op elk scherm en voor iedereen die inlogt, klanten in " +
        "hun eigen dashboard inbegrepen. Daar komt geen bouw of programmeerwerk meer aan te pas, en met " +
        "\"terug naar de standaard\" staat alles weer zoals het was. Dat is met opzet zo: een keuze die " +
        "een bouw nodig heeft, wordt niet gemaakt op het moment dat je hem maakt, en een ander bureau dat " +
        "dit dashboard straks gebruikt kan niet bij de code.\n\n" +
        "De eerste keuze is inmiddels gemaakt, en die was: het blijft eruitzien zoals het nu is. Dat " +
        "klinkt als niets doen, maar het verzet het werk van \"hoe wordt het\" naar \"geldt het overal\". " +
        "Want een stijl die maar op driekwart van de plekken aankomt, is geen stijl. Elke ronde daarna " +
        "gaat over dat laatste kwart: schaduwen die net anders waren opgeschreven, kleurcodes die " +
        "rechtstreeks in een scherm stonden in plaats van via een naam. Die bewegen nergens in mee, dus " +
        "die blijven staan waar ze staan zodra er ooit wél iets verandert.\n\n" +
        "Waarom dat scherm er nu al is en niet pas als alles klopt: zodra alles uit de schalen leest, is een " +
        "ander ontwerp kiezen niets meer dan die schalen veranderen, en zie je op dezelfde plek in één blik " +
        "wat dat met alle bouwstenen tegelijk doet. Het strak trekken en de speelruimte bouwen zijn niet " +
        "twee klussen maar één.\n\n" +
        "Daarvoor moest er nog iets bij, want een schaal zegt alleen hoe groot iets is en welke kleur het " +
        "heeft. Wil je alle bijschriften een tikje groter, dan moet je weten wélke van de honderden " +
        "gebruiken een bijschrift is, en dat stond nergens. Er ligt nu een **betekenislaag** bovenop: " +
        "zevenenveertig namen die zeggen waarvóór een waarde dient, zoals een bijschrift, een kaartrand of " +
        "de ruimte binnen een kaart. Of dat bijschrift 12,5 of 13 pixels is, staat op één plek. De namen " +
        "volgen hoe het al gebruikt werd, niet hoe het zou moeten heten: dat is eerst nageteld.\n\n" +
        "Ook daar hoort een meter bij, maar dan andersom: een **vloer** onder het aantal plekken dat die " +
        "laag gebruikt, die alleen mag stijgen. Een laag die netjes gedefinieerd is en die niemand gebruikt " +
        "is namelijk geen fundament maar een vierde stapel naast de drie die er al lagen, en dan is het " +
        "erger geworden in plaats van beter.\n\n" +
        "Eén les uit de eerste dag, want die kostte een oplevering: een meter moet meten wat hij bedoelt. " +
        "De knopmeter telde classnamen, en zag een keurige knop met een aan-stand en een pijltje erin aan " +
        "voor drie nieuwe soorten knop. Hij hield daarmee goed werk tegen. Die meter houdt nu geen bouw meer " +
        "tegen; dát een knop het knopsysteem gebruikt werd al bij de knop zelf bewaakt, en dezelfde regel op " +
        "twee plekken bewaken loopt uit elkaar. Een poort die goed werk tegenhoudt wordt uitgezet, en dan " +
        "bewaakt hij niets meer.",
    },
];
