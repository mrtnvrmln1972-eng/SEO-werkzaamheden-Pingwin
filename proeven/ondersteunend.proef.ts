// ═══════════════════════════════════════════════════════════
// EEN ONDERSTEUNEND STUK MAG DE LANDINGSPAGINA NIET AFPAKKEN
// ═══════════════════════════════════════════════════════════
// De knop "Ondersteunend maken" bij een document doet iets waar je pas maanden
// later achter komt als het fout gaat: hij bepaalt of een blog de landingspagina
// versterkt of hem juist zijn plek in Google afpakt. Het verschil zit in vier
// dingen, en die zijn alle vier te meten:
//
//   1. geen enkele kop van de blog is in de kern de zoekterm zelf; het WOORD mag
//      er gewoon in staan (zie botstMetHoofdterm en de uitleg verderop);
//   2. er loopt vanuit de blog een link naar die landingspagina (zonder link
//      ondersteunt er niets, dan staat het stuk er alleen maar naast);
//   3. de hoofdterm staat juist WEL in de linktekst, want dat is het signaal dat
//      je doorgeeft;
//   4. het is er precies één, want een tweede link naar dezelfde pagina telt
//      nauwelijks mee en leest als opgevuld.
//
// Die vier worden in code nagerekend (`controleerPlan`) en niet aan het
// taalmodel overgelaten: een instructie in een prompt is een verzoek, geen poort.
// Deze proef bewaakt dat die controle blijft werken. Gaat hij stuk, dan levert
// de knop stukken op die er goed uitzien en precies het tegenovergestelde doen.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { botsendeTermen, botstMetHoofdterm, controleerPlan, tekstNaarBlokken } from "../lib/ondersteunend";
import { groepeer } from "../lib/doc-groepen";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const DOEL = "https://voorbeeld.nl/natuurzwembad-aanleggen/";

/** Een plan dat het goed doet: de blog gaat over het onderhoud, en linkt met de
    hoofdterm naar de pagina die daarover gaat. */
function goedPlan() {
  return {
    kop: "Dit stuk pakt de onderhoudsvragen en stuurt de aanvragen door.",
    doelen: [{ url: DOEL, hoofdterm: "natuurzwembad aanleggen", steuntermen: ["natuurzwembad onderhouden", "welke planten"] }],
    titel: "Zo houd je een natuurzwembad helder zonder chloor",
    metaTitle: "Natuurzwembad onderhouden: zo blijft het water helder",
    metaDescription: "Wat een natuurzwembad nodig heeft per seizoen.",
    wijzigingen: ["Titel gericht op onderhoud in plaats van op aanleg."],
    links: [{ naar: DOEL, anker: "een natuurzwembad aanleggen", plek: "in de alinea over de start" }],
    linksNaarBlog: [],
    landingMetas: [],
    waarschuwingen: [],
    tekst: "## Zo houd je een natuurzwembad helder\n\nEen alinea.",
  };
}

const schoon = controleerPlan(goedPlan());
proef("een goed plan levert geen waarschuwingen op", schoon.length === 0, schoon.join(" | "));

// 1. De hoofdterm in de titel: dan concurreren ze alsnog.
const inTitel = goedPlan();
inTitel.titel = "Natuurzwembad aanleggen: waar je op moet letten";
const rTitel = controleerPlan(inTitel);
proef("hoofdterm in de titel wordt gemeld", rTitel.some((r) => r.includes("titel")), rTitel.join(" | "));

// Ook als hij alleen in de eerste kop van de tekst staat; die wordt de H1.
const inKop = goedPlan();
inKop.tekst = "## Natuurzwembad aanleggen in het kort\n\nEen alinea.";
proef("hoofdterm in de eerste kop wordt gemeld", controleerPlan(inKop).length > 0);

// En in de meta-title, want dat is wat Google in de zoekresultaten leest.
const inMeta = goedPlan();
inMeta.metaTitle = "Natuurzwembad aanleggen | Voorbeeld";
proef("hoofdterm in de meta-title wordt gemeld", controleerPlan(inMeta).length > 0);

// 2. Geen link naar de doelpagina: dan ondersteunt het stuk niets.
const zonderLink = goedPlan();
zonderLink.links = [];
const rZonder = controleerPlan(zonderLink);
proef("een ontbrekende link wordt gemeld", rZonder.some((r) => r.includes("geen enkele link")), rZonder.join(" | "));

// 3. Wel een link, maar met een nietszeggende ankertekst.
const slechtAnker = goedPlan();
slechtAnker.links = [{ naar: DOEL, anker: "lees meer", plek: "onderaan" }];
const rAnker = controleerPlan(slechtAnker);
proef("een link zonder de hoofdterm in de linktekst wordt gemeld",
  rAnker.some((r) => r.includes("linktekst")), rAnker.join(" | "));

// ── Eén link per doelpagina, niet twee (21-08-2026) ─────────────────────────
// Google telt binnen één stuk vooral de eerste link naar een adres, dus een
// tweede voegt niets toe en leest als opgevuld. Maartens woorden: "niet twee
// keer naar dezelfde".
const teVeel = goedPlan();
teVeel.links = [1, 2].map((n) => ({ naar: DOEL, anker: "natuurzwembad aanleggen", plek: `alinea ${n}` }));
const rTeVeel = controleerPlan(teVeel);
proef("twee links naar dezelfde pagina wordt gemeld", rTeVeel.some((r) => /Eén is genoeg/.test(r)), rTeVeel.join(" | "));
proef("één link is goed", controleerPlan(goedPlan()).length === 0);

// Twee doelpagina's: elk krijgt zijn eigen controle, ook als de eerste klopt.
const tweede = "https://voorbeeld.nl/zwemvijver-aanleggen/";
const tweeDoelen = goedPlan();
tweeDoelen.doelen = [...tweeDoelen.doelen, { url: tweede, hoofdterm: "zwemvijver aanleggen", steuntermen: [] }];
const rTwee = controleerPlan(tweeDoelen);
proef("de tweede doelpagina wordt óók nagerekend", rTwee.some((r) => r.includes(tweede)), rTwee.join(" | "));

// Zonder hoofdterm valt er niets na te rekenen; dan hoort er ook niets gemeld te
// worden over die pagina, behalve wat wél te meten is (de link).
const geenTerm = goedPlan();
geenTerm.doelen = [{ url: DOEL, hoofdterm: "", steuntermen: [] }];
proef("een doel zonder hoofdterm levert geen loze meldingen op", controleerPlan(geenTerm).length === 0);

// ═══════════════════════════════════════════════════════════
// HET DOCUMENT IS EEN OPLEVERING, GEEN LIJST MET HUISWERK (21-08-2026)
// ═══════════════════════════════════════════════════════════
// Er stond een kopje "Let op" in het document met de waarschuwingen eronder.
// Dat document gaat naar de klant en de sitebouwer, en dan lees je daar
// aanbevelingen die wíj hadden moeten uitvoeren ("het verdient aanbeveling ook de
// meta-description van de landingspagina te optimaliseren") en een interne
// afweging ("controleer of dit aansluit bij de interne linkstrategie die Maarten
// voor ogen heeft"). Maartens woorden: "dat roept vragen op of de klant dan zelf
// nog iets moet doen". Deze drie controles houden dat weg.

const bron = readFileSync(join(__dirname, "..", "lib", "ondersteunend.ts"), "utf8");
proef(
  "er staat geen kopje 'Let op' meer in het document",
  !/text:\s*"Let op"/.test(bron),
  "De waarschuwingen zijn voor Maarten en horen op het scherm, niet in het document dat de klant leest.",
);
proef(
  "de waarschuwingen gaan niet mee het document in",
  !/plan\.waarschuwingen[^\n]*bullets/.test(bron),
  "Zet plan.waarschuwingen nooit als bullets in de DocSpec.",
);
proef(
  "een betere meta voor de landingspagina wordt geleverd, niet aanbevolen",
  bron.includes("landingMetas") && bron.includes("Ook overnemen op de landingspagina"),
  "Een aanbeveling die we zelf kunnen uitvoeren hoort een kant-en-klare waarde te zijn.",
);
proef(
  "een botsende titel wordt eerst hersteld en pas daarna gemeld",
  bron.includes("herstelBotsendeTitel") && bron.includes("botsendeTermen(plan)"),
  "Kan de hoofdterm niet in de titel blijven, dan stellen we een andere titel voor in plaats van het te melden.",
);

// De herkenning zelf: welke term botst er?
const botst = goedPlan();
botst.titel = "Natuurzwembad aanleggen in IJsselmuiden";
proef("de botsende term wordt herkend", botsendeTermen(botst).includes("natuurzwembad aanleggen"), botsendeTermen(botst).join(" | "));
proef("een schoon plan levert geen botsende term op", botsendeTermen(goedPlan()).length === 0);

// ═══════════════════════════════════════════════════════════
// EEN ONDERSTEUNENDE VERSIE HOORT BIJ ZIJN ORIGINEEL
// ═══════════════════════════════════════════════════════════
// De lijst groepeerde op de woorden in de naam. Dat werkt voor een klantversie
// die bijna hetzelfde heet, maar juist niet voor een stuk dat ondersteunend is
// gemaakt: dat krijgt met opzet een ándere titel, want de oude botste met de
// landingspagina. Dan las het als een los project en schoof er een document van
// iets heel anders tussen. Vandaar de harde verwijzing (bronId).
{
  const docs = [
    { id: 3, kind: "copy", naam: "Zo blijft het water in IJsselmuiden helder", bronId: 1 },
    { id: 2, kind: "copy", naam: "Natuurlijke zwemvijver in Zeeland.docx" },
    { id: 1, kind: "copy", naam: "Strak natuurzwembad in IJsselmuiden.docx" },
  ];
  const g = groepeer(docs);
  proef("een ondersteunende versie zit in de groep van zijn origineel", g[3] === g[1], JSON.stringify(g));
  proef("een los project blijft een eigen groep", g[2] !== g[1], JSON.stringify(g));
  // De lijst komt op nieuwste-eerst binnen, dus de bron kan ná zijn afgeleide
  // langskomen. Andersom moet het net zo goed werken.
  const omgekeerd = groepeer([...docs].reverse());
  proef("ook als het origineel later in de lijst staat", omgekeerd[3] === omgekeerd[1], JSON.stringify(omgekeerd));
}


// ═══════════════════════════════════════════════════════════
// HET WOORD MAG ERIN, DE ZOEKTERM ALS BELOFTE NIET (21-08-2026)
// ═══════════════════════════════════════════════════════════
// De regel was "de hoofdterm mag NIET in de titel of de H1 staan", en dat is te
// grof. De hoofdterm van /zwemvijvers/natuurzwembad/ is één generiek woord:
// "natuurzwembad". Een projectverhaal dát daarover gaat kan dat woord niet
// missen, en het weghalen kost meer dan het oplevert: dan snapt Google niet waar
// het stuk over gaat en is de interne link vanuit dat stuk juist mínder waard.
// Maartens vraag: "is het een groot probleem dat de term natuurzwembad in de H1
// staat?" Nee. Wat wél botst, is een kop die in de kern de zoekterm zelf is.
{
  const mag: [string, string][] = [
    ["Strak natuurzwembad in IJsselmuiden, een kijkje in dit project", "natuurzwembad"],
    ["Natuurzwembad in IJsselmuiden: zo hebben we het gebouwd", "natuurzwembad"],
    ["Zo houd je het water helder zonder chloor", "natuurzwembad"],
    ["Wat een natuurzwembad kost aan onderhoud per seizoen", "natuurzwembad onderhoud"],
  ];
  for (const [kop, term] of mag) {
    proef(`mag blijven staan: "${kop.slice(0, 45)}..."`, !botstMetHoofdterm(kop, term));
  }
  const magNiet: [string, string][] = [
    ["Natuurzwembad aanleggen", "natuurzwembad"],
    ["Ons natuurzwembad", "natuurzwembad"],
    ["Natuurzwembad aanleggen in IJsselmuiden", "natuurzwembad"],
    ["Natuurzwembad aanleggen: waar je op moet letten", "natuurzwembad aanleggen"],
    ["Wat kost een natuurzwembad aanleggen", "natuurzwembad"],
  ];
  for (const [kop, term] of magNiet) {
    proef(`botst wel: "${kop}"`, botstMetHoofdterm(kop, term));
  }
}

// ── De H-tags staan voor elke kop (21-08-2026) ──────────────────────────────
// Zonder het nummer ziet de sitebouwer alleen dát iets een kop is, niet wélke,
// en belandt een tussenkop als H2 waar hij een H3 hoort te zijn.
{
  const blokken = tekstNaarBlokken("# De titel\n\nEen alinea.\n\n## Een tussenkop\n\n### Nog dieper\n\n- een punt");
  const koppen = blokken.filter((b) => b.type === "subheading").map((b) => (b as { text: string }).text);
  proef("elke kop krijgt zijn H-nummer ervoor", koppen.join(" | ") === "H1 · De titel | H2 · Een tussenkop | H3 · Nog dieper", koppen.join(" | "));
  proef("de rest van de tekst blijft gewoon staan",
    blokken.some((b) => b.type === "paragraph") && blokken.some((b) => b.type === "bullets"));
  // Staat het nummer er al in, dan komt het er niet twee keer voor te staan.
  const nogmaals = tekstNaarBlokken("## H2 · Een tussenkop");
  proef("een kop krijgt nooit twee keer een nummer",
    (nogmaals[0] as { text: string }).text === "H2 · Een tussenkop", JSON.stringify(nogmaals[0]));
}

// ── Titel, kop en meta's staan als feit in het document ─────────────────────
// Het document sprak zichzelf tegen: bovenaan stond dat de titel gewijzigd was,
// verderop dat de H1 grotendeels ongewijzigd was. Feiten die het dashboard zelf
// kan vaststellen, hoort het niet aan een tekstschrijver te vragen.
{
  const b = readFileSync(join(__dirname, "..", "lib", "ondersteunend.ts"), "utf8");
  proef("er is één feitentabel met wat er stond en wat er nu staat",
    b.includes("veldenTabel(") && b.includes('"Stond er", "Staat er nu"'),
    "Zonder die tabel beschrijft het model de titel en de H1 zelf, en dan spreken twee plekken elkaar tegen.");
  proef("het model schrijft niet meer zelf over titel, H1 en meta's",
    /Schrijf in "wijzigingen" NIETS over de titel/.test(b),
    "Anders staat hetzelfde twee keer in het document, in twee formuleringen.");
  proef("de steuntermen worden ingekort tot een leesbare kolom",
    b.includes("steunKolom(") && b.includes("andere vragen rond dit onderwerp"),
    "Een komma-lijst van vijftien termen in een smalle kolom leest niemand.");
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
