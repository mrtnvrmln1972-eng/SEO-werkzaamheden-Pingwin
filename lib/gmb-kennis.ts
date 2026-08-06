// ═══════════════════════════════════════════════════════════
// GOOGLE-BEDRIJFSPROFIEL: DE ENIGE BRON VOOR WAT WE METEN EN ADVISEREN
// ═══════════════════════════════════════════════════════════
// Alleen lijsten, typen en teksten; geen database, geen server-code, geen fetch.
// Net als lib/onboarding-stappen.ts draait dit bestand dus óók in de browser,
// zodat het scherm exact dezelfde criteria en dezelfde woorden toont als de
// motor gebruikt. Dat is de les die hier al drie keer geleerd is: dezelfde regel
// op twee plekken uitschrijven betekent dat ze uit elkaar gaan lopen.
//
// De onderbouwing (waaróm dit de punten zijn die tellen) staat in het brein:
// pingwin-brein/brein/wat-werkt/google-bedrijfsprofiel.md. Dit bestand is de
// uitvoerbare vertaling daarvan; wijzigt de kennis, wijzig ze op beide plekken.
// ═══════════════════════════════════════════════════════════

/** De zes brillen waarmee we naar een profiel kijken. */
export type Bril = "compleet" | "consistent" | "reviews" | "beeld" | "activiteit" | "concurrentie";

export const BRIL_LABEL: Record<Bril, string> = {
  compleet: "Compleet",
  consistent: "Klopt met de site",
  reviews: "Reviews",
  beeld: "Foto's",
  activiteit: "Activiteit",
  concurrentie: "Tegenover de concurrent",
};

export const BRIL_UITLEG: Record<Bril, string> = {
  compleet: "Ieder leeg veld is een vraag die Google niet kan beantwoorden en een reden om iemand anders te tonen.",
  consistent: "Staat er op het profiel iets anders dan op de site, dan vertrouwt Google geen van beide helemaal.",
  reviews: "Het tempo waarin er reviews bijkomen en of er geantwoord wordt weegt zwaarder dan het totaal.",
  beeld: "Profielen met recente, echte foto's worden vaker aangeklikt en vaker bezocht.",
  activiteit: "Een profiel dat leeft (posts, vragen, diensten) wint het van een profiel dat alleen bestaat.",
  concurrentie: "Lokaal is alles relatief: niet hoe goed je bent, maar hoe goed je bent tegenover nummer 1.",
};

/** Waar een bevinding vandaan komt. Bepaalt of we hem kunnen meten of niet. */
export type Bron =
  | "maps"    // de meetdeur (Places API): werkt altijd, ook voor concurrenten
  | "beheer"  // de beheerdeur (Business Profile API): alleen als jij beheerder bent én Google ons goedkeurde
  | "eigen";  // uit het dashboard zelf (bedrijfsgegevens, site)

/** Hoe hard de uitslag is. Dezelfde afspraak als bij de mailcontrole. */
export type Hardheid = "gemeten" | "richtinggevend";

export type Zwaarte = "hoog" | "middel" | "laag";

export type CheckDef = {
  key: string;
  bril: Bril;
  /** Wat er niet goed is, in gewone taal. Zo staat het in beeld. */
  label: string;
  /** Waarom dit uitmaakt. Eén zin, geen jargon. */
  waarom: string;
  /** Wat er moet gebeuren. Concreet genoeg om er een taak van te maken. */
  actie: string;
  bron: Bron;
  zwaarte: Zwaarte;
  hardheid: Hardheid;
  /** Alleen relevant voor deze bedrijfstypes (leeg = voor alle). */
  alleenType?: Bedrijfstype[];
};

/** Spiegelt OrgData["bedrijfstype"] uit lib/org-data.ts. */
export type Bedrijfstype = "kliniek" | "webshop" | "dienstverlener" | "lokaal" | "informatief";

// ═══════════════════════════════════════════════════════════
// DE CHECKS
// ═══════════════════════════════════════════════════════════
// Volgorde binnen een bril is de volgorde in beeld. De motor bepaalt welke
// checks áánslaan; deze lijst bepaalt wat ze dan zeggen.

export const CHECKS: CheckDef[] = [
  // ── Compleet ───────────────────────────────────────────────
  {
    key: "geen-profiel", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er is geen Google-bedrijfsprofiel gevonden",
    waarom: "Zonder profiel sta je niet op de kaart en niet in het lokale blok bovenaan de zoekresultaten, hoe goed de site ook is.",
    actie: "Profiel aanmaken en laten verifiëren. Verificatie duurt enkele dagen tot weken, dus dit is altijd de eerste stap.",
  },
  {
    key: "niet-actief", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Het profiel staat op tijdelijk of permanent gesloten",
    waarom: "Google toont een gesloten profiel vrijwel nooit, en bezoekers die het wel zien haken af.",
    actie: "Controleer in het beheer of dit klopt. Zo niet, zet de status terug op geopend.",
  },
  {
    key: "geen-categorie", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staat geen of een te vage hoofdcategorie",
    waarom: "De hoofdcategorie is het zwaarste ranking-signaal van een profiel: hij bepaalt op welke zoekopdrachten je überhaupt kans maakt.",
    actie: "Kies de meest specifieke categorie die het bedrijf echt dekt, en zet de bijzaken als extra categorie erachter.",
  },
  {
    key: "geen-website", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staat geen website-link op het profiel",
    waarom: "De link is de brug van het profiel naar de site; zonder die brug gaat het bezoek dat je verdient nergens heen.",
    actie: "Zet de website erop, en bij meerdere vestigingen de bijbehorende locatiepagina in plaats van de homepage.",
  },
  {
    key: "geen-telefoon", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staat geen telefoonnummer op het profiel",
    waarom: "Bellen is bij lokale zoekopdrachten vaak de belangrijkste actie, en zonder nummer verdwijnt de belknop.",
    actie: "Zet het lokale nummer erop, niet een centraal 088-nummer als er een plaatselijk nummer bestaat.",
  },
  {
    key: "geen-openingstijden", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "De openingstijden ontbreken",
    waarom: "Google toont profielen zonder openingstijden minder vaak, en \"nu geopend\" is een filter dat mensen echt gebruiken.",
    actie: "Vul alle zeven dagen in, ook de dagen dat je dicht bent.",
  },
  {
    key: "geen-feestdagen", bril: "compleet", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "Er zijn geen afwijkende openingstijden voor feestdagen ingesteld",
    waarom: "Google vraagt er zelf om en zet een waarschuwing op je profiel als het ontbreekt; bezoekers voor een dichte deur leveren bovendien slechte reviews op.",
    actie: "Zet de feestdagen van dit jaar in één keer klaar in het beheer.",
  },
  {
    key: "geen-beschrijving", bril: "compleet", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "De bedrijfsomschrijving is leeg of veel te kort",
    waarom: "Dit is de enige plek op het profiel waar je in eigen woorden uitlegt wat je doet en voor wie; hij telt niet mee voor de ranking maar wel voor de keuze.",
    actie: "Schrijf 600 tot 750 tekens: wat je doet, voor wie, in welk gebied, en wat je anders maakt. Geen opsomming van zoekwoorden.",
  },
  {
    key: "geen-attributen", bril: "compleet", bron: "beheer", zwaarte: "middel", hardheid: "richtinggevend",
    label: "De attributen zijn niet ingevuld",
    waarom: "Attributen zoals rolstoeltoegankelijk, gratis parkeren of afspraak nodig zijn filters waarop mensen zoeken; wat je niet invult, kun je niet winnen.",
    actie: "Loop de aangeboden attributen één keer door en vink alles aan wat klopt.",
  },
  {
    key: "geen-diensten", bril: "compleet", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "De diensten staan niet op het profiel",
    waarom: "Een ingevulde dienstenlijst laat je meedoen op zoekopdrachten naar die specifieke dienst in plaats van alleen op je categorie.",
    actie: "Zet elke hoofddienst erop met een korte omschrijving. De dienstenlijst uit de bedrijfsgegevens is het startpunt.",
    alleenType: ["dienstverlener", "kliniek", "lokaal"],
  },
  {
    key: "geen-producten", bril: "compleet", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "Er staan geen producten op het profiel",
    waarom: "Producten krijgen een eigen blok op het profiel met foto en prijs, en dat blok wordt bekeken en aangeklikt.",
    actie: "Zet de bestsellers of de hoofdcategorieën erop, met foto, prijs en een link naar de productpagina.",
    alleenType: ["webshop", "lokaal"],
  },

  // ── Klopt met de site ──────────────────────────────────────
  {
    key: "naam-wijkt-af", bril: "consistent", bron: "eigen", zwaarte: "hoog", hardheid: "gemeten",
    label: "De bedrijfsnaam op het profiel wijkt af van de vastgelegde naam",
    waarom: "Google koppelt profiel, site en vermeldingen op naam, adres en telefoon; wijkt er één af, dan verzwakt het hele verband.",
    actie: "Maak de namen gelijk. Let op: er mogen geen zoekwoorden in de profielnaam die niet op de gevel staan, dat is een reden voor schorsing.",
  },
  {
    key: "adres-wijkt-af", bril: "consistent", bron: "eigen", zwaarte: "hoog", hardheid: "gemeten",
    label: "Het adres op het profiel wijkt af van het adres in de bedrijfsgegevens",
    waarom: "Twee adressen voor één bedrijf is precies het signaal waardoor Google geen van beide durft te vertrouwen.",
    actie: "Kies welk adres klopt en pas de andere plek aan, inclusief de structured data op de site.",
  },
  {
    key: "telefoon-wijkt-af", bril: "consistent", bron: "eigen", zwaarte: "hoog", hardheid: "gemeten",
    label: "Het telefoonnummer op het profiel wijkt af van dat in de bedrijfsgegevens",
    waarom: "Hetzelfde verhaal als bij het adres, en het kost bovendien echte telefoontjes als het oude nummer nog rondzwerft.",
    actie: "Maak ze gelijk, op het profiel, op de site en in de structured data.",
  },
  {
    key: "website-wijkt-af", bril: "consistent", bron: "eigen", zwaarte: "middel", hardheid: "gemeten",
    label: "De website-link wijst niet naar het domein van deze klant",
    waarom: "Een link naar een oud domein of een socialprofiel gooit het bezoek weg dat het profiel oplevert.",
    actie: "Zet de juiste URL erop, zonder tracking-parameters die de link lelijk maken.",
  },
  {
    key: "reviewcijfer-wijkt-af", bril: "consistent", bron: "eigen", zwaarte: "laag", hardheid: "gemeten",
    label: "Het reviewcijfer in de bedrijfsgegevens klopt niet meer met wat er live staat",
    waarom: "Dat cijfer staat in de structured data op de site; wijkt het af van de werkelijkheid, dan is dat een onjuiste claim aan Google.",
    actie: "Werk de bedrijfsgegevens bij met de gemeten waarden, en genereer de structured data opnieuw.",
  },
  {
    key: "geen-mapslink-vastgelegd", bril: "consistent", bron: "eigen", zwaarte: "laag", hardheid: "gemeten",
    label: "De Google Maps-link van deze vestiging staat nog niet in de bedrijfsgegevens",
    waarom: "Die link hoort bij de vaste vermeldingen van het bedrijf, zodat Google en AI-systemen profiel en site aan elkaar knopen.",
    actie: "Neem de link op bij de vestiging en bij de sociale profielen in de bedrijfsgegevens.",
  },

  // ── Reviews ────────────────────────────────────────────────
  {
    key: "geen-reviews", bril: "reviews", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staan (bijna) geen reviews op het profiel",
    waarom: "Zonder reviews kom je niet in het lokale blok, en de bezoekers die je wél ziet kiezen de concurrent met sterren.",
    actie: "Zet een vaste vraagroutine op: elke tevreden klant krijgt na afloop de reviewlink, per mail of via een QR-code.",
  },
  {
    key: "reviewtempo-laag", bril: "reviews", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er komen te weinig nieuwe reviews bij",
    waarom: "Google kijkt naar hoe vers de reviews zijn; honderd reviews uit 2022 wegen minder dan twintig van dit jaar.",
    actie: "Spreek een aantal per maand af met de klant en maak het vragen onderdeel van het werkproces, niet een losse actie.",
  },
  {
    key: "reviews-onbeantwoord", bril: "reviews", bron: "beheer", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er wordt niet of nauwelijks op reviews geantwoord",
    waarom: "Google noemt reageren zelf een factor, en voor bezoekers is een antwoord het bewijs dat er iemand oplet. Ook bij vijf sterren.",
    actie: "Spreek af dat de klant op élke review reageert. Het dashboard schrijft de concepten, de klant zet ze erop.",
  },
  {
    key: "lage-review", bril: "reviews", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staat een review van drie sterren of lager onbeantwoord",
    waarom: "Een negatieve review zonder reactie is het eerste wat een twijfelende bezoeker leest; mét een rustige reactie wordt hij juist een blijk van vertrouwen.",
    actie: "Binnen twee dagen reageren: erkennen, niet in discussie, en het gesprek offline voortzetten.",
  },
  {
    key: "reviews-zonder-inhoud", bril: "reviews", bron: "maps", zwaarte: "laag", hardheid: "richtinggevend",
    label: "De reviews noemen bijna nooit de dienst of de plaats",
    waarom: "Woorden in reviews helpen Google begrijpen waar je goed in bent; \"top!\" zegt niets, \"snel geholpen met een lekkage in Breda\" wel.",
    actie: "Vraag niet om \"een review\" maar om \"wat we voor u gedaan hebben\". Dat levert vanzelf de juiste woorden op.",
  },

  // ── Foto's ─────────────────────────────────────────────────
  {
    key: "geen-fotos", bril: "beeld", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Er staan (bijna) geen foto's op het profiel",
    waarom: "Profielen met foto's krijgen aantoonbaar meer klikken naar de website en meer routeaanvragen dan profielen zonder.",
    actie: "Zet er minimaal tien echte foto's op: buitenkant, binnenkant, team, en het werk zelf. Geen stockfoto's.",
  },
  {
    key: "fotos-verouderd", bril: "beeld", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "De laatste foto is lang geleden geplaatst",
    waarom: "Verse foto's zijn een teken van leven; een profiel waar sinds twee jaar niets bij kwam oogt verlaten.",
    actie: "Spreek een ritme af, bijvoorbeeld een paar foto's per maand van echt werk.",
  },
  {
    key: "geen-logo-omslag", bril: "beeld", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "Het logo of de omslagfoto ontbreekt",
    waarom: "Dit zijn de twee beelden die Google het vaakst toont; ontbreken ze, dan kiest Google zelf iets uit, en dat is zelden je beste foto.",
    actie: "Zet het logo en een sterke omslagfoto erop in de juiste verhouding.",
  },

  // ── Activiteit ─────────────────────────────────────────────
  {
    key: "geen-posts", bril: "activiteit", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "Er zijn geen recente posts op het profiel",
    waarom: "Posts verschijnen in het profiel en soms in de zoekresultaten, en houden het profiel actief. Ze verlopen na verloop van tijd, dus stilte is zichtbaar.",
    actie: "Plan een vast ritme: iets nieuws, een aanbieding, een afgerond project of een veelgestelde vraag. Eén per week is genoeg.",
  },
  {
    key: "vragen-onbeantwoord", bril: "activiteit", bron: "beheer", zwaarte: "middel", hardheid: "gemeten",
    label: "Er staan onbeantwoorde vragen op het profiel",
    waarom: "Iedereen mag daar antwoorden, ook een concurrent of iemand die het verkeerd heeft. Onbeantwoord laten is het weggeven van je eigen etalage.",
    actie: "Beantwoord de openstaande vragen, en zet zelf de tien meestgestelde vragen erop met het goede antwoord.",
  },
  {
    key: "geen-berichten", bril: "activiteit", bron: "beheer", zwaarte: "laag", hardheid: "richtinggevend",
    label: "Berichten staan aan maar er wordt traag gereageerd",
    waarom: "Google toont de reactietijd op het profiel, en een trage reactietijd is zichtbaar voor iedereen.",
    actie: "Zet berichten uit als er niemand op let, of spreek af wie ze binnen een dag beantwoordt. Halfslachtig aan laten staan is het slechtste van twee.",
  },

  // ── Tegenover de concurrent ────────────────────────────────
  {
    key: "minder-reviews", bril: "concurrentie", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "De concurrent heeft aanzienlijk meer reviews",
    waarom: "In het lokale blok is het verschil in aantal en gemiddelde vaak de doorslaggevende factor bij gelijke afstand.",
    actie: "Reken uit hoeveel reviews per maand er nodig zijn om binnen een jaar aan te sluiten, en maak daar een afspraak van.",
  },
  {
    key: "lager-cijfer", bril: "concurrentie", bron: "maps", zwaarte: "hoog", hardheid: "gemeten",
    label: "Het gemiddelde ligt onder dat van de concurrenten",
    waarom: "Onder de 4,3 wordt zichtbaar geklikt op de volgende in de lijst, ook als je verder alles goed doet.",
    actie: "Kijk waar de klachten over gaan, los dat op, en zorg dat tevreden klanten weer gaan schrijven. Reviews wegpoetsen kan niet en hoeft niet.",
  },
  {
    key: "minder-fotos", bril: "concurrentie", bron: "maps", zwaarte: "middel", hardheid: "gemeten",
    label: "De concurrent heeft veel meer foto's",
    waarom: "Bij twee gelijkwaardige profielen wint het profiel waar iets te zien is.",
    actie: "Haal het verschil in met echte foto's, en spreek een vast ritme af zodat het niet weer wegzakt.",
  },
  {
    key: "smallere-categorie", bril: "concurrentie", bron: "maps", zwaarte: "middel", hardheid: "richtinggevend",
    label: "De concurrent staat in een preciezere categorie",
    waarom: "Een preciezere hoofdcategorie wint van een brede categorie op precies de zoekopdrachten die klanten opleveren.",
    actie: "Vergelijk de categorieën en kies de specifiekste die het bedrijf echt dekt.",
  },

  // ── Meerdere locaties ──────────────────────────────────────
  {
    key: "dubbel-profiel", bril: "compleet", bron: "maps", zwaarte: "hoog", hardheid: "richtinggevend",
    label: "Er lijkt een tweede profiel voor hetzelfde bedrijf te bestaan",
    waarom: "Twee profielen splitsen de reviews en de signalen, en Google kan de verkeerde tonen. Dit is de kaartversie van twee pagina's die om hetzelfde zoekwoord vechten.",
    actie: "Controleer of het echt een dubbel is en vraag dan samenvoeging aan bij Google. Reviews gaan bij samenvoegen meestal mee, bij verwijderen niet.",
  },
  {
    key: "locatie-zonder-pagina", bril: "compleet", bron: "eigen", zwaarte: "middel", hardheid: "gemeten",
    label: "Deze vestiging heeft geen eigen locatiepagina op de site",
    waarom: "Een profiel dat naar de homepage wijst mist het verband tussen die plaats en die vestiging; een eigen pagina maakt dat verband hard.",
    actie: "Maak een locatiepagina met adres, openingstijden, route en de diensten van die vestiging, en laat het profiel daarheen wijzen.",
  },
];

export const CHECK = new Map(CHECKS.map((c) => [c.key, c]));

// ═══════════════════════════════════════════════════════════
// DE DREMPELS
// ═══════════════════════════════════════════════════════════
// Eén plek, zodat het scherm en de motor dezelfde grens hanteren en niemand
// hoeft te raden waar "te weinig" begint. Bewust ruim: het gaat om signaleren,
// niet om een cijfer achter de komma.

export const DREMPEL = {
  /** Minder reviews dan dit telt als "vrijwel geen". */
  reviewsWeinig: 5,
  /** Minder nieuwe reviews per maand dan dit telt als te traag. */
  reviewsPerMaand: 1,
  /** Vanaf deze sterren of lager gaat het seintje af, en hoort er antwoord. */
  lageReviewSterren: 3,
  /** Onder dit gemiddelde begint zichtbaar klikverlies. */
  gemiddeldeOndergrens: 4.3,
  /** Minder foto's dan dit is te weinig. */
  fotosWeinig: 10,
  /** Zoveel keer meer reviews dan wij: dan is het een echt gat. */
  concurrentFactor: 1.5,
  /** Zoveel dagen zonder post telt als stil. */
  postStil: 45,
  /** Zoveel dagen zonder nieuwe foto telt als verouderd. */
  fotoOud: 180,
  /** Zoveel tekens is een fatsoenlijke bedrijfsomschrijving. */
  beschrijvingMin: 400,
} as const;

// ═══════════════════════════════════════════════════════════
// DE SUGGESTIES PER BEDRIJFSTYPE
// ═══════════════════════════════════════════════════════════
// Niet elke bevinding komt uit een meting. Dit zijn de dingen die je met een
// profiel kúnt doen en die per soort bedrijf verschillen: posts, producten,
// vragen, aanbiedingen. Het scherm toont ze als "hier valt nog meer te halen",
// los van de bevindingen, zodat er altijd een volgende stap is ook als het
// profiel technisch op orde is.

export type Suggestie = {
  key: string;
  titel: string;
  /** Wat je concreet doet. Twee tot drie zinnen, klaar om aan de klant te sturen. */
  wat: string;
  /** Waarom het werkt. */
  waarom: string;
  /** Hoe vaak: eenmalig, of een ritme. */
  ritme: string;
  /** Voor welke bedrijfstypes (leeg = alle). */
  types?: Bedrijfstype[];
};

export const SUGGESTIES: Suggestie[] = [
  {
    key: "post-ritme",
    titel: "Wekelijks een post",
    wat: "Kies één vast moment per week en plaats iets: een afgerond project, een nieuwe dienst, een aanbieding, of het antwoord op een vraag die je die week kreeg. Een foto, drie zinnen en een knop.",
    waarom: "Posts houden het profiel levend en verschijnen soms mee in de zoekresultaten. Ze verlopen na een tijd, dus een profiel dat stilvalt is zichtbaar stil.",
    ritme: "Wekelijks",
  },
  {
    key: "vragen-zelf-zetten",
    titel: "Zet je eigen tien vragen erop",
    wat: "Plaats de tien vragen die klanten het vaakst stellen zelf op het profiel en beantwoord ze meteen. Dat mag en is de bedoeling.",
    waarom: "Iedereen mag antwoorden op vragen bij jouw profiel, ook een concurrent. Zelf invullen betekent dat het juiste antwoord bovenaan staat.",
    ritme: "Eenmalig, daarna aanvullen",
  },
  {
    key: "review-routine",
    titel: "Een vaste routine om reviews te vragen",
    wat: "Spreek af op welk moment in het proces de klant de reviewlink krijgt (na afronding, bij de factuur, op de bon) en wie dat doet. Vraag niet om \"een review\" maar om \"wat we voor u gedaan hebben\".",
    waarom: "Reviews die er vanzelf komen zijn te weinig en te ongelijkmatig. Een routine levert een gestaag tempo op, en dat is wat Google beloont.",
    ritme: "Doorlopend",
  },
  {
    key: "antwoorden-op-alles",
    titel: "Antwoord op élke review, ook de goede",
    wat: "Een kort, persoonlijk antwoord op iedere review. Bij een klacht: erkennen, geen discussie, en het gesprek offline voortzetten. Het dashboard schrijft de concepten.",
    waarom: "Google noemt reageren zelf een factor, en voor een twijfelende bezoeker is een antwoord het bewijs dat er iemand oplet.",
    ritme: "Binnen twee dagen",
  },
  {
    key: "fotos-van-werk",
    titel: "Foto's van echt werk, niet van stock",
    wat: "Elke maand een paar foto's van wat er die maand gedaan is. Voor en na, het team aan het werk, de binnenkant van de zaak.",
    waarom: "Echte foto's leveren meer klikken en meer routeaanvragen op. Stockfoto's herkent iedereen, ook Google.",
    ritme: "Maandelijks",
  },
  {
    key: "producten-blok",
    titel: "Vul het productenblok",
    wat: "Zet de bestsellers of de hoofdcategorieën op het profiel, met foto, prijs en een link naar de productpagina.",
    waarom: "Het productenblok krijgt een eigen plek op het profiel en wordt aangeklikt, ook door mensen die je naam nog niet kenden.",
    ritme: "Eenmalig, seizoensgewijs bijwerken",
    types: ["webshop", "lokaal"],
  },
  {
    key: "diensten-blok",
    titel: "Vul het dienstenblok",
    wat: "Zet elke hoofddienst op het profiel met een korte omschrijving in gewone taal. Gebruik de dienstenlijst uit de bedrijfsgegevens als startpunt.",
    waarom: "Met een gevulde dienstenlijst doe je mee op zoekopdrachten naar die specifieke dienst, in plaats van alleen op je categorie.",
    ritme: "Eenmalig, bijwerken bij nieuwe diensten",
    types: ["dienstverlener", "kliniek", "lokaal"],
  },
  {
    key: "behandelingen-uitlichten",
    titel: "Licht de behandelingen apart uit",
    wat: "Zet iedere behandeling als eigen dienst op het profiel, en gebruik posts om er één per week uit te lichten met wat het inhoudt en wat het kost.",
    waarom: "Mensen zoeken op de behandeling, niet op de kliniek. Wie de behandeling benoemt wordt gevonden op de zoekopdracht die telt.",
    ritme: "Wekelijks een uitgelicht",
    types: ["kliniek"],
  },
  {
    key: "afspraaklink",
    titel: "Zet de afspraak- of offerteknop erop",
    wat: "Koppel de boekings- of offertepagina aan het profiel, zodat er een knop verschijnt naast bellen en route.",
    waarom: "Elke klik minder tussen zien en aanvragen levert aanvragen op. De knop staat er prominent bij.",
    ritme: "Eenmalig",
    types: ["kliniek", "dienstverlener", "lokaal"],
  },
  {
    key: "openingstijden-feestdagen",
    titel: "Zet de feestdagen een jaar vooruit klaar",
    wat: "Vul in één sessie alle afwijkende openingstijden van het komende jaar in.",
    waarom: "Google zet anders een waarschuwing op je profiel, en een bezoeker voor een dichte deur schrijft een slechte review.",
    ritme: "Jaarlijks",
  },
  {
    key: "locatiepaginas",
    titel: "Eén locatiepagina per vestiging",
    wat: "Geef iedere vestiging een eigen pagina met adres, openingstijden, route, het team en de diensten van díe locatie, en laat het profiel daarheen wijzen.",
    waarom: "Het verband tussen plaats en vestiging wordt hard als er een eigen pagina achter zit; naar de homepage wijzen gooit dat verband weg.",
    ritme: "Eenmalig per vestiging",
  },
  {
    key: "utm-meten",
    titel: "Meet wat het profiel oplevert",
    wat: "Zet een herkenbare markering achter de website-link van het profiel, zodat je in de statistieken ziet welk bezoek daar vandaan komt.",
    waarom: "Zonder markering verdwijnt bezoek uit het profiel in de grote hoop en kun je nooit laten zien wat het optimaliseren heeft opgeleverd.",
    ritme: "Eenmalig per vestiging",
  },
];

/** De suggesties die bij dit bedrijfstype horen. Zonder type: alleen de algemene. */
export function suggestiesVoor(type: Bedrijfstype | ""): Suggestie[] {
  return SUGGESTIES.filter((s) => !s.types || (type && s.types.includes(type as Bedrijfstype)));
}

/** Geldt deze check voor dit bedrijfstype? */
export function checkGeldt(c: CheckDef, type: Bedrijfstype | ""): boolean {
  return !c.alleenType || (!!type && c.alleenType.includes(type as Bedrijfstype));
}

// ═══════════════════════════════════════════════════════════
// DE SCORE
// ═══════════════════════════════════════════════════════════
// Bewust geen cijfer van 1 tot 100: dat suggereert precisie die er niet is en
// nodigt uit tot sturen op het getal. Wel een stand in vier woorden, afgeleid
// van wat er zwaar misgaat. Zelfde gedachte als bij de prioriteitenscan: de
// volgorde van het werk telt, niet het rapportcijfer.

export type Stand = "goed" | "redelijk" | "zwak" | "ontbreekt";

export const STAND_LABEL: Record<Stand, string> = {
  goed: "Staat er goed voor",
  redelijk: "Redelijk, met losse eindjes",
  zwak: "Hier valt veel te winnen",
  ontbreekt: "Geen profiel gevonden",
};

// ═══════════════════════════════════════════════════════════
// DE UITNODIGING OM BEHEERDER TE WORDEN
// ═══════════════════════════════════════════════════════════
// Vaste tekst, geen AI: dit is elke keer hetzelfde verzoek en het moet elke
// keer exact hetzelfde stappenplan bevatten. Een gegenereerde tekst zou hier
// alleen maar variatie toevoegen aan iets dat juist voorspelbaar moet zijn.
// Staat hier omdat het bij de kennis hoort en niet bij het scherm.

export function beheerUitnodiging(bedrijf: string, pingwinEmail: string): { onderwerp: string; tekst: string } {
  return {
    onderwerp: `Toegang tot het Google-bedrijfsprofiel van ${bedrijf}`,
    tekst: [
      `Beste,`,
      ``,
      `Om ${bedrijf} beter vindbaar te maken op Google Maps en in het lokale blok bovenaan de zoekresultaten, willen we het Google-bedrijfsprofiel meenemen in het werk. Daar is toegang voor nodig.`,
      ``,
      `Wat het oplevert: we zien dan hoe vaak het profiel gezien wordt, hoe vaak er gebeld wordt en hoeveel mensen de route opvragen. Dat is precies waarmee we kunnen laten zien wat het werk oplevert. En we kunnen het profiel bijhouden zonder dat u er zelf achteraan hoeft.`,
      ``,
      `Zo voegt u ons toe (het duurt een minuut):`,
      ``,
      `1. Ga naar google.com/business en log in met het account dat het profiel beheert.`,
      `2. Kies het bedrijf, klik links op "Instellingen" en dan op "Gebruikers" of "Mensen en toegang".`,
      `3. Klik op "Toevoegen" en vul dit e-mailadres in: ${pingwinEmail}`,
      `4. Kies de rol "Beheerder" en verstuur de uitnodiging.`,
      ``,
      `We passen niets aan zonder overleg. Alles wat we voorstellen krijgt u eerst te zien.`,
      ``,
      `Met vriendelijke groet,`,
      `Pingwin Online Marketing`,
    ].join("\n"),
  };
}

export function standUit(bevindingen: { zwaarte: Zwaarte; key: string }[]): Stand {
  if (bevindingen.some((b) => b.key === "geen-profiel")) return "ontbreekt";
  const hoog = bevindingen.filter((b) => b.zwaarte === "hoog").length;
  const middel = bevindingen.filter((b) => b.zwaarte === "middel").length;
  if (hoog >= 3) return "zwak";
  if (hoog >= 1 || middel >= 4) return "redelijk";
  return "goed";
}
