// ═══════════════════════════════════════════════════════════
// EEN ONDERSTEUNEND STUK MAG DE LANDINGSPAGINA NIET AFPAKKEN
// ═══════════════════════════════════════════════════════════
// De knop "Ondersteunend maken" bij een document doet iets waar je pas maanden
// later achter komt als het fout gaat: hij bepaalt of een blog de landingspagina
// versterkt of hem juist zijn plek in Google afpakt. Het verschil zit in drie
// dingen, en die zijn alle drie te meten:
//
//   1. de hoofdterm van de landingspagina staat NIET in de titel of de kop van
//      de blog (anders mikken ze op hetzelfde en kiest Google er zelf een);
//   2. er loopt vanuit de blog een link naar die landingspagina (zonder link
//      ondersteunt er niets, dan staat het stuk er alleen maar naast);
//   3. de hoofdterm staat juist WEL in de linktekst, want dat is het signaal dat
//      je doorgeeft.
//
// Die drie worden in code nagerekend (`controleerPlan`) en niet aan het
// taalmodel overgelaten: een instructie in een prompt is een verzoek, geen poort.
// Deze proef bewaakt dat die controle blijft werken. Gaat hij stuk, dan levert
// de knop stukken op die er goed uitzien en precies het tegenovergestelde doen.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { botsendeTermen, controleerPlan } from "../lib/ondersteunend";
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

// Te veel links naar dezelfde pagina leest als opgevuld.
const teVeel = goedPlan();
teVeel.links = [1, 2, 3, 4].map((n) => ({ naar: DOEL, anker: "natuurzwembad aanleggen", plek: `alinea ${n}` }));
proef("meer dan drie links naar dezelfde pagina wordt gemeld", controleerPlan(teVeel).length > 0);

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

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
