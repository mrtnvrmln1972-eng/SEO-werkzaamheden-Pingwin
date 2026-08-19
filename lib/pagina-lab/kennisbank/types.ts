// ═══════════════════════════════════════════════════════════
// DE KENNISBANK VAN HET PAGINA-LAB: DE VORM
// ═══════════════════════════════════════════════════════════
// Het Pagina-lab beoordeelt een pagina op meer dan SEO: conversie (levert hij
// klanten op), bruikbaarheid (kun je hem gebruiken), vormgeving (hoe ziet hij
// eruit) en interactie (hoe gedraagt hij zich). Voor SEO ligt er al een
// criterialijst (`lib/seo-criteria.ts`); voor deze vier lag er niets, en zonder
// die lijst is elk oordeel een mening van het moment.
//
// TWEE PLANKEN, EN DAT IS DE KERN VAN DIT BESTAND
// ═══════════════════════════════════════════════
// Plank 1, `Criterium`: onderbouwd. Er hoort minstens één bron bij met een
// naam en een adres, plus de datum waarop we die bron voor het laatst hebben
// nagekeken. Dit mag in een klantrapport en mag als reden onder een advies.
//
// Plank 2, `Vakoordeel`: wat wij vinden zonder dat er onderzoek onder ligt.
// Dat mag, want een deel van het vak is ervaring, maar het staat apart en het
// draagt nooit de schijn van onderzoek. Daarom heeft dit type geen `bronnen`
// en geen `bewijs`: er is niets om naar te wijzen, en dan hoort het veld er
// ook niet te zijn. Blijkt een vakoordeel zich keer op keer te bewijzen, dan
// promoveert het naar plank 1 zodra we er een bron bij vinden.
//
// `proeven/pagina-lab-kennisbank.proef.ts` rekent die scheiding na en laat de
// bouw mislukken als een vakoordeel zich als onderzoek voordoet. Dat is in dit
// project de vaste les: een regel die alleen in een document leeft, wordt
// gebroken zodra iemand haast heeft.
// ═══════════════════════════════════════════════════════════

/** De vier vakgebieden naast de SEO die er al is. */
export type Discipline = "conversie" | "bruikbaarheid" | "vormgeving" | "interactie";

export const DISCIPLINES: Discipline[] = ["conversie", "bruikbaarheid", "vormgeving", "interactie"];

/** Wat een discipline in gewone taal beantwoordt. Voor op het scherm. */
export const DISCIPLINE_UITLEG: Record<Discipline, string> = {
  conversie: "Levert deze pagina klanten op, of kijkt iemand alleen?",
  bruikbaarheid: "Kan iedereen deze pagina gebruiken en begrijpen, ook met een beperking?",
  vormgeving: "Hoe ziet de pagina eruit, en helpt dat beeld de boodschap?",
  interactie: "Hoe gedraagt de pagina zich: snelheid, klikken, bewegen, onderbreken.",
};

/**
 * Hoe hard het bewijs onder een criterium is. Dezelfde drie niveaus als in
 * `pingwin-brein/brein/wat-werkt/README.md`, met opzet: twee schalen naast
 * elkaar lopen altijd uit elkaar.
 */
export type Bewijs = "sterk" | "gemiddeld" | "zwak";

/** Hoe actueel de kennis nog is. Ook dit komt uit de wat-werkt-database. */
export type Stand = "actueel" | "evolueert" | "verouderd";

/**
 * Hoeveel het weegt in een oordeel over een pagina. Bewust drie standen en niet
 * een cijfer van 1 tot 10: een cijfer suggereert een precisie die er niet is.
 */
export type Weegt = "hoog" | "midden" | "laag";

/**
 * Hoe het Pagina-lab dit criterium kan vaststellen. Dit veld is er voor de
 * volgende stap, waarin het lab zelf gaat oordelen:
 *
 *  - `meting`  uit de HTML of uit een cijfer (koppen, velden, contrast, CWV).
 *  - `beeld`   alleen te zien op de schermfoto (rust, hiërarchie, wat er boven
 *              de vouw staat). Precies hierom maakt de brug een foto.
 *  - `oordeel` vraagt een mens of een model dat de context begrijpt.
 */
export type Vaststellen = "meting" | "beeld" | "oordeel";

/** Wat voor soort bron het is. Een norm weegt zwaarder dan een blog. */
export type BronSoort = "norm" | "onderzoek" | "vakinstituut" | "platform";

export type Bron = {
  naam: string;
  /** Het adres van de bron zelf, niet van een artikel dat ernaar verwijst. */
  url: string;
  soort: BronSoort;
};

/** Plank 1: onderbouwd, met bron en datum. Mag in een klantrapport. */
export type Criterium = {
  /** Bijvoorbeeld CONV-01. Vast, zodat een bevinding ernaar kan verwijzen. */
  id: string;
  discipline: Discipline;
  /** Eén regel: wat er goed moet zijn. */
  titel: string;
  /** Waar we concreet naar kijken op de pagina. Zo concreet mogelijk. */
  waarNaarKijken: string;
  /** Wat het oplevert of kost. De reden die je aan een klant uitlegt. */
  waarom: string;
  bewijs: Bewijs;
  bronnen: Bron[];
  /** ISO-datum waarop we de bron voor het laatst hebben nagekeken. */
  gecheckt: string;
  stand: Stand;
  weegt: Weegt;
  vaststellen: Vaststellen;
  /** Wanneer het niet opgaat. Zonder nuance wordt een criterium een stok. */
  nuance?: string;
};

/**
 * Plank 2: ons eigen vakoordeel. Geen bron, geen bewijsniveau, en dat is geen
 * omissie maar de bedoeling.
 */
export type Vakoordeel = {
  /** Bijvoorbeeld VAK-01. */
  id: string;
  discipline: Discipline;
  titel: string;
  waarNaarKijken: string;
  /** Waarom wíj dit vinden. Nooit geschreven alsof er onderzoek onder ligt. */
  waarom: string;
  /** Waar dit vandaan komt: welke praktijk, welke pagina, welk moment. */
  grond: string;
  /** ISO-datum waarop we dit hebben opgeschreven. */
  sinds: string;
  weegt: Weegt;
  vaststellen: Vaststellen;
};

/** De waarschuwing die overal meegaat waar een vakoordeel in beeld komt. */
export const VAKOORDEEL_WAARSCHUWING =
  "Vakoordeel van Pingwin: onze ervaring, geen onderzoek. Bruikbaar als advies, nooit als " +
  "onderbouwing in een klantrapport.";
