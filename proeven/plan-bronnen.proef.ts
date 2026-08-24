import fs from "node:fs";
import path from "node:path";
import { driveLinksUit } from "../lib/drive-id";

// ═══════════════════════════════════════════════════════════
// EEN AANGELEVERD DOCUMENT GAAT VANZELF MEE, IN ELKE FASE
// ═══════════════════════════════════════════════════════════
// Noem je bij een pagina een Google-document, dan hoort dat document bij die
// pagina en loopt het mee in de strategie-chat, de analyse, de blauwdruk en de
// copy. Zonder knop, zonder erop letten, zonder zorgen dat het in het juiste
// veld staat.
//
// Tot 24-08-2026 was een link in het strategieveld dode tekst: het adres ging
// mee, de inhoud niet. Het document rolde er gewoon uit, dus je zag niet dat je
// afspraken nooit waren meegewogen. Deze proef houdt de hele ketting vast,
// inclusief de vier plekken waar het stilletjes weer stuk kan gaan.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. Een link herkennen, waar hij ook staat ──
const tekst = `**Rol:** pillarpage hovenier
- https://docs.google.com/document/d/1a3DLZ62wPIS_t7BeT6udIhBmR_yURIMMhi6RpgS0jDc/edit?tab=t.0#heading=h.goj1
- <a href="https://docs.google.com/spreadsheets/d/1PrWFH1ORFXYz72ngZLX6mhZitZNNeFzfuEeUkFar1Gg/edit?gid=983979620#gid=983979620">register</a>
- https://docs.google.com/document/d/1a3DLZ62wPIS_t7BeT6udIhBmR_yURIMMhi6RpgS0jDc/edit (zelfde stuk)
Zie ook https://kamsteegtuinen.nl/hovenier/ voor de huidige pagina.`;
const gevonden = driveLinksUit(tekst);

check("een link in lopende tekst wordt herkend",
  gevonden.some((g) => g.id === "1a3DLZ62wPIS_t7BeT6udIhBmR_yURIMMhi6RpgS0jDc"),
  "Anders gaat alleen het adres mee de fase in en niets van de inhoud.");

check("een link in een href wordt óók herkend",
  gevonden.some((g) => g.id === "1PrWFH1ORFXYz72ngZLX6mhZitZNNeFzfuEeUkFar1Gg"),
  "Een geplakte link staat in een opmaakbaar veld als HTML.");

check("hetzelfde document twee keer telt als één",
  gevonden.length === 2,
  `Twee adressen naar hetzelfde stuk is één document; gevonden: ${gevonden.length}.`);

check("een gewone website-link wordt met rust gelaten",
  !gevonden.some((g) => g.link.includes("kamsteegtuinen.nl")),
  "Die leest de motor zelf al.");

check("een pagina zonder document levert niets op",
  driveLinksUit("**Rol:** locatiepagina Zundert").length === 0,
  "Zo'n pagina hoort exact dezelfde context te houden als voorheen.");

// ── 2. Het systeem zoekt zelf, de gebruiker hoeft nergens op te letten ──
const bron = lees("lib/plan-bronnen.ts");

check("er wordt in de strategie, de gesprekken, het advies én de sturing gezocht",
  /getPagePlan/.test(bron) && /chatTekstVoorPagina/.test(bron) && /getPageClusterAdvice/.test(bron) && /\[plan, extra, adviesTekst, chats\]/.test(bron),
  "Eén keer noemen moet genoeg zijn, waar dan ook; anders moet iemand er alsnog op letten.");

check("het document wordt uitgewerkt tot een briefing voor déze pagina",
  /BRIEFING_SYSTEM/.test(bron) && /async function maakBriefing/.test(bron),
  "Doorgeven van rauwe tekst is niet hetzelfde als duiden wat er voor deze pagina uit volgt.");

check("de briefing wordt bewaard en vervalt op de inhoud",
  /page_bron_briefing/.test(bron) && /function vingerafdruk/.test(bron),
  "Zonder kast betaalt elke fase de wachttijd; op een datum stempelen mist een gewijzigde inhoud.");

check("de interne links moeten uitgeschreven worden, niet samengevat",
  /UITGESCHREVEN uit, één regel per link/.test(bron),
  "Juist de ankerteksten en bestemmingen sneuvelen als eerste in een samenvatting.");

check("een onvervulde voorwaarde wordt gemeld in plaats van verzwegen",
  /VOORWAARDE waaraan nog niet voldaan is/.test(bron),
  "Staat er 'niet schrijven zonder twee projecten', dan moet dat bovenaan het stuk komen.");

check("een openbaar document werkt ook zonder de Drive-koppeling",
  /async function openbaarUitgelezen/.test(bron) && /export\?format=/.test(bron),
  "Een gewone fetch op een Google-adres geeft de schil van de bewerkomgeving terug, geen tekst.");

check("er wordt nooit stil afgekapt",
  /hier afgekapt na/.test(bron) && /LET OP: er horen nog/.test(bron) && /NIET GELEZEN/.test(bron),
  "Een model dat niet weet dat het de helft ziet, schrijft rustig verder alsof het alles zag.");

check("de ruimte is ruim genoeg voor een heel register",
  /MAX_PER_DOC = 120000/.test(bron) && /MAX_RUW_IN_FASE = 120000/.test(bron),
  "Een blauwdruk of linkregister moet er in zijn geheel in passen.");

// ── 3. Een werkblad komt compleet binnen, niet alleen het eerste tabblad ──
const drive = lees("lib/drive.ts");

check("een sheet wordt met álle tabbladen uitgelezen",
  /sheetAlsHtml/.test(drive) && /htmlTabellenNaarTekst/.test(drive),
  "Drive exporteert een sheet naar CSV, en dat is alleen het eerste tabblad; een linkregister heeft er drie.");

check("een rij uit een werkblad blijft een rij",
  /cellen\.join\(" \| "\)/.test(drive),
  "Cel-voor-cel op een eigen regel maakt een register onleesbaar.");

// ── 4. Alle fases gebruiken het ──
const doc = lees("lib/page-doc.ts");
const ground = lees("lib/page-chat-ground.ts");

check("analyse, blauwdruk en copy krijgen het mee",
  /bronContext\(slug, url, extra\)/.test(doc),
  "Die drie bouwen allemaal op buildContext; daar hoort het in.");

check("de strategie-chat krijgt het ook mee",
  /bronContext\(slug, url\)/.test(ground),
  "Daar begint het gesprek over de pagina; zonder de documenten praat je daar op aannames.");

check("de chat weet dat hij een Google-document zelf mag openen",
  /lees_document/.test(ground),
  "Vangnet voor een document dat pas in dit gesprek genoemd wordt.");

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} punt(en) mis.`);
if (fouten > 0) process.exit(1);
