// ═══════════════════════════════════════════════════════════
// DE ONBOARDING-STAPPEN: DE ENIGE BRON VOOR DE VOLGORDE
// ═══════════════════════════════════════════════════════════
// Alleen de lijst en de typen; geen database, geen server-code. Net als
// lib/org-vereist.ts draait dit bestand dus óók in de browser, zodat het scherm
// exact dezelfde volgorde en dezelfde teksten toont als de server gebruikt.
// De status-berekening en de poort staan in lib/onboarding.ts.
// ═══════════════════════════════════════════════════════════

export type Blok = "aansluiten" | "kennen" | "meten" | "werken";
export type Door = "jij" | "dashboard";

export type StapKey =
  | "domein" | "searchconsole" | "ahrefs" | "urls" | "beheeromgeving" | "adsaccount"
  | "profiel" | "tov" | "bedrijfsgegevens" | "werkgebied" | "klantwaarde" | "concurrenten"
  | "googleprofiel" | "gmbbeheer" | "positionering" | "huisstijl" | "documenten"
  | "zoekwoorden" | "prioriteiten" | "opruimen" | "internelinks" | "gmbscan"
  | "strategie";

export type StapDef = {
  key: StapKey;
  label: string;
  blok: Blok;
  /** Eén zin, gewone taal: waarom deze stap er is. Staat zo in het scherm. */
  waarom: string;
  /** Wie de stap doet: het dashboard zelf, of Maarten (inloggen, invullen, kiezen). */
  door: Door;
  /** Wat er eerst moet staan. Dit is de poort. */
  nodig: StapKey[];
  /** Na hoeveel dagen dit gegeven als achterhaald geldt (leeg = veroudert niet). */
  verouderdNa?: number;
  /** Niet nodig om te kunnen werken; telt niet mee in de teller. */
  optioneel?: boolean;
  /** Waar in de cockpit deze stap thuishoort (tab-waarde uit de URL). */
  tab?: string;
  /** Kan de startknop deze stap zelf uitvoeren? */
  automatisch?: boolean;
};

export const ONBOARDING: StapDef[] = [
  // ── Aansluiten: zonder deze koppelingen heeft geen enkele analyse data ──
  {
    key: "domein", label: "Website-adres", blok: "aansluiten", door: "jij", nodig: [], tab: "paginas",
    waarom: "Zonder website-adres weet het dashboard niet welke site het moet meten.",
  },
  {
    key: "searchconsole", label: "Search Console gekoppeld", blok: "aansluiten", door: "jij", nodig: ["domein"], tab: "resultaten",
    waarom: "Search Console levert de echte zoekwoorden, posities en vertoningen; bijna elke analyse leunt erop.",
  },
  {
    key: "ahrefs", label: "Ahrefs-project", blok: "aansluiten", door: "jij", nodig: ["domein"], tab: "klant",
    waarom: "Ahrefs levert zoekvolume, moeilijkheid en de concurrentie in de zoekresultaten.",
  },
  {
    key: "urls", label: "Pagina's ingelezen", blok: "aansluiten", door: "dashboard", nodig: ["domein"], tab: "paginas",
    automatisch: true, verouderdNa: 60,
    waarom: "De lijst met alle pagina's van de site is de basis onder opruimen, interne links en de prioriteitenscan.",
  },
  {
    key: "beheeromgeving", label: "Beheeromgeving van de site", blok: "aansluiten", door: "jij", nodig: ["domein"], tab: "klant",
    optioneel: true,
    waarom: "Met een koppeling naar WordPress kunnen teksten en meta-gegevens direct doorgezet worden.",
  },
  {
    key: "adsaccount", label: "Ads-account", blok: "aansluiten", door: "jij", nodig: [], tab: "klant",
    optioneel: true,
    waarom: "Een link naar het Google Ads-account, zodat je er in één klik bent. Er is geen API-koppeling; dit is alleen een bewaarde link, geen meting.",
  },

  // ── Wie is de klant: dit moet vastliggen vóór er iets geschreven of gescand wordt ──
  {
    key: "profiel", label: "Klantprofiel", blok: "kennen", door: "dashboard", nodig: ["domein"], tab: "paginas",
    automatisch: true, verouderdNa: 365,
    waarom: "Wie de klant is, voor wie hij werkt en wat hem onderscheidt; zonder dit schrijft elke tekst over een willekeurig bedrijf.",
  },
  {
    key: "tov", label: "Tone of voice", blok: "kennen", door: "dashboard", nodig: ["domein"], tab: "paginas",
    automatisch: true, verouderdNa: 365,
    waarom: "Hoe de klant schrijft en praat, zodat nieuwe tekst klinkt als hij en niet als een tekstfabriek.",
  },
  {
    key: "bedrijfsgegevens", label: "Bedrijfsgegevens (structured data)", blok: "kennen", door: "jij", nodig: ["domein"], tab: "klant",
    automatisch: true, verouderdNa: 365,
    waarom: "Naam, adres, openingstijden, KvK en profielen: het identiteitsblok waar alle structured data op de site uit opgebouwd wordt.",
  },
  {
    key: "werkgebied", label: "Werkgebied", blok: "kennen", door: "jij", nodig: ["bedrijfsgegevens"], tab: "klant",
    waarom: "Waar de klant klanten vandaan haalt bepaalt welke plaatsnamen en welke zoekwoorden er wel en niet toe doen.",
  },
  {
    key: "concurrenten", label: "Concurrenten bepaald", blok: "kennen", door: "dashboard", nodig: ["domein"], tab: "paginas",
    automatisch: true, verouderdNa: 180,
    waarom: "Tegen wie we het opnemen in de zoekresultaten; zonder die lijst is er geen vergelijking en geen gat om te vullen.",
  },
  {
    key: "klantwaarde", label: "Klantwaarde en conversie", blok: "kennen", door: "jij", nodig: [], tab: "cannibalisatie",
    waarom: "Wat één klant opbrengt en welk deel van de bezoekers klant wordt; zonder die twee getallen kan geen enkele lijst in euro's.",
  },
  {
    key: "googleprofiel", label: "Google-bedrijfsprofiel gevonden", blok: "kennen", door: "dashboard", nodig: ["bedrijfsgegevens"], tab: "google-profiel",
    automatisch: true, verouderdNa: 180,
    waarom: "Welk profiel op de kaart bij deze klant hoort, per vestiging; zonder die koppeling kunnen we niets meten en niets vergelijken.",
  },
  {
    key: "gmbbeheer", label: "Beheerder van het Google-profiel", blok: "kennen", door: "jij", nodig: ["googleprofiel"], tab: "google-profiel",
    waarom: "Als beheerder zien we de bezoekcijfers (hoe vaak gezien, gebeld, route gevraagd) en kunnen we het profiel bijwerken; zonder beheer meten we alleen de buitenkant.",
  },
  {
    key: "positionering", label: "Positioneringsadvies", blok: "kennen", door: "jij", nodig: [], tab: "klant",
    optioneel: true,
    waarom: "De scherpe positionering en concurrentievergelijking, als afgerond adviesdocument (Drive-link).",
  },
  {
    key: "huisstijl", label: "Huisstijl vastgelegd", blok: "kennen", door: "jij", nodig: [], tab: "klant",
    optioneel: true,
    waarom: "De visuele stijl van de klant (kleuren, typografie, knoppen), zodat nieuwe pagina's er precies zo uitzien als de rest van de site.",
  },
  {
    key: "documenten", label: "Documenten in de kennisdatabase", blok: "kennen", door: "dashboard", nodig: [], tab: "documenten",
    optioneel: true,
    waarom: "De analyses, blauwdrukken en copy die er al voor deze klant liggen.",
  },

  // ── Waar staat de site: de site-brede metingen ──
  {
    key: "zoekwoorden", label: "Zoekwoordkansen verzameld", blok: "meten", door: "dashboard", nodig: ["domein", "concurrenten"], tab: "paginas",
    automatisch: true, verouderdNa: 120,
    waarom: "De zoekwoorden waar de klant nog niets mee doet en de concurrent wel.",
  },
  {
    key: "prioriteiten", label: "Prioriteitenscan gedraaid", blok: "meten", door: "dashboard", nodig: ["urls", "searchconsole", "profiel", "concurrenten"], tab: "prioriteiten",
    automatisch: true, verouderdNa: 90,
    waarom: "Waar de snelste winst zit op deze site, van deze week tot strategisch.",
  },
  {
    key: "opruimen", label: "Opruimen gedraaid", blok: "meten", door: "dashboard", nodig: ["urls", "searchconsole"], tab: "cannibalisatie",
    automatisch: true, verouderdNa: 180,
    waarom: "Welke pagina's elkaar in de weg zitten, wat weg kan en wat juist opgepakt moet worden.",
  },
  {
    key: "internelinks", label: "Interne links gedraaid", blok: "meten", door: "dashboard", nodig: ["urls", "searchconsole"], tab: "interne-links",
    automatisch: true, verouderdNa: 180,
    waarom: "Vanaf welke pagina's je het beste naar een doelpagina linkt om hem omhoog te duwen.",
  },
  {
    key: "gmbscan", label: "Google-profiel doorgemeten", blok: "meten", door: "dashboard", nodig: ["googleprofiel", "concurrenten"], tab: "google-profiel",
    automatisch: true, verouderdNa: 60,
    waarom: "Hoe het profiel ervoor staat tegenover de concurrenten in de buurt: reviews, foto's, compleetheid en wat er te winnen valt.",
  },

  // ── En dan pas: aan het werk ──
  {
    key: "strategie", label: "Strategie vastgelegd", blok: "werken", door: "jij", nodig: ["profiel", "prioriteiten"], tab: "werkzaamheden",
    waarom: "Het gesprek waarin de koers wordt gekozen; daarna pas gaan er pagina's de keten in.",
  },
];

export const BLOK_LABEL: Record<Blok, string> = {
  aansluiten: "Aansluiten",
  kennen: "Weten wie de klant is",
  meten: "Weten waar de site staat",
  werken: "Aan het werk",
};

export const BLOK_UITLEG: Record<Blok, string> = {
  aansluiten: "De koppelingen waar alle data vandaan komt.",
  kennen: "Wat vastligt vóór er iets geschreven of gescand wordt.",
  meten: "De site-brede metingen die bepalen waar we beginnen.",
  werken: "De koers, en daarna de pagina's.",
};

export const STAP = new Map(ONBOARDING.map((s) => [s.key, s]));
export const stapLabel = (k: StapKey): string => STAP.get(k)?.label || k;

export type Staat = "af" | "bezig" | "open" | "verouderd";

export type StapStand = StapDef & {
  staat: Staat;
  /** Wat er staat, of wat er precies mist. Altijd een hele zin. */
  detail: string;
  sinds: string | null;
  /** Voorwaarden die nog niet af zijn (leeg = hij kan). */
  wacht: { key: StapKey; label: string }[];
};

export type Stand = {
  slug: string;
  naam: string;
  stappen: StapStand[];
  /** Alleen de verplichte stappen tellen mee. */
  af: number;
  totaal: number;
  /** Labels van wat er nog open staat of verouderd is; voor het signaal in de lijst. */
  mist: string[];
  /** Wat er op Maarten wacht (die kan de startknop niet voor je doen). */
  aanJou: StapKey[];
  klaar: boolean;
};
