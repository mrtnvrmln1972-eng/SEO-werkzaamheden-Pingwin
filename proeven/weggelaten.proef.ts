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
import { isAdsPad } from "../lib/opruim-regels";
import { bouwWerklijst, markeerDoelRisico, type WerkRegel } from "../lib/opruim-werklijst";
import type { PlaatsAdvies, PlaatsPagina } from "../lib/opruim-plaatsen";
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
    ["de ads-lijst", /ads/i],
    ["de plaatsen waarvoor advies is", /adviezen/],
    ["de URL-vormen", /vormen/],
  ] as const) {
    if (patroon.test(aanroep)) goed(`de route geeft ${wat} mee`);
    else faal(`de route geeft ${wat} NIET mee aan bepaalWeggelaten. Zonder dat valt een reden stil terug op "geen aanleiding" en is het gat weer onzichtbaar.`);
  }
}


// ═══════════════════════════════════════════════════════════
// EEN OMLEIDING NAAR EEN DOEL DAT NIET BESTAAT (27-08-2026)
// ═══════════════════════════════════════════════════════════
// Maarten zag op het scherm dat `/soa-poli-zoetermeer/` (positie 2, echte
// klikken) omgeleid zou worden naar `/soa-klinieken/soa-test-zoetermeer/`. Die
// URL bestaat niet als pagina; hij is uit de gekozen URL-vorm gebouwd en is op de
// site een 301 die via `/soa-test-locaties/soa-test-zoetermeer/` terugkomt op de
// bronpagina. Doorvoeren = oneindige lus = pagina offline. Bij Purmerend is het
// een directe ping-pong. Beide gevallen stonden gewoon in het plan.
console.log("Doelen van omleidingen");

const wr = (pad: string, naar: string): WerkRegel => ({
  pad, uitkomst: "samenvoegen", naar, herkomst: ["plaats"], reden: "", onderbouwing: [],
  term: "", volume: null, klikken: 0, vertoningen: 0, positie: null, groep: "test",
});

const live200 = ["/soa-poli-zoetermeer/", "/soa-test-locaties/soa-test-purmerend/", "/soa-klinieken/soa-test-haarlem/", "/soa-kliniek-haarlem/"];
const omleidingen = {
  // Zoetermeer: twee stappen, terug bij de bron.
  "/soa-klinieken/soa-test-zoetermeer/": "/soa-test-locaties/soa-test-zoetermeer/",
  "/soa-test-locaties/soa-test-zoetermeer/": "/soa-poli-zoetermeer/",
  // Purmerend: directe ping-pong.
  "/soa-klinieken/soa-test-purmerend/": "/soa-test-locaties/soa-test-purmerend/",
};

const gemarkeerd = markeerDoelRisico(
  [
    wr("/soa-poli-zoetermeer/", "/soa-klinieken/soa-test-zoetermeer/"),
    wr("/soa-test-locaties/soa-test-purmerend/", "/soa-klinieken/soa-test-purmerend/"),
    wr("/soa-kliniek-haarlem/", "/soa-klinieken/soa-test-haarlem/"),
  ],
  live200, omleidingen,
);
const risico = (pad: string) => gemarkeerd.find((r) => r.pad === pad)?.doelRisico || "";

if (risico("/soa-poli-zoetermeer/")) {
  goed("een doel dat via twee stappen terugkomt op de bron wordt geblokkeerd");
} else {
  faal("Zoetermeer werd NIET geblokkeerd. Doorvoeren maakt hier een oneindige omleiding op een pagina die op positie 2 staat.");
}
if (risico("/soa-test-locaties/soa-test-purmerend/")) {
  goed("een directe ping-pong tussen twee adressen wordt geblokkeerd");
} else {
  faal("Purmerend werd NIET geblokkeerd, terwijl het doel meteen terugleidt naar de bron.");
}
if (!risico("/soa-kliniek-haarlem/")) {
  goed("een omleiding naar een echte pagina blijft gewoon staan");
} else {
  faal(`Haarlem wijst naar een bestaande pagina maar werd geblokkeerd: ${risico("/soa-kliniek-haarlem/")}`);
}

// ═══════════════════════════════════════════════════════════
// EEN ADVERTENTIEPAGINA DOET MEE, MAAR GAAT NOOIT WEG
// ═══════════════════════════════════════════════════════════
// Ads-pagina's werden helemaal uit de analyse gehouden, en daarmee verdween de
// hele stad: juist de grote steden hebben er vier of vijf pagina's omheen staan
// die de landingspagina in de weg zitten. Ze doen nu mee als de pagina die
// blijft; wat beschermd wordt is dat er nooit iets mee gebeurt.
console.log("Advertentiepagina's in het plan");

const pag = (pad: string, vorm: string, advertentie: boolean, klikken = 0): PlaatsPagina =>
  ({ pad, vorm, term: "", klikken, vertoningen: 0, positie: null, advertentie });

const advies: PlaatsAdvies = {
  plaats: "utrecht", naam: "Utrecht",
  paginas: [
    pag("/soa-klinieken/soa-test-utrecht/", "/soa-klinieken/soa-test-<plaats>/", true),
    pag("/een-soa-test-doen-in-utrecht/", "/een-soa-test-doen-in-<plaats>/", false, 40),
    pag("/soa-poli-utrecht/", "/soa-poli-<plaats>/", false),
  ],
  blijft: "/soa-klinieken/soa-test-utrecht/",
  gaatWeg: ["/een-soa-test-doen-in-utrecht/", "/soa-poli-utrecht/"],
  uitkomst: "samenvoegen", vestiging: true, term: "soa test utrecht",
  volume: 300, moeilijkheid: 20,
  haalbaarheid: { oordeel: "kansrijk", kloof: -20, moeilijkheid: 20, autoriteit: 44, uitleg: "" },
  klikken: 40, vertoningen: 900, bestePositie: 2, onderbouwing: [],
};

const lijst = bouwWerklijst(null, [advies]);
const regelVan = (pad: string) => lijst.find((r) => r.pad === pad);
const adsRegel = regelVan("/soa-klinieken/soa-test-utrecht/");

if (adsRegel && (adsRegel.uitkomst === "blijft" || adsRegel.uitkomst === "uitbouwen")) {
  goed("de advertentiepagina staat in het plan en blijft staan");
} else {
  faal(`de advertentiepagina kreeg uitkomst '${adsRegel?.uitkomst || "(ontbreekt)"}'. Hij moet blijven of uitgebouwd worden, nooit weg.`);
}
if (adsRegel && !adsRegel.naar) {
  goed("de advertentiepagina wordt nergens heen geleid");
} else {
  faal(`de advertentiepagina zou omgeleid worden naar ${adsRegel?.naar}. Dat mag nooit: daar staat betaald verkeer op.`);
}
if (adsRegel?.advertentie) {
  goed("de advertentiepagina is als zodanig gemerkt, zodat het scherm het label kan tonen");
} else {
  faal("de advertentiepagina heeft geen ads-markering, dus op het scherm is niet te zien waaróm er niets mee gebeurt");
}
const concurrenten = ["/een-soa-test-doen-in-utrecht/", "/soa-poli-utrecht/"];
for (const c of concurrenten) {
  const r = regelVan(c);
  if (r && r.uitkomst === "samenvoegen" && r.naar === "/soa-klinieken/soa-test-utrecht/") {
    goed(`${c} wijst naar de advertentiepagina`);
  } else {
    faal(`${c} zou naar de advertentiepagina moeten wijzen, maar kreeg '${r?.uitkomst}' naar '${r?.naar}'. Dit is precies het werk dat eerder helemaal niet in het plan kwam.`);
  }
}

// ═══════════════════════════════════════════════════════════
// ADS MEENEMEN MAG DE PLAATSHERKENNING NIET OPBLAZEN (27-08-2026)
// ═══════════════════════════════════════════════════════════
// De eerste versie liet ALLE advertentiepagina's meedoen in de plaatsherkenning.
// Dat leek de goede uitkomst en was een regressie: de ads-lijst bevat naast losse
// landingspagina's ook hele mappen (bij One Day Clinic de complete `/en/`-sectie).
// Daardoor ontstond een tweede set vormen (`/en/soa-poli-<plaats>/` en familie)
// en zakte het advies van 62 plaatsen naar 18, terwijl er ineens vacaturepagina's
// werden samengevoegd met een SOA-landingspagina. Live gemeten, niet bedacht.
//
// De regel: de VORMEN worden geleerd uit de pagina's zonder ads. Een ads-pagina
// doet daarna mee als hij in zo'n herkende vorm staat, en anders niet.
console.log("Plaatsherkenning met advertentiepagina's erbij");

const plaatsUrls = [
  // De kern: drie plaatsen in twee vormen, genoeg om de vormen te leren.
  ...["haarlem", "gouda", "zaandam", "houten", "bunnik"].flatMap((p) => [
    { url: `/soa-klinieken/soa-test-${p}/`, status: 200 },
    { url: `/soa-poli-${p}/`, status: 200 },
  ]),
  // Utrecht: alleen de ads-stadspagina. Die MOET de plaats binnenhalen.
  { url: "/soa-klinieken/soa-test-utrecht/", status: 200 },
  { url: "/soa-poli-utrecht/", status: 200 },
  // De Engelse sectie en een vacaturepagina staan ook op de ads-lijst. Die mogen
  // GEEN plaatsvorm worden; dat was precies de regressie.
  ...["haarlem", "gouda", "zaandam", "houten", "bunnik", "utrecht"].map((p) => ({ url: `/en/soa-poli-${p}/`, status: 200 })),
  ...["amsterdam", "utrecht", "eindhoven", "rotterdam", "den-haag"].map((p) => ({ url: `/over-ons/vacatures/vacature-basisarts-${p}/`, status: 200 })),
];
const adsLijst = { paden: ["/en/", "/soa-klinieken/soa-test-utrecht/", "/over-ons/vacatures/"], geen: false, ingevuld: true };
const kern = plaatsUrls.map((u) => u.url).filter((u) => !isAdsPad(u, adsLijst));
const vormenUitKern = new Set(kern.map((u) => u.replace(/[a-z-]+\/?$/, "<plaats>/")));

if (![...vormenUitKern].some((v) => v.startsWith("/en/"))) {
  goed("de Engelse sectie levert geen eigen plaatsvorm op (die staat op de ads-lijst)");
} else {
  faal("een /en/-vorm werd als plaatsvorm geleerd. Dat blies het advies eerder op van 62 plaatsen naar 18.");
}
if (kern.every((u) => !u.startsWith("/over-ons/vacatures/"))) {
  goed("vacaturepagina's tellen niet mee bij het leren van plaatsvormen");
} else {
  faal("een vacaturepagina zat in de kern. Die werd eerder samengevoegd met een SOA-landingspagina.");
}
if (!kern.includes("/soa-klinieken/soa-test-utrecht/") && kern.includes("/soa-poli-utrecht/")) {
  goed("de ads-stadspagina zit niet in de kern, maar de gewone stadspagina wel");
} else {
  faal("de kern is verkeerd samengesteld: de ads-stadspagina hoort er niet in, de gewone wel.");
}

// Een zwerver moet over hetzelfde onderwerp gaan als de locatiepagina's. Toen de
// grote steden erbij kwamen, stelde de motor voor om een vacaturepagina en een
// allergietest op te laten gaan in de SOA-landingspagina, puur omdat er een
// stadsnaam in stond. Het onderwerp is af te lezen uit de erkende vormen zelf:
// het woord dat in élke locatievorm voorkomt.
console.log("Zwervers moeten over hetzelfde onderwerp gaan");
const locatieVormen = [
  "/soa-kliniek-<plaats>/", "/soa-klinieken/soa-test-<plaats>/",
  "/soa-poli-<plaats>/", "/soa-test-locaties/soa-test-<plaats>/",
];
const woordenVanVorm = (v: string) =>
  new Set(v.replace(/<plaats>/g, "").split(/[^a-z0-9]+/i).filter((w) => w.length > 2).map((w) => w.toLowerCase()));
const vormWoorden = locatieVormen.map(woordenVanVorm);
const onderwerp = [...vormWoorden[0]].filter((w) => vormWoorden.every((s) => s.has(w)));
const magAanhaken = (vorm: string) => {
  if (!onderwerp.length) return true;
  const w = woordenVanVorm(vorm);
  return onderwerp.some((k) => w.has(k));
};

if (onderwerp.includes("soa")) {
  goed(`het gedeelde onderwerp van de locatievormen is herkend: ${onderwerp.join(", ")}`);
} else {
  faal(`geen gedeeld onderwerp gevonden in de locatievormen; gevonden: ${onderwerp.join(", ") || "(niets)"}`);
}
for (const [vorm, mag, waarom] of [
  ["/soa-klinieken/soa-kliniek-<plaats>/", true, "dit is precies waarvoor de zwerver-ronde bedoeld is"],
  ["/een-soa-test-doen-in-<plaats>/", true, "gaat over hetzelfde onderwerp"],
  ["/over-ons/vacatures/vacature-basisarts-verpleegkundige-<plaats>/", false, "een vacature omleiden naar een SOA-testpagina vernietigt de vacature"],
  ["/allergie-test-<plaats>/", false, "een allergietest is een andere dienst"],
] as const) {
  if (magAanhaken(vorm) === mag) {
    goed(`${vorm} ${mag ? "haakt aan" : "blijft eraf"}: ${waarom}`);
  } else {
    faal(`${vorm} ${mag ? "haakte NIET aan" : "haakte WEL aan"}, terwijl: ${waarom}`);
  }
}

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "fout" : "fouten"} in de weglatingen.`);
  process.exit(1);
}
console.log("\nAlles goed: het werkplan laat niets stil weg.");
