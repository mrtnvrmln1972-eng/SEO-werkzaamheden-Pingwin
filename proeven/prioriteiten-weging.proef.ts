// Proef op de weging van de prioriteitenscan.
//
// Waarom dit bestand er is: de weging bepaalt de vólgorde van de kansenlijst, en
// een verkeerde volgorde ziet er precies zo uit als een goede. Bij Paul Hoevenaars
// stond "voortuin" bovenaan (3.500 zoekopdrachten, landelijk plaatjeswoord) boven
// "tuinontwerp laten maken", en niets in het scherm liet zien dat dat fout was.
// Zulke fouten vind je alleen met een proef die de uitkomst hardop uitspreekt.
//
// De zoekwoorden en pagina's hieronder zijn de échte van paulhoevenaars.nl,
// overgenomen uit Search Console op 6 augustus 2026.

import { bouwKlantContext, leidWerkgebiedAf, bepaalIntentie, bepaalFit, weeg } from "../lib/prioriteiten-context";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// ── De echte data van Paul Hoevenaars ──
const PAUL_ZOEKWOORDEN = [
  "hovenier den bosch", "hovenier eindhoven", "hovenier oss", "hovenier uden", "hovenier veghel",
  "tuinaanleg eindhoven", "tuinaanleg uden", "tuinaanleg veghel", "tuinontwerp zevenaar",
  "hovenier prijzen", "hovenier kosten", "villa tuin", "paul hoevenaars",
];
const PAUL_URLS = [
  "https://paulhoevenaars.nl/hovenier-den-bosch", "https://paulhoevenaars.nl/hovenier-eindhoven",
  "https://paulhoevenaars.nl/hovenier-oss", "https://paulhoevenaars.nl/hovenier-uden",
  "https://paulhoevenaars.nl/hovenier-veghel", "https://paulhoevenaars.nl/diensten/tuinaanleg",
  "https://paulhoevenaars.nl/diensten/tuinontwerp", "https://paulhoevenaars.nl/projecten/mediterrane-villatuin",
];
const PAUL_PROPOSITIE = "Hovenier die complete particuliere tuinen realiseert van ontwerp tot aanleg en onderhoud in het midden- tot hogere segment, geen los tuinontwerpbureau, geen prijsvechter en niet zo exclusief dat het middensegment afhaakt.";

// ── 1. Het werkgebied komt uit de eigen data, niet uit een stedenlijst ──
const wg = leidWerkgebiedAf(PAUL_ZOEKWOORDEN, PAUL_URLS);
for (const plaats of ["uden", "oss", "veghel", "den bosch", "eindhoven"]) {
  checkWaar(`werkgebied bevat ${plaats}`, wg.plaatsen.includes(plaats), `gevonden: ${wg.plaatsen.join(", ")}`);
}
// "prijzen" en "kosten" staan óók achter "hovenier", maar zijn geen dorpen. Zonder
// deze grens maakt de scan van elk koopwoord een plaats.
checkWaar("prijzen is geen plaats", !wg.plaatsen.includes("prijzen"), `gevonden: ${wg.plaatsen.join(", ")}`);
checkWaar("kosten is geen plaats", !wg.plaatsen.includes("kosten"), `gevonden: ${wg.plaatsen.join(", ")}`);
checkWaar("hovenier is herkend als dienst", wg.dienstwoorden.includes("hovenier"), wg.dienstwoorden.join(", "));
checkWaar("tuinaanleg is herkend als dienst", wg.dienstwoorden.includes("tuinaanleg"), wg.dienstwoorden.join(", "));

// Een klant zonder bruikbare data mag niet omvallen, en houdt de grote steden.
const leeg = leidWerkgebiedAf([], []);
check("lege data geeft leeg werkgebied", leeg.plaatsen.length, 0);
check("lege data geeft geen diensten", leeg.dienstwoorden.length, 0);
check("den haag blijft herkend zonder context", bepaalIntentie("hovenier den haag"), "lokaal-commercial");

// Een vestigingsplaats die niet in de zoekwoorden voorkomt (Paul zit in
// Vorstenbosch) komt uit de bedrijfsgegevens.
const ctx = bouwKlantContext({
  profiel: "Tuinontwerp, tuinaanleg en onderhoud. Complete tuintransformatie met beplanting en verlichting.",
  naam: "Paul Hoevenaars", propositie: PAUL_PROPOSITIE,
  zoekwoorden: PAUL_ZOEKWOORDEN, urls: PAUL_URLS, extraPlaatsen: ["Vorstenbosch"],
});
checkWaar("vestigingsplaats telt mee", ctx.plaatsen.includes("vorstenbosch"), ctx.plaatsen.join(", "));

// ── 2. Koopgerichtheid, de kern van de reparatie ──
check("landelijk plaatjeswoord is onbekend", bepaalIntentie("voortuin", ctx), "_onbekend");
check("oriënterend woord is oriënterend", bepaalIntentie("zwembad tuin ideeen", ctx), "informational");
check("nederlands koopsignaal telt", bepaalIntentie("tuinontwerp laten maken", ctx), "transactional");
check("laten-vorm telt breed", bepaalIntentie("tuin laten onderhouden", ctx), "transactional");
check("kosten telt als koopsignaal", bepaalIntentie("kosten hovenier", ctx), "transactional");
check("eigen werkgebied is lokaal", bepaalIntentie("tuinaanleg uden", ctx), "lokaal-commercial");
check("dienst zonder plaats is commercieel", bepaalIntentie("hovenier vught", ctx), "commercial");
check("vacature is navigatie", bepaalIntentie("paul hoevenaars vacature", ctx), "navigational");

// De oude fout, expliciet vastgelegd zodat hij niet terugkomt: alles wat nergens
// op matchte kreeg "lokaal-commercial" (weging 0,9).
checkWaar("onbekend is niet langer lokaal-commercial",
  bepaalIntentie("groene schutting", ctx) !== "lokaal-commercial",
  `gekregen: ${bepaalIntentie("groene schutting", ctx)}`);

// ── 3. Merk-fit op hele woorden ──
// "voortuin" bevat de letters van "tuin", maar is een ander woord. Op substring
// gematcht kreeg elk woord met "tuin" erin ten onrechte een hogere fit.
checkWaar("voortuin erft niets van tuin",
  bepaalFit("voortuin", { ...ctx, kern: ["tuin"], dienstwoorden: [] }) === 0.5,
  `gekregen: ${bepaalFit("voortuin", { ...ctx, kern: ["tuin"], dienstwoorden: [] })}`);
checkWaar("tuin als los woord telt wel",
  bepaalFit("tuin laten aanleggen", { ...ctx, kern: ["tuin"], dienstwoorden: [] }) > 0.5, "");
// De budget-poort blijft dicht bij een klant die zegt geen prijsvechter te zijn.
checkWaar("goedkoop valt uit de lijst", bepaalFit("goedkope hovenier", ctx) <= 0.25,
  `gekregen: ${bepaalFit("goedkope hovenier", ctx)}`);

// ── 4. De uitkomst waar het allemaal om begon ──
// "tuinontwerp laten maken" hoort boven "voortuin" te staan, ondanks vier keer
// minder zoekvolume. Dit is de regel die het scherm gebruikt voor de volgorde.
const a = weeg("tuinontwerp laten maken", ctx);
const b = weeg("voortuin", ctx);
const gewicht = { transactional: 1, "lokaal-commercial": 0.9, commercial: 0.7, navigational: 0.5, informational: 0.3, _onbekend: 0.5 } as Record<string, number>;
const scoreA = Math.log10(900) * gewicht[a.intentie] * a.relevanceFit;
const scoreB = Math.log10(3500) * gewicht[b.intentie] * b.relevanceFit;
checkWaar("tuinontwerp laten maken verslaat voortuin", scoreA > scoreB,
  `tuinontwerp laten maken ${scoreA.toFixed(2)} (${a.intentie}, fit ${a.relevanceFit}) tegen voortuin ${scoreB.toFixed(2)} (${b.intentie}, fit ${b.relevanceFit})`);

console.log(fouten ? `\n${fouten} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fouten ? 1 : 0);
