import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
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
      titel: "Eén assistent, twee vensters",
      kern: "Het Overview-blok en het zwevende venster zijn hetzelfde gesprek, met dezelfde kennis.",
      tekst:
        "Er waren twee schermen op dezelfde motor, en welke assistent je kreeg hing af van welk venster je "
        + "toevallig opende. Het Overview-blok op de takenpagina kende de hele site: de volledige paginalijst met "
        + "status en redirects, wat er per pagina al gedaan is, de zoekwoordstand, de koers, de concurrenten. Het "
        + "zwevende venster kende de klant: de mail, de stand van zaken, de lopende werkzaamheden, de Search "
        + "Console-totalen, Google Ads. Allebei een half beeld, en het verschil was nergens te zien.\n\n"
        + "Sinds 19 augustus 2026 is het één tool. Elk gesprek krijgt **alles**: de mail én de site, de cijfers én "
        + "de koers. Je kunt in het zwevende venster verdergaan waar je in het Overview-blok gebleven was, want het "
        + "is letterlijk hetzelfde gesprek in dezelfde lijst.\n\n"
        + "Twee assistenten blijven apart, en dat is met opzet: de **Ads-assistent** (eigen campagnecijfers, eigen "
        + "rol) en de **leadomgeving** (een bedrijf dat nog geen klant is, dus geen Search Console en geen "
        + "weekplanning). De **pagina-chat** blijft ook apart: die gaat over één URL, scrapet die elke beurt live, "
        + "en levert een vastgelegde strategie en een document in plaats van taken.",
    },
    {
      titel: "Van gesprek naar werk: één knop, één weg",
      kern: "\"Wat volgt hieruit?\" weegt het hele gesprek en levert een voorstel met vinkjes.",
      tekst:
        "Sparren mag vrijblijvend blijven. Pas als jij erom vraagt, leest de assistent het hele gesprek terug " +
        "en bepaalt hij welk werk eruit volgt. Je krijgt geen takenlijst maar een **voorstel**: per punt wat " +
        "het is, waarom het volgt uit dit gesprek, en hoe zeker dat is. Wat duidelijk volgt staat aangevinkt, " +
        "een suggestie staat uit. Wat bewust géén taak is staat er grijs onder, zodat zichtbaar blijft dat het " +
        "is meegewogen en er niets stilletjes wegvalt. Wat jij aanvinkt wordt een kaart in de weekplanning, " +
        "via dezelfde poort als elke andere kaart.\n\n" +
        "**Dit is de enige weg van gesprek naar taak**, en dat is met opzet. Er was tot 19 augustus 2026 een " +
        "tweede: een knop legde een gesprek vast als \"site-wide strategie-sessie\" in een apart blok op de " +
        "takenpagina, met eigen actiepunten die je daar nog een keer moest omzetten. Dat leverde een analyse op " +
        "een plek waar je hem niet verwachtte en niet zelf bijhield. De grote lijn hoort in **De koers**, in je " +
        "eigen woorden; het werk hoort in de weekplanning. Daartussen zit niets meer.",
    },
    {
      titel: "Als een vraag niet lukt, zie je waarom",
      kern: "Geen stilte meer: de reden staat onder je vraag en je vraag komt terug in het invulveld.",
      tekst:
        "Een zware vraag laat de assistent soms tientallen dingen opzoeken voor hij antwoordt, en heel af en toe " +
        "past dat niet binnen de vijf minuten die de server mag rekenen. Dat is niet erg; erg is dat je het niet " +
        "zag. De vraag verdween uit het invulveld, er kwam niets terug, en het leek alsof je genegeerd werd. " +
        "Wie dan opnieuw plakt, heeft twee identieke vragen in beeld staan zonder één antwoord eronder.\n\n" +
        "Drie dingen zorgen dat dat niet meer kan:\n\n" +
        "- **De reden staat waar de vraag stond.** Onder het gesprek zelf, niet ergens anders op de kaart. " +
        "In gewone taal, met wat je eraan kunt doen (meestal: splits hem in twee kleinere vragen).\n" +
        "- **Je vraag blijft van jou.** Lukt het niet, dan staat je tekst weer in het invulveld en verdwijnt de " +
        "losse vraag uit het gesprek. Ernaast staat een knop **Probeer opnieuw**, dus overtypen of opnieuw " +
        "plakken hoeft nooit meer.\n" +
        "- **Het dashboard kapt zelf af, net vóór de server dat doet.** Daarmee komt er altijd een leesbaar " +
        "antwoord terug in plaats van een lege pagina waar de browser niets mee kan.\n\n" +
        "Daaronder zit nog een stille verbetering: de extra denkrondes die een antwoord afmaken, uitschrijven en " +
        "narekenen beginnen alleen nog als er ook echt tijd voor is. Anders werd een compleet antwoord soms " +
        "ingeruild voor een ronde die er niet meer bij paste, en dan hield je niets over.",
    },
    {
      titel: "Kaarten met knoppen: de mens blijft aan het stuur",
      kern: "De assistent stelt voor, de gebruiker keurt goed, het dashboard voert uit.",
      tekst:
        "Een voorstel komt als kaart met een knop. Pas na goedkeuren gebeurt er iets: een taak aanmaken, een " +
        "document genereren, een meta doorvoeren, een redirect zetten, een mail klaarzetten.\n\n" +
        "Er gaat nooit iets zelfstandig naar de klant of naar de site. Dat is geen technische beperking maar " +
        "een ontwerpkeuze, en hij staat er bewust in: een systeem dat autonoom naar buiten mag kan niet " +
        "vertrouwd worden op het moment dat het één keer misgaat.\n\n" +
        "**Een half geschreven kaart wordt niet uitgevoerd.** Loopt de assistent tegen zijn lengtegrens aan " +
        "terwijl hij een lange kaart schrijft (een vastgelegde strategie, een aanvulling op het klantprofiel), " +
        "dan stopt hij middenin een zin en is de tekst in die kaart onherstelbaar half. Er gaat dan technisch " +
        "niets mis, en dat is juist het gevaar: de kaart ziet er compleet uit en werd gewoon opgeslagen. Op " +
        "16 augustus 2026 kwam zo een Kamsteeg-strategie in het klantprofiel terecht die ophield bij \"aanleg " +
        "en onder\", zonder de prompt voor de plaatspagina's. Nu wordt zo'n antwoord opnieuw gevraagd met meer " +
        "ruimte, en past het dán nog niet, dan wordt de kaart niet uitgevoerd maar compacter opnieuw " +
        "geschreven. Er wordt dus nooit meer stilzwijgend een halve tekst bewaard.",
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
      titel: "Vers gecheckt, gedoseerd en zonder FAQ-vergaarbak",
      kern: "Drie adviesregels uit de praktijk: de pagina wordt op het moment zelf opgehaald, de commerciële laag volgt de zoekresultaten, en zoekersvragen worden koppen in de tekst.",
      tekst:
        "Drie regels die elk advies over een pagina scherper maken, alle drie geboren uit een echte casus " +
        "(augustus 2026, een klantpagina waarvan de sitebouwer net een eigen optimalisatie had doorgevoerd):\n\n" +
        "- **De pagina wordt op het moment van het gesprek zelf opgehaald.** Niet alleen de laatst ingelezen " +
        "versie uit de paginalijst, maar de pagina zoals hij nú live staat, met de datum en tijd erbij " +
        "(\"live gecheckt op ...\"). De assistent mag pas zeggen dat er iets op de pagina ontbreekt als dat " +
        "aan die verse versie getoetst is. Zo kan een advies nooit meer een kop \"missen\" die er sinds " +
        "vorige week gewoon op staat, en zie je als lezer altijd op welke paginaversie het oordeel rust.\n" +
        "- **De commerciële laag wordt gedoseerd naar wat er in Google wint.** Staat de top 10 vol " +
        "kennisbanken en ziekenhuizen, dan wint een overwegend informatieve pagina; verkoopsecties blijven " +
        "dan klein (een kort blok met een link naar de kosten- of behandelpagina). Staat de top 10 vol " +
        "aanbieders, dan mag de commerciële laag dragend zijn. De dosering volgt de zoekresultaten, niet de " +
        "wens om meer te verkopen.\n" +
        "- **Zoekersvragen worden koppen in de tekst, geen los FAQ-blok.** Google toont sinds mei 2026 geen " +
        "FAQ-blokjes meer in de zoekresultaten; de waarde zit in de vraag en het antwoord zelf. De " +
        "belangrijkste vragen die mensen echt stellen (de \"Mensen vragen ook\"-vragen) krijgen daarom elk " +
        "een eigen kop in de tekst met een direct antwoord; alleen restvragen mogen nog in een kort blok " +
        "\"Veelgestelde vragen\" onderaan.",
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
};
