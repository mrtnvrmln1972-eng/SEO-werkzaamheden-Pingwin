// ═══════════════════════════════════════════════════════════
// PROEF: DE PAGINALIJST GEBRUIKT ÉCHT ALLE BRONNEN
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026), vraag van Maarten: hoe weten we zeker dat de analyse
// álle pagina's meeneemt, niet alleen die in de sitemap?
//
// De sitescan veegt vier bronnen bij elkaar (sitemap, Search Console, Ahrefs, de
// interne links). Dat klopte, op één na: als "Search Console" gebruikte hij
// `getGscForClient`, en dat is de functie achter het kaartje op het scherm. Die
// haalt de **top 15 pagina's** over ongeveer vier weken op.
//
// Gemeten bij One Day Clinic: Search Console kent 791 pagina's, er stonden er 16
// met herkomst "gsc" in de lijst, en 47 ontbraken helemaal (vooral Engelse, zoals
// /en/bloedonderzoek/). Die vielen daarmee buiten élke analyse.
//
// Deze proef bewaakt dat de brede bron gebruikt blijft. Een bron die "Search
// Console" heet maar een dashboardwidget is, is precies het soort fout dat
// niemand ziet omdat de naam klopt.

import { readFileSync } from "fs";
import { verenigBronnen } from "../lib/site-urls";

let fouten = 0;
const faal = (wat: string) => { console.error(`  ✗ ${wat}`); fouten++; };
const goed = (wat: string) => console.log(`  ✓ ${wat}`);

const lees = (pad: string) => readFileSync(new URL(`../${pad}`, import.meta.url), "utf8");

// ── De scan pakt de brede Search Console-bron ──────────────
console.log("De sitescan gebruikt de brede Search Console-bron");
const scan = lees("lib/site-urls.ts");

if (scan.includes("getGscAllPages(")) {
  goed("de scan haalt élke pagina op die Search Console kent");
} else {
  faal("de scan gebruikt getGscAllPages niet. Zonder die functie komt de paginalijst uit de top 15 van het dashboardkaartje en ontbreken er honderden pagina's.");
}
if (!/getGscForClient\s*\(/.test(scan)) {
  goed("de scan gebruikt het dashboardkaartje niet meer als bron");
} else {
  faal("getGscForClient staat weer in de sitescan. Die geeft top 25 zoekwoorden en top 15 pagina's over vier weken; dat is een kaartje, geen paginalijst.");
}

// ── De brede bron is ook echt breed ────────────────────────
console.log("De brede bron is ook echt breed");
const google = lees("lib/google.ts");
const blok = /export async function getGscAllPages\(([\s\S]*?)\n}/.exec(google)?.[0] || "";
if (!blok) {
  faal("getGscAllPages bestaat niet in lib/google.ts");
} else {
  const limiet = /rowLimit:\s*(\w+)/.exec(blok)?.[1] || "";
  const standaard = /days\s*=\s*(\d+)/.exec(blok)?.[1] || "0";
  if (blok.includes('dimensions: ["page"]')) goed("hij vraagt op paginaniveau uit");
  else faal("getGscAllPages vraagt niet op paginaniveau uit");
  if (limiet && limiet !== "15") goed(`de grens is instelbaar (${limiet}) en niet de vijftien van het kaartje`);
  else faal("getGscAllPages haalt er nog steeds vijftien op");
  if (Number(standaard) >= 90) goed(`hij kijkt standaard ${standaard} dagen terug`);
  else faal(`hij kijkt maar ${standaard} dagen terug. Een pagina hoort in de lijst zodra Google hem kent, ook met één vertoning in maand twee.`);
}

// ── De vereniging houdt een pagina die alleen Google kent ──
console.log("Een pagina die alleen Search Console kent haalt de lijst");
const uit = verenigBronnen("onedayclinic.nl", {
  sitemap: ["https://onedayclinic.nl/anonieme-soa-test/"],
  gsc: ["https://onedayclinic.nl/en/bloedonderzoek/", "https://onedayclinic.nl/anonieme-soa-test/"],
  ahrefs: [],
  links: ["https://onedayclinic.nl/contact/"],
});
const paden = uit.map((x) => x.url.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, ""));

if (paden.includes("/en/bloedonderzoek")) {
  goed("een pagina die alleen Google kent staat in de lijst");
} else {
  faal("een pagina die alleen in Search Console voorkomt haalde de lijst niet. Dat is precies de groep van 47 die buiten de analyse viel.");
}
if (paden.includes("/contact")) {
  goed("een pagina die alleen via een interne link gevonden is staat er ook in");
} else {
  faal("een pagina die alleen via een link bereikbaar is ontbreekt");
}
const dubbel = uit.filter((x) => x.url.includes("anonieme-soa-test"));
if (dubbel.length === 1 && dubbel[0].bronnen.includes("sitemap") && dubbel[0].bronnen.includes("gsc")) {
  goed("een pagina uit twee bronnen wordt één regel met beide herkomsten");
} else {
  faal(`dezelfde pagina uit sitemap én Search Console leverde ${dubbel.length} regels op`);
}

// ── Een bron die stilvalt moet opvallen ────────────────────
// Op 27-08-2026 leverde Search Console nul pagina's op en was van buitenaf niet te
// zien of dat aan de koppeling lag, aan Google, of aan een scan die vóór een
// deploy liep. De fout werd stil weggeslikt en de telling werd nergens getoond.
// Precies zo kon de top-15-fout jarenlang blijven staan: de bron stond in de
// lijst, dus hij leek te werken.
console.log("Een bron die stilvalt valt op");
if (/perBron/.test(scan)) {
  goed("de scan telt per bron hoeveel pagina's die heeft opgeleverd");
} else {
  faal("de scan geeft geen telling per bron terug; dan is 'Search Console gaf niets' onzichtbaar");
}
if (!/catch\s*\{\s*\/\* optioneel \*\/\s*\}[\s\S]{0,80}getGscAllPages/.test(scan) && /gscFout/.test(scan)) {
  goed("een fout bij het ophalen wordt onthouden in plaats van weggeslikt");
} else {
  faal("een fout bij Search Console wordt nog steeds stil weggeslikt");
}
const urlsRoute = lees("app/api/admin/urls/route.ts");
if (/perBron/.test(urlsRoute) && /Search Console leverde geen enkele pagina/.test(urlsRoute)) {
  goed("de scan meldt het met zoveel woorden als Search Console niets opleverde");
} else {
  faal("de uitkomst van de scan noemt de bronnen niet, dus een stilgevallen bron blijft onzichtbaar");
}

// ── Een leeg antwoord wordt niet onthouden ─────────────────
// Het geheugen van vijf minuten bewaarde ook een LEGE uitkomst. Eén hik bij Google
// en alles wat in die vijf minuten op die cijfers wacht (opruimkandidaten, gaten,
// plaatsadvies, taalmeting) kreeg stilletjes nul terug. Dat is precies het soort
// stilte waar hier vandaag een halve dag in is gaan zitten.
console.log("Een leeg antwoord wordt niet onthouden");
if (/if \(uit\.length\) paarCache\.set/.test(google)) {
  goed("een lege uitkomst gaat niet in het geheugen");
} else {
  faal("een lege uitkomst wordt vijf minuten vastgehouden; één hik bij Google zet dan alles op nul");
}

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "fout" : "fouten"} in de dekking van de paginalijst.`);
  process.exit(1);
}
console.log("\nAlles goed: de paginalijst gebruikt alle bronnen, niet alleen de sitemap.");
