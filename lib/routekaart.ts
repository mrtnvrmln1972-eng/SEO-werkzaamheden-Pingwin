// ═══════════════════════════════════════════════════════════
// DE ROUTEKAART: DE ONTWIKKELING VAN DIT DASHBOARD, IN PUNTEN
// ═══════════════════════════════════════════════════════════
// Dit bestand houdt de STAND bij van elk ontwikkelpunt. De volledige beschrijving
// staat in lib/uitleg/15-agenda/ (hoofdstuk "Eerlijke agenda en routekaart"), bij de
// uitklapper met dezelfde code. Eén bron per soort informatie: de tekst daar, de
// stand hier.
//
// Waarom dit bestaat: Maarten stuurt de ontwikkeling aan vanuit losse chats, één
// punt per chat. Zonder een gedeelde stand weet chat B niet dat chat A al aan R2
// bezig is, en dan botsen ze. Dit bestand is dat gedeelde geheugen, en het scherm
// /routekaart is het bedieningspaneel eromheen.
//
// Bijwerken hoort bij het werk, niet erna:
//  - begin je aan een punt, zet `stand` op "loopt" en push dat meteen;
//  - is het af, zet `stand` op "af" met de datum in `afGekomen`.
// De slash-opdracht /ontwikkelpunt dwingt die twee stappen af.
// ═══════════════════════════════════════════════════════════

export type Stand = "open" | "loopt" | "af";
export type Omvang = "klein" | "middel" | "groot";

export type Punt = {
  /** R1 tot R15; dezelfde code als de uitklapper in lib/uitleg/15-agenda/. */
  code: string;
  titel: string;
  /** 1 = motoren volwaardig maken, 2 = remmen weg bij groei, 3 = van werkplek naar product. */
  golf: 1 | 2 | 3;
  stand: Stand;
  /** Datum waarop het punt afkwam (alleen bij stand "af"). */
  afGekomen?: string;
  /** Codes die éérst af moeten zijn. Leeg = kan vandaag beginnen. */
  nodig: string[];
  omvang: Omvang;
  /** Eén regel: wat het oplevert. Niet wat het is. */
  oplevert: string;
  /** Eén regel: waaraan je ziet dat het af is. */
  af: string;
  /** Welke schermen of motoren meebewegen; waarschuwt bij twee chats tegelijk. */
  raakt: string[];
};

export const GOLVEN: { nummer: 1 | 2 | 3; titel: string; regel: string }[] = [
  {
    nummer: 1,
    titel: "De motoren volwaardig maken",
    regel: "Het fundament ligt er al; er zit per motor één stuk data tussen. Goedkoopste winst.",
  },
  {
    nummer: 2,
    titel: "De remmen weghalen die groei tegenhouden",
    regel: "Werkt nu omdat het bureau uit één persoon bestaat. Wordt urgent bij de tweede.",
  },
  {
    nummer: 3,
    titel: "Van eigen werkplek naar product",
    regel: "Wat er nodig is voordat een ander bureau dit kan gebruiken of kopen.",
  },
];

export const PUNTEN: Punt[] = [
  // ── Golf 1 ──
  {
    code: "R1",
    titel: "Autoriteit per pagina aansluiten",
    golf: 1,
    stand: "af",
    afGekomen: "6 augustus 2026",
    nodig: [],
    omvang: "klein",
    oplevert: "Het interne-linkadvies wordt hard in plaats van aannemelijk.",
    af: "Bij een doelpagina staan de bronpagina's in een andere volgorde, elk met hun waarde en datum.",
    raakt: ["Interne links", "Prioriteitenscan", "Verbruik"],
  },
  {
    code: "R2",
    titel: "Prioriteren op conversies in plaats van klikken",
    golf: 1,
    stand: "af",
    afGekomen: "7 augustus 2026",
    nodig: [],
    omvang: "middel",
    oplevert: "De rangorde gaat over aanvragen in plaats van over bezoek, waar GA4 dat per pagina meet.",
    af: "Meet een klant conversies per pagina, dan staat de prioriteitenlijst in een andere volgorde, met per punt de verwachte aanvragen. Zonder die data verandert er niets.",
    raakt: ["Prioriteitenscan"],
  },
  {
    code: "R3",
    titel: "AI-vindbaarheid op onderwerpniveau",
    golf: 1,
    stand: "open",
    nodig: [],
    omvang: "middel",
    oplevert: "Van een thermometer naar een advies: op welke vragen ontbreek je, en wie staat er dan wel.",
    af: "Per klant een vragenlijst met genoemd of niet, wie er wel staat, en de beweging over tijd.",
    raakt: ["Prioriteitenscan", "Zoekwoorden", "Verbruik"],
  },
  {
    code: "R4",
    titel: "Verbruik compleet: de Ahrefs-credits erbij",
    golf: 1,
    stand: "af",
    afGekomen: "8 augustus 2026",
    nodig: [],
    omvang: "klein",
    oplevert: "De echte kosten per klant, en dus de marge. Het cijfer waar een licentieprijs op rust.",
    af: "Per klant per maand één bedrag dat AI en Ahrefs samen dekt, met de duurste actie erbij.",
    raakt: ["Verbruik", "Financiën", "Ahrefs-laag"],
  },

  // ── Golf 2 ──
  {
    code: "R5",
    titel: "Meerdere mailboxen",
    golf: 2,
    stand: "open",
    nodig: [],
    omvang: "middel",
    oplevert: "Samenwerken kan pas echt: de mail van een collega is niet langer onzichtbaar.",
    af: "Twee mailboxen gekoppeld, één tijdlijn per klant met per bericht de afzender.",
    raakt: ["Mail", "Tijdlijn", "Assistent", "Rechten"],
  },
  {
    code: "R6",
    titel: "Tweede sitekoppeling, en copy doorvoeren",
    golf: 2,
    stand: "loopt",
    nodig: [],
    omvang: "groot",
    oplevert: "De keten breekt niet meer bij de site. Hier zit het meeste overgebleven handwerk.",
    af: "Een goedgekeurd copydocument staat als concept in de site, met voorbeeldlink, zonder kopiëren.",
    raakt: ["Documentenketen", "Werklijst", "Fases", "Wat we doen"],
  },
  {
    code: "R7",
    titel: "Bronnen-gezondheid: welke bron is vandaag stil?",
    golf: 2,
    stand: "af",
    afGekomen: "8 augustus 2026",
    nodig: [],
    omvang: "middel",
    oplevert: "Voorkomt de ergste fout: een conclusie trekken op data die stil verouderd is.",
    af: "Eén koppeling losgetrokken is binnen een minuut te zien, met een knop om het te herstellen.",
    raakt: ["Alle koppelingen", "Kaarten en scores"],
  },
  {
    code: "R8",
    titel: "Correcties worden regels, in élke motor",
    golf: 2,
    stand: "open",
    nodig: [],
    omvang: "middel",
    oplevert: "Het systeem wordt beter doordat je het gebruikt, niet alleen bij opruimen.",
    af: "Een gecorrigeerd meta-voorstel komt de volgende ronde goed terug, met de regel in de lijst.",
    raakt: ["Meta", "Interne links", "Prioriteitenscan", "Opruim-regels"],
  },

  // ── Golf 3 ──
  {
    code: "R9",
    titel: "Het klantdashboard op echte data",
    golf: 3,
    stand: "loopt",
    nodig: [],
    omvang: "middel",
    oplevert: "De rijkste data komt eindelijk bij degene die betaalt. Grootste verkoopwaarde.",
    af: "Een klant ziet zonder jouw tussenkomst de ontwikkeling van deze maand in gewone taal.",
    raakt: ["Klantdashboard", "Voorbeeldweergave", "Wijzigingen"],
  },
  {
    code: "R10",
    titel: "Signaleren in plaats van kijken",
    golf: 3,
    stand: "open",
    nodig: ["R7"],
    omvang: "middel",
    oplevert: "Wat stuk is komt naar jou toe. Bij twintig klanten kun je niet meer rondkijken.",
    af: "Een pagina die echt wegzakt levert één bericht met een knop op; normale schommeling niet.",
    raakt: ["Achtergrondtaken", "Wijzigingen", "Trends", "Prioriteitenscan"],
  },
  {
    code: "R11",
    titel: "Licentie-klaar: sleutels, opzet en quota",
    golf: 3,
    stand: "open",
    nodig: ["R4", "R7"],
    omvang: "groot",
    oplevert: "Het verschil tussen 'ik zet een omgeving voor je op' en 'je neemt hem zelf in gebruik'.",
    af: "Een nieuwe omgeving is vanaf leeg in gebruik te nemen zonder één omgevingsvariabele.",
    raakt: ["Alle koppelingen", "Beheer", "Beveiliging"],
  },
  {
    code: "R12",
    titel: "Een vangnet onder de rekenmotoren",
    golf: 3,
    stand: "open",
    nodig: [],
    omvang: "klein",
    oplevert: "Snelheid: je kunt aan de scoring sleutelen zonder met de hand na te rekenen.",
    af: "Eén commando draait alle proeven, is groen, en wordt rood bij een gewijzigd gewicht.",
    raakt: ["Rekenlagen (niets in de werking)"],
  },
  {
    code: "R13",
    titel: "Wie deed wat: een spoor van wijzigingen",
    golf: 3,
    stand: "open",
    nodig: [],
    omvang: "middel",
    oplevert: "Samenwerken zonder elkaar in de weg zitten, en rechten durven uitdelen.",
    af: "Bij een goedgekeurd meta-voorstel staat wie het goedkeurde en wanneer.",
    raakt: ["Schrijvende handelingen", "Rechten", "Kaarten"],
  },

  // ── Het verhaal naar buiten (hoort in dezelfde straat) ──
  {
    code: "R14",
    titel: "Schermafbeeldingen per hoofdstuk, door het dashboard zelf gemaakt",
    golf: 3,
    stand: "loopt",
    nodig: [],
    omvang: "middel",
    oplevert: "De uitleg wordt zichtbaar in plaats van beschreven, en de beelden verouderen niet stil.",
    af: "Eén opdracht vernieuwt alle beelden, met klantnamen vervangen door een neutrale naam.",
    raakt: ["Uitleg", "Verkooppitch", "Interne browser"],
  },
  {
    code: "R15",
    titel: "De verkooppitch als eigen pagina",
    golf: 3,
    stand: "open",
    nodig: ["R14"],
    omvang: "klein",
    oplevert: "Een pagina die in twee minuten overtuigt, naast de uitleg die alles uitlegt.",
    af: "Een lead ziet in twee minuten wat het is, met beelden, en één duidelijke vervolgstap.",
    raakt: ["Uitleg", "Nieuwe pagina"],
  },
];

/** Kan dit punt vandaag beginnen? */
export function kanStarten(p: Punt): boolean {
  if (p.stand !== "open") return false;
  return p.nodig.every((c) => PUNTEN.find((x) => x.code === c)?.stand === "af");
}

/** Welke punten houden dit punt tegen (alleen de nog niet afgeronde). */
export function wachtOp(p: Punt): Punt[] {
  return p.nodig
    .map((c) => PUNTEN.find((x) => x.code === c))
    .filter((x): x is Punt => Boolean(x) && x!.stand !== "af");
}

/** De punten die op dit moment in een andere chat gebouwd worden. */
export function lopendeP(): Punt[] {
  return PUNTEN.filter((p) => p.stand === "loopt");
}

/**
 * Botst dit punt met iets dat nu al gebouwd wordt? Zo ja, welke.
 * Twee chats in hetzelfde scherm leveren merge-conflicten en half werk op; dat
 * is precies wat de waarschuwing per punt bedoelt.
 */
export function botstMetLopend(p: Punt): Punt[] {
  return lopendeP().filter((x) => x.code !== p.code && x.raakt.some((r) => p.raakt.includes(r)));
}

/**
 * Het punt dat we aanraden om nu te doen: laagste golf, dan kleinste omvang.
 * Bewust één advies en geen top drie; een lijst is geen advies.
 *
 * Punten die hetzelfde scherm raken als iets dat nú loopt vallen af. Zonder die
 * regel adviseerde dit scherm vrolijk een punt waar het er zelf twee regels lager
 * voor waarschuwde: op 6 augustus stond R1 te lopen (raakt Verbruik) en werd R4
 * aangeraden (raakt óók Verbruik). Een advies dat je eigen waarschuwing negeert
 * is erger dan geen advies.
 */
export function nuDoen(): Punt | null {
  const rang: Record<Omvang, number> = { klein: 0, middel: 1, groot: 2 };
  const op = (lijst: Punt[]) =>
    [...lijst].sort((a, b) => a.golf - b.golf || rang[a.omvang] - rang[b.omvang])[0] ?? null;
  const kan = PUNTEN.filter(kanStarten);
  if (!kan.length) return null;
  const vrij = kan.filter((p) => botstMetLopend(p).length === 0);
  return op(vrij);
}

/**
 * Waarom er geen advies is. Voor het scherm, zodat "geen advies" geen raadsel is.
 *  - "leeg":  er staat niets open dat kan beginnen (alles af, of alles wacht).
 *  - "botst": er kán wel wat, maar alles raakt een scherm waar nu al aan gewerkt
 *             wordt. Dan is wachten het juiste antwoord, geen tweede chat.
 */
export function geenAdviesReden(): "leeg" | "botst" | null {
  if (nuDoen()) return null;
  return PUNTEN.filter(kanStarten).length ? "botst" : "leeg";
}

/**
 * Welke punten kun je NU tegelijk in aparte chats starten?
 *
 * Niet "alles wat kan beginnen": twee punten die elkaars scherm raken leveren
 * samen merge-conflicten op, dus die mogen niet in dezelfde set zitten. Daarom
 * wordt de set opgebouwd in plaats van gefilterd: neem het beste punt, en voeg
 * alleen punten toe die noch met een lopend punt, noch met een al gekozen punt
 * botsen.
 *
 * Zo is de uitkomst een set die gegarandeerd naast elkaar kan, in plaats van een
 * lijst waar Maarten zelf de botsingen uit moet halen.
 */
export function parallelNu(): Punt[] {
  const rang: Record<Omvang, number> = { klein: 0, middel: 1, groot: 2 };
  const kandidaten = PUNTEN.filter(kanStarten)
    .filter((p) => botstMetLopend(p).length === 0)
    .sort((a, b) => a.golf - b.golf || rang[a.omvang] - rang[b.omvang]);

  const gekozen: Punt[] = [];
  for (const p of kandidaten) {
    if (gekozen.some((g) => g.raakt.some((r) => p.raakt.includes(r)))) continue;
    gekozen.push(p);
  }
  return gekozen;
}

/** Punten die hetzelfde scherm raken; waarschuwing bij twee chats tegelijk. */
export function raaktZelfde(p: Punt): Punt[] {
  return PUNTEN.filter(
    (x) => x.code !== p.code && x.stand !== "af" && x.raakt.some((r) => p.raakt.includes(r)),
  );
}

/** De regel die Maarten in een verse chat plakt. */
export function startprompt(p: Punt): string {
  return `/ontwikkelpunt ${p.code}`;
}

/** Terugval als de slash-opdracht niet beschikbaar is (gewone taal). */
export function startpromptTekst(p: Punt): string {
  return `Pak ontwikkelpunt ${p.code} van de routekaart op: ${p.titel.toLowerCase()}.`;
}

export function voortgang(): { af: number; loopt: number; open: number; totaal: number } {
  return {
    af: PUNTEN.filter((p) => p.stand === "af").length,
    loopt: PUNTEN.filter((p) => p.stand === "loopt").length,
    open: PUNTEN.filter((p) => p.stand === "open").length,
    totaal: PUNTEN.length,
  };
}
