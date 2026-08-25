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
import { botsendeTermen, botstMetHoofdterm, bouwSpec, controleerPlan, isEchteWijziging,
         linksBuitenDeTekst, schoonInline, tekstNaarBlokken, watDitStukDoet, type OndersteunendPlan } from "../lib/ondersteunend";
import { groepeer } from "../lib/doc-groepen";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const DOEL = "https://voorbeeld.nl/natuurzwembad-aanleggen/";

/** Een plan dat het goed doet: de blog gaat over het onderhoud, en linkt met de
    hoofdterm naar de pagina die daarover gaat. */
function goedPlan(): OndersteunendPlan {
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
  "een betere meta voor de landingspagina wordt geschreven, niet aanbevolen",
  bron.includes("landingMetas") && /zet ze in "landingMetas"/.test(bron),
  "Een aanbeveling die we zelf kunnen uitvoeren hoort een kant-en-klare waarde te zijn.",
);
// Maar die waarde gaat naar het scherm, niet het document in: hij gaat over de
// landingspagina en dit document gaat over dít stuk (25-08-2026). Let op dat je
// hier niet op de brontekst zoekt naar de oude kop, want die staat nog in de
// toelichting hierboven; kijk naar de DocSpec zelf (verderop in deze proef).
proef(
  "het model weet dat die waarden niet in het document komen",
  /niet in dit document/.test(bron),
  "Anders schrijft het er alsnog een zin over.",
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
const koppenVan = (t: string) => tekstNaarBlokken(t)
  .filter((b) => b.type === "subheading").map((b) => (b as { text: string }).text);

{
  const blokken = tekstNaarBlokken("# De titel\n\nEen alinea.\n\n## Een tussenkop\n\n### Nog dieper\n\n- een punt");
  const koppen = blokken.filter((b) => b.type === "subheading").map((b) => (b as { text: string }).text);
  proef("elke kop krijgt zijn H-nummer ervoor", koppen.join(" | ") === "H1 · De titel | H2 · Een tussenkop | H3 · Nog dieper", koppen.join(" | "));
  proef("de rest van de tekst blijft gewoon staan",
    blokken.some((b) => b.type === "paragraph") && blokken.some((b) => b.type === "bullets"));
  // Staat het nummer er al in, dan komt het er niet twee keer voor te staan.
  const nogmaals = koppenVan("# H1 · Een kop");
  proef("een kop krijgt nooit twee keer een nummer", nogmaals[0] === "H1 · Een kop", nogmaals.join(" | "));
}

// ═══════════════════════════════════════════════════════════
// ER STAAT ALTIJD EEN H1 BOVEN DE TEKST (25-08-2026)
// ═══════════════════════════════════════════════════════════
// De tabel in het document zei "H1 boven het stuk: Strak natuurzwembad in
// Zaamslag", en precies die kop stond in de tekst eronder als "H2 · Strak
// natuurzwembad in Zaamslag". Er was dus nergens een H1 te zien en het document
// sprak zichzelf tegen. Maartens woorden: "ik zie nu geen H1". Oorzaak: het model
// levert de eerste kop vaak als ## aan, ook al vraagt de prompt om #. Dat wordt
// nu in code rechtgezet: de eerste kop IS de H1, wat er ook binnenkomt.
{
  const metTwee = koppenVan("## De titel\n\nEen alinea.\n\n### Een tussenkop\n\n### Nog een tussenkop");
  proef("een tekst die met ## begint krijgt tóch een H1 bovenaan",
    metTwee[0] === "H1 · De titel", metTwee.join(" | "));
  proef("de koppen eronder schuiven mee naar H2",
    metTwee.slice(1).every((k) => k.startsWith("H2 · ")), metTwee.join(" | "));

  const gelijk = koppenVan("## Eerste\n\n## Tweede\n\n## Derde");
  proef("er is precies één H1, ook als alle koppen even diep zijn",
    gelijk.filter((k) => k.startsWith("H1 · ")).length === 1, gelijk.join(" | "));

  const diep = koppenVan("### Alleen maar diepe koppen\n\n#### Nog dieper");
  proef("ook een tekst zonder ondiepe koppen begint met een H1",
    diep[0] === "H1 · Alleen maar diepe koppen", diep.join(" | "));
}

// ── Geen markdown-tekens in een Word-document (25-08-2026) ──────────────────
// In de opgeleverde tekst stond letterlijk "Benieuwd wat een [natuurlijke
// zwemvijver](https://gardenswimm.nl/...) voor jouw tuin kan betekenen?" en een
// losse regel "---". Word kent geen markdown, dus dat komt zo in beeld bij de
// klant. Dit is dezelfde harde opmaakregel als op het scherm: nooit ruwe
// markdown in beeld.
{
  // De link blijft zichtbaar in de lopende tekst, want de sitebouwer kopieert
  // die tekst. Stond hij alleen in een tabel, dan kan hij hem vergeten.
  proef("een link wordt gewone tekst, mét het adres erbij",
    schoonInline("Benieuwd wat een [natuurlijke zwemvijver](https://a.nl/b/) kost?")
      === "Benieuwd wat een natuurlijke zwemvijver (https://a.nl/b/) kost?",
    schoonInline("Benieuwd wat een [natuurlijke zwemvijver](https://a.nl/b/) kost?"));
  proef("vet en cursief verliezen hun sterretjes",
    schoonInline("Dit is **belangrijk** en *dit* ook") === "Dit is belangrijk en dit ook");
  const blokken = tekstNaarBlokken("# Kop\n\n---\n\nEen [link](https://a.nl/) in een alinea.\n\n- een **punt**");
  const tekstIn = JSON.stringify(blokken);
  // Alleen naar de tekst zelf kijken; de haakjes van de JSON eromheen tellen niet.
  const woorden = blokken.flatMap((b) =>
    b.type === "bullets" ? b.items : ("text" in b && typeof b.text === "string" ? [b.text] : []));
  proef("er blijft nergens een markdown-teken staan",
    woorden.every((w) => !/[[\]*`]|--/.test(w)), woorden.join(" | "));
  proef("het adres van de link staat in de alinea zelf",
    woorden.some((w) => w.includes("(https://a.nl/)")), woorden.join(" | "));
  proef("de streepjeslijn is weg, de alinea niet",
    blokken.some((b) => b.type === "paragraph" && /^Een link \(.*\) in een alinea\.$/.test((b as { text: string }).text)), tekstIn);
}

// ═══════════════════════════════════════════════════════════
// ÉÉN GEGEVEN STAAT OP ÉÉN PLEK IN HET DOCUMENT (25-08-2026)
// ═══════════════════════════════════════════════════════════
// De titel, de H1, de meta-title en de meta-description stonden er drie keer in:
// in de tabel "Titel, kop en meta's", nog een keer onder "Voor de sitebouwer",
// en de H1 daarna nog als kop boven de tekst. Maartens woorden: "dingen met
// koppen, meta's, titels die er volgens mij drie keer in staan. Niet nodig,
// gewoon één keer kort en duidelijk."
//
// Deze proef bouwt een echte DocSpec en telt na. Zet er dus nooit een tweede
// tabel bij "voor de zekerheid".
{
  const plan = goedPlan();
  plan.landingMetas = [{ url: DOEL, metaTitle: "Een betere titel", metaDescription: "Een betere omschrijving." }];
  // De H1 is met opzet géén stukje van de titel: anders telt een substring-check
  // hem twee keer mee en zegt de proef iets anders dan hij denkt te zeggen.
  const h1 = "Helder water zonder chloor, zo doen we dat";
  plan.tekst = `# ${h1}\n\nEen alinea.`;
  const velden = [
    ["Titel van het stuk", "De oude titel", plan.titel],
    ["H1 boven het stuk", "stond er niet", h1],
    ["Paginatitel (meta-title)", "stond er niet", plan.metaTitle],
    ["Meta-description", "stond er niet", plan.metaDescription],
  ];
  const spec = bouwSpec(plan, { klant: "Voorbeeld", doelUrls: [DOEL], velden });

  /** Hoe vaak komt deze waarde voor in de tabellen en tekstblokken van het document? */
  const telt = (waarde: string) => {
    let n = 0;
    for (const sec of spec.sections) {
      for (const b of sec.blocks) {
        if (b.type === "table") for (const rij of b.rows) for (const cel of rij) { if (cel.includes(waarde)) n++; }
        else if ("text" in b && typeof b.text === "string" && b.text.includes(waarde)) n++;
        else if (b.type === "bullets") for (const i of b.items) { if (i.includes(waarde)) n++; }
      }
    }
    return n;
  };
  for (const [naam, waarde] of [
    ["de titel", plan.titel],
    ["de meta-title", plan.metaTitle],
    ["de meta-description", plan.metaDescription],
  ] as [string, string][]) {
    proef(`${naam} staat maar op één plek in het document`, telt(waarde) === 1, `komt ${telt(waarde)}x voor`);
  }
  // De H1 mag twee keer: als waarde voor de sitebouwer, en als echte kop boven
  // de tekst. Dat is geen dubbeling maar het verschil tussen zeggen en tonen.
  proef("de H1 staat als waarde én als kop, en verder nergens",
    telt(h1) === 2, `komt ${telt(h1)}x voor`);

  const secties = spec.sections.map((s) => s.heading);
  proef("de secties staan in de goede volgorde",
    JSON.stringify(secties) === JSON.stringify(["Wat dit stuk doet", "Wat er is aangepast", "Voor de sitebouwer", "De aangepaste tekst"]),
    JSON.stringify(secties));

  // "Wat dit stuk doet" is een korte toelichting, geen hoofdstuk met tabellen.
  const doet = spec.sections[0].blocks;
  proef("'Wat dit stuk doet' is één blok, zonder tabel", doet.length === 1 && doet[0].type === "highlight", JSON.stringify(doet));
  const zinnen = (doet[0] as { text: string }).text.split(/(?<=\.)\s+/).filter(Boolean);
  proef("'Wat dit stuk doet' is hooguit twee zinnen", zinnen.length <= 2, zinnen.join(" || "));

  // Er is één tabel met de velden, en die heeft de oude waarde erbij.
  const tabellen = spec.sections.flatMap((s) => s.blocks).filter((b) => b.type === "table") as { headers: string[] }[];
  const veldTabellen = tabellen.filter((t) => t.headers[0] === "Veld");
  proef("er is precies één tabel met titel, kop en meta's", veldTabellen.length === 1, JSON.stringify(veldTabellen.map((t) => t.headers)));
  proef("die tabel toont ook wat er stond",
    veldTabellen[0]?.headers.join(",") === "Veld,Stond er,Staat er nu", JSON.stringify(veldTabellen[0]?.headers));

  // De landingspagina staat op de omslag; in de secties alleen waar hij iets
  // toevoegt. In de omslag-meta stond hij nog een keer, woordelijk gelijk aan de
  // ondertitel er twee regels boven.
  proef("de omslag noemt de landingspagina niet twee keer",
    !JSON.stringify(spec.meta || {}).includes(DOEL) && !JSON.stringify(spec.meta || {}).includes("/natuurzwembad-aanleggen/"),
    JSON.stringify(spec.meta));

  // De tekst zelf begint met een H1.
  const eerste = spec.sections[3].blocks[0] as { type: string; text?: string };
  proef("de aangepaste tekst begint met een H1",
    eerste.type === "subheading" && !!eerste.text?.startsWith("H1 · "), JSON.stringify(eerste));

  // ── De landingspagina-meta's gaan niet mee het document in (25-08-2026) ────
  // Die gaan over een ándere pagina dan dit stuk, en dit document gaat over dít
  // stuk. Ze worden nog wel geschreven en staan op het scherm bij het document.
  const alles = JSON.stringify(spec);
  proef("'Ook overnemen op de landingspagina' staat niet meer in het document",
    !alles.includes("Ook overnemen op de landingspagina"));
  proef("en de waarden ervan dus ook niet",
    !alles.includes("Een betere titel") && !alles.includes("Een betere omschrijving"));
}

// ═══════════════════════════════════════════════════════════
// DE LINK STAAT IN DE TEKST, NIET ALLEEN IN EEN TABEL (25-08-2026)
// ═══════════════════════════════════════════════════════════
// De sitebouwer kopieert de tekst uit dit document. Stond de link alleen in een
// tabel eronder, dan kan hij hem daarbij vergeten, en dan ondersteunt dit stuk
// niets meer. Maartens woorden: "de link vanuit dit stuk gewoon letterlijk in de
// tekst willen zien, zodat de sitebouwer dat ook niet kan vergeten bij het
// kopiëren en plakken van de tekst."
{
  const velden = [["Titel van het stuk", "Oud", "Nieuw"]];

  // Staat de link in de tekst, dan hoeft hij nergens anders meer.
  const wel = goedPlan();
  wel.tekst = `# Een kop\n\nZo laat je een [natuurzwembad aanleggen](${DOEL}) in je tuin.`;
  proef("een link die in de tekst staat, telt als geregeld", linksBuitenDeTekst(wel).length === 0);
  const specWel = bouwSpec(wel, { klant: "V", doelUrls: [DOEL], velden });
  proef("dan staat er geen linktabel meer in het document",
    !JSON.stringify(specWel).includes("nog niet in de tekst"));
  const alinea = specWel.sections[3].blocks
    .filter((b) => b.type === "paragraph").map((b) => (b as { text: string }).text).join(" ");
  proef("het adres staat gewoon in de alinea", alinea.includes(`(${DOEL})`), alinea);

  // Staat hij er niet, dan mag hij niet stilletjes verdwijnen.
  const niet = goedPlan();
  niet.tekst = "# Een kop\n\nEen alinea zonder link.";
  proef("een link die niet in de tekst staat wordt eruit gehaald", linksBuitenDeTekst(niet).length === 1);
  proef("en krijgt alsnog een regel in het document",
    JSON.stringify(bouwSpec(niet, { klant: "V", doelUrls: [DOEL], velden })).includes("nog niet in de tekst"));
}

// ── "Wat dit stuk doet" wordt in code geschreven, niet gevraagd ─────────────
{
  const zin = watDitStukDoet(goedPlan());
  proef("de zin noemt de landingspagina", zin.includes("/natuurzwembad-aanleggen/"), zin);
  proef("de zin noemt de hoofdterm", zin.includes("natuurzwembad aanleggen"), zin);
  proef("de zin is hooguit twee zinnen", zin.split(/(?<=\.)\s+/).filter(Boolean).length <= 2, zin);

  const twee = goedPlan();
  twee.doelen = [...twee.doelen, { url: "https://voorbeeld.nl/zwemvijver-aanleggen/", hoofdterm: "zwemvijver aanleggen", steuntermen: [] }];
  const zinTwee = watDitStukDoet(twee);
  proef("bij twee doelpagina's staan ze er allebei in",
    zinTwee.includes("/natuurzwembad-aanleggen/") && zinTwee.includes("/zwemvijver-aanleggen/"), zinTwee);
  proef("en dan gaat het over 'die pagina's'", zinTwee.includes("die pagina's"), zinTwee);

  const geen = goedPlan();
  geen.doelen = [];
  proef("zonder doelpagina blijft er een leesbare zin staan", watDitStukDoet(geen).length > 40);

  const b = readFileSync(join(__dirname, "..", "lib", "ondersteunend.ts"), "utf8");
  proef("het model schrijft die zin niet meer zelf",
    !/"kop":"/.test(b) && b.includes("plan.kop = watDitStukDoet(plan)"),
    "Dit is een feit dat het dashboard zelf kent; vraag je het aan een tekstschrijver, dan wisselt het per ronde.");
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
  // De steuntermen stonden als derde kolom in een tabel bij "Wat dit stuk doet".
  // Dat is een interne SEO-afweging, geen boodschap voor een klant of een
  // sitebouwer, en het noemde de landingspagina voor de derde keer. Ze staan nu
  // alleen nog op het scherm, bij het document, voor Maarten (25-08-2026).
  proef("de steuntermen staan niet meer in het document",
    !b.includes("steunKolom(") && !b.includes("Dit stuk mikt op"),
    "Die horen op het scherm, niet in het stuk dat de klant leest.");
}


// ── "Wat er is aangepast" bevat alleen wat er écht is aangepast (21-08-2026) ──
// Onder dat kopje stonden vijf punten waarvan er vier begonnen met "ongewijzigd
// gelaten", mét de reden erbij. Dat is geen lijst met aanpassingen maar een lijst
// met niet-aanpassingen, en de klant leest daar dus vier dingen die niet gebeurd
// zijn. Maartens woorden: "je noemt een heel aantal dingen waar niks aan
// veranderd is".
{
  const weg = [
    "Tussenkop 'Natuurlijke waterzuivering uit het zicht' ongewijzigd gelaten: bevat de hoofdterm maar heeft een eigen invalshoek.",
    "Tussenkop 'Ook 's avonds een blikvanger' ongewijzigd gelaten.",
    "De eerste alinea is niet aangepast.",
    "De opsomming blijft staan zoals hij was.",
  ];
  for (const regel of weg) proef(`gaat eruit: "${regel.slice(0, 50)}..."`, !isEchteWijziging(regel));
  const blijft = [
    "Afsluitende alinea toegevoegd met de interne link naar de landingspagina.",
    "Tussenkop 'Natuurzwembad aanleggen' vervangen door 'Zo bouwden we dit bad'.",
    "De eerste alinea herschreven zodat hij op het project mikt.",
  ];
  for (const regel of blijft) proef(`blijft staan: "${regel.slice(0, 50)}..."`, isEchteWijziging(regel));
  proef("een lege regel telt niet mee", !isEchteWijziging("   "));

  const b = readFileSync(join(__dirname, "..", "lib", "ondersteunend.ts"), "utf8");
  proef("de filter zit op het inlezen van het plan", /wijzigingen:[^\n]*isEchteWijziging/.test(b),
    "Anders komt zo'n regel alsnog in het document.");
  proef("is er niets aan de tekst veranderd, dan zegt het document dat in één zin",
    b.includes("Aan de tekst zelf is niets veranderd"),
    "Beter één eerlijke zin dan een kopje met een lijst niet-aanpassingen eronder.");
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
