// Proef op de kennisbank van het Pagina-lab.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De kennisbank heeft twee planken: onderbouwde criteria met een bron en een
// datum, en daarnaast ons eigen vakoordeel zonder bron. Die scheiding is de
// hele waarde ervan. Loopt hij weg, dan staat er over een half jaar een mening
// met de uitstraling van onderzoek in een klantrapport, en dan is de kennisbank
// erger dan geen kennisbank.
//
// Wegglijden gaat vanzelf en zonder kwade wil: iemand voegt een punt toe waar
// hij toevallig aan het werk is, laat de bron even weg omdat hij hem later wel
// opzoekt, of schrijft een vakoordeel op alsof er cijfers onder liggen. Dit is
// binnen dit project de vaste les, nu voor de zesde keer in dezelfde vorm: een
// regel die alleen in een document leeft, wordt gebroken zodra iemand haast
// heeft. Dus wordt hij nagerekend.
//
// Rood als: een criterium geen bron of geen geldige datum heeft, een datum in
// de toekomst ligt, een code dubbel is of niet bij zijn discipline past, een
// discipline te leeg raakt om iets zinnigs mee te zeggen, een vakoordeel zich
// als onderzoek voordoet (een adres, een percentage, of onderzoekstaal), of het
// scherm de waarschuwing bij het vakoordeel niet meer toont.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRITERIA, DISCIPLINES, VAKOORDEEL_WAARSCHUWING, VAKOORDELEN, alsTekst, criteriaVan } from "../lib/pagina-lab/kennisbank";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = join(__dirname, "..");
const VANDAAG = new Date().toISOString().slice(0, 10);

// ── 1. Elke discipline is echt gevuld ──────────────────────
// Onder de vier criteria kun je over die discipline niets zeggen zonder te
// gaan improviseren, en improviseren is precies wat de kennisbank moet
// voorkomen.
const MINIMUM = 4;
for (const d of DISCIPLINES) {
  const aantal = criteriaVan(d).length;
  check(`${d} heeft minstens ${MINIMUM} onderbouwde criteria`, aantal >= MINIMUM, `nu: ${aantal}`);
}

// ── 2. Codes: uniek, en herkenbaar aan hun discipline ──────
const VOORVOEGSEL: Record<string, string> = {
  conversie: "CONV",
  bruikbaarheid: "BRUIK",
  vormgeving: "VORM",
  interactie: "INT",
};

const gezien = new Set<string>();
for (const punt of [...CRITERIA, ...VAKOORDELEN]) {
  check(`${punt.id} komt maar één keer voor`, !gezien.has(punt.id), "Twee punten met dezelfde code maken een verwijzing waardeloos.");
  gezien.add(punt.id);
}

for (const c of CRITERIA) {
  const hoort = `${VOORVOEGSEL[c.discipline]}-`;
  check(`${c.id} past bij discipline ${c.discipline}`, c.id.startsWith(hoort), `verwacht een code die begint met ${hoort}`);
}
for (const v of VAKOORDELEN) {
  check(`${v.id} is als vakoordeel te herkennen`, v.id.startsWith("VAK-"), "Een vakoordeel hoort een VAK-code te hebben, ook al staat het bij een discipline.");
}

// ── 3. Elk criterium heeft een echte bron en een datum ─────
const isDatum = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

for (const c of CRITERIA) {
  check(`${c.id} heeft minstens één bron`, c.bronnen.length > 0, "Zonder bron hoort een punt op de vakoordeel-plank, niet hier.");
  for (const b of c.bronnen) {
    check(`${c.id} bron "${b.naam.slice(0, 40)}" heeft een adres`, /^https:\/\/\S+$/.test(b.url), `gevonden: ${b.url}`);
    check(`${c.id} bron heeft een naam`, b.naam.trim().length > 3, "Een bron zonder naam kan niemand nalopen.");
  }
  check(`${c.id} heeft een geldige controledatum`, isDatum(c.gecheckt), `gevonden: ${c.gecheckt}`);
  check(`${c.id} is niet in de toekomst nagekeken`, c.gecheckt <= VANDAAG, `${c.gecheckt} ligt na vandaag (${VANDAAG})`);
}

// Hetzelfde adres onder twee namen is het begin van twee lijsten die uit elkaar
// lopen. Eén bron, één naam.
const naamPerUrl = new Map<string, string>();
for (const c of CRITERIA) {
  for (const b of c.bronnen) {
    const eerder = naamPerUrl.get(b.url);
    if (eerder === undefined) naamPerUrl.set(b.url, b.naam);
    else check(`${b.url} heeft overal dezelfde naam`, eerder === b.naam, `"${eerder}" tegenover "${b.naam}"`);
  }
}

// ── 4. Een vakoordeel doet zich niet voor als onderzoek ────
// Dit is de kern van de scheiding. Geen adres (want dan lijkt er een bron te
// zijn), geen percentage (want dan lijkt er gemeten te zijn) en geen taal die
// naar onderzoek verwijst.
const ONDERZOEKSTAAL = /\b(uit onderzoek blijkt|onderzoek toont|onderzoek laat zien|studie|studies|onderzocht|bewezen|significant)\b/i;

for (const v of VAKOORDELEN) {
  const velden = `${v.titel} ${v.waarNaarKijken} ${v.waarom} ${v.grond}`;
  check(`${v.id} verwijst niet naar een adres`, !/https?:\/\//.test(velden), "Een adres suggereert een bron; dan hoort het punt op plank 1.");
  check(`${v.id} noemt geen percentage`, !/\d\s?%/.test(velden), "Een percentage suggereert een meting die er niet is.");
  check(`${v.id} gebruikt geen onderzoekstaal`, !ONDERZOEKSTAAL.test(velden), `gevonden: ${velden.match(ONDERZOEKSTAAL)?.[0]}`);
  check(`${v.id} zegt waar het vandaan komt`, v.grond.trim().length > 30, "Zonder herkomst is een vakoordeel niet te wegen en niet te promoveren.");
  check(`${v.id} heeft een geldige datum`, isDatum(v.sinds) && v.sinds <= VANDAAG, `gevonden: ${v.sinds}`);
}

// Op typeniveau kan een vakoordeel geen bronnen dragen. Deze controle bewaakt
// dat iemand dat veld er niet alsnog bij zet.
for (const v of VAKOORDELEN) {
  check(`${v.id} draagt geen bronnenveld`, !("bronnen" in v) && !("bewijs" in v),
    "Vakoordeel.bronnen en Vakoordeel.bewijs bestaan met opzet niet. Hoort het punt bij plank 1, verhuis het dan echt.");
}

// ── 5. De twee planken blijven ook in de uitvoer gescheiden ─
const tekst = alsTekst();
const eersteVak = tekst.indexOf("VAK-");
const waarschuwing = tekst.indexOf(VAKOORDEEL_WAARSCHUWING);
check("de waarschuwing staat in de tekst voor een beoordeling", waarschuwing >= 0,
  "alsTekst() geeft het vakoordeel door zonder te zeggen dat het geen onderzoek is.");
check("de waarschuwing staat vóór het eerste vakoordeel", waarschuwing >= 0 && eersteVak > waarschuwing,
  "Een waarschuwing achteraf leest niemand.");

// ── 6. Het scherm toont beide planken, met de waarschuwing ──
const scherm = readFileSync(join(WORTEL, "app/admin/pagina-lab/PaginaLabClient.tsx"), "utf8");
check("het scherm toont de waarschuwing bij het vakoordeel", scherm.includes("VAKOORDEEL_WAARSCHUWING"),
  "Zonder die regel staat op het scherm een mening zonder het label erbij.");
check("het scherm toont de bron en de datum bij een criterium", scherm.includes("c.bronnen") && scherm.includes("c.gecheckt"),
  "De bron is de reden dat plank 1 bestaat; die hoort in beeld.");

console.log(
  fouten === 0
    ? `\nKennisbank in orde: ${CRITERIA.length} onderbouwde criteria, ${VAKOORDELEN.length} vakoordelen, planken gescheiden.`
    : `\n${fouten} fout(en) in de kennisbank van het Pagina-lab.`,
);
if (fouten > 0) process.exit(1);
