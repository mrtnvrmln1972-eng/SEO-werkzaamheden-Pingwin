import { zonderLosStreepje } from "./streepjes";
// Nette weergave van het info-blok op een projectkaart (weekplanning).
// Werkt met terugwerkende kracht op ALLE bestaande kaarten (Pingwin én NOC):
// de platte kaarttekst wordt gesplitst in het unieke verhaal (Doel, Afspraken en
// herkomst) en fase-specifieke sturing die bij de fase-rijen hoort. Zo staat elk
// ding op precies één plek en dubbelt het bovenblok niet met de fase-checklist.
// De opgeslagen data blijft ongemoeid; dit is puur de weergave-laag.

import { linkifyHtml } from "./linkify";
import { puntSoort } from "./punt-soort";
import { striptToeschrijvingen, type HerkomstContext } from "./herkomst";
import { mdToHtml } from "./markdown";

export type CardFaseKey = "strategie" | "gelieerde" | "analyse" | "blauwdruk" | "copy" | "bouw" | "structured";

export type CardInfo = {
  achtergrond: string[];   // het unieke verhaal: wat is er mis, cijfers, waarom nu
  afspraken: string[];     // mail-datums, wie, referenties
  overig: string[];        // punten die nergens anders passen, incl. losse opdrachtregels
  perFase: Partial<Record<CardFaseKey, string[]>>;
  // Wat er niet in de begrensde kaart past. Gaat NIET verloren: het staat ingeklapt
  // onderaan onder "Eerdere notities", voor als je het voor een blauwdruk nodig hebt.
  rest: string[];
};

// Hoeveel regels een kaart in één blik mag tonen. Een kaart hoort te bevatten wat je
// nodig hebt om díe klus te doen, niet alles wat we ooit over de pagina wisten. Bij
// Paul Hoevenaars stonden er twaalf regels onder Doel voor een pagina waar drie
// dingen over te zeggen zijn.
const MAX_WAAROM = 4;
const MAX_AFSPRAKEN = 4;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Mail-verwijzingen ("mail van 5-7") worden een ECHTE link naar die mail, als we
// hem kennen. Eerder werd elke datum oranje en klikbaar gemaakt, ook als er geen
// mail bij hoorde: dan zag je een oranje woordje dat nergens heen ging. Dat gebeurde
// precies wanneer de assistent een mail noemde die niet in het postvak van deze
// klant zit. Kennen we de mail niet, dan blijft het gewone tekst.
// Per datum ALLE mails van die dag, niet één. Er stond eerder één link per datum,
// dus bij meerdere mails op dezelfde dag won willekeurig de eerste of de laatste
// (de korte sleutel hield de eerste, de lange overschreef met de laatste). Een zin
// als "Ahren (mail van 3-8) bevestigt" kwam daardoor uit bij de mail van iemand
// anders die dag. Nu kiezen we op naam, en bij twijfel liever géén link dan een
// verkeerde: de datum blijft dan gewone tekst.
export type MailKandidaat = { link: string; van: string; onderwerp: string };
export type MailLinks = Record<string, string | MailKandidaat[]>;   // "5-7" of "5-7-2026"

// Welke mail van die dag bedoelt deze zin? De zin noemt bijna altijd de persoon
// ("Ahren (mail van 3-8) bevestigt", "Mail van 31-7: Maarten presenteerde"). Die
// naam is het enige betrouwbare onderscheid dat we hebben.
// De laatste datum die in een kaarttekst genoemd wordt. Daarmee kan de kaart zien
// dat hij achterloopt: staat er inmiddels nieuwere mail, dan klopt een zin als
// "antwoord nog niet ontvangen" niet meer. De kaarttekst is een momentopname, de
// mailbox loopt door; zonder deze vergelijking blijft de kaart onterecht wachten.
export function laatsteDatumInTekst(tekst: string, aanname?: number): Date | null {
  const jaar = aanname || new Date().getFullYear();
  let nieuwste: Date | null = null;
  const pak = (d: number, m: number, j?: number) => {
    const dt = new Date(j || jaar, m - 1, d);
    if (!Number.isNaN(dt.getTime()) && (!nieuwste || dt > nieuwste)) nieuwste = dt;
  };
  for (const m of (tekst || "").matchAll(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/g)) {
    const j = m[3] ? (Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    if (Number(m[1]) <= 31 && Number(m[2]) <= 12) pak(Number(m[1]), Number(m[2]), j);
  }
  for (const m of (tekst || "").matchAll(/\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+(\d{4}))?\b/gi)) {
    const mnd = MAAND[m[2].toLowerCase()];
    if (mnd) pak(Number(m[1]), mnd, m[3] ? Number(m[3]) : undefined);
  }
  return nieuwste;
}

function namenVan(k: MailKandidaat): string[] {
  // Alleen de voornaam/achternaam-delen, geen mailadres-staart: in de zin staat
  // "Ahren", niet "ahren@onedayclinic.nl".
  return (k.van || "").split(/[<>@\s,;.]+/).map((n) => n.replace(/[^a-zà-ÿ-]/gi, "")).filter((n) => n.length > 2);
}

function kiesMail(kandidaten: string | MailKandidaat[], zin: string, voor?: string): string {
  if (typeof kandidaten === "string") return kandidaten;
  if (!kandidaten.length) return "";
  if (kandidaten.length === 1) return kandidaten[0].link;
  // "Mail Maarten aan Emre 31-7" gaat over de mail VAN Maarten. De naam vlak achter
  // "mail" is de afzender, dus die telt zwaarder dan een naam verderop in de zin.
  const afzender = (voor || "").replace(/^\s*mail(?:tje)?\s+(?:van\s+)?/i, "").split(/\s+aan\s+/i)[0].trim().toLowerCase();
  if (afzender) {
    for (const k of kandidaten) {
      if (namenVan(k).some((n) => n.toLowerCase() === afzender)) return k.link;
    }
  }
  const kaal = zin.toLowerCase();
  for (const k of kandidaten) {
    if (namenVan(k).some((n) => kaal.includes(n.toLowerCase()))) return k.link;
  }
  return "";   // meerdere mails, geen naam die het uitwijst: geen gok, geen link
}

// Dezelfde datum in verschillende schrijfwijzen naar één sleutel.
function datumSleutel(d: number, m: number, j?: number): string {
  return j ? `${d}-${m}-${j}` : `${d}-${m}`;
}
const MAAND: Record<string, number> = {
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
};
function sleutelUitTekst(tekst: string): string | null {
  const num = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/.exec(tekst.trim());
  if (num) {
    const j = num[3] ? (Number(num[3]) < 100 ? 2000 + Number(num[3]) : Number(num[3])) : undefined;
    return datumSleutel(Number(num[1]), Number(num[2]), j);
  }
  const tx = /^(\d{1,2})\s+([a-zà-ž]+)(?:\s+(\d{2,4}))?$/i.exec(tekst.trim());
  if (tx && MAAND[tx[2].toLowerCase()]) {
    const j = tx[3] ? (Number(tx[3]) < 100 ? 2000 + Number(tx[3]) : Number(tx[3])) : undefined;
    return datumSleutel(Number(tx[1]), MAAND[tx[2].toLowerCase()], j);
  }
  return null;
}

// Inline-opmaak binnen één regel: **vet** renderen, nooit ruwe sterretjes tonen.
// Getallen die in een geschreven zin staan zijn een momentopname van het moment
// dat de kaart geschreven werd. De verse meting staat bovenaan de kaart. Stonden
// die twee naast elkaar zonder onderscheid, dan las je op één kaart 70.773
// vertoningen bovenaan en 36.326 in de tekst eronder, en wist je niet meer welke
// klopte. Het getal blijft staan (het is echte historie), maar krijgt zichtbaar
// mee dat het van toen is. Werkt met terugwerkende kracht voor elke kaart die er
// al staat, want het gebeurt hier in de weergave en niet in de opgeslagen tekst.
const GEMETEN = /(\d[\d.,]*)(\s*)(vertoningen|klikken|impressies)\b/gi;
function markeerOudeCijfers(html: string): string {
  return html.replace(GEMETEN, (heel, getal: string, spatie: string, woord: string) =>
    `<span class="wp-cijfer-toen" title="Zoals gemeten toen deze kaart geschreven werd. De actuele meting staat bovenaan de kaart.">${getal}${spatie}${woord}<span class="wp-cijfer-toen-lab">toen</span></span>`);
}

function inline(s: string, mails?: MailLinks): string {
  return markeerOudeCijfers(escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*/g, ""))
    // Er stond alleen "mail (van) <datum>". In de praktijk schrijft de assistent
    // "Mail Emre 25-7-2026" of "Mail Maarten aan Emre 31-7-2026", met de naam tussen
    // "mail" en de datum, en dan viel de hele verwijzing buiten dit patroon: geen
    // link, terwijl de mail er wel was. De namen mogen er nu tussen staan; ze helpen
    // bovendien om de juiste mail van die dag te kiezen.
    .replace(/\b([Mm]ail(?:tje)?\s+(?:van\s+)?(?:[A-Za-zÀ-ÿ]+\s+(?:aan\s+[A-Za-zÀ-ÿ]+\s+)?)??)(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+\d{2,4})?)/g,
      (heel, voor: string, datum: string) => {
        if (!mails) return heel;
        const k = sleutelUitTekst(datum);
        const treffer = k ? (mails[k] ?? mails[k.split("-").slice(0, 2).join("-")]) : undefined;
        // De hele zin gaat mee, want daarin staat de naam die uitwijst wélke mail
        // van die dag bedoeld wordt.
        const link = treffer ? kiesMail(treffer, s, voor) : "";
        if (!link) return heel;   // onbekende of dubbelzinnige mail blijft gewone tekst
        return `${voor}<a class="wp-maillink" href="${link}" target="_blank" rel="noreferrer" title="Open deze mail">${datum}</a>`;
      });
}

// Genormaliseerde sleutel voor regel-dedup (zelfde logica als de merge in weekplan.ts).
function lineKey(s: string): string {
  return s.trim().toLowerCase().replace(/^-\s*/, "").replace(/\s+/g, " ");
}

// ── Ontdubbelen op betekenis, niet op letters ──
// Het samenvoegen van kaarten plakte nieuwe regels erbij en herkende alleen
// LETTERLIJK gelijke regels als dubbel. Daardoor stond er drie keer hetzelfde in
// andere woorden: "De pagina heeft 77 vertoningen en 0 klikken: zichtbaar maar
// trekt geen verkeer aan" naast "De pagina staat op 77 vertoningen en 0 klikken,
// dus er is zichtbaarheid maar geen conversie".
//
// Hier vergelijken we op de inhoudswoorden van een regel. Delen twee regels het
// merendeel van hun woorden, dan is het hetzelfde punt en houden we de langste
// (die bevat meestal de meeste informatie). Dit zit in de WEERGAVE-laag, dus het
// geldt meteen voor alle kaarten die er al staan.
const STOPWOORDEN = new Set([
  "de", "het", "een", "en", "of", "maar", "dus", "want", "die", "dat", "er", "is", "zijn", "was", "wordt",
  "worden", "heeft", "hebben", "met", "voor", "van", "op", "in", "aan", "bij", "naar", "te", "als", "ook",
  "nog", "geen", "niet", "wel", "al", "om", "per", "deze", "dit", "we", "ze", "je", "meer", "veel", "tot",
]);
function inhoudswoorden(s: string): Set<string> {
  return new Set(
    lineKey(s)
      .replace(/[^a-z0-9à-ÿ/.\- ]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWOORDEN.has(w)),
  );
}
function zelfdePunt(a: Set<string>, b: Set<string>, drempel = 0.7): boolean {
  if (!a.size || !b.size) return false;
  let gedeeld = 0;
  for (const w of a) if (b.has(w)) gedeeld++;
  if (drempel !== 0.7) return gedeeld / Math.min(a.size, b.size) >= drempel;
  // Ten opzichte van de KORTSTE regel: een korte samenvatting van een lange regel
  // is ook een dubbeling, en die zou bij delen door de langste onder de drempel vallen.
  return gedeeld / Math.min(a.size, b.size) >= 0.7;
}

/** Houdt per punt één regel over: de langste van een groep die hetzelfde zegt. */
export function ontdubbel(regels: string[]): string[] {
  const uit: { tekst: string; woorden: Set<string> }[] = [];
  for (const r of regels) {
    const w = inhoudswoorden(r);
    const bestaand = uit.find((x) => zelfdePunt(x.woorden, w));
    if (!bestaand) { uit.push({ tekst: r, woorden: w }); continue; }
    // De langere formulering wint: die bevat doorgaans het cijfer of de nuance.
    if (r.length > bestaand.tekst.length) { bestaand.tekst = r; bestaand.woorden = w; }
  }
  return uit.map((x) => x.tekst);
}

// Een kort regeltje dat op ':' eindigt is een sectiekopje ("Achtergrond:", "Deeltaken:").
function isKopje(s: string): boolean {
  const t = s.trim();
  return /^[A-ZÀ-Ž][^:]{1,40}:$/.test(t);
}

// Herkent fase-specifieke regels (oud én nieuw formaat), hoofdletterongevoelig,
// met of zonder leidend '- '. Geeft de fase plus de sturingstekst terug.
function faseVanRegel(regel: string): { fase: CardFaseKey; tekst: string } | null {
  const kaal = regel.replace(/^-\s*/, "").trim();
  const m = /^([a-zà-ž][a-zà-ž -]{2,24}?)\s*:\s*(.+)$/i.exec(kaal);
  const prefix = (m ? m[1] : kaal.split(/\s+/).slice(0, 2).join(" ")).toLowerCase();
  const rest = m ? m[2].trim() : kaal;
  const map: [RegExp, CardFaseKey][] = [
    [/^analyse\b/, "analyse"],
    [/^blauwdruk\b/, "blauwdruk"],
    [/^copy\b/, "copy"],
    [/^meta[- ]?(title|titel|description|descriptions)?\b/, "copy"],
    [/^strategie\b/, "strategie"],
    [/^(structured data|structured|schema)\b/, "structured"],
    // "Bouw" heet inmiddels "Implementatie"; oude kaarten schrijven nog "Bouw:",
    // dus allebei moeten in dezelfde fase landen.
    [/^(bouw|bouwen|publiceer|publicatie|implementatie|implementeer)\b/, "bouw"],
    [/^dev\b/, "bouw"],
    [/^alt[- ]?tekst/, "bouw"],
    [/^interne links?\b/, "bouw"],
    [/^gelieerde?\b/, "gelieerde"],
  ];
  for (const [re, fase] of map) {
    if (re.test(prefix)) {
      // Bij een expliciete "Fase: ..." prefix tonen we alleen de sturing; bij een
      // zin die toevallig zo begint ("Dev week 2: ...") houden we de hele regel.
      const toon = m && /^(analyse|blauwdruk|copy|strategie|structured data|schema|bouw|implementatie|gelieerde pagina's|gelieerde)$/i.test(m[1].trim()) ? rest : kaal;
      return { fase, tekst: toon };
    }
  }
  // Inhoud-herkenning voor opdracht-zinnen zonder nette prefix ("Controleer en
  // finaliseer de copy…"). Werkwoord-vangrail: alleen regels die als instructie
  // beginnen; kenniszinnen ("De blauwdruk ligt al klaar…") blijven in Doel.
  const isInstructie = /^(controleer|finaliseer|schrijf|maak|voeg|verwerk|corrigeer|optimaliseer|herstel|verkort|plaats|bouw|publiceer|pas\b|zet\b|update|implementeer)/i.test(kaal);
  if (isInstructie) {
    const laag = kaal.toLowerCase();
    if (/structured data|schema(\.org)?\b/.test(laag)) return { fase: "structured", tekst: kaal };
    if (/alt[- ]?tekst|interne links?|publiceer|\bbouw\b|live zetten/.test(laag)) return { fase: "bouw", tekst: kaal };
    if (/\bcopy\b|webtekst|paginatekst|meta[- ]?(titel|title|description)|prijstabel/.test(laag)) return { fase: "copy", tekst: kaal };
    if (/blauwdruk/.test(laag)) return { fase: "blauwdruk", tekst: kaal };
    if (/analyse/.test(laag)) return { fase: "analyse", tekst: kaal };
    if (/strategie/.test(laag)) return { fase: "strategie", tekst: kaal };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// MAILADMINISTRATIE HOORT NIET IN "AANPAK EN AFSPRAKEN"
// ═══════════════════════════════════════════════════════════
// De mailgeschiedenis stond twee keer op de kaart: bevroren in de geschreven
// tekst ("Mail van 31-7: Maarten presenteerde het dashboard") en levend in "Waar
// deze pagina staat", dat zichzelf bijhoudt uit de mailbox. De bevroren versie is
// degene die veroudert en je verkeerd informeert, dus die hoort daar weg.
//
// Het verschil dat telt is niet "gaat het over mail", maar wáár de verwijzing
// staat:
//
//   "Mail van 31-7: Maarten presenteerde ..."       → begint als administratie:
//                                                     dát er gemaild is. Archief.
//   "Ahren (mail van 3-8) bevestigt: geen tabel"    → een besluit, met de mail als
//                                                     bron. Blijft, zonder de bron.
//
// Wat overblijft onder Aanpak en afspraken is dus alleen wat we gaan doen en wat
// ons tegenhoudt ("Wacht op reply Emre voor copy kan starten"). Weggooien doen we
// nooit: de administratie zakt naar Eerdere notities.

// Begint de regel met een mailverwijzing? Dan is het een logregel.
const MAILKOP = /^(?:mail(?:tje)?\s+(?:van\s+)?(?:[a-zà-ÿ]+\s+(?:aan\s+[a-zà-ÿ]+\s+)?)??\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|mail(?:tje)?\s+van\s+\d{1,2}\s+[a-zà-ÿ]+)\s*[:.-]\s*/i;

function isMailLogregel(regel: string): boolean {
  return MAILKOP.test(regel.replace(/^-\s*/, "").trim());
}

// Een besluit dat toevallig naar een mail verwijst: de verwijzing eruit, het
// besluit blijft staan. De datum zelf staat al in de tijdlijn eronder.
function stripMailBron(regel: string): string {
  return regel
    .replace(/\s*\((?:zie\s+)?mail(?:tje)?\s+(?:van\s+)?[^)]*\)\s*/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Communicatie- en referentieregels zijn geen taken: die horen als geheugensteun
// onder Afspraken en herkomst (mail naar de klant gaat via de kaart-knoppen).
function isCommunicatie(regel: string): boolean {
  const kaal = regel.replace(/^-\s*/, "").trim().toLowerCase();
  return /(stuur|verstuur|mail)\b.*?(bevestiging|mail|richting|naar)|bevestigingsmail|bekijk (de )?(website|site)\b.*(richtlijn|referentie)/.test(kaal);
}

// Splitst de kaarttekst in het unieke verhaal en fase-sturing. Werkt op oude
// platte bullets én op het nieuwe formaat met kopjes (Achtergrond/Afspraken/Aanpak).
// Generieke nul-informatie-regels die alleen ruimte kosten (retroactief wegfilteren).
// Regels die geen reden zijn, maar de afwezigheid van een reden. Ze ontstonden
// doordat "Waarom deze pagina" altijd gevuld moest worden, ook als er niets te
// melden viel: een kaart die vanuit het pagina-overzicht wordt opgepakt zonder
// Search Console-data kreeg gegarandeerd twee zinnen die je niets vertellen
// ("nog geen data", "nog geen strategie"), plus een derde die alleen de titel
// van de kaart herhaalt. Drie regels lezen om te weten dat er niets bekend is.
//
// Ze staan hier in de WEERGAVE-laag en niet alleen bij het maken, zodat elke
// kaart die er al staat er ook meteen vanaf is. Dat is de vaste regel: een
// opmaakverbetering geldt met terugwerkende kracht.
const RUIS: RegExp[] = [
  /^dev bouwt en publiceert de pagina/i,
  /^de aanpak staat hieronder/i,
  /^opgepakt vanuit (het pagina-overzicht|de navigatie)/i,
  /^er ligt (nog )?(geen|al een) vastgelegde strategie voor deze pagina/i,
  /^nog geen search console-data/i,
  // "Pagina oppakken: /hovenier/oosterhout/" en "Nieuwe pagina: /x/": dat is de
  // opdrachtregel waarmee de kaart is aangemaakt, niet een reden. Hij belandde
  // als bullet in de kaart bij het samenvoegen van een tweede klik op dezelfde
  // pagina, en de titel-herhaalcontrole ving hem niet omdat de kaarttitel
  // inmiddels alleen nog het pad is.
  /^(pagina oppakken|nieuwe pagina)\s*:/i,
  // Bevroren op het moment van aanmaken, terwijl het fase-blok eronder de echte
  // stand toont. Twee antwoorden op dezelfde vraag, waarvan er één veroudert.
  /^\d+ van de 7 fases staan af/i,
  /^bron: opgepakt vanuit de navigatie-roadmap/i,
];

export function splitCardInfo(toelichting: string, taak?: string, herkomst?: HerkomstContext): CardInfo {
  // Namen van personen die niet aantoonbaar bij deze klant horen gaan er hier al
  // uit, vóór alle andere verwerking. Zo werkt het met terugwerkende kracht voor
  // elke kaart die er al staat, en komt zo'n naam ook niet meer in een mail
  // terecht die uit deze tekst wordt gemaakt. Zie lib/herkomst.ts voor het waarom.
  toelichting = striptToeschrijvingen(toelichting || "", herkomst || {});
  // Vaste schrijfregel, in de weergave dus ook voor alle kaarten die er al staan.
  toelichting = zonderLosStreepje(toelichting);
  const info: CardInfo = { achtergrond: [], afspraken: [], overig: [], perFase: {}, rest: [] };
  const seen = new Set<string>();
  // De titel van de kaart hoort niet als bullet IN de kaart. Bij het samenvoegen
  // werd de titel van het nieuwe punt er telkens bij geplakt, dus stond hij er
  // soms twee keer in, licht anders geformuleerd.
  const titelWoorden = taak ? inhoudswoorden(taak) : null;
  let sectie: "achtergrond" | "afspraken" | "aanpak" = "achtergrond";
  for (const raw of (toelichting || "").split("\n")) {
    const regel = raw.trim();
    if (!regel) continue;
    if (RUIS.some((re) => re.test(regel.replace(/^-\s*/, "")))) continue;
    const k = lineKey(regel);
    if (seen.has(k)) continue;
    seen.add(k);
    // Herhaalt deze regel de kaarttitel? Bij het samenvoegen werd de titel van het
    // nieuwe punt telkens als bullet aangeplakt, dus stond hij er soms twee keer in,
    // net anders geformuleerd ("Ontwikkel /diensten/tuinontwerp/ (uitbreiding met
    // beplantingsplan)" naast de titel "Breid /diensten/tuinontwerp/ uit en verwerk
    // beplantingsplan"). Ruimere drempel dan elders, want een misser hier kost niets:
    // de regel verdwijnt niet maar zakt naar Eerdere notities.
    if (titelWoorden && zelfdePunt(titelWoorden, inhoudswoorden(regel), 0.55)) {
      info.rest.push(regel.replace(/^-\s*/, "").trim());
      continue;
    }
    if (isKopje(regel)) {
      const kop = regel.replace(/:$/, "").toLowerCase();
      if (/afspraken|herkomst|bron/.test(kop)) sectie = "afspraken";
      // Een "opdracht"-kopje krijgt geen eigen vak meer (dat was een apart,
      // automatisch samengesteld blok waar je zelf geen zicht op had): het
      // valt nu gewoon onder "Aanpak en afspraken", net als de rest.
      else if (/opdracht|aanpak|deeltaken|taken|stappen/.test(kop)) sectie = "aanpak";
      else sectie = "achtergrond";
      continue; // het kopje zelf niet dubbel tonen; de render zet eigen kopjes
    }
    if (isCommunicatie(regel)) {
      info.afspraken.push(regel.replace(/^-\s*/, "").trim());
      continue;
    }
    const fase = faseVanRegel(regel);
    if (fase) {
      (info.perFase[fase.fase] ||= []).push(fase.tekst);
      continue;
    }
    const kaal = regel.replace(/^-\s*/, "").trim();
    if (sectie === "afspraken") info.afspraken.push(kaal);
    else if (sectie === "aanpak") info.overig.push(kaal);
    else info.achtergrond.push(kaal);
  }
  // Aangeplakte regels erven de sectie van het blok ervóór, want bij het
  // samenvoegen komen ze zonder eigen kopje binnen. Daardoor belandden
  // constateringen onder "Aanpak en taken" en kregen ze een knopje om door te
  // zetten. Een constatering hoort bij Doel, wat er ook boven stond.
  const echtWerk: string[] = [];
  for (const r of info.overig) {
    if (puntSoort(r) === "feit") info.achtergrond.push(r);
    else echtWerk.push(r);
  }
  info.overig = echtWerk;

  // Mailadministratie uit Aanpak en afspraken: de tijdlijn eronder houdt zichzelf
  // bij en is dus altijd actueel; deze regels waren dat na een dag al niet meer.
  // Een besluit dat naar een mail verwijst blijft staan, alleen zonder de bron.
  const afsprakenSchoon: string[] = [];
  for (const r of info.afspraken) {
    if (isMailLogregel(r)) info.rest.push(r);
    else afsprakenSchoon.push(stripMailBron(r));
  }
  info.afspraken = afsprakenSchoon;
  const overigSchoon: string[] = [];
  for (const r of info.overig) {
    if (isMailLogregel(r)) info.rest.push(r);
    else overigSchoon.push(stripMailBron(r));
  }
  info.overig = overigSchoon;

  info.achtergrond = ontdubbel(info.achtergrond);
  info.afspraken = ontdubbel(info.afspraken);
  info.overig = ontdubbel(info.overig);
  for (const f of Object.keys(info.perFase) as CardFaseKey[]) {
    info.perFase[f] = ontdubbel(info.perFase[f] || []);
  }

  // Begrenzen: wat er boven de limiet uitkomt verhuist naar "Eerdere notities".
  // Weggooien doen we nooit; het staat straks ingeklapt onderaan de kaart.
  if (info.achtergrond.length > MAX_WAAROM) {
    info.rest.push(...info.achtergrond.slice(MAX_WAAROM));
    info.achtergrond = info.achtergrond.slice(0, MAX_WAAROM);
  }
  if (info.afspraken.length > MAX_AFSPRAKEN) {
    info.rest.push(...info.afspraken.slice(MAX_AFSPRAKEN));
    info.afspraken = info.afspraken.slice(0, MAX_AFSPRAKEN);
  }
  // Per fase één regel; de rest is bijna altijd een andere formulering van dezelfde
  // instructie en hoort niet naast de stap te staan waar je mee bezig bent.
  for (const f of Object.keys(info.perFase) as CardFaseKey[]) {
    const v = info.perFase[f] || [];
    if (v.length > 1) { info.rest.push(...v.slice(1)); info.perFase[f] = v.slice(0, 1); }
  }
  info.rest = ontdubbel(info.rest);
  return info;
}


// De korte, gerichte sturing die meegaat als een fase vanaf de kaart start:
// de achtergrond plus specifiek de sturing van díe fase (niet de hele lap).
export function faseSturing(info: CardInfo, fase: CardFaseKey, max = 1500): string {
  const delen: string[] = [];
  if (info.achtergrond.length) delen.push(info.achtergrond.join(" "));
  const eigen = info.perFase[fase] || [];
  if (eigen.length) delen.push(`Sturing voor deze stap: ${eigen.join("; ")}`);
  return delen.join("\n\n").slice(0, max);
}

// ═══════════════════════════════════════════════════════════
// EEN SJABLOONZIN PER FASE ZEGT NIETS WAT DE FASENAAM NIET AL ZEGT
// ═══════════════════════════════════════════════════════════
// Ontstond een kaart uit het pagina-overzicht of de prioriteitenscan, dan kreeg
// elke fase een standaardzin mee (faseVoorstel in lib/weekplan-kaarttekst.ts):
// "Analyse: toets deze pagina en op overlap met andere eigen pagina's",
// "Copy: tekst aanscherpen". Dat is de omschrijving van de fase, geen sturing.
// Erger: die zin wordt nooit herschreven, dus op een kaart waar de copy al
// geschreven en goedgekeurd is staat er nog steeds "tekst aanscherpen", en dat
// spreekt het vinkje ernaast tegen.
//
// Zulke regels verdienen dus geen uitleg-knop op de kaart. Dit is de
// weergave-laag, dus het geldt met terugwerkende kracht voor elke kaart die er
// al staat. De opgeslagen tekst blijft ongemoeid: hij stuurt de documentmotor
// nog steeds (faseSturing hierboven), waar zo'n zin wél zijn nut heeft omdat de
// motor de fasenaam niet als context heeft.
const SJABLOON_STURING: RegExp[] = [
  // bestaande pagina verbeteren
  /^toets deze pagina\b.*\bop overlap met andere eigen pagina'?s/i,
  /^vergelijk de koppenstructuur met de top-?10\b.*\bwat er mist/i,
  /^tekst aanscherpen\b/i,
  /^wijzigingen doorvoeren, publiceren en de interne links nalopen/i,
  // nieuwe pagina bouwen
  /^bepaal de rol van deze pagina\b.*\bermee overlappen/i,
  /^check de top-?10\b.*\brealistisch tussen/i,
  /^koppenstructuur en secties op basis van de top-?10/i,
  /^tekst schrijven vanuit de blauwdruk/i,
  /^pagina bouwen, publiceren en\b.*\bintern aanlinken/i,
  /^schema toevoegen dat bij dit paginatype past/i,
];

/** Is dit de standaardzin die bij het aanmaken van de kaart is meegegeven? */
export function isSjabloonSturing(tekst: string): boolean {
  const t = (tekst || "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  return SJABLOON_STURING.some((re) => re.test(t));
}

// ═══════════════════════════════════════════════════════════
// EEN BEVROREN "COPY NOG NIET BEVESTIGD LIVE"-REGEL IS NIET WAAR ZODRA DE METING
// HET TEGENDEEL AANTOONT
// ═══════════════════════════════════════════════════════════
// De Copy-fase op een kaart toont vaak een geschreven regel als "Copy aangeleverd
// 7 juli; nog geen wijziging gedetecteerd" (geschreven toen dat klopte). Meet het
// dashboard nadien (via "Is dit doorgevoerd?" of "Controleer de site") dat de
// copy wél op de pagina staat, dan blijft die regel het tegenovergestelde
// beweren: hij staat vast in de opgeslagen kaarttekst en wordt nooit herschreven.
// Dit is de weergave-laag, dus de correctie werkt met terugwerkende kracht op
// elke kaart die zo'n regel al bevat, zonder de opgeslagen tekst aan te raken.
const STALE_COPY_NOG_NIET = /nog\s+(niet|geen)\s+(doorgevoerd|wijziging\s+gedetecteerd|live|bevestigd)|controleer\s+of\s+(het|de\s+copy)\s+live\s+staat/i;

export function verseCopySturing(sturing: string, doorgevoerd: boolean | null | undefined): string {
  if (doorgevoerd !== true || !sturing || !STALE_COPY_NOG_NIET.test(sturing)) return sturing;
  return "Copy staat aantoonbaar live op de pagina (bevestigd bij de laatste controle).";
}

// Inline SVG-iconen (huisstijl-oranje via currentColor), stijl van het voorbeeld.
const SVG = (paden: string, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paden.split("|").map((d) => `<path d="${d}"></path>`).join("")}</svg>`;
const ICO_VLAG = SVG("M4 21V4|M4 4h12l-2 4 2 4H4");
const ICO_KLEMBORD = SVG("M9 4h6v3H9z|M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2|M9 12h6|M9 16h4");

function lijst(regels: string[], cls: string, mails?: MailLinks): string {
  // Elk punt (Doel én Aanpak) krijgt een klein »-knopje: zet dit punt op een
  // bespreeklijst (Sander, klant, ...). De kaart-component vangt de klik af.
  const knop = '<button type="button" class="wp-info-lijstbtn" title="Zet dit punt op een bespreeklijst">&raquo;</button>';
  return `<ul class="${cls}">${regels.map((r) => `<li>${knop}${inline(r, mails)}</li>`).join("")}</ul>`;
}

function infoKaart(icoon: string, kop: string, inhoud: string): string {
  return `<div class="wp-info-kaart"><div class="wp-info-kaarthead"><span class="wp-info-icoon">${icoon}</span><span class="wp-info-kop">${kop}</span></div>${inhoud}</div>`;
}

// De "Eerdere notities" apart, zodat de kaart ze onderaan het gedeelde blok
// "Over deze pagina" kan zetten in plaats van midden op de kaart, vlak boven het
// tweede archief van het paginadossier. Geeft null als er niets ouds is.
export function eerdereNotitiesHtml(toelichting: string, pageUrl?: string, taak?: string, mails?: MailLinks, herkomst?: HerkomstContext): { html: string; aantal: number } | null {
  const info = splitCardInfo(toelichting, taak, herkomst);
  if (!info.rest.length) return null;
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  return { html: linkifyHtml(lijst(info.rest, "wp-punt-lijst", mails), domain), aantal: info.rest.length };
}

// ═══════════════════════════════════════════════════════════
// "WAAROM DEZE PAGINA" EN "AANPAK EN AFSPRAKEN" GAAN DICHT (17-08-2026)
// ═══════════════════════════════════════════════════════════
// Die twee vakken stonden altijd open bovenaan de projectkaart en vulden het
// halve scherm met de stand van de zoekwoorden op het moment dat de kaart werd
// gemaakt. Dat is bevroren tekst: de posities en vertoningen erin kloppen na een
// paar weken niet meer, en wat er echt met de pagina gebeurt lees je in de
// wijzigingen en in de rankings van díe pagina, niet hier.
//
// Weggooien is toch niet goed: precies deze tekst reist als sturing mee naar de
// kaart-chat en naar de documenten (analyse, blauwdruk, copy). Zou hij helemaal
// van het scherm verdwijnen, dan werken die motoren met een opdracht die jij
// niet meer kunt lezen of corrigeren. Daarom één dichte regel: van het scherm
// af, maar één klik terug te halen. `verhaalDicht` zet dat aan; de projectkaart
// gebruikt het, de andere plek (de takenkaart in ActionCard) staat zelf al
// achter een uitklapper en laat het dus gewoon open staan.
export function cardInfoHtml(toelichting: string, pageUrl?: string, taak?: string, cijfers?: string, mails?: MailLinks, herkomst?: HerkomstContext, zonderNotities?: boolean, ruw?: boolean, verhaalDicht?: boolean): string {
  const domain = (() => { try { return pageUrl ? new URL(pageUrl).host : ""; } catch { return ""; } })();
  // Kant-en-klare inhoud (bijv. een contentagenda): de Achtergrond/Aanpak-per-fase-
  // indeling hieronder knipt per regel en zou een tabel in losse pipe-regels breken.
  // Toon de tekst dan ongewijzigd als markdown, in dezelfde kaartvorm als de rest.
  if (ruw) {
    const html = mdToHtml((toelichting || "").trim());
    if (!html) return "";
    return `<div class="wp-info-doel wp-info-een">${infoKaart(ICO_KLEMBORD, "Inhoud", `<div class="md wp-info-ruw">${html}</div>`)}</div>`;
  }
  const info = splitCardInfo(toelichting, taak, herkomst);
  const kaarten: string[] = [];
  // "Waarom deze pagina" en "Aanpak en afspraken" zijn de bevroren, met de hand
  // geschreven kant van hetzelfde verhaal dat het levende maildossier (het blok
  // "Waar deze pagina staat") ook vertelt, maar dan actueel. Heeft die pagina een
  // dossier met echte inhoud, dan wint dat: twee kaartjes die hetzelfde punt op
  // een ander moment beschrijven is dubbelop, niet extra informatie. Zonder
  // dossier (een verse kaart, of een taak zonder pagina) blijft dit de enige bron.
  if (info.achtergrond.length) {
    kaarten.push(infoKaart(ICO_VLAG, "Waarom deze pagina", lijst(info.achtergrond, "wp-check-lijst", mails)));
  }
  // Losse "opdracht"-regels (vroeger een eigen vak "Opdrachten in deze kaart")
  // vallen hier ook onder: dat was een automatisch samengesteld bakje waarvan
  // de herkomst (chat, mail, scan, handmatig) nergens zichtbaar was, dus geen
  // apart, ongecontroleerd vak meer. Gewoon aanpak, als de rest.
  const aanpak = ontdubbel([...info.overig, ...info.afspraken]);
  if (aanpak.length) {
    kaarten.push(infoKaart(ICO_KLEMBORD, "Aanpak en afspraken", lijst(aanpak, "wp-punt-lijst", mails)));
  }
  const vakken = kaarten.length ? `<div class="wp-info-doel${kaarten.length === 1 ? " wp-info-een" : ""}">${kaarten.join("")}</div>` : "";
  const kolommen = !vakken ? ""
    : verhaalDicht
      ? `<details class="wp-info-rest wp-info-verhaal"><summary>Achtergrond en afspraken (${info.achtergrond.length + aanpak.length})</summary>${vakken}</details>`
      : vakken;

  // De cijfers komen uit de METING, nooit uit geschreven tekst. Zolang een getal in
  // een zin stond, konden er twee metingen naast elkaar blijven staan (positie 27.9
  // met 869 vertoningen én positie 30.1 met 615). Eén vaste plek maakt dat onmogelijk.
  const cijferRegel = cijfers
    ? `<div class="wp-info-cijfers"><span class="wp-cijfer-nu-lab">Nu gemeten</span>${escapeHtml(cijfers)}</div>`
    : "";

  // Wat niet in de begrensde kaart past staat hier, ingeklapt. Niets raakt kwijt;
  // het staat alleen niet meer in de weg. <details> heeft geen JavaScript nodig.
  const notities = info.rest.length && !zonderNotities
    ? `<details class="wp-info-rest"><summary>Eerdere notities (${info.rest.length})</summary>${lijst(info.rest, "wp-punt-lijst", mails)}</details>`
    : "";
  // Geen emoji's in het dashboard: status-emoji's uit oudere kaartteksten worden
  // retroactief nette stipjes (zelfde betekenis, rustiger beeld).
  const zonderEmoji = linkifyHtml(cijferRegel + kolommen + notities, domain)
    .replace(/✅|✔️|✔/g, '<span class="st-dot st-ok" title="In orde"></span>')
    .replace(/❌|✖️|✖|⛔/g, '<span class="st-dot st-fout" title="Probleem"></span>')
    .replace(/⚠️|⚠/g, '<span class="st-dot st-warn" title="Let op"></span>');
  return zonderEmoji;
}
