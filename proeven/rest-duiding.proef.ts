// ═══════════════════════════════════════════════════════════
// PROEF: DE REST KRIJGT EEN OORDEEL, GEEN RESTBAK
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026), Maartens woorden: "Hier heb ik gewoon een lijst met
// URL's waar ik geen reet aan heb." Er stonden 331 pagina's onder "geen
// aanleiding gevonden", en daar kun je geen plan uit maken: je weet niet of het
// komt doordat er geen zoekvraag is, geen vertoningen, geen ranking, of doordat
// er simpelweg niet naar gekeken is.
//
// Zijn redenering is de regel geworden: geen zoekvolume betekent opruimen (bij
// duizend pagina's is dood gewicht een probleem), wél vraag maar geen ranking
// betekent optimaliseren. Deze proef legt die vertaling vast.

import { duidPagina, duidRest, isGeenEchtePagina, REST_LABEL, REST_WAT_NU, REST_VOLGORDE, type PaginaCijfers } from "../lib/rest-duiding";

let fouten = 0;
const faal = (wat: string) => { console.error(`  ✗ ${wat}`); fouten++; };
const goed = (wat: string) => console.log(`  ✓ ${wat}`);

const c = (klikken: number, vertoningen: number, positie: number | null): PaginaCijfers => ({ klikken, vertoningen, positie });

console.log("Het oordeel per pagina");
for (const [pad, cijfers, verwacht, waarom] of [
  ["/bloedonderzoek-amstelveen/", c(0, 0, null), "opruimen",
   "geen enkele vertoning in negentig dagen: niemand zoekt hem en niemand vindt hem"],
  ["/soa-test-kopen/", c(0, 800, 14), "optimaliseren",
   "er komt vraag op af maar hij staat te laag om er iets aan over te houden"],
  ["/hiv-test/", c(0, 900, 4), "klik-blijft-liggen",
   "Google toont hem op plek 4 en er komt geen klik uit: dat is titel-en-description-werk"],
  ["/soa-test/", c(120, 4000, 2), "doet-het-goed",
   "levert echt bezoekers op, hier moet je vanaf blijven"],
  ["/author/onedaylgn18d/page/5/", c(0, 0, null), "geen-echte-pagina",
   "paginering van een auteursarchief is geen pagina waar SEO-werk op hoort"],
  ["/soa-blog/page/3/", c(2, 30, 40), "geen-echte-pagina",
   "ook met wat vertoningen blijft paginering paginering"],
] as const) {
  const uit = duidPagina(pad, cijfers);
  if (uit.oordeel === verwacht) goed(`${pad} → ${REST_LABEL[uit.oordeel]}`);
  else faal(`${pad} kreeg '${uit.oordeel}' in plaats van '${verwacht}': ${waarom}`);
}

console.log("Elk oordeel is na te rekenen");
const opruim = duidPagina("/losse-pagina/", c(0, 0, null));
if (/geen enkele vertoning/i.test(opruim.onderbouwing)) {
  goed("een opruim-oordeel zegt waaróp het rust");
} else {
  faal(`de onderbouwing bij opruimen zegt niets meetbaars: "${opruim.onderbouwing}"`);
}
const opt = duidPagina("/iets/", c(0, 800, 14));
if (/800/.test(opt.onderbouwing) && /14/.test(opt.onderbouwing.replace(",", "."))) {
  goed("een optimaliseer-oordeel noemt de vertoningen en de plek");
} else {
  faal(`de onderbouwing mist de cijfers: "${opt.onderbouwing}"`);
}

console.log("De groepen en hun uitleg");
for (const o of REST_VOLGORDE) {
  if (!REST_LABEL[o]) faal(`oordeel '${o}' heeft geen label`);
  if ((REST_WAT_NU[o] || "").length < 80) faal(`oordeel '${o}' heeft geen uitleg die zegt wat je ermee moet`);
}
if (!fouten) goed("elk oordeel heeft een label en een uitleg die een handeling noemt");

// Het label moet een HANDELING zijn, geen constatering. "Geen aanleiding
// gevonden" was precies het probleem.
for (const o of REST_VOLGORDE) {
  if (/geen aanleiding/i.test(REST_LABEL[o])) faal(`'${REST_LABEL[o]}' is een restbak-label, geen oordeel`);
}

console.log("Groeperen");
const groepen = duidRest(
  ["/a/", "/b/", "/author/x/page/2/", "/c/"],
  new Map([["/a", c(0, 900, 12)], ["/b", c(0, 0, null)], ["/c", c(50, 900, 3)]]),
);
const namen = groepen.map((g) => g.oordeel);
if (namen.includes("optimaliseren") && namen.includes("opruimen") && namen.includes("geen-echte-pagina")) {
  goed(`vier pagina's werden ${groepen.length} groepen: ${namen.join(", ")}`);
} else {
  faal(`de groepering klopt niet: ${namen.join(", ")}`);
}
if (namen[0] === "optimaliseren") {
  goed("de groep waar groei zit staat bovenaan");
} else {
  faal(`bovenaan staat '${namen[0]}'; het werk dat iets oplevert hoort eerst`);
}
const zonderCijfers = duidRest(["/onbekend/"], new Map());
if (zonderCijfers[0]?.oordeel === "opruimen") {
  goed("een pagina zonder cijfers telt als niet gevonden, niet als onbekend");
} else {
  faal("een pagina zonder Search Console-cijfers kreeg geen oordeel");
}

if (!isGeenEchtePagina("/soa-test/")) goed("een gewone pagina is geen paginering");
else faal("/soa-test/ werd als techniek-adres gezien");

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "fout" : "fouten"} in de duiding.`);
  process.exit(1);
}
console.log("\nAlles goed: de rest is een plan, geen lijst URL's.");
