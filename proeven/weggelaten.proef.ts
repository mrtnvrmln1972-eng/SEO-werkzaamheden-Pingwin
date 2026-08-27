// ═══════════════════════════════════════════════════════════
// PROEF: HET WERKPLAN MAG NIET STIL WEGLATEN
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026): zoeken op "Utrecht" of "Rotterdam" in het werkplan gaf
// alleen titelwerk terug. De cannibalisatie-blokken ontbraken niet door een fout,
// ze waren er nooit: de hoofdpagina's van die steden staan op de lijst met
// advertentiepagina's en vallen daarom buiten de opruim-analyse. Dat is een goed
// besluit, maar het scherm zei er niets over, en een weglating zonder reden is
// niet te onderscheiden van een gat.
//
// Deze proef bewaakt drie dingen:
//   1. Een advertentiepagina valt weg MET de reden "advertentie".
//   2. Een plaats waarvan de ankerpagina een advertentiepagina is, sleept haar
//      andere pagina's mee de analyse uit. Dat is geen besluit maar bijvangst, en
//      het moet daarom een eigen reden hebben.
//   3. Een blok waar niets meer te doen is verdwijnt niet, maar komt terug in
//      `plan.afgerond`. Anders is "dit is af" hetzelfde beeld als "nooit bekeken".

import { readFileSync } from "fs";
import { bepaalWeggelaten, WEGLAAT_LABEL, WEGLAAT_UITLEG } from "../lib/opruim-weggelaten";
import { bouwWerkplan, type OpruimRegel } from "../lib/werkplan";

let fouten = 0;
const faal = (wat: string) => { console.error(`  ✗ ${wat}`); fouten++; };
const goed = (wat: string) => console.log(`  ✓ ${wat}`);

// ── De opstelling: een kliniek met stadspagina's, waarvan Utrecht adverteert ──
const ads = {
  paden: ["/soa-klinieken/soa-test-utrecht/", "/en/"],
  geen: false,
  ingevuld: true,
};
const vormen = ["/soa-klinieken/soa-test-<plaats>/", "/soa-poli-<plaats>/"];
const live = [
  "/soa-klinieken/soa-test-utrecht/",        // advertentiepagina
  "/een-soa-test-doen-in-utrecht/",          // GEEN advertentie, maar wel Utrecht
  "/meest-voorkomende-soas-in-utrecht/",     // idem
  "/en/een-soa-test-doen-in-utrecht/",       // valt onder /en/
  "/soa-klinieken/soa-test-breda/",          // gewoon in de analyse
  "/over-ons/",                              // geen aanleiding
];
// Breda kreeg wel een advies, Utrecht niet: dat is precies het gevolg dat we meten.
const adviesPlaatsen = ["breda"];
const werklijst = ["/soa-klinieken/soa-test-breda/"];

const w = bepaalWeggelaten(live, werklijst, ads, adviesPlaatsen, vormen);
const redenVan = (pad: string) => w.paginas.find((p) => p.pad === pad)?.reden || "(niet weggelaten)";

console.log("Weggelaten pagina's, met reden");

// 1. De advertentiepagina zelf.
if (redenVan("/soa-klinieken/soa-test-utrecht/") === "advertentie") {
  goed("een advertentiepagina valt weg met de reden 'advertentie'");
} else {
  faal(`de Utrecht-advertentiepagina kreeg reden '${redenVan("/soa-klinieken/soa-test-utrecht/")}' in plaats van 'advertentie'`);
}
if (redenVan("/en/een-soa-test-doen-in-utrecht/") === "advertentie") {
  goed("alles onder een afgeschermde map telt ook als advertentiepagina");
} else {
  faal("een pagina onder /en/ werd niet als advertentiepagina herkend");
}

// 2. Het gevolg-effect: de rest van de plaats valt mee de analyse uit.
for (const pad of ["/een-soa-test-doen-in-utrecht/", "/meest-voorkomende-soas-in-utrecht/"]) {
  if (redenVan(pad) === "plaats-verweesd") {
    goed(`${pad} krijgt de eigen reden 'plaats valt buiten de analyse'`);
  } else {
    faal(`${pad} kreeg reden '${redenVan(pad)}'. Juist deze pagina's zijn GEEN advertentiepagina en mogen niet op één hoop met 'geen aanleiding': daar zit werk dat blijft liggen.`);
  }
}

// 3. Een pagina waar echt niets voor gevonden is.
if (redenVan("/over-ons/") === "geen-aanleiding") {
  goed("een pagina zonder bevindingen krijgt de reden 'geen aanleiding'");
} else {
  faal(`/over-ons/ kreeg reden '${redenVan("/over-ons/")}'`);
}

// 4. Wat wél beoordeeld is, staat niet in de weglatingen.
if (!w.paginas.some((p) => p.pad === "/soa-klinieken/soa-test-breda/")) {
  goed("een pagina die in de werklijst staat wordt niet als weggelaten geteld");
} else {
  faal("Breda staat in de werklijst maar werd toch als weggelaten geteld");
}
if (w.live === 6 && w.beoordeeld === 1) {
  goed("de telling klopt: 6 live, 1 beoordeeld");
} else {
  faal(`telling klopt niet: live=${w.live} (verwacht 6), beoordeeld=${w.beoordeeld} (verwacht 1)`);
}

// 5. Elke reden die de code kent, heeft een label en een uitleg in gewone taal.
for (const { reden } of w.telling) {
  if (!WEGLAAT_LABEL[reden]) faal(`reden '${reden}' heeft geen label`);
  const uitleg = WEGLAAT_UITLEG[reden] || "";
  if (uitleg.length < 60) {
    faal(`reden '${reden}' heeft geen uitleg die iets uitlegt. Een reden zonder uitleg is weer een gat.`);
  }
}
if (!fouten) goed("elke reden heeft een label en een uitleg in gewone taal");

// ── Een blok zonder open werk verdwijnt niet, maar wordt 'afgerond' ──
console.log("Blokken waar niets meer te doen is");
const regel = (pad: string, groep: string, doorgevoerd: boolean): OpruimRegel => ({
  pad, uitkomst: "opruimen", naar: "", reden: "weg", onderbouwing: [],
  volume: 10, positie: null, groep, doorgevoerd,
});
const plan = bouwWerkplan(
  [
    regel("/soa-klinieken/soa-test-zeist/", "Zeist", true),      // al gedaan
    regel("/soa-klinieken/soa-test-woerden/", "Woerden", false), // nog te doen
  ],
  [], [], [], 3,
);

if (plan.afgerond.some((c) => c.naam === "Zeist")) {
  goed("een blok waarvan alles al doorgevoerd is komt terug in 'afgerond'");
} else {
  faal("Zeist is volledig doorgevoerd en verdween stil uit het plan. Zoeken op 'Zeist' geeft dan nul blokken, precies hetzelfde beeld als een plaats die nooit is bekeken.");
}
if (!plan.clusters.some((c) => c.naam === "Zeist")) {
  goed("een afgerond blok telt niet mee als openstaand werk");
} else {
  faal("Zeist heeft geen open werk meer maar staat toch in het plan");
}
if (plan.clusters.some((c) => c.naam === "Woerden")) {
  goed("een blok met open werk blijft gewoon in het plan staan");
} else {
  faal("Woerden heeft open werk maar staat niet in het plan");
}

// ── De aanroep moet álles meegeven wat de functie nodig heeft ──
// Dit stond er eerst niet, en precies daar ging het mis: de functie was goed en
// groen, maar de route gaf de URL-vormen niet mee. Zonder die vormen kan geen
// enkele plaats als verweesd herkend worden en valt alles stil terug op "geen
// aanleiding". Live was de teller voor 'plaats-verweesd' dus nul, terwijl de
// proef groen stond. Een pure functie bewaken is niet genoeg als de aanroep de
// helft van het antwoord weggooit.
console.log("De aanroep in de API");
const route = readFileSync(new URL("../app/api/admin/opruim-werklijst/route.ts", import.meta.url), "utf8");
// Commentaar eerst weg: de toelichting bíj de aanroep noemt dezelfde woorden als
// de argumenten, dus zonder dit keurt de proef zijn eigen uitleg goed in plaats
// van de code. Precies dat gebeurde bij de eerste versie van deze controle.
const aanroep = (/bepaalWeggelaten\(([\s\S]*?)\n\s*\);/.exec(route)?.[1] || "")
  .replace(/\/\/[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");
if (!aanroep) {
  faal("kan de aanroep van bepaalWeggelaten niet vinden in de opruim-werklijst-route");
} else {
  for (const [wat, patroon] of [
    ["de ads-lijst", /\bads\b/],
    ["de plaatsen waarvoor advies is", /adviezen/],
    ["de URL-vormen", /vormen/],
  ] as const) {
    if (patroon.test(aanroep)) goed(`de route geeft ${wat} mee`);
    else faal(`de route geeft ${wat} NIET mee aan bepaalWeggelaten. Zonder dat valt een reden stil terug op "geen aanleiding" en is het gat weer onzichtbaar.`);
  }
}

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "fout" : "fouten"} in de weglatingen.`);
  process.exit(1);
}
console.log("\nAlles goed: het werkplan laat niets stil weg.");
