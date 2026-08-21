import { sql, ensureSchema } from "./db";
import { callClaude } from "./anthropic";
import { getClientBySlug } from "./clients";
import { getGscForPage } from "./google";
import { measurePage } from "./page-measure";
import { buildPingwinDoc, type DocSpec, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { getPageDriveFolder } from "./site-urls";
import { registerGeneratedVersion } from "./doc-versions";

// ═══════════════════════════════════════════════════════════
// EEN BLOG ONDERSTEUNEND MAKEN AAN EEN LANDINGSPAGINA
// ═══════════════════════════════════════════════════════════
// Een klant levert een blog of een projectverhaal aan. Dat stuk gaat over
// hetzelfde onderwerp als een landingspagina die het moet hebben van precies dat
// zoekwoord. Publiceer je hem zoals hij is, dan gebeurt er één van twee dingen:
// Google kiest de blog in plaats van de landingspagina (dan verkoop je niets), of
// de twee wisselen elkaar af (dan zakken ze allebei). Dat is cannibalisatie, en
// het is geen randgeval maar de normale uitkomst.
//
// Deze motor lost dat op met de enige verdeling die werkt: één pagina is de baas
// op de commerciële hoofdterm, de ander pakt de informatieve vragen eromheen en
// geeft zijn kracht door met een interne link. Wat hier NIET gebeurt: de tekst
// herschrijven. De inhoud is van de klant en blijft van de klant; alleen de kop,
// de titel, de meta en een paar zinnen eromheen verschuiven, plus de links.
//
// Vier dingen worden hier in CODE nagerekend en niet aan het taalmodel
// overgelaten, want een instructie in een prompt is een verzoek en geen poort:
//   1. geen enkele kop van de blog is in de kern de hoofdterm zélf (het wóórd mag
//      er gewoon in staan, zie botstMetHoofdterm verderop);
//   2. er loopt vanuit de blog een link naar elke doelpagina;
//   3. de ankertekst van die link bevat de hoofdterm, want dat is het signaal dat
//      je wilt doorgeven;
//   4. het is er precies ÉÉN per doelpagina, niet twee.
//
// ── HET DOCUMENT IS EEN OPLEVERING, GEEN LIJST MET HUISWERK (21-08-2026) ──
// Er stond een kopje "Let op" in het document met daaronder de waarschuwingen.
// Dat document gaat naar de klant en naar de sitebouwer, en dan lees je daar
// dingen als "het verdient aanbeveling om ook de meta-description van de
// landingspagina te optimaliseren" en "controleer of dit aansluit bij de interne
// linkstrategie die Maarten voor ogen heeft". Maartens woorden: "dat roept
// vragen op of de klant dan zelf nog iets moet doen". Terecht, want die punten
// horen niet bij hen: het eerste is werk dat wíj gewoon doen, het tweede is een
// interne afweging.
//
// Sindsdien geldt hier één regel, en die zit zowel in de prompt als in de vorm
// van het document:
//   * Kun je het zelf, doe het dan. Een betere meta-title voor de landingspagina
//     schrijf je, je beveelt hem niet aan; hij staat als kant-en-klare waarde in
//     "Voor de sitebouwer".
//   * Kan de hoofdterm niet uit de titel of de H1, dan stel je een ándere titel
//     voor. Er wordt hieronder één herstelronde gedraaid die precies dat doet,
//     en pas als die ook niet lukt blijft er iets over.
//   * Wat er dan nog over is, is voor Maarten en staat op het scherm; het komt
//     NIET in het document. Zo staat er in het document alleen wat af is en wat
//     de sitebouwer moet overnemen.
// ═══════════════════════════════════════════════════════════

export type OndersteunendDoel = {
  /** De landingspagina die sterker moet worden. */
  url: string;
  /** De term waarop die pagina de baas is en waar de blog dus vanaf blijft. */
  hoofdterm: string;
  /** Waar de blog zelf op mag mikken: de vragen eromheen. */
  steuntermen: string[];
};

export type OndersteunendeLink = {
  naar: string;
  anker: string;
  /** Waar in de blog die link komt, in gewone taal. */
  plek: string;
};

/**
 * Een betere meta-title en meta-description voor de LANDINGSPAGINA zelf.
 *
 * Dit stond eerder als aanbeveling in het document ("het verdient aanbeveling om
 * ook de meta-description van de landingspagina te optimaliseren"). Een
 * aanbeveling die wij zelf kunnen uitvoeren hoort geen aanbeveling te zijn, dus
 * hij wordt geschreven en als waarde meegeleverd.
 */
export type LandingMeta = {
  url: string;
  metaTitle: string;
  metaDescription: string;
};

export type OndersteunendPlan = {
  kop: string;
  doelen: OndersteunendDoel[];
  titel: string;
  metaTitle: string;
  metaDescription: string;
  wijzigingen: string[];
  links: OndersteunendeLink[];
  /** Bestaande pagina's die naar deze blog zouden moeten linken. */
  linksNaarBlog: { van: string; anker: string }[];
  /** Kant-en-klare meta's voor de landingspagina's zelf; leeg als ze al goed zijn. */
  landingMetas: LandingMeta[];
  /** ALLEEN voor Maarten, op het scherm. Komt nooit in het document. */
  waarschuwingen: string[];
  /** De aangepaste tekst, met ## en ### voor de koppen. */
  tekst: string;
};

const SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin. Je krijgt een blog of projectverhaal dat op de site van een klant gepubliceerd gaat worden, plus één of twee bestaande landingspagina's die het moeten hebben van hun eigen zoekwoord.

JOUW OPDRACHT: maak dat stuk ONDERSTEUNEND aan die landingspagina('s). Niet concurrerend.

DE VERDELING (dit is de kern, hier hangt alles aan):
- De landingspagina is en blijft de baas op zijn commerciële hoofdterm (de term waarmee iemand een opdracht zoekt, bijvoorbeeld "natuurzwembad aanleggen" of "hovenier Etten-Leur").
- De blog mikt op de informatieve vragen ERNAAST: hoe, wat kost, waarmee, hoe onderhoud je, wat is het verschil, welke soorten, een praktijkverhaal. Long tail, vraagvormen, ervaringen.
- De blog geeft zijn kracht door aan de landingspagina met ÉÉN interne link waarvan de ankertekst juist WEL de hoofdterm bevat.

HET ONDERWERP MAG ER GEWOON IN (dit werd eerder te streng toegepast):
- Het WOORD uit de hoofdterm mag in de titel, de meta-title, de H1 en de tussenkoppen staan, en dat is vaak zelfs beter: een stuk dat zichtbaar over hetzelfde onderwerp gaat, geeft een sterkere interne link door dan een stuk waar dat woord uit weggepoetst is.
- Wat NIET mag, is een kop die in de kern de zoekterm zélf is. Twee vormen: (1) er blijft na het weghalen van de hoofdterm te weinig eigen betekenis over ("Ons natuurzwembad", "Natuurzwembad aanleggen"); (2) de hoofdterm staat er met een koopwerkwoord tegenaan (aanleggen, laten maken, kopen, kosten, prijzen, offerte).
- Geef de kop dus een eigen invalshoek: de plaats, de klant, het type project, de vraag die hij beantwoordt. "Strak natuurzwembad in IJsselmuiden, een kijkje in dit project" is goed. "Natuurzwembad aanleggen in IJsselmuiden" is niet goed.

MINIMAAL INGRIJPEN (net zo belangrijk):
- De inhoud is van de klant. Neem de tekst LETTERLIJK over, alinea voor alinea. Herschrijf niets omdat het mooier kan.
- Je past alleen aan wat nodig is om de botsing weg te nemen: de titel, de H1, de koppen die op de hoofdterm zitten, de eerste alinea, en de zinnen waar een interne link in komt. Voeg hooguit één korte afsluitende alinea toe die naar de landingspagina verwijst.
- Elke aanpassing die je doet, benoem je in "wijzigingen". Wat je niet noemt, heb je niet veranderd.

DIT DOCUMENT IS EEN OPLEVERING, GEEN LIJST MET HUISWERK (dit is een harde regel):
- Het document gaat naar de klant en naar de sitebouwer. Alles wat erin staat is óf al gedaan door ons, óf een concrete waarde die zij overnemen. Er staat nooit iets in waarvan de klant zich afvraagt of hij zelf nog iets moet uitzoeken.
- Geef daarom NOOIT een aanbeveling die je zelf kunt uitvoeren. Kun je het zelf, doe het, en zet het in "wijzigingen". Dus niet "het verdient aanbeveling de meta-description aan te scherpen", maar de aangescherpte meta-description zelf.
- Vind je dat de meta-title of de meta-description van de LANDINGSPAGINA beter kan (te lang, te kort, geen klikprikkel, hoofdterm niet vooraan), schrijf ze dan zelf en zet ze in "landingMetas". Zijn ze al goed, laat "landingMetas" dan leeg; verzin geen werk.
- Is een kop in de kern de zoekterm zelf, kies dan een kop met een eigen invalshoek. Lever dat alternatief, in plaats van een opmerking dat het lastig is.
- Schrijf in "wijzigingen" NIETS over de titel, de H1, de meta-title of de meta-description. Die staan feitelijk in een eigen tabel in het document, met de oude en de nieuwe waarde naast elkaar; schrijf je er zelf ook over, dan spreken die twee elkaar tegen. In "wijzigingen" hoort alleen wat er met de INHOUD gebeurd is: welke alinea, welke tussenkop, welke zin met de link erin.
- "waarschuwingen" is UITSLUITEND voor Maarten en komt niet in het document. Zet daar alleen wat echt een keuze van hem vraagt (een strategische afweging, iets wat je niet kon controleren). Nooit iets over de interne linkstrategie of over ons eigen werk; dat is geen klantboodschap. Meestal is deze lijst leeg.

HARDE REGELS:
- Geen enkele kop van de blog (titel, meta-title, H1, tussenkop) is in de kern de hoofdterm zelf; zie hierboven wat dat betekent.
- PRECIES ÉÉN interne link per landingspagina, met de hoofdterm (of een natuurlijke variant daarvan) als ankertekst. Nooit twee keer naar dezelfde pagina: Google telt binnen één stuk vooral de eerste link naar een adres, dus een tweede voegt niets toe en leest als opgevuld. Nooit "lees meer" of "klik hier".
- Een link naar een ándere relevante pagina van dezelfde site mag er wel bij, als hij inhoudelijk klopt.
- Zet die link in de lopende tekst waar hij inhoudelijk hoort, niet in de eerste alinea.
- Bij "steuntermen" hooguit VIER termen, en alleen de termen die er echt toe doen. Geen waslijst; die staat straks in een smalle kolom en dan leest niemand hem.
- Verzin geen feiten, cijfers, plaatsen of diensten die niet in de aangeleverde tekst of de data staan.
- Geen emoji. Geen losse streepjes als zinsscheiding; gebruik een komma, een puntkomma, haakjes of een nieuwe zin.

Antwoord met UITSLUITEND geldige JSON, niets eromheen:
{"kop":"één zin: wat dit stuk nu doet voor de landingspagina('s)",
 "doelen":[{"url":"...","hoofdterm":"de term waarop die pagina de baas is","steuntermen":["waar de blog op mikt","..."]}],
 "titel":"de nieuwe titel van de blog",
 "metaTitle":"maximaal 60 tekens",
 "metaDescription":"maximaal 155 tekens",
 "wijzigingen":["korte regels: wat je hebt aangepast en waarom, maximaal 6"],
 "links":[{"naar":"de doel-URL","anker":"de ankertekst","plek":"in welke alinea, in gewone taal"}],
 "linksNaarBlog":[{"van":"bestaande pagina die naar deze blog zou moeten linken","anker":"voorgestelde ankertekst"}],
 "landingMetas":[{"url":"de landingspagina","metaTitle":"maximaal 60 tekens","metaDescription":"maximaal 155 tekens"}],
 "waarschuwingen":["alleen wat een keuze van Maarten vraagt; niet voor de klant, meestal leeg"],
 "tekst":"de volledige aangepaste tekst, met ## voor koppen en ### voor subkoppen, links als [ankertekst](url)"}`;

/** Staat een term (los van hoofdletters en meervoud-s) in deze regel tekst? */
function bevatTerm(tekst: string, term: string): boolean {
  const t = (term || "").trim().toLowerCase();
  if (t.length < 3) return false;
  return (tekst || "").toLowerCase().includes(t);
}

/** De eerste kop uit de aangepaste tekst; dat is de H1 van de blog. */
function eersteKop(tekst: string): string {
  for (const regel of (tekst || "").split("\n")) {
    const m = regel.match(/^#{1,3}\s+(.*)$/);
    if (m) return m[1].trim();
  }
  return "";
}

// ═══════════════════════════════════════════════════════════
// WANNEER BOTST EEN KOP ECHT? (verfijnd 21-08-2026)
// ═══════════════════════════════════════════════════════════
// De regel was: de hoofdterm mag NIET in de titel, de meta-title of de H1 staan.
// Dat is te grof, en bij GardenSwimm liep het daarop vast. De hoofdterm van
// /zwemvijvers/natuurzwembad/ is één generiek woord: "natuurzwembad". Een
// projectverhaal dát over een natuurzwembad gaat, kan dat woord niet missen, en
// het weghalen kost meer dan het oplevert: dan snapt Google niet waar het stuk
// over gaat, en is de interne link vanuit dat stuk juist minder waard. Een
// ondersteunend stuk hoort over hetzelfde onderwerp te gaan; dat is het punt.
// Maartens vraag: "is het een groot probleem dat de term natuurzwembad in de H1
// staat?" Nee, en de regel klopte dus niet.
//
// Wat wél botst, is een kop die in de kern de zoekterm ís. Twee vormen:
//   1. Er blijft na het weghalen van de hoofdterm te weinig eigen betekenis over
//      ("Ons natuurzwembad", "Natuurzwembad aanleggen"). Dan mikt de kop op
//      precies dezelfde vraag als de landingspagina.
//   2. De hoofdterm staat er met een commercieel werkwoord tegenaan
//      ("natuurzwembad aanleggen", "natuurzwembad laten maken"). Dat is de
//      koopintentie, en die hoort bij de landingspagina.
// Staat het woord er met een eigen invalshoek omheen (een plaats, een merk, een
// project, een vraag), dan is er geen botsing en mag het gewoon blijven staan.

/** Woorden die niets zeggen over het onderwerp van een kop. */
const KOP_STOPWOORDEN = new Set([
  "de", "het", "een", "en", "of", "in", "op", "bij", "met", "voor", "van", "naar", "aan", "uit",
  "dit", "dat", "die", "deze", "ons", "onze", "je", "jouw", "uw", "we", "wij", "zo", "hoe", "wat",
  "is", "zijn", "wordt", "worden", "werd", "waarom", "welke", "over", "als", "ook", "bijvoorbeeld",
]);

/** Werkwoorden waarmee iemand een opdracht zoekt; die intentie is van de landingspagina. */
const KOOP_WOORDEN = [
  "aanleggen", "aanleg", "laten aanleggen", "aanschaffen", "kopen", "bestellen", "laten maken",
  "laten bouwen", "bouwen", "offerte", "prijs", "prijzen", "kosten", "installeren", "plaatsen",
];

function normaliseer(t: string): string {
  return (t || "").toLowerCase().replace(/[^a-z0-9à-ÿ\s]/gi, " ").replace(/\s+/g, " ").trim();
}

/**
 * Is deze kop in de kern de hoofdterm zelf?
 *
 * Geeft false als het woord er alleen ín staat met een eigen invalshoek eromheen;
 * dat is geen botsing maar precies wat een ondersteunend stuk hoort te doen.
 */
export function botstMetHoofdterm(kop: string, hoofdterm: string): boolean {
  const k = normaliseer(kop);
  const t = normaliseer(hoofdterm);
  if (!k || t.length < 3 || !k.includes(t)) return false;

  // Vorm 2: de koopintentie staat er letterlijk tegenaan.
  for (const koop of KOOP_WOORDEN) {
    if (k.includes(`${t} ${koop}`) || k.includes(`${koop} ${t}`)) return true;
  }

  // Vorm 3: de kop begint met een hoofdterm van meer dan één woord. Zo'n term is
  // de commerciële zoekfrase zelf ("natuurzwembad aanleggen"), en vooraan in een
  // titel is dat het sterkste signaal dat er bestaat; dan mikt de kop precies op
  // die zoekopdracht. Bij een hoofdterm van één generiek woord telt dit niet:
  // "Natuurzwembad in IJsselmuiden, een kijkje in dit project" begint er ook mee
  // en is juist een prima titel voor een ondersteunend stuk.
  if (t.includes(" ") && k.startsWith(t)) return true;

  // Vorm 1: haal de hoofdterm eruit en kijk wat er aan eigen betekenis overblijft.
  const rest = k.split(t).join(" ").split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !KOP_STOPWOORDEN.has(w) && !KOOP_WOORDEN.includes(w));
  return rest.length < 2;
}

/**
 * De hoofdtermen waarvan de titel, de meta-title of de H1 in de kern de zoekterm
 * zelf is.
 *
 * Apart van `controleerPlan` omdat dit het enige punt uit de poort is dat je kunt
 * hérstellen in plaats van melden: een titel is drie regels, de tekst niet. Wat
 * hier uitkomt gaat naar de herstelronde; wat daarna nog botst wordt alsnog een
 * melding voor Maarten.
 */
export function botsendeTermen(plan: OndersteunendPlan): string[] {
  const kop = eersteKop(plan.tekst);
  const uit: string[] = [];
  for (const doel of plan.doelen || []) {
    const term = (doel.hoofdterm || "").trim();
    if (!term) continue;
    if (botstMetHoofdterm(plan.titel, term) || botstMetHoofdterm(plan.metaTitle, term) || botstMetHoofdterm(kop, term)) {
      uit.push(term);
    }
  }
  return [...new Set(uit)];
}

/**
 * De poort. Wat het taalmodel belooft is niet hetzelfde als wat het levert, dus
 * de dingen waar het echt om draait worden hier nagerekend en als waarschuwing
 * teruggegeven. Er wordt niets stilgehouden en niets geweigerd: Maarten ziet wat
 * er niet klopt en beslist zelf.
 */
export function controleerPlan(plan: OndersteunendPlan): string[] {
  const uit: string[] = [];
  const kop = eersteKop(plan.tekst);
  for (const doel of plan.doelen || []) {
    const term = (doel.hoofdterm || "").trim();
    if (!term) continue;
    if (botstMetHoofdterm(plan.titel, term) || botstMetHoofdterm(plan.metaTitle, term) || botstMetHoofdterm(kop, term)) {
      uit.push(`De titel of de kop van dit stuk is in de kern "${term}" zelf. Zo mikt hij op dezelfde vraag als ${doel.url}; geef de kop een eigen invalshoek (de plaats, het project, de vraag die hij beantwoordt). Het wóórd mag er gewoon in blijven staan.`);
    }
    const naarDoel = (plan.links || []).filter((l) => (l.naar || "").includes(doel.url) || doel.url.includes(l.naar || ""));
    if (!naarDoel.length) {
      uit.push(`Er loopt geen enkele link naar ${doel.url}. Zonder die link ondersteunt dit stuk niets; het staat er dan alleen maar naast.`);
    } else if (!naarDoel.some((l) => bevatTerm(l.anker, term))) {
      uit.push(`De link naar ${doel.url} heeft de hoofdterm "${term}" niet in de linktekst. Juist dáár hoort hij te staan, want dat is het signaal dat je doorgeeft.`);
    }
    // Eén link per doelpagina, niet meer. Google telt binnen één pagina vooral de
    // eerste link naar een adres, dus een tweede voegt niets toe en leest als
    // opgevuld. Maartens woorden (21-08-2026): "niet twee keer naar dezelfde".
    if (naarDoel.length > 1) {
      uit.push(`Er staan ${naarDoel.length} links naar ${doel.url}. Eén is genoeg: een tweede link naar dezelfde pagina telt nauwelijks mee en leest als opgevuld. Houd de sterkste over.`);
    }
  }
  return uit;
}

// ═══════════════════════════════════════════════════════════
// HERSTELRONDE: EEN BOTSENDE TITEL WORDT VERVANGEN, NIET GEMELD
// ═══════════════════════════════════════════════════════════
// De poort hierboven zag het al: de hoofdterm staat nog in de titel of de H1, en
// dan blijft dit stuk concurreren met de landingspagina. Dat kwam als zin in het
// document terecht ("haal hem daar weg en laat hem alleen in de linktekst
// staan"), en dat is een opdracht aan iemand die hem niet gaat uitvoeren.
//
// Dit is het enige punt uit de poort dat je écht kunt oplossen zonder de tekst te
// herschrijven: een titel, een meta-title en een H1 zijn drie regels. Dus wordt
// er één korte ronde gedraaid die om een alternatief vraagt, en pas als dát ook
// de term nog bevat blijft er een melding over, voor Maarten, op het scherm.

const HERSTEL_SYSTEM = `Je bent SEO-specialist bij bureau Pingwin. Een blog of projectverhaal is ondersteunend gemaakt aan een landingspagina, maar de titel of de H1 bevat nog steeds de commerciële hoofdterm van die landingspagina. Zo blijven ze om hetzelfde zoekwoord vechten.

Het probleem is NIET dat het woord erin staat; dat mag en dat is vaak zelfs beter. Het probleem is dat de kop in de kern de zoekterm zélf is: er blijft te weinig eigen betekenis over als je de hoofdterm eruit haalt, of er staat een koopwerkwoord tegenaan (aanleggen, laten maken, kopen, kosten, prijzen, offerte).

Bedenk een andere titel, meta-title en H1 die exact hetzelfde stuk dekken en het onderwerp gewoon benoemen, maar met een eigen invalshoek erbij: de plaats, de klant, het type project, de vraag die het stuk beantwoordt. Het woord uit de hoofdterm mag er dus gewoon in blijven staan. Blijf bij de inhoud van het stuk; verzin geen nieuwe feiten.

Antwoord met UITSLUITEND geldige JSON:
{"titel":"de nieuwe titel","metaTitle":"maximaal 60 tekens","h1":"de nieuwe H1 boven het stuk","uitleg":"één korte regel: wat je veranderd hebt en waarom"}`;

/** De eerste kopregel in de tekst vervangen door een nieuwe H1. */
function vervangEersteKop(tekst: string, nieuweKop: string): string {
  const regels = (tekst || "").split("\n");
  for (let i = 0; i < regels.length; i++) {
    const m = regels[i].match(/^(#{1,3})\s+(.*)$/);
    if (m) { regels[i] = `${m[1]} ${nieuweKop}`; return regels.join("\n"); }
  }
  return `# ${nieuweKop}\n\n${tekst}`;
}

/**
 * Eén ronde om een botsende titel te vervangen. Geeft terug of het gelukt is.
 *
 * Het antwoord wordt nagerekend met dezelfde `bevatTerm` als de poort: lost het
 * alternatief het niet op, dan wordt er níets toegepast en blijft de melding
 * staan. Een half hersteld plan is erger dan een eerlijk gemeld plan.
 */
async function herstelBotsendeTitel(
  plan: OndersteunendPlan,
  termen: string[],
  ctx: { slug: string },
): Promise<boolean> {
  if (!termen.length) return false;
  const user = `HOOFDTERMEN DIE ER NIET IN MOGEN: ${termen.join(", ")}

HUIDIGE TITEL: ${plan.titel}
HUIDIGE META-TITLE: ${plan.metaTitle}
HUIDIGE H1: ${eersteKop(plan.tekst)}

WAAR HET STUK OVER GAAT:
${plan.tekst.slice(0, 2000)}`;
  try {
    const raw = await callClaude(HERSTEL_SYSTEM, [{ role: "user", content: user }], 700, { slug: ctx.slug, action: "ondersteunend-titel-herstel" });
    const schoon = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(schoon.slice(schoon.indexOf("{"), schoon.lastIndexOf("}") + 1)) as
      { titel?: string; metaTitle?: string; h1?: string; uitleg?: string };
    const titel = String(p.titel || "").trim();
    const metaTitle = String(p.metaTitle || "").trim();
    const h1 = String(p.h1 || "").trim();
    if (!titel || !h1) return false;
    // Nareken met dezelfde regel als de poort: botst de kop nog steeds, dan heeft
    // dit niets opgelost. Het woord zelf mag er in blijven staan.
    for (const term of termen) {
      if (botstMetHoofdterm(titel, term) || botstMetHoofdterm(metaTitle || titel, term) || botstMetHoofdterm(h1, term)) return false;
    }
    plan.titel = titel;
    if (metaTitle) plan.metaTitle = metaTitle;
    plan.tekst = vervangEersteKop(plan.tekst, h1);
    plan.wijzigingen = [
      ...plan.wijzigingen,
      String(p.uitleg || "").trim()
        || `De kop heeft een eigen invalshoek gekregen, zodat dit stuk niet meer op dezelfde vraag mikt als de landingspagina.`,
    ].slice(0, 8);
    return true;
  } catch {
    return false;
  }
}

/**
 * Regels met ## en ### omzetten naar de blokken van een Pingwin-document.
 *
 * Elke kop krijgt zijn H-nummer ervoor ("H1 · Zo blijft het water helder").
 * Zonder dat ziet de sitebouwer alleen dat iets een kop is, niet wélke, en dan
 * belandt een tussenkop als H2 terwijl hij een H3 hoort te zijn. Maartens
 * woorden (21-08-2026): "het is noodzakelijk dat alle titels de H-tags heel kort
 * voor de titel vermelden".
 *
 * Het niveau komt uit de tekst zelf: één hekje is de H1, twee is een H2, drie is
 * een H3. Dat is precies hoe de motor de tekst ook aanlevert.
 */
export function tekstNaarBlokken(tekst: string): DocBlock[] {
  const blokken: DocBlock[] = [];
  let bullets: string[] = [];
  const legen = () => {
    if (bullets.length) { blokken.push({ type: "bullets", items: bullets }); bullets = []; }
  };
  for (const ruw of (tekst || "").split("\n")) {
    const regel = ruw.trim();
    if (!regel) { legen(); continue; }
    const kop = regel.match(/^(#{1,6})\s+(.*)$/);
    if (kop) {
      legen();
      const niveau = kop[1].length;
      const naam = kop[2].trim().replace(/^H[1-6]\s*[·:.-]?\s*/i, "");
      blokken.push({ type: "subheading", text: `H${niveau} · ${naam}` });
      continue;
    }
    const punt = regel.match(/^[-*]\s+(.*)$/);
    if (punt) { bullets.push(punt[1].trim()); continue; }
    legen();
    blokken.push({ type: "paragraph", text: regel });
  }
  legen();
  return blokken;
}

/**
 * De feitelijke tabel "titel, koppen en meta's": wat er stond en wat er nu staat.
 *
 * Waarom dit uit CODE komt en niet uit het taalmodel: het document sprak zichzelf
 * tegen. Bovenaan stond dat de titel gewijzigd was, verderop dat de H1
 * grotendeels ongewijzigd was, en of de hoofdterm er nu wel of niet in zat werd
 * op twee plekken anders beschreven. Maartens woorden (21-08-2026): "dan moet je
 * het ook consistent vermelden met wat er is aangepast of niet". Feiten die het
 * dashboard zelf kan vaststellen, hoort het niet aan een tekstschrijver te
 * vragen. Het model schrijft daarom niets meer over deze vier velden.
 */
function veldenTabel(plan: OndersteunendPlan, oudeTitel: string, oudeKop: string): string[][] {
  const nieuweKop = eersteKop(plan.tekst);
  const regel = (veld: string, was: string, wordt: string): string[] => {
    const w = (was || "").trim();
    const n = (wordt || "").trim();
    if (!n) return [veld, w || "niet bekend", "niet ingevuld"];
    if (!w) return [veld, "stond er niet", n];
    return [veld, w, n === w ? "ongewijzigd" : n];
  };
  return [
    regel("Titel van het stuk", oudeTitel, plan.titel),
    regel("H1 boven het stuk", oudeKop, nieuweKop),
    regel("Paginatitel (meta-title)", "", plan.metaTitle),
    regel("Meta-description", "", plan.metaDescription),
  ];
}

/** De steuntermen kort houden; een waslijst in een smalle kolom leest niemand. */
function steunKolom(termen: string[]): string {
  const schoon = (termen || []).map((t) => t.trim()).filter(Boolean);
  if (!schoon.length) return "niet bepaald";
  const eerste = schoon.slice(0, 3);
  const rest = schoon.length - eerste.length;
  return eerste.join(", ") + (rest > 0 ? `, en ${rest} andere vragen rond dit onderwerp` : "");
}

/** Wat we van een doelpagina weten: waar hij nu op gevonden wordt en wat erop staat. */
async function doelBeeld(domain: string, url: string): Promise<string> {
  const [meting, gsc] = await Promise.all([
    measurePage(url).catch(() => null),
    domain ? getGscForPage(domain, url, 90).catch(() => []) : Promise.resolve([]),
  ]);
  const regels: string[] = [`PAGINA: ${url}`];
  if (meting?.ok) {
    regels.push(`Titel: ${meting.metaTitle || "(geen)"} (${meting.titleLength} tekens)`);
    // De meta-description hoort erbij sinds het document zelf een betere meta
    // mag meeleveren in plaats van hem aan te bevelen: zonder de huidige tekst
    // kun je niet zien of hij beter kan.
    regels.push(`Meta-description: ${meting.metaDescription || "(geen)"} (${meting.descriptionLength} tekens)`);
    if (meting.h1?.length) regels.push(`H1: ${meting.h1.join(" | ")}`);
    if (meting.h2?.length) regels.push(`Koppen: ${meting.h2.slice(0, 12).join(" | ")}`);
  } else {
    regels.push("Deze pagina kon niet gelezen worden (bestaat hij al?); ga uit van de zoekwoorden en de URL.");
  }
  const top = (gsc || []).sort((a, b) => b.impressions - a.impressions).slice(0, 12);
  if (top.length) {
    regels.push("Waar deze pagina nu op gevonden wordt (Search Console, 90 dagen):");
    for (const k of top) regels.push(`  ${k.keyword} (positie ${k.position.toFixed(1)}, ${k.impressions} vertoningen, ${k.clicks} klikken)`);
  } else {
    regels.push("Nog geen Search Console-cijfers voor deze pagina.");
  }
  return regels.join("\n");
}

export async function maakOndersteunend(opts: {
  slug: string;
  versieId: number;
  doelUrls: string[];
  zoekwoorden?: string;
  folderId?: string;
}): Promise<{ ok: boolean; error?: string; plan?: OndersteunendPlan; link?: string; naam?: string }> {
  const { slug, versieId } = opts;
  const doelUrls = (opts.doelUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 2);
  if (!doelUrls.length) return { ok: false, error: "Kies eerst de landingspagina die dit stuk moet ondersteunen." };

  await ensureSchema();
  const { rows } = await sql`
    SELECT url, kind, naam, tekst FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${versieId} LIMIT 1`;
  const versie = rows[0];
  if (!versie) return { ok: false, error: "Dit document staat niet meer in de lijst." };
  const bron = String(versie.tekst || "").trim();
  if (!bron) return { ok: false, error: "Van dit document is geen leesbare tekst bewaard, dus er valt niets aan te passen." };

  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const beelden = await Promise.all(doelUrls.map((u) => doelBeeld(domain, u)));

  const user = `KLANT: ${client?.name || slug}${domain ? ` (${domain})` : ""}

DE LANDINGSPAGINA('S) DIE STERKER MOETEN WORDEN:
${beelden.join("\n\n")}
${opts.zoekwoorden?.trim() ? `\nMaarten geeft deze zoekwoorden mee als de termen waarop die pagina('s) moeten winnen: ${opts.zoekwoorden.trim()}\n` : ""}
HET AANGELEVERDE STUK (${versie.naam || "zonder naam"}):
${bron.slice(0, 16000)}`;

  let plan: OndersteunendPlan;
  try {
    const raw = await callClaude(SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "ondersteunend-maken" });
    const schoon = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(schoon.slice(schoon.indexOf("{"), schoon.lastIndexOf("}") + 1)) as Partial<OndersteunendPlan>;
    plan = {
      kop: String(p.kop || "").trim() || "Dit stuk is ondersteunend gemaakt.",
      doelen: (Array.isArray(p.doelen) ? p.doelen : []).map((d) => ({
        url: String(d?.url || "").trim(),
        hoofdterm: String(d?.hoofdterm || "").trim(),
        steuntermen: (Array.isArray(d?.steuntermen) ? d.steuntermen : []).map(String).slice(0, 4),
      })).filter((d) => d.url),
      titel: String(p.titel || "").trim() || String(versie.naam || "Aangepast stuk"),
      metaTitle: String(p.metaTitle || "").trim(),
      metaDescription: String(p.metaDescription || "").trim(),
      wijzigingen: (Array.isArray(p.wijzigingen) ? p.wijzigingen : []).map(String).slice(0, 6),
      links: (Array.isArray(p.links) ? p.links : []).map((l) => ({
        naar: String(l?.naar || "").trim(), anker: String(l?.anker || "").trim(), plek: String(l?.plek || "").trim(),
      })).filter((l) => l.naar),
      linksNaarBlog: (Array.isArray(p.linksNaarBlog) ? p.linksNaarBlog : []).map((l) => ({
        van: String(l?.van || "").trim(), anker: String(l?.anker || "").trim(),
      })).filter((l) => l.van).slice(0, 5),
      landingMetas: (Array.isArray(p.landingMetas) ? p.landingMetas : []).map((m) => ({
        url: String(m?.url || "").trim(),
        metaTitle: String(m?.metaTitle || "").trim(),
        metaDescription: String(m?.metaDescription || "").trim(),
      })).filter((m) => m.url && (m.metaTitle || m.metaDescription)).slice(0, 2),
      waarschuwingen: (Array.isArray(p.waarschuwingen) ? p.waarschuwingen : []).map(String).slice(0, 5),
      tekst: String(p.tekst || "").trim(),
    };
  } catch (e) {
    return { ok: false, error: "Het aanpassen lukte niet: " + (e instanceof Error ? e.message : "onbekende fout") };
  }
  if (!plan.tekst) return { ok: false, error: "Er kwam geen aangepaste tekst terug; probeer het nog een keer." };

  // Geen doelen teruggekregen? Dan valt er ook niets na te rekenen, dus vullen we
  // ze aan met wat Maarten koos. Zonder dit zou de poort stilzwijgend niets doen.
  if (!plan.doelen.length) plan.doelen = doelUrls.map((u) => ({ url: u, hoofdterm: "", steuntermen: [] }));

  // Botst de titel nog met de landingspagina, dan eerst één ronde om een ander
  // voorstel vragen. Melden dat het niet kan is de laatste stap, niet de eerste.
  const botsend = botsendeTermen(plan);
  if (botsend.length) await herstelBotsendeTitel(plan, botsend, { slug });

  plan.waarschuwingen = [...plan.waarschuwingen, ...controleerPlan(plan)];

  // Het document: eerst wat er veranderd is en wat de sitebouwer moet doen, dan
  // pas de tekst zelf. Andersom scrolt niemand tot de instructie.
  // Wat er stond vóór onze ronde: de bestandsnaam is de titel zoals de klant hem
  // aanleverde, en de eerste kop in de brontekst is de H1. Weten we het niet, dan
  // zegt de tabel dat eerlijk in plaats van iets te suggereren.
  const oudeTitel = String(versie.naam || "").replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  const oudeKop = eersteKop(bron);
  const velden = veldenTabel(plan, oudeTitel, oudeKop);

  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Ondersteunende publicatie",
    titel: plan.titel,
    ondertitel: `Ondersteunend aan ${doelUrls.join(" en ")}`,
    meta: { Klant: client?.name || slug, Ondersteunt: doelUrls.join(", ") },
    stijl: "werkdocument",
    sections: [
      {
        heading: "Wat dit stuk doet",
        blocks: [
          { type: "highlight", text: plan.kop },
          // De derde kolom was een komma-lijst van tien tot vijftien termen in een
          // smalle kolom; die leest niemand. Nu hooguit drie, met een korte zin
          // als er meer zijn (zie steunKolom).
          ...(plan.doelen.length ? [{
            type: "table" as const,
            headers: ["Landingspagina", "Blijft de baas op", "Dit stuk mikt op"],
            rows: plan.doelen.map((d) => [pad(d.url), d.hoofdterm || "niet bepaald", steunKolom(d.steuntermen)]),
          }] : []),
          // Titel, H1 en de meta's: één tabel met wat er stond en wat er nu staat,
          // door het dashboard zelf ingevuld. Dit stond eerder verspreid in de
          // geschreven tekst, en die sprak zichzelf tegen (zie veldenTabel).
          { type: "subheading" as const, text: "Titel, kop en meta's" },
          { type: "table" as const, headers: ["Veld", "Stond er", "Staat er nu"], rows: velden },
          // Hier stond ook een kopje "Let op" met de waarschuwingen eronder. Dat
          // document gaat naar de klant en naar de sitebouwer, en dan lees je
          // daar aanbevelingen die wíj hadden moeten doen, of een interne
          // afweging over de linkstrategie. Beide roepen dezelfde vraag op:
          // "moet ik hier zelf nog iets mee?" Wat er te doen viel is nu gedaan
          // en staat hierboven; wat er overblijft is voor Maarten en staat op
          // het scherm bij het document. Zet dit kopje hier nooit terug.
          ...(plan.wijzigingen.length ? [{ type: "subheading" as const, text: "Wat er in de tekst is aangepast" }, { type: "bullets" as const, items: plan.wijzigingen }] : []),
        ],
      },
      {
        heading: "Voor de sitebouwer",
        blocks: [
          { type: "table", headers: ["Veld", "Waarde"], rows: [
            ["Titel van het stuk", plan.titel],
            ["H1 boven het stuk", eersteKop(plan.tekst) || plan.titel],
            ["Paginatitel (meta-title)", plan.metaTitle || "niet ingevuld"],
            ["Meta-description", plan.metaDescription || "niet ingevuld"],
          ] },
          // Kant-en-klaar, geen aanbeveling: staat hier alleen als de huidige
          // meta van de landingspagina echt beter kan.
          ...(plan.landingMetas.length ? [
            { type: "subheading" as const, text: "Ook overnemen op de landingspagina" },
            { type: "table" as const, headers: ["Pagina", "Veld", "Waarde"], rows: plan.landingMetas.flatMap((m) => [
              ...(m.metaTitle ? [[pad(m.url), "Paginatitel (meta-title)", m.metaTitle]] : []),
              ...(m.metaDescription ? [[pad(m.url), "Meta-description", m.metaDescription]] : []),
            ]) },
          ] : []),
          ...(plan.links.length ? [
            { type: "subheading" as const, text: "Links vanuit dit stuk" },
            { type: "table" as const, headers: ["Naar", "Linktekst", "Waar"], rows: plan.links.map((l) => [l.naar, l.anker, l.plek]) },
          ] : []),
          ...(plan.linksNaarBlog.length ? [
            { type: "subheading" as const, text: "Pagina's die naar dit stuk mogen linken" },
            { type: "table" as const, headers: ["Vanaf", "Linktekst"], rows: plan.linksNaarBlog.map((l) => [l.van, l.anker]) },
          ] : []),
        ],
      },
      { heading: "De aangepaste tekst", blocks: tekstNaarBlokken(plan.tekst) },
    ],
  };

  let buffer: Buffer;
  try {
    buffer = await buildPingwinDoc(spec);
  } catch (e) {
    return { ok: false, error: "Het document kon niet opgemaakt worden: " + (e instanceof Error ? e.message : "onbekende fout") };
  }

  // De map: wat Maarten in het venster koos, en anders de map die al bij deze
  // pagina of taak hoort. Zonder map geen bestand, en dat zeggen we ook.
  let folderId = (opts.folderId || "").trim();
  if (!folderId) {
    const opgeslagen = await getPageDriveFolder(slug, String(versie.url)).catch(() => null);
    folderId = opgeslagen?.folderId || "";
  }
  if (!folderId) {
    return { ok: false, error: "Er is nog geen Drive-map gekozen om dit in op te slaan. Kies er een bij \"Opslaan in\" en start opnieuw." };
  }

  const bestandsnaam = `${(client?.name || slug).replace(/[^\w\s-]/g, "").trim()}-ondersteunend-${plan.titel.replace(/[^\w\s-]/g, "").trim().slice(0, 60)}.docx`;
  let link = "";
  try {
    ({ link } = await uploadDocx(folderId, bestandsnaam, buffer));
  } catch (e) {
    return { ok: false, error: "Document gemaakt, maar het opslaan in Drive mislukte: " + (e instanceof Error ? e.message : "onbekende fout") };
  }

  // Als nieuw document in dezelfde taak, mét de doelpagina in de naam. Het
  // aangeleverde stuk blijft gewoon staan: er wordt nooit iets overschreven.
  const naam = `${plan.titel} (ondersteunend aan ${doelUrls.map(pad).join(" en ")})`;
  // De bron erbij: dit stuk komt voort uit dát document, en hoort er in de lijst
  // dus pal onder te staan. Uit de naam afleiden werkt hier juist níet, want een
  // ondersteunende versie krijgt vaak een andere titel; dat is het hele punt.
  await registerGeneratedVersion(slug, String(versie.url), String(versie.kind || "copy"), naam, link, plan.tekst, plan.kop, versieId)
    .catch(() => { /* het bestand staat er; de lijst vult zich bij de volgende ronde */ });

  return { ok: true, plan, link, naam };
}

/** Alleen het pad, want een hele URL in een documentnaam leest niet. */
function pad(u: string): string {
  try { return new URL(u).pathname; } catch { return u; }
}
