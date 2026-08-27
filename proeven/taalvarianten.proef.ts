// ═══════════════════════════════════════════════════════════
// PROEF: EEN TWEEDE TAAL IS EEN EIGEN BOOM, GEEN DUBBELING
// ═══════════════════════════════════════════════════════════
// Aanleiding (27-08-2026). Bij One Day Clinic stond `/en/` als één regel op de
// lijst met advertentiepagina's. Omdat zo'n regel álles eronder dekt, vielen 315
// pagina's in één klap buiten élke analyse. Fout: die pagina's staan op
// `index, follow`, 211 ervan hebben een echte positie in Google.
//
// Maar ze zomaar in het gewone opruimen gooien is óók fout, en dat is wat deze
// proef bewaakt. De Nederlandse en Engelse versie zijn via hreflang netjes aan
// elkaar gekoppeld; ze samenvoegen sloopt een werkende taalstructuur. De vraag is
// een andere: is er zoekvraag in díe taal?
//
//   geen eigen vraag → vertaling die niemand zoekt, gaat op in de tegenhanger
//   wel eigen vraag  → blijft staan en moet echt vertaald worden

import {
  taalBomen, taalVan, zonderTaal, taalVanZoekopdracht, beoordeelTaalvarianten, merkWoordenVan,
  type GscRegel,
} from "../lib/taalvarianten";
import { teBredeAdsPaden, zonderTeBrede, isAdsPad } from "../lib/opruim-regels";

let fouten = 0;
const faal = (wat: string) => { console.error(`  ✗ ${wat}`); fouten++; };
const goed = (wat: string) => console.log(`  ✓ ${wat}`);

// ── De taalboom herkennen ──────────────────────────────────
console.log("De taalboom herkennen");
const paden = [
  "/anonieme-soa-test/", "/soa-test-utrecht/", "/over-ons/", "/contact/", "/tarieven/",
  "/en/anonieme-soa-test/", "/en/soa-test-utrecht/", "/en/over-ons/", "/en/contact/",
  "/en/tarieven/", "/en/afspraak-maken/",
  "/de/eenmalig/", // te weinig pagina's voor een eigen boom
];
const bomen = taalBomen(paden);
if (bomen.includes("en")) goed("de Engelse sectie wordt als taalboom herkend");
else faal(`de Engelse sectie werd niet herkend; gevonden: ${bomen.join(", ") || "(niets)"}`);
if (!bomen.includes("de")) goed("één losse Duitse pagina is nog geen taalboom");
else faal("een enkele /de/-pagina werd als volwaardige taalboom geteld");

if (taalVan("/en/anonieme-soa-test/", bomen) === "en") goed("een pagina in de boom krijgt zijn taal mee");
else faal("taalVan herkende de Engelse pagina niet");
if (taalVan("/anonieme-soa-test/", bomen) === "") goed("een pagina in de hoofdtaal heeft geen taalprefix");
else faal("een Nederlandse pagina kreeg ten onrechte een taal toegewezen");
if (zonderTaal("/en/anonieme-soa-test/", bomen) === "/anonieme-soa-test") {
  goed("de tegenhanger is te vinden door de taal eraf te halen");
} else {
  faal(`zonderTaal gaf '${zonderTaal("/en/anonieme-soa-test/", bomen)}'`);
}

// ── De taal van een zoekopdracht ───────────────────────────
console.log("De taal van een zoekopdracht");
for (const [zoek, verwacht] of [
  ["soa test utrecht", "nederlands"],
  ["wat kost een soa test", "nederlands"],
  ["std test near me", "engels"],
  ["what is an sti", "engels"],
  ["anonymous std testing amsterdam", "engels"],
  ["chlamydia", "onbekend"],
] as const) {
  const uit = taalVanZoekopdracht(zoek);
  if (uit === verwacht) goed(`"${zoek}" → ${uit}`);
  else faal(`"${zoek}" werd '${uit}' in plaats van '${verwacht}'`);
}

// De merknaam mag nooit als taalsignaal tellen. Live gemeten: "one day clinic"
// werd zes keer als Engelse zoekvraag geteld, terwijl het gewoon iemand is die
// het merk intikt. Dat zou een pagina ten onrechte laten blijven.
console.log("De merknaam telt niet als taal");
const merk = merkWoordenVan("onedayclinic.nl");
if (merk.includes("day") && merk.includes("onedayclinic")) {
  goed(`de merkwoorden komen uit het domein: ${merk.join(", ")}`);
} else {
  faal(`merkWoordenVan gaf ${merk.join(", ") || "(niets)"}`);
}
if (taalVanZoekopdracht("one day clinic", merk) === "onbekend") {
  goed('"one day clinic" telt niet als Engelse zoekvraag');
} else {
  faal(`"one day clinic" werd '${taalVanZoekopdracht("one day clinic", merk)}'. Een merkzoekopdracht is geen bewijs van Engels publiek.`);
}
if (taalVanZoekopdracht("std testing near me", merk) === "engels") {
  goed('een echte Engelse zoekopdracht blijft gewoon Engels');
} else {
  faal('"std testing near me" werd niet meer als Engels herkend; de merkfilter is te grof');
}

// ── Het oordeel per taalvariant ────────────────────────────
console.log("Het oordeel per taalvariant");
const gsc: GscRegel[] = [
  // Deze Engelse pagina heeft écht Engels publiek.
  { keyword: "std test near me", page: "/en/anonieme-soa-test/", clicks: 12, impressions: 400, position: 6 },
  { keyword: "anonymous std testing", page: "/en/anonieme-soa-test/", clicks: 3, impressions: 120, position: 9 },
  // Deze wordt alleen op Nederlandse termen gevonden: niet vertaald, en dus in de
  // weg van zijn eigen tegenhanger.
  { keyword: "soa test utrecht", page: "/en/soa-test-utrecht/", clicks: 1, impressions: 300, position: 8 },
  { keyword: "wat kost een soa test", page: "/en/soa-test-utrecht/", clicks: 0, impressions: 90, position: 14 },
  // De Nederlandse tegenhanger, die hoort niet in het oordeel thuis.
  { keyword: "soa test utrecht", page: "/soa-test-utrecht/", clicks: 40, impressions: 900, position: 3 },
];
const { oordelen } = beoordeelTaalvarianten(paden, gsc);
const van = (p: string) => oordelen.find((o) => o.pad === p.replace(/\/$/, ""));

const metVraag = van("/en/anonieme-soa-test/");
if (metVraag?.uitkomst === "blijft-vertalen") {
  goed("een taalvariant mét eigen zoekvraag blijft staan en gaat de vertaalwachtrij in");
} else {
  faal(`de Engelse pagina met 520 eigen vertoningen kreeg '${metVraag?.uitkomst}'. Die mag nooit samengevoegd worden: hreflang koppelt hem aan zijn tegenhanger.`);
}
if (metVraag && !metVraag.tegenhanger.includes("en/")) {
  goed("de tegenhanger in de hoofdtaal is gevonden");
} else if (!metVraag?.tegenhanger) {
  faal("de Nederlandse tegenhanger werd niet gevonden");
}

const zonderVraag = van("/en/soa-test-utrecht/");
if (zonderVraag?.uitkomst === "samenvoegen") {
  goed("een taalvariant zonder eigen zoekvraag gaat op in zijn tegenhanger");
} else {
  faal(`de Engelse Utrecht-pagina kreeg '${zonderVraag?.uitkomst}'. Hij wordt alleen op Nederlandse termen gevonden, dus hij is een vertaling die niemand zoekt en die zijn eigen tegenhanger in de weg zit.`);
}
if (zonderVraag?.tegenhanger === "/soa-test-utrecht") {
  goed("hij wijst naar de juiste Nederlandse pagina");
} else {
  faal(`de tegenhanger werd '${zonderVraag?.tegenhanger}' in plaats van /soa-test-utrecht`);
}
if (zonderVraag?.onderbouwing.some((r) => r.toLowerCase().includes("hreflang"))) {
  goed("de onderbouwing zegt dat de hreflang-verwijzing eraf moet");
} else {
  faal("de onderbouwing vergeet de hreflang-verwijzing. Zonder die stap blijft Google een vertaling verwachten die er niet meer is.");
}

// Een pagina in de hoofdtaal krijgt nooit een taaloordeel.
if (!oordelen.some((o) => o.pad === "/soa-test-utrecht")) {
  goed("een pagina in de hoofdtaal krijgt geen taaloordeel");
} else {
  faal("een Nederlandse pagina kreeg een taaloordeel; die hoort hier niet thuis");
}

// ── Een hele sectie is geen advertentiepagina ──────────────
console.log("Een hele sectie is geen advertentiepagina");
const alleLive = [
  ...Array.from({ length: 40 }, (_, i) => `/en/pagina-${i}/`),
  "/soa-klinieken/soa-test-utrecht/", "/soa-test-kopen/", "/", "/over-ons/",
];
const adsLijst = {
  paden: ["/en/", "/", "/soa-klinieken/soa-test-utrecht/", "/soa-test-kopen/"],
  geen: false, ingevuld: true,
};
const teBreed = teBredeAdsPaden(adsLijst, alleLive).map((x) => x.pad);
if (teBreed.includes("/en/")) goed("een regel die 40 pagina's dekt wordt gemeld als te breed");
else faal("/en/ dekt 40 pagina's en werd niet als te breed herkend. Dat is precies de regel die 315 pagina's onzichtbaar maakte.");
if (!teBreed.includes("/soa-test-kopen/")) {
  goed("een gewone landingspagina op de wortel blijft gewoon een advertentiepagina");
} else {
  faal("/soa-test-kopen/ is één pagina maar werd als te breed weggezet");
}
if (!teBreed.includes("/")) goed("de homepage dekt alleen zichzelf en blijft toegestaan");
else faal("/ werd als te breed gezien, terwijl hij alleen de homepage zelf dekt");

const effectief = zonderTeBrede(adsLijst, alleLive);
if (!isAdsPad("/en/pagina-3/", effectief)) {
  goed("een Engelse pagina telt niet langer als advertentiepagina");
} else {
  faal("een Engelse pagina wordt nog steeds als advertentiepagina behandeld");
}
if (isAdsPad("/soa-klinieken/soa-test-utrecht/", effectief)) {
  goed("de echte stadslandingspagina blijft wél een advertentiepagina");
} else {
  faal("de stadspagina van Utrecht verloor zijn ads-markering; die moet juist beschermd blijven");
}

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "fout" : "fouten"} in de taalvarianten.`);
  process.exit(1);
}
console.log("\nAlles goed: een tweede taal is een eigen boom.");
