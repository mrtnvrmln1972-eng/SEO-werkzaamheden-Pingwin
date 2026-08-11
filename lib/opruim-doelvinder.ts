import { getClientUrls, type ClientUrl } from "./site-urls";
import { getAhrefsTopPages } from "./ahrefs";
import { getAdsPaginas, isAdsPad, getOpruimRegels } from "./opruim-regels";
import { feitenPerTerm, magSamenvoegen, type Intentie } from "./opruim-intentie";
import type { WerkRegel } from "./opruim-werklijst";

// ═══════════════════════════════════════════════════════════
// WAAR MOET DEZE PAGINA HEEN? DE KEUZELADDER, NAGEREKEND
// ═══════════════════════════════════════════════════════════
// De opruimlijst zei tot nu toe wél dát een pagina weg kon, maar niet waarheen.
// Dat laatste is precies waar een 301 zijn waarde wint of verliest, want een
// omleiding draagt alleen iets over als de doelpagina een redelijke vervanging
// is, gezien vanuit de bezoeker. Is dat niet zo, dan behandelt Google hem als
// een soft 404: de omleiding werkt technisch, maar er gaat niets over.
//
// De toets die daaronder ligt is één vraag: zou iemand die op het oude
// zoekresultaat klikte, op de doelpagina het gevoel hebben dat hij heeft
// gekregen waarvoor hij kwam? Zo nee, dan is het doel verkeerd gekozen.
//
// De ladder, van boven naar beneden, stoppen bij de eerste die past:
//
//   1. De inhoudelijke opvolger  hetzelfde onderwerp én dezelfde zoekintentie.
//                                Bij een samenvoeging per definitie de pagina
//                                waarin de inhoud opgaat.
//   2. De dichtstbijzijnde zuster  zelfde niveau, zelfde type, net een andere
//                                invulling. Alleen als de bezoeker daar echt
//                                geholpen wordt.
//   3. De categorie of hub erboven  geen zinnige zuster, maar het onderwerp
//                                bestaat wel op de site. De bezoeker kiest
//                                zelf verder.
//   4. 410  geen enkel relevant doel. Eerlijker en schoner dan trede 5.
//   5. De homepage  laatste redmiddel, en eigenlijk alleen bij pagina's met
//                                externe links die je niet wilt verliezen.
//
// Twee dingen bepalen hóe zwaar die keuze weegt, en ze staan daarom bij elk
// voorstel op het scherm: externe links (zonder verwijzende domeinen valt er
// nauwelijks iets over te dragen en is het vooral een keuze voor de bezoeker)
// en residueel verkeer (ranken de pagina's nog ergens op, dan bepaalt het doel
// of die posities meeverhuizen of verdampen).
//
// De som is bewust dom en herhaalbaar, zonder taalmodel: twee keer draaien
// geeft twee keer hetzelfde voorstel. Wat een mens beter weet, legt hij vast
// als vaste regel (lib/opruim-regels.ts); die wint hier altijd.
// ═══════════════════════════════════════════════════════════

/** Welke trede van de ladder dit voorstel is. */
export type Trede = "opvolger" | "zuster" | "hub" | "410" | "homepage";

export type DoelVoorstel = {
  van: string;
  /** Het voorgestelde doelpad. Leeg bij trede 410. */
  doel: string;
  trede: Trede;
  /** Hoe hard dit voorstel staat: hoog = bewijs, laag = beste gok. */
  zeker: "hoog" | "middel" | "laag";
  /** Eén zin voor in de tabel. */
  kort: string;
  /** De volledige onderbouwing, zin voor zin. */
  waarom: string[];
  /** Technische hygiëne: wat er nog aandacht vraagt vóór doorvoeren. */
  waarschuwingen: string[];
  /** Waarom de keuze zwaar of licht weegt. */
  gewicht: { refDomains: number | null; klikken: number; vertoningen: number };
  /** Al vastgelegd door Maarten: dan is dit geen voorstel maar een besluit. */
  vast: boolean;
};

export type DoelenRapport = {
  voorstellen: DoelVoorstel[];
  /** Wat er niet berekend kon worden, eerlijk benoemd. */
  gaten: string[];
  bepaaldOp: string;
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };
const norm = (u: string) => padVan(u).replace(/\/+$/, "").toLowerCase() || "/";

/** Het pad één niveau hoger. "/" als er niets boven zit. */
function ouder(pad: string): string {
  const delen = norm(pad).split("/").filter(Boolean);
  delen.pop();
  return delen.length ? `/${delen.join("/")}/` : "/";
}
/** Alle mappen boven dit pad, van dichtbij naar ver. */
function ouders(pad: string): string[] {
  const uit: string[] = [];
  let p = norm(pad);
  while (p !== "/") { p = norm(ouder(p)); uit.push(p); if (uit.length > 8) break; }
  return uit;
}

// Woorden die niets over het onderwerp zeggen. Dezelfde les als bij de
// eindstructuur: "wat", "van", "voor" en "bij" zijn schrijfstijl, geen thema.
const VULWOORDEN = new Set([
  "de", "het", "een", "en", "of", "van", "voor", "met", "bij", "aan", "op", "in", "uit", "over",
  "wat", "hoe", "waarom", "wanneer", "welke", "wie", "waar", "dat", "die", "deze", "dit", "je",
  "jouw", "mijn", "zijn", "haar", "ons", "onze", "niet", "wel", "ook", "naar", "per", "als",
  "page", "pagina", "index", "home", "www", "html", "php", "nl", "amp",
]);

/** De losse woorden van een pad plus titel, zonder ruis. */
function woorden(pad: string, titel = ""): string[] {
  const ruw = `${norm(pad).replace(/\//g, " ")} ${(titel || "").toLowerCase()}`;
  return [...new Set(
    ruw.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !VULWOORDEN.has(w) && !/^\d+$/.test(w)),
  )];
}

/** Alleen de woorden uit het pad zelf: die zeggen meer over het onderwerp dan
    een titel, waar ook merknaam en verkoopregels in staan. */
function padWoorden(pad: string): string[] {
  return woorden(pad, "");
}

// ── Taalversie: een NL-pagina hoort niet naar een EN-doel ──
const TAALCODES = new Set(["en", "de", "fr", "es", "it", "pl", "tr", "nl", "be", "pt", "ru"]);
function taalVan(pad: string): string {
  const eerste = norm(pad).split("/").filter(Boolean)[0] || "";
  return TAALCODES.has(eerste) ? eerste : "";
}

type Kandidaat = {
  pad: string;
  /** Het pad zoals het écht op de site staat, mét of zonder afsluitende slash.
      Een omleiding naar /soa-klinieken terwijl de site /soa-klinieken/ gebruikt
      levert een tweede hop op (WordPress corrigeert dat zelf), en dat is precies
      wat de regel "één hop" verbiedt. */
  origineel: string;
  titel: string;
  woorden: Set<string>;
  padWoorden: Set<string>;
  klikken: number;
  vertoningen: number;
  refDomains: number | null;
  /** De zoekterm waar deze pagina het best op scoort (Ahrefs), voor de intentie-rem. */
  term: string;
  /** Wat er volgens de werklijst met deze pagina gebeurt. */
  uitkomst: string;
};

/**
 * Alles wat er over de pagina's van deze klant bekend is, omgezet naar wat de
 * ladder nodig heeft. Eén keer per berekening opgehaald, want dit is dezelfde
 * data voor alle 38 regels.
 */
async function verzamel(slug: string, domain: string, regels: WerkRegel[]): Promise<Bak> {
  const [urls, ads, tops, vasteRegels] = await Promise.all([
    getClientUrls(slug).catch(() => [] as ClientUrl[]),
    getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false })),
    domain ? getAhrefsTopPages(domain).catch(() => []) : Promise.resolve([]),
    getOpruimRegels(slug).catch(() => []),
  ]);
  return maakBak({ urls, ads, tops, vasteRegels, regels });
}

/**
 * Dezelfde bak, maar dan zonder database: alles wat de ladder nodig heeft,
 * afgeleid uit ruwe gegevens. Apart gezet zodat `proeven/redirect-doel.proef.ts`
 * de ladder kan narekenen op verzonnen sites, want de keuzes hieronder zijn
 * precies het soort regel dat stilletjes verschuift zodra iemand iets bijbouwt.
 */
export function maakBak(inv: {
  urls: ClientUrl[];
  ads: { paden: string[]; geen: boolean; ingevuld: boolean };
  tops: { url: string; refDomains: number | null; topKeyword: string }[];
  vasteRegels: { van: string; besluit: string; naar: string }[];
  regels: WerkRegel[];
}): Bak {
  const { urls, ads, tops, vasteRegels, regels } = inv;

  // Verwijzende domeinen per pagina. Ahrefs levert dit al mee in de top-pages
  // die het dashboard toch al ophaalt (30 dagen in de cache), dus dit kost geen
  // extra eenheden. Staat een pagina er niet in, dan weten we het niet; dat is
  // iets anders dan nul en wordt ook zo getoond.
  const links = new Map<string, number>();
  const topTerm = new Map<string, string>();
  for (const t of tops) {
    if (t.refDomains != null) links.set(norm(t.url), t.refDomains);
    if (t.topKeyword) topTerm.set(norm(t.url), t.topKeyword.toLowerCase());
  }

  const uitkomstVan = new Map<string, string>();
  for (const r of regels) uitkomstVan.set(norm(r.pad), r.uitkomst);

  // Hoe vaak komt een woord voor over de hele site? Een woord dat meer dan 8%
  // van de pagina's dekt is ruis en zegt niets ("test" staat bij One Day Clinic
  // in bijna elke URL). Diezelfde grens gebruikt de eindstructuur al.
  const telling = new Map<string, number>();
  for (const u of urls) for (const w of padWoorden(u.url)) telling.set(w, (telling.get(w) || 0) + 1);
  const totaal = Math.max(1, urls.length);
  // Twee voorwaarden, want een percentage alleen slaat op een kleine site door:
  // op een site van vier pagina's is élk woord dat twee keer voorkomt "50% van
  // de site", en dan houdt de bron geen enkel onderwerpswoord over. Ruis is pas
  // ruis als een woord én een groot deel van de site dekt én op genoeg pagina's
  // staat om dat te kunnen zeggen.
  const ruis = new Set([...telling].filter(([, n]) => n / totaal > 0.08 && n >= 8).map(([w]) => w));
  const idf = (w: string) => Math.log(totaal / Math.max(1, telling.get(w) || 1));

  const kandidaten: Kandidaat[] = [];
  for (const u of urls) {
    const p = norm(u.url);
    if (isAdsPad(p, ads)) continue;
    // Een doel moet zelf 200 geven. Weten we de status niet, dan is dat geen
    // bewijs van het tegendeel; onbekend telt mee, 404/301 niet.
    if (u.status != null && u.status !== 200) continue;
    const uit = uitkomstVan.get(p) || "";
    // Nooit omleiden naar een pagina die zelf verdwijnt (dat maakt een keten)
    // of die nog niet bestaat.
    if (uit === "opruimen" || uit === "samenvoegen" || uit === "nieuw") continue;
    kandidaten.push({
      pad: p, origineel: padVan(u.url) || p, titel: u.title || "",
      woorden: new Set(woorden(u.url, u.title)),
      padWoorden: new Set(padWoorden(u.url)),
      klikken: u.gscClicks || 0, vertoningen: u.gscImpressions || 0,
      refDomains: links.has(p) ? links.get(p)! : null,
      term: topTerm.get(p) || "",
      uitkomst: uit,
    });
  }
  const bestaat = new Set(urls.filter((u) => u.status == null || u.status === 200).map((u) => norm(u.url)));

  return { urls, links, kandidaten, bestaat, ruis, idf, vasteRegels };
}

export type Bak = {
  urls: ClientUrl[];
  links: Map<string, number>;
  kandidaten: Kandidaat[];
  bestaat: Set<string>;
  ruis: Set<string>;
  idf: (w: string) => number;
  vasteRegels: { van: string; besluit: string; naar: string }[];
};

// Woorden die de invulling veranderen maar niet het onderwerp. Ze tellen bewust
// licht mee, want ze zijn juist zeldzaam op een site en zouden anders het
// zwaarste woord van de URL worden. Zonder deze lijst haalde
// /chlamydia-thuistest-kopen/ zijn eigen opvolger /thuistesten/chlamydia-thuistest/
// niet, omdat "kopen" (één keer op de site) zwaarder woog dan "chlamydia" en
// "thuistest" samen. Dat het één een koopvraag is en het ander niet, is een
// echte overweging, maar die hoort bij de intentie-rem en niet hier.
const INVULWOORDEN = new Set([
  "kopen", "bestellen", "kosten", "prijs", "prijzen", "goedkoop", "goedkope", "aanbieding",
  "actie", "online", "snel", "direct", "beste", "vergelijken", "nieuw", "nieuwe", "oud", "oude",
]);
const wegingVan = (w: string, idf: (x: string) => number) => (INVULWOORDEN.has(w) ? 0.3 : idf(w));

/** Hoeveel van het onderwerp van de bronpagina dekt deze kandidaat af? 0 tot 1. */
function dekking(bron: string[], kand: Set<string>, idf: (w: string) => number): number {
  const totaal = bron.reduce((s, w) => s + wegingVan(w, idf), 0);
  if (totaal <= 0) return 0;
  const raak = bron.filter((w) => kand.has(w)).reduce((s, w) => s + wegingVan(w, idf), 0);
  return raak / totaal;
}

/**
 * De hub voor een familie pagina's: de map waar de meeste pagina's van die
 * familie onder hangen én die zelf als pagina bestaat. Bij One Day Clinic is
 * dat /soa-klinieken/ ("Kies je locatie"), en dat is precies wat trede 3
 * bedoelt: het onderwerp bestaat op de site, de bezoeker kiest zelf verder.
 *
 * Waarom niet gewoon de map boven de bronpagina: die bestaat lang niet altijd
 * als echte pagina. /soa-test-locaties/ heeft achttien kinderen maar is zelf
 * geen pagina; dan is een omleiding daarheen een 404 in plaats van een hub.
 */
function familieHub(familie: string[], bak: Bak): string {
  const stem = new Map<string, number>();
  for (const p of familie) for (const o of ouders(p)) {
    if (o === "/") continue;
    stem.set(o, (stem.get(o) || 0) + 1);
  }
  const kan = [...stem]
    .filter(([p]) => bak.bestaat.has(p) && bak.kandidaten.some((k) => k.pad === p))
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  return kan[0]?.[0] || "";
}

/** De zoekintentie van een term, voor zover Ahrefs die kent. */
export type Intenties = Map<string, Intentie>;

async function intentiesVoor(termen: string[]): Promise<Intenties> {
  const schoon = [...new Set(termen.map((t) => (t || "").trim().toLowerCase()).filter(Boolean))].slice(0, 200);
  const uit: Intenties = new Map();
  if (!schoon.length) return uit;
  try {
    const feiten = await feitenPerTerm(schoon);
    for (const [t, f] of feiten) uit.set(t, f.intentie);
  } catch { /* geen intentie bekend is geen fout; de rem gaat dan gewoon uit */ }
  return uit;
}

/**
 * Het voorstel voor elke pagina die opgeruimd wordt zonder dat de analyse al
 * een bestemming gaf. Geeft ook de treden terug die niet gehaald werden, want
 * "waarom niet de zusterpagina" is voor het beoordelen net zo nuttig als het
 * voorstel zelf.
 */
export async function bepaalDoelen(slug: string, domain: string, regels: WerkRegel[]): Promise<DoelenRapport> {
  const bak = await verzamel(slug, domain, regels);
  // Eén keer alle intenties ophalen (gecached bij Ahrefs), niet per regel. De
  // termen van de bronnen én de best scorende term van elke kandidaat; titels
  // gebruiken we bewust niet, want een paginatitel is geen zoekopdracht.
  const open = regels.filter((r) => (r.uitkomst === "opruimen" || r.uitkomst === "samenvoegen") && !r.naar);
  const intenties = await intentiesVoor([...open.map((r) => r.term), ...bak.kandidaten.map((k) => k.term)]);
  return ladder(bak, regels, intenties);
}

/**
 * De ladder zelf: geen database, geen Ahrefs, alleen rekenen. Zo is hij na te
 * rekenen in een proef, en geeft twee keer draaien twee keer hetzelfde antwoord.
 */
export function ladder(bak: Bak, regels: WerkRegel[], intenties: Intenties = new Map()): DoelenRapport {
  const gaten: string[] = [];
  if (!bak.urls.length) gaten.push("De pagina's van deze site zijn nog niet ingelezen, dus er valt geen doel te kiezen. Draai eerst een sitescan.");
  if (!bak.links.size) gaten.push("Er zijn geen backlink-gegevens per pagina beschikbaar. De weging op externe links staat daarmee uit; het voorstel leunt dan alleen op onderwerp en bezoekers.");

  // Alleen de regels zonder bestemming: de rest heeft er al een uit de analyse.
  const open = regels.filter((r) => (r.uitkomst === "opruimen" || r.uitkomst === "samenvoegen") && !r.naar);
  if (!open.length) return { voorstellen: [], gaten, bepaaldOp: new Date().toISOString() };

  // De plaatsfamilie: alle pagina's die in de plaatsanalyse zaten. Voor die
  // familie geldt de zusterregel niet (zie hieronder), en de hub eruit is de
  // locatie-overzichtspagina.
  const plaatsPaden = regels.filter((r) => r.herkomst.includes("plaats")).map((r) => norm(r.pad));
  const plaatsSet = new Set(plaatsPaden);
  const plaatsHub = familieHub(plaatsPaden, bak);

  const vast = new Map(bak.vasteRegels.filter((r) => r.besluit === "redirect" && r.naar).map((r) => [norm(r.van), r.naar]));

  const voorstellen: DoelVoorstel[] = [];
  for (const r of open) {
    const bron = norm(r.pad);
    const taal = taalVan(bron);
    const bronWoorden = padWoorden(bron).filter((w) => !bak.ruis.has(w));
    const refDomains = bak.links.has(bron) ? bak.links.get(bron)! : null;
    const gewicht = { refDomains, klikken: r.klikken || 0, vertoningen: r.vertoningen || 0 };
    const heeftLinks = (refDomains || 0) > 0;
    const heeftRest = (r.klikken || 0) > 0 || (r.vertoningen || 0) >= 25;

    // 0. Wat Maarten al heeft vastgelegd wint van elke berekening.
    const vastDoel = vast.get(bron);
    if (vastDoel) {
      voorstellen.push({
        van: r.pad, doel: norm(vastDoel), trede: "opvolger", zeker: "hoog", vast: true,
        kort: `Vast doel: ${norm(vastDoel)}`,
        waarom: [`Dit doel is eerder door jou vastgelegd, dus de berekening blijft eraf. Wil je iets anders, pas dan de vaste regel aan.`],
        waarschuwingen: [], gewicht,
      });
      continue;
    }

    // De kandidaten voor déze bron: zelfde taalversie, niet zichzelf.
    const mogelijk = bak.kandidaten.filter((k) => k.pad !== bron && taalVan(k.pad) === taal);
    const gescoord = mogelijk
      .map((k) => ({ k, score: dekking(bronWoorden, k.padWoorden, bak.idf), breed: dekking(bronWoorden, k.woorden, bak.idf) }))
      .sort((a, b) => (b.score + b.breed) - (a.score + a.breed) || b.k.klikken - a.k.klikken);

    // De intentie-rem. Twee pagina's over dezelfde woorden maar een andere vraag
    // horen niet naar elkaar toe: wie uitleg zocht en een prijslijst krijgt, is
    // niet geholpen. Kennen we de intentie niet, dan remt hij niet.
    const bronIntentie = intenties.get((r.term || "").trim().toLowerCase()) || "";
    const intentieBotst = (k: Kandidaat): string => {
      if (!bronIntentie) return "";
      const ki = intenties.get((k.term || "").trim().toLowerCase()) || "";
      if (!ki) return "";
      const oordeel = magSamenvoegen(bronIntentie as Intentie, ki as Intentie);
      return oordeel.mag ? "" : oordeel.reden;
    };

    const waarschuwingen: string[] = [];
    const afgevallen: string[] = [];

    // ── Trede 1: de inhoudelijke opvolger ──
    // Een pagina die hetzelfde onderwerp én dezelfde specifieke invulling dekt.
    // Voor /soa-test-nuenen/ is dat een andere Nuenen-pagina die blijft staan,
    // niet een willekeurige plaats.
    // De drempel ligt op 0,7 van het gewicht van de bron, en dat gewicht telt
    // zeldzame woorden zwaar. Daardoor haalt een zusterpagina deze trede vanzelf
    // niet: "soa test veldhoven" en "soa test breda" delen alleen de woorden die
    // half de site deelt, en juist het woord dat de pagina onderscheidt (de
    // plaats) ontbreekt. Dat hoeft dus niet apart afgevangen te worden.
    const opvolger = gescoord.find(({ k, score }) => score >= 0.7 && !intentieBotst(k));
    if (opvolger) {
      const botst = intentieBotst(opvolger.k);
      voorstellen.push({
        van: r.pad, doel: opvolger.k.pad, trede: "opvolger", zeker: "hoog", vast: false,
        kort: `Inhoudelijke opvolger: ${opvolger.k.pad}`,
        waarom: [
          `**Trede 1 van de ladder: de inhoudelijke opvolger.** ${opvolger.k.pad} dekt ${Math.round(opvolger.score * 100)}% van waar deze pagina over gaat${bronWoorden.length ? ` (${bronWoorden.join(", ")})` : ""}, en die pagina blijft staan. Wie op het oude zoekresultaat klikte, krijgt daar waarvoor hij kwam.`,
          ...(botst ? [] : bronIntentie ? [`De zoekintentie botst niet: allebei bedienen ze een ${bronIntentie}e vraag.`] : []),
          ...weegZin(gewicht, heeftLinks, heeftRest),
        ],
        waarschuwingen, gewicht,
      });
      continue;
    }
    afgevallen.push("Er is geen pagina die dit onderwerp én deze specifieke invulling overneemt, dus trede 1 valt af.");

    // ── Trede 2: de dichtstbijzijnde zusterpagina ──
    // Zelfde niveau, zelfde type, andere invulling. Bewust NIET voor plaatsen:
    // dat iemand die "soa test veldhoven" zoekt geholpen is op de pagina van een
    // andere stad, kunnen we niet aantonen, en de ladder zegt zelf dat de zuster
    // alleen werkt zolang de bezoeker daar realistisch geholpen wordt. Zonder
    // afstandsgegevens is dat een aanname, geen bevinding. De hub eronder doet
    // hetzelfde werk zonder die gok: daar kiest de bezoeker zelf zijn locatie.
    const isPlaats = plaatsSet.has(bron);
    if (!isPlaats) {
      const zuster = gescoord.find(({ k, score }) =>
        score >= 0.6 && ouder(k.pad) === ouder(bron) && !intentieBotst(k));
      if (zuster) {
        voorstellen.push({
          van: r.pad, doel: zuster.k.pad, trede: "zuster", zeker: "middel", vast: false,
          kort: `Dichtstbijzijnde zuster: ${zuster.k.pad}`,
          waarom: [
            `**Trede 2 van de ladder: de dichtstbijzijnde zusterpagina.** ${zuster.k.pad} staat op hetzelfde niveau, is hetzelfde type pagina en heeft net een andere invulling. De bezoeker landt op iets dat hij herkent.`,
            `Trede 1 viel af: geen enkele pagina neemt dit onderwerp één op één over.`,
            ...weegZin(gewicht, heeftLinks, heeftRest),
          ],
          waarschuwingen, gewicht,
        });
        continue;
      }
      afgevallen.push("Er is geen zusterpagina op hetzelfde niveau die dicht genoeg bij dit onderwerp ligt, dus trede 2 valt af.");
    } else {
      afgevallen.push("Trede 2 (een andere plaats) slaan we bewust over: dat iemand die naar déze plaats zocht geholpen is op de pagina van een andere stad, kunnen we niet aantonen.");
    }

    // ── Trede 3: de categorie of hub erboven ──
    // De homepage telt hier niet mee: die is trede 5, niet trede 3. Anders is
    // elke pagina "onder een hub" en komt de ladder nooit bij 410 uit, terwijl
    // massaal naar de homepage omleiden juist is wat we willen vermijden.
    const eigenOuder = ouders(bron).find((o) => o !== "/" && bak.bestaat.has(o) && bak.kandidaten.some((k) => k.pad === o && taalVan(k.pad) === taal));
    const hub = isPlaats ? (plaatsHub || eigenOuder || "") : (eigenOuder || hubUitWoorden(bronWoorden, gescoord, bak));
    if (hub) {
      const hubK = bak.kandidaten.find((k) => k.pad === hub);
      // De intentie-rem geldt hier bewust NIET als veto, anders dan bij trede 1
      // en 2. Een categoriepagina is per definitie breder dan zijn kinderen en
      // bedient dus meer dan één soort vraag; de rem vergelijkt maar één term
      // per pagina, en op kleine lokale termen is dat label wankel. Live liep
      // dat meteen mis: zes plaatspagina's vielen terug op 410 omdat "soa poli
      // bemmel" als informatief te boek stond en het locatie-overzicht als
      // transactioneel, terwijl dat dezelfde vraag is. Het verschil verdwijnt
      // niet, het wordt een waarschuwing in plaats van een besluit.
      const botst = hubK ? intentieBotst(hubK) : "";
      if (botst) waarschuwingen.push(`Let op de zoekintentie: ${botst} Bij een categoriepagina hoeft dat geen probleem te zijn, maar controleer of ${hub} deze bezoeker echt verder helpt.`);
      voorstellen.push({
        van: r.pad, doel: hub, trede: "hub", zeker: heeftRest || heeftLinks ? "middel" : "hoog", vast: false,
        kort: `Categorie erboven: ${hub}`,
        waarom: [
          `**Trede 3 van de ladder: de categorie of hub erboven.** ${hub}${hubK?.titel ? ` ("${hubK.titel.split("|")[0].trim()}")` : ""} gaat over hetzelfde onderwerp, alleen breder. De bezoeker kiest daar zelf verder, en dat is eerlijker dan hem op een pagina zetten die net niet zijn vraag beantwoordt.`,
          ...afgevallen,
          ...weegZin(gewicht, heeftLinks, heeftRest),
        ],
        waarschuwingen, gewicht,
      });
      continue;
    } else {
      afgevallen.push("Er is geen categorie- of overzichtspagina die dit onderwerp dekt, dus trede 3 valt af.");
    }

    // ── Trede 4 en 5: 410, of de homepage als er externe links zijn ──
    if (heeftLinks) {
      voorstellen.push({
        van: r.pad, doel: "/", trede: "homepage", zeker: "laag", vast: false,
        kort: "Laatste redmiddel: de homepage",
        waarom: [
          `**Trede 5 van de ladder: de homepage, als laatste redmiddel.** Er is geen relevant doel op de site, maar deze pagina heeft ${refDomains} verwijzende ${refDomains === 1 ? "domein" : "domeinen"}. Die waarde willen we niet weggooien, en dat is de enige reden waarom dit geen 410 wordt.`,
          ...afgevallen,
          `Let op: massaal naar de homepage omleiden is functioneel hetzelfde als een 410, maar dan zonder het duidelijke signaal aan Google. Doe dit dus alleen hier, en niet als patroon.`,
        ],
        waarschuwingen: [...waarschuwingen, "Overweeg eerst of de verwijzende pagina's te benaderen zijn om de link te verleggen; dat is altijd beter dan een homepage-redirect."],
        gewicht,
      });
      continue;
    }
    voorstellen.push({
      van: r.pad, doel: "", trede: "410", zeker: "hoog", vast: false,
      kort: "Geen redirect: 410 (bewust weg)",
      waarom: [
        `**Trede 4 van de ladder: 410.** Er is geen enkel relevant doel voor deze pagina, en dat eerlijk vertellen is schoner dan een omleiding naar iets dat er net niet over gaat. Zo'n omleiding behandelt Google als een soft 404: hij werkt technisch, maar draagt niets over.`,
        ...afgevallen,
        ...weegZin(gewicht, heeftLinks, heeftRest),
      ],
      waarschuwingen, gewicht,
    });
  }

  // ── Veel-naar-één: kan het doel na de samenvoeging alle bronnen nog aan? ──
  // Twintig plaatsen naar één locatiepagina kan prima, twintig productvarianten
  // naar één categoriepagina meestal niet. Het verschil zit erin of de bronnen
  // onderling hetzelfde soort pagina zijn.
  const perDoel = new Map<string, DoelVoorstel[]>();
  for (const v of voorstellen) if (v.doel) {
    if (!perDoel.has(v.doel)) perDoel.set(v.doel, []);
    perDoel.get(v.doel)!.push(v);
  }
  for (const [doel, lijst] of perDoel) {
    if (lijst.length < 8) continue;
    // Het toegestane geval is expliciet: allemaal plaatspagina's naar het
    // locatie-overzicht. Dat is dezelfde vraag met een andere waarde ervoor, en
    // de hub beantwoordt hem voor allemaal ("kies je locatie"). Zodra de bronnen
    // over verschillende ONDERWERPEN gaan, is dat niet meer vanzelf waar, en dan
    // hoort er een controle bij in plaats van een aanname.
    const allemaalPlaats = lijst.every((v) => plaatsSet.has(norm(v.van)));
    const gemengd = !allemaalPlaats;
    for (const v of lijst) {
      v.waarschuwingen.push(gemengd
        ? `${lijst.length} pagina's wijzen naar ${doel}, en ze gaan onderling over een verschillend type onderwerp. Controleer of ${doel} na de samenvoeging voor al die bronnen nog een redelijk antwoord is; zo niet, splits de bestemming.`
        : `${lijst.length} pagina's wijzen naar ${doel}. Dat mag hier: het zijn stuk voor stuk plaatspagina's van hetzelfde type, en ${doel} hoort daar het overzicht van te zijn.`);
    }
  }

  // Elk doel terug naar de schrijfwijze die de site zelf gebruikt (zie
  // Kandidaat.origineel): anders staat er een omleiding die de site daarna
  // nog een keer moet rechtzetten.
  const toonPad = (p: string) => (p ? (bak.kandidaten.find((k) => k.pad === norm(p))?.origineel || p) : "");

  // ── Eén hop: nooit een keten ──
  // Wijst een doel zelf ergens anders heen (omdat het zelf in de lijst staat),
  // dan schrijven we het voorstel meteen naar het eindpunt.
  const doelVan = new Map(voorstellen.map((v) => [norm(v.van), v.doel]));
  for (const v of voorstellen) {
    let stap = 0;
    while (v.doel && doelVan.has(norm(v.doel)) && stap < 5) {
      const volgend = doelVan.get(norm(v.doel)) || "";
      if (!volgend || norm(volgend) === norm(v.doel)) break;
      v.waarschuwingen.push(`${v.doel} gaat zelf ook weg; het voorstel wijst daarom meteen naar ${volgend}, zodat er geen keten ontstaat.`);
      v.doel = norm(volgend);
      stap++;
    }
    if (norm(v.doel) === norm(v.van)) { v.doel = ""; v.trede = "410"; v.kort = "Geen redirect: 410 (bewust weg)"; }
    v.doel = toonPad(v.doel);
    v.kort = v.kort.replace(/\/\S+$/, (m) => (norm(m) === norm(v.doel) ? v.doel : m));
  }

  return { voorstellen, gaten, bepaaldOp: new Date().toISOString() };
}

/** De hub op basis van woorden, voor pagina's zonder bestaande map erboven. */
function hubUitWoorden(bronWoorden: string[], gescoord: { k: Kandidaat; score: number }[], bak: Bak): string {
  // Een hub is korter dan zijn kinderen en dekt de brede woorden van de bron:
  // /soa-klinieken/ voor /soa-kliniek-bemmel/. De specifieke invulling (de
  // plaats) hoeft hij juist NIET te dekken, want daar gaat een hub niet over.
  const breed = bronWoorden.filter((w) => bak.idf(w) < Math.log(bak.urls.length / 8));
  if (!breed.length) return "";
  const kans = gescoord
    .filter(({ k }) => k.pad !== "/" && k.padWoorden.size <= 3 && dekking(breed, k.padWoorden, bak.idf) >= 0.5)
    .sort((a, b) => a.k.padWoorden.size - b.k.padWoorden.size || b.k.klikken - a.k.klikken);
  return kans[0]?.k.pad || "";
}

/** Wat de keuze zwaar of licht maakt, in één of twee zinnen. */
function weegZin(g: DoelVoorstel["gewicht"], heeftLinks: boolean, heeftRest: boolean): string[] {
  const uit: string[] = [];
  if (heeftLinks) {
    uit.push(`**Deze keuze weegt zwaar:** er wijzen ${g.refDomains} externe ${g.refDomains === 1 ? "website" : "websites"} naar deze pagina. Wat je overdraagt hangt dan echt van de relevantie van het doel af.`);
  }
  if (heeftRest) {
    uit.push(`De pagina doet nog mee in Google (${g.klikken > 0 ? `${g.klikken} bezoekers` : `${g.vertoningen} vertoningen`} per maand). Het doel bepaalt of die posities gedeeltelijk meeverhuizen of gewoon verdampen.`);
  }
  if (!heeftLinks && !heeftRest) {
    uit.push(`**Deze keuze weegt licht:** geen externe links${g.refDomains === null ? " bekend" : ""} en vrijwel geen verkeer. Er valt dus nauwelijks iets over te dragen; het gaat hier vooral om het opruimen zelf en om waar de enkele bezoeker landt.`);
  }
  return uit;
}
