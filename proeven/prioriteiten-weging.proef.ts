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
import { onderbouwing } from "../lib/prioriteiten-onderbouwing";

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

// De vondst van 6 augustus, op de echte scan van One Day Clinic. Toen een plaats
// nog uit de ZOEKWOORDEN mocht komen ("staat achter twee verschillende diensten")
// werden "pijpen zonder condoom" en "in de keel" plaatsnamen, en kregen ze de
// weging van een lokaal koopwoord. Plaatsen komen daarom alleen nog uit de eigen
// pagina-URL's. Deze proef houdt dat zo.
const odc = leidWerkgebiedAf(
  ["soa test amsterdam", "soa test pijpen zonder condoom", "soa test in de keel",
   "chlamydia test amsterdam", "chlamydia symptomen man", "soa symptomen man"],
  ["https://onedayclinic.nl/soa-test", "https://onedayclinic.nl/chlamydia-test", "https://onedayclinic.nl/bloedonderzoek"],
);
checkWaar("lange vraagzin wordt geen plaats",
  !odc.plaatsen.includes("pijpen zonder condoom") && !odc.plaatsen.includes("in de keel"),
  `gevonden: ${odc.plaatsen.join(", ")}`);
checkWaar("dienstwoord wordt geen plaats", !odc.plaatsen.includes("test"), `gevonden: ${odc.plaatsen.join(", ")}`);
// Een echte plaats in hun eigen zoekwoorden hoort er juist wél in te staan.
checkWaar("amsterdam wordt wel herkend", odc.plaatsen.includes("amsterdam"), `gevonden: ${odc.plaatsen.join(", ")}`);
check("amsterdam telt als lokaal", bepaalIntentie("soa test amsterdam", { propositie: "", kern: [], dienstwoorden: [], plaatsen: odc.plaatsen }), "lokaal-commercial");
// Een plaatsnaam die deze klant nergens gebruikt, telt niet mee. De lijst mag
// nooit los gaan zoeken; anders wordt "echt" (dorp in Limburg) een plaats in
// "is dit echt nodig".
checkWaar("ongebruikte plaatsnaam telt niet mee", !odc.plaatsen.includes("echt"), `gevonden: ${odc.plaatsen.join(", ")}`);
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

// ── 5. De onderbouwing die de klant te zien krijgt ──
// Dezelfde tekst gaat naar het scherm, de weekplan-kaart en de mail. Er mag dus
// niets in staan wat je een klant niet voorlegt.
const basis = {
  type: "content_gap", titel: "", url: "", zoekwoord: "tuinontwerp laten maken",
  maandvolume: 900, huidigePositie: 0, targetPositie: 5, intentie: "transactional",
  effort: 6, timeToEffect: 4, confidence: 0.3, extraKlikkenPerMaand: 44,
  bron: "de kansenlijst",
};
const metNotitie = onderbouwing({ ...basis, rationale: "Directe koopintentie, past bij totaalconcept Paul" });
checkWaar("interne steekwoorden gaan niet mee naar de klant",
  !metNotitie.blokMd.includes("totaalconcept Paul"), metNotitie.blokMd.slice(0, 200));
const metZin = onderbouwing({ ...basis, rationale: "Er is zoekvraag op dit onderwerp, maar geen eigen pagina die erop mikt en dat kost bezoek." });
checkWaar("een echte zin gaat wel mee", metZin.blokMd.includes("geen eigen pagina die erop mikt"), "");
checkWaar("de vier kopjes staan erin",
  ["Wat we zagen", "Waarom dit de moeite waard is", "Wat we gaan doen", "Wat het kan opleveren"].every((k) => metZin.blokMd.includes(k)), metZin.blokMd);
checkWaar("een verwachting blijft een verwachting", metZin.blokMd.includes("geen belofte"), "");
checkWaar("geen jargon in de klanttekst",
  !/tier|roi|relevance|striking|content gap|intentie:/i.test(metZin.blokMd), metZin.blokMd);
// Een klikdoor-kans mag niet als "te lage positie" worden uitgelegd.
const ctr = onderbouwing({ ...basis, type: "ctr_underperform", url: "/hovenier-oss/", huidigePositie: 20, confidence: 0.6 });
checkWaar("klikdoor wordt niet als positieprobleem uitgelegd",
  ctr.blokMd.includes("te weinig op geklikt") && !ctr.blokMd.includes("net buiten waar geklikt wordt"), ctr.blokMd.slice(0, 200));

console.log(fouten ? `\n${fouten} proef(en) mislukt.` : "\nAlle proeven geslaagd.");
process.exit(fouten ? 1 : 0);
