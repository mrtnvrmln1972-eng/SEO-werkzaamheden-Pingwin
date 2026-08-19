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

import { controleerPlan } from "../lib/ondersteunend";

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

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
