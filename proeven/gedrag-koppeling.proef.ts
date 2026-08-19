// Proef op de gedragskoppelingen: Analytics en Clarity.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Drie dingen kunnen hier stilletjes misgaan, en alle drie merk je pas als het
// te laat is.
//
//  1. DE SLEUTEL LEKT. De Clarity-sleutel geeft toegang tot de cijfers van een
//     klantwebsite. Hij hoort dezelfde weg te gaan als het WordPress-wachtwoord:
//     de server kent hem, de browser nooit. Eén regel die hem "even" meestuurt
//     naar het scherm, en hij staat in de netwerkoverzichten van elke browser
//     die dat scherm ooit opent.
//  2. HET DAGPLAFOND WORDT OPGEGETEN. Clarity staat tien opvragingen per project
//     per dag toe. Zonder rem is dat op één middag weg, en dan staat de bron een
//     etmaal droog zonder dat iemand begrijpt waarom.
//  3. HET LAB GAAT ZELF OPHALEN. Het Pagina-lab leest; ophalen bij Clarity
//     gebeurt op één plek, bij de koppeling. Zou een oordeel per pagina zelf
//     ophalen, dan is punt 2 binnen tien pagina's een feit.
//
// Alle drie zijn ze een regel die je kunt vergeten, dus alle drie worden ze hier
// nagerekend. Dat is in dit project de vaste les: een regel die alleen in een
// document leeft, wordt gebroken zodra iemand haast heeft.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { verwerk } from "../lib/clarity";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf8");

// ── 1. De sleutel blijft op de server ──────────────────────
const route = lees("app/api/admin/gedrag/route.ts");
check("de koppelroute haalt de sleutel nergens op", !/\bclarityToken\s*\(/.test(route),
  "Wie de sleutel ophaalt in een route, is één regel verwijderd van hem meesturen. De stand zegt al of hij er is.");

check("de koppelroute stuurt geen sleutel mee terug", !/sleutel:\s*[^"']/.test(route) && !/api_token/.test(route),
  "De browser hoort alleen te horen ÓF er een sleutel is, nooit welke.");

// Elk scherm dat de gedragsgegevens toont, is een clientcomponent; daar mag de
// sleutel dus in geen enkele vorm terechtkomen.
for (const bestand of readdirSync(join(WORTEL, "app/admin/pagina-lab")).filter((b) => b.endsWith(".tsx"))) {
  const inhoud = lees(`app/admin/pagina-lab/${bestand}`);
  check(`${bestand} toont geen sleutel`, !/api_token|clarityToken/.test(inhoud),
    "Een sleutel hoort niet in een scherm, ook niet om hem te laten zien.");
}

// De stand die wél naar het scherm gaat, mag geen sleutelveld hebben.
const clarity = lees("lib/clarity.ts");
const standType = clarity.slice(clarity.indexOf("export type ClarityStand = {"), clarity.indexOf("export async function clarityStand"));
check("de stand bevat geen sleutel", !/token|sleutel/i.test(standType),
  "ClarityStand gaat naar de browser; daar hoort geen sleutel in te zitten.");

// ── 2. Het dagplafond wordt gecontroleerd vóór de aanvraag ──
const haal = clarity.slice(clarity.indexOf("export async function haalClarity"));
const eindeHaal = haal.indexOf("\n}\n");
const lichaam = eindeHaal > 0 ? haal.slice(0, eindeHaal) : haal;
const remOp = lichaam.indexOf("ruimte <= 0");
const fetchOp = lichaam.indexOf("fetch(");
check("er is een rem op het aantal opvragingen", remOp > 0, "Zonder rem is het dagplafond van Clarity binnen een middag op.");
check("de rem staat vóór de aanvraag", remOp > 0 && fetchOp > remOp,
  "Eerst tellen, dan pas ophalen. Andersom is de rem er wel maar werkt hij niet.");

// ── 3. Het lab haalt zelf niets op ─────────────────────────
function bestandenIn(map: string): string[] {
  const uit: string[] = [];
  for (const naam of readdirSync(join(WORTEL, map))) {
    const pad = `${map}/${naam}`;
    if (statSync(join(WORTEL, pad)).isDirectory()) uit.push(...bestandenIn(pad));
    else if (/\.(ts|tsx)$/.test(naam)) uit.push(pad);
  }
  return uit;
}
for (const pad of [...bestandenIn("lib/pagina-lab"), ...bestandenIn("app/api/admin/pagina-lab")]) {
  const inhoud = lees(pad);
  check(`${pad} haalt niet zelf op bij Clarity`, !/\bhaalClarity\s*\(/.test(inhoud),
    "Ophalen gebeurt op één plek (/api/admin/gedrag). Tien per dag is te weinig om per pagina op te vragen.");
}

// ── 4. De verwerking struikelt nergens over ────────────────
// Deze koppeling is nog nooit tegen een echte sleutel gedraaid (Maarten heeft
// op 19-08-2026 nog geen Clarity-account). Juist daarom moet vaststaan dat een
// antwoord dat er nét anders uitziet dan verwacht geen scherm omvergooit.
const echtVormig = [
  { metricName: "Traffic", information: [{ totalSessionCount: "120", totalBotSessionCount: "4", distinctUserCount: "98", URL: "/ogen-laseren/" }] },
  { metricName: "ScrollDepth", information: [{ averageScrollDepth: "62.5", URL: "/ogen-laseren/" }] },
];
const verwerkt = verwerk(echtVormig);
check("een normaal antwoord komt er goed uit", verwerkt.length === 2 && verwerkt[0].metriek === "Traffic",
  `gevonden: ${JSON.stringify(verwerkt).slice(0, 120)}`);
check("de uitsplitsing wordt herkend", verwerkt[0].regels[0]?.dimensie === "/ogen-laseren/",
  "De URL uit de informatieregel hoort als uitsplitsing terug te komen.");
check("de getallen worden getallen", verwerkt[0].regels[0]?.waarden.totalSessionCount === 120,
  "Clarity stuurt getallen als tekst; die horen omgezet te worden.");

for (const rommel of [null, undefined, {}, [], "tekst", [{ geen: "metriek" }], [{ metricName: "X", information: null }]]) {
  let stuk = false;
  try { verwerk(rommel); } catch { stuk = true; }
  check(`de verwerking overleeft ${JSON.stringify(rommel) || String(rommel)}`, !stuk,
    "Een onverwacht antwoord mag geen fout geven; dan valt het hele scherm om.");
}

console.log(fouten === 0 ? "\nGedragskoppeling in orde: sleutel blijft op de server, rem staat vóór de aanvraag." : `\n${fouten} fout(en) in de gedragskoppeling.`);
if (fouten > 0) process.exit(1);
