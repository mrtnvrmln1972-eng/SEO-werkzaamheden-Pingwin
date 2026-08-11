// Proef op de copy-briefing voor de klant.
//
// Aanleiding: de briefing van 11 augustus 2026 voor Kamsteeg
// (/hovenier/oosterhout/). Daarin ging vier dingen mis die alle vier alleen door
// een regel in een document bewaakt werden, en dus terugkwamen:
//
//   1. De hele uitleg stond er twee keer in: één keer vers opgebouwd, één keer
//      uit het opgeslagen copy-document.
//   2. De niveau-aanduidingen H1/H2/H3 stonden ook boven de hoofdstukken van de
//      briefing zelf, terwijl die aanduiding een instructie aan de sitebouwer is
//      en dus alleen bij echte paginatekst hoort.
//   3. De metadata-tabel bevatte ons eigen oordeel over onze eigen tekst
//      ("te kort, ruimte onbenut").
//   4. De openingstekst liep onder zijn kader uit, omdat de hoogte van dat kader
//      geschat werd met te veel tekens per regel en een te lage regelhoogte.
//
// Deze proef draait vóór elke bouw; zolang hij groen is, kan geen van de vier
// terugkomen.

import { metaRegels, metaVerificatie, webtekstSecties, OORDEEL_WOORDEN } from "../lib/copy-briefing";
import { hoogteVan } from "../lib/huisstijl/vorm";
import { buildPingwinDoc, type DocSection, type DocSpec } from "../lib/pingwin-docx";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

// ── 1 en 2: ontdubbelen ────────────────────────────────────────────
// Nagebouwd naar het echte Kamsteeg-document: eerst de briefing-hoofdstukken,
// dan de webteksten met de meta bovenaan.
const DOCUMENT: DocSection[] = [
  { heading: "H1 — Landingspagina-copy — Hovenier Oosterhout", blocks: [{ type: "paragraph", text: "Op basis van de SEO-analyse, de blauwdruk en de top 10-analyse hebben we deze copy ontwikkeld." }] },
  { heading: "H2 — 1. Waar de nieuwe teksten over gaan", blocks: [{ type: "paragraph", text: "Deze pagina trekt alle hovenier-zoekopdrachten voor Oosterhout samen." }] },
  { heading: "H2 — 2. Welke zoekwoorden erin verwerkt zijn", blocks: [{ type: "bullets", items: ["hovenier oosterhout — primair"] }] },
  { heading: "H2 — 3. Wat dit voor jullie vindbaarheid betekent", blocks: [{ type: "paragraph", text: "De pagina bestaat momenteel niet." }] },
  { heading: "H2 — 4. De volledige webteksten (lees na en corrigeer)", blocks: [
    { type: "subheading", text: "H3 — Meta-title" },
    { type: "paragraph", text: "Hovenier in Oosterhout - Kamsteeg Tuinen" },
    { type: "subheading", text: "H3 — Meta-description" },
    { type: "paragraph", text: "Hovenier Oosterhout: tuinaanleg, ontwerp en onderhoud." },
    { type: "subheading", text: "H1 — Hovenier in Oosterhout" },
    { type: "paragraph", text: "Zoekt u een hovenier in Oosterhout? Kamsteeg Tuinen ontwerpt en onderhoudt." },
    { type: "subheading", text: "H2 — Tuinaanleg in Oosterhout" },
    { type: "paragraph", text: "Wij leggen uw tuin volledig aan." },
  ] },
];

const uit = webtekstSecties(DOCUMENT);

check("de briefing-hoofdstukken vallen weg", uit.length, 1);
check("de kop 'volledige webteksten' vervalt (het document zet er zijn eigen boven)", uit[0].heading, undefined);
check("de meta staat niet nog een tweede keer bij de webteksten",
  uit[0].blocks.some((b) => b.type === "subheading" && /meta-/i.test(b.text)), false);
check("de waarde van de meta gaat mee weg, niet als losse zin achterblijven",
  uit[0].blocks.some((b) => b.type === "paragraph" && /Kamsteeg Tuinen$/.test(b.text)), false);
check("de echte paginakoppen blijven mét hun niveau-aanduiding",
  uit[0].blocks.filter((b) => b.type === "subheading").map((b) => (b as { text: string }).text).join(" | "),
  "H1 — Hovenier in Oosterhout | H2 — Tuinaanleg in Oosterhout");
check("de paginatekst zelf blijft volledig staan",
  uit[0].blocks.filter((b) => b.type === "paragraph").length, 2);

// Zonder de kop "volledige webteksten" (ouder document): alleen de herkende
// briefing-hoofdstukken vallen weg, de rest blijft ongemoeid.
const ZONDER_KOP: DocSection[] = [
  { heading: "H2 — 1. Waar de nieuwe teksten over gaan", blocks: [{ type: "paragraph", text: "uitleg" }] },
  { heading: "H1 — Hovenier in Oosterhout", blocks: [{ type: "paragraph", text: "de echte tekst" }] },
  { heading: "H2 — Onze werkwijze", blocks: [{ type: "paragraph", text: "stap voor stap" }] },
];
check("zonder die kop blijft alles staan behalve de briefing",
  webtekstSecties(ZONDER_KOP).map((s) => s.heading).join(" | "),
  "H1 — Hovenier in Oosterhout | H2 — Onze werkwijze");

// ── 3: geen oordeel over eigen werk in de tabel ────────────────────
const TITEL = "Hovenier in Oosterhout - Kamsteeg Tuinen";        // 380 px: te kort
const DESC = "Hovenier Oosterhout: tuinaanleg, ontwerp & onderhoud. 30 jaar ervaring, eigen team. Vraag gratis advies aan.";
const regels = metaRegels(TITEL, DESC);

check("de tabel heeft drie kolommen: element, tekst, lengte", regels[0].length, 3);
check("de opgeleverde tekst staat er onveranderd in", regels[0][1], TITEL);
check("de meting staat er als feit bij", /^\d+ tekens, \d+ px$/.test(regels[0][2]), true);
check("er staat nergens een afkeuring van eigen werk", OORDEEL_WOORDEN.test(regels.flat().join(" ")), false);
check("ook niet bij de omschrijving", OORDEEL_WOORDEN.test(regels[1].join(" ")), false);

// ── 4: het kader is hoog genoeg voor zijn tekst ────────────────────
// De echte openingstekst van de briefing, in het echte callout-kader.
const OPENING = "Op basis van de SEO-analyse, de blauwdruk en de top 10-analyse hebben we deze copy ontwikkeld die voldoet aan de perfecte invulling voor deze pagina. Uiteraard heb jij veel meer verstand van jouw vak en je bedrijf dan wij, dus vragen we je wel om deze teksten goed door te nemen en aan te passen waar nodig. Als je deze teksten (al dan niet aangepast) terugstuurt, dan zullen wij ze op de juiste, SEO-geoptimaliseerde manier in de website verwerken.";
const KADER = { breedte: 606, font: 14, regel: 21.5, extra: 38 };
const hoogte = OPENING ? hoogteVan(OPENING, KADER) : 0;

// Zes regels van 21,5 px plus de marges is het minimum waarop deze tekst past;
// de oude schatting kwam op 40 + 5 x 17 = 125 px en liep dus over.
check("de openingstekst krijgt ruimte voor minstens zes regels", hoogte >= 6 * 21.5 + KADER.extra, true);
check("maar het kader wordt ook niet absurd hoog", hoogte < 12 * 21.5 + KADER.extra, true);
check("een lege tekst geeft nog steeds een werkbaar kader", hoogteVan("", KADER) >= 46, true);
check("regeleindes in de tekst tellen mee",
  hoogteVan("een\ntwee\ndrie", KADER) > hoogteVan("een", KADER), true);

// ── 5: de verificatie van de criteria ──────────────────────────────
const T_GOED = "Hovenier Oosterhout: tuinaanleg en onderhoud - Kamsteeg";
const D_GOED = "Hovenier Oosterhout nodig? Kamsteeg Tuinen ontwerpt, legt aan en onderhoudt met een eigen team en 30 jaar ervaring. Vraag vandaag gratis advies aan.";
const goed = metaVerificatie(T_GOED, D_GOED, { keyword: "hovenier oosterhout", h1: "Hovenier in Oosterhout" });
check("de verificatie toetst de volledige criterialijst", goed.regels.length >= 12, true);
check("en die is voor deze teksten helemaal groen", goed.allesGoed, true);
check("er staat nergens een kruisje in", goed.regels.flat().some((c) => c.includes("✗")), false);
check("de pixelbreedte staat er expliciet bij",
  goed.regels.some((r) => /venster van Google/.test(r[1]) && /px/.test(r[2])), true);

const slecht = metaVerificatie(TITEL, DESC, { keyword: "hovenier oosterhout" });
check("een tekst die de lat niet haalt, komt niet als groen door", slecht.allesGoed, false);

// ── 6: geen tabel binnen een kader ─────────────────────────────────
// De titel en het nummer van een stapkaart stonden in een tabelletje ín de vorm.
// Dat is geldig, maar niet elke lezer tekent het: in de voorvertoning verdwenen
// de titels en bleven er vier naamloze blokken over. Titels horen buiten het
// kader; deze proef houdt ze daar.
const PROEFSPEC: DocSpec = {
  klant: "Proef", rapporttype: "Copy-briefing", titel: "Proefdocument",
  stijl: "werkdocument",   // geen omslag, dus geen browser nodig
  sections: [{ heading: "Hoe deze nieuwe tekst tot stand kwam", blocks: [
    { type: "step", nr: 1, title: "We beginnen bij de strategie", text: "Een tekst van enige lengte, zodat het kader ook echt iets moet omvatten en de hoogte gemeten wordt." },
    { type: "highlight", text: "Een callout met wat tekst erin." },
  ] }],
};

buildPingwinDoc(PROEFSPEC).then(async (buf) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zip = await require("jszip").loadAsync(buf);
  const xml: string = await zip.file("word/document.xml").async("string");
  check("geen tabel binnen een kader", (xml.match(/<w:txbxContent><w:tbl>/g) || []).length, 0);
  check("de titel van de stapkaart staat er wél in", xml.includes("We beginnen bij de strategie"), true);
  check("het kader zelf staat er ook", /name="Stap 1"/.test(xml), true);
  console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
  process.exit(fouten === 0 ? 0 : 1);
}).catch((e) => {
  console.log("FOUT | het proefdocument kon niet gebouwd worden:", (e as Error).message);
  process.exit(1);
});
