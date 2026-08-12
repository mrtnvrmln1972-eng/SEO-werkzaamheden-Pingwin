// Proef op de keuzeladder voor redirect-doelen (lib/opruim-doelvinder.ts).
//
// Waarom dit bestand er is. De ladder is een reeks oordelen die er in code
// allemaal even redelijk uitzien: kies de opvolger, anders de zuster, anders de
// hub, anders 410, en alleen bij externe links de homepage. Precies zulke regels
// verschuiven stilletjes zodra iemand een drempel bijstelt of een filter
// toevoegt, en het gevolg zie je pas maanden later terug in Google: een
// omleiding die technisch werkt maar niets overdraagt (een soft 404).
//
// Wat hier vastligt, en waarom het uitmaakt:
//   - de trede die eruit komt is de HOOGSTE die past, niet de makkelijkste;
//   - een pagina die zelf weggaat wordt nooit een doel (dat maakt een keten);
//   - een andere taalversie wordt nooit een doel;
//   - zonder externe links en zonder verkeer is 410 het antwoord, niet de
//     homepage: dat is de enige plek in de ladder waar "niets doen" beter is;
//   - bij plaatspagina's wint de dichtstbijzijnde vestiging, maar alleen als de
//     afstand echt gemeten is; zonder die meting valt hij terug op de hub.
//
// De ladder rekent hier op verzonnen sites, zonder database en zonder Ahrefs.

import { maakBak, ladder, kiesBestemmingen, type Bak, type Intenties, type Nabijheid } from "../lib/opruim-doelvinder";
import type { WerkRegel } from "../lib/opruim-werklijst";
import type { ClientUrl } from "../lib/site-urls";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}
function checkWaar(naam: string, waar: boolean, uitleg = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}`);
  if (!waar && uitleg) console.log(`       ${uitleg}`);
}

const SITE = "https://voorbeeld.nl";
const url = (pad: string, extra: Partial<ClientUrl> = {}): ClientUrl => ({
  url: `${SITE}${pad}`, status: 200, redirectTarget: "", title: "", gscClicks: 0, gscImpressions: 0,
  plan: "", hasClusterAdvice: false, lastScanned: null, bronnen: [], ...extra,
});
const regel = (pad: string, uitkomst: WerkRegel["uitkomst"], extra: Partial<WerkRegel> = {}): WerkRegel => ({
  pad, uitkomst, naar: "", herkomst: [], reden: "", onderbouwing: [], term: "",
  volume: null, klikken: 0, vertoningen: 0, positie: null, groep: "", ...extra,
});

function bouw(urls: ClientUrl[], regels: WerkRegel[], tops: { url: string; refDomains: number | null; topKeyword: string }[] = [], adsPaden: string[] = []): Bak {
  return maakBak({ urls, ads: { paden: adsPaden, geen: !adsPaden.length, ingevuld: true }, tops, vasteRegels: [], regels });
}
const doelVan = (bak: Bak, regels: WerkRegel[], pad: string) => {
  const v = ladder(bak, regels).voorstellen.find((x) => x.van === pad);
  return v ? { trede: v.trede, doel: v.doel, waarschuwingen: v.waarschuwingen } : null;
};

// ── 1. Plaatspagina's zonder afstandsgegevens: de hub ─────────────────────
// Weten we niet hoe ver de ene plaats van de andere ligt, dan mag de ladder
// "soa test veldhoven" niet naar de pagina van Breda sturen: dat iemand die naar
// Veldhoven zocht daar geholpen is, is dan een gok. De hub kan dat wel opvangen,
// want daar kiest de bezoeker zelf. Mét gemeten afstand ligt het anders; dat
// staat in proef 9.
{
  const plaatsen = ["veldhoven", "mierlo", "baarn", "zeist", "woerden", "vianen", "harmelen", "grave", "malden"];
  const urls = [
    url("/"),
    url("/soa-klinieken/", { title: "SOA klinieken | Kies je locatie" }),
    url("/soa-klinieken/soa-test-breda/"),
    ...plaatsen.map((p) => url(`/soa-klinieken/soa-test-${p}/`)),
  ];
  const regels: WerkRegel[] = [
    regel("/soa-klinieken/soa-test-breda/", "uitbouwen", { herkomst: ["plaats"] }),
    ...plaatsen.map((p) => regel(`/soa-klinieken/soa-test-${p}/`, "opruimen", { herkomst: ["plaats"], term: `soa test ${p}` })),
  ];
  const bak = bouw(urls, regels);
  const v = doelVan(bak, regels, "/soa-klinieken/soa-test-veldhoven/");
  check("plaatspagina zonder vraag gaat naar de categorie erboven", v?.doel, "/soa-klinieken/");
  check("en dat is trede 3, niet trede 2", v?.trede, "hub");
  checkWaar("zonder gemeten afstand wordt de zusterstad nooit het doel",
    !ladder(bak, regels).voorstellen.some((x) => x.doel.includes("breda")),
    "Een andere stad als bestemming is zonder afstand een aanname, en die hoort de ladder niet te doen.");
  checkWaar("veel-naar-één van hetzelfde type geeft geen waarschuwing maar een bevestiging",
    (v?.waarschuwingen || []).some((w) => /hetzelfde type/.test(w)));
}

// ── 2. Geen hub, geen links, geen verkeer: 410 ────────────────────────────
{
  const urls = [url("/"), url("/over-ons/")];
  const regels = [regel("/oude-actiepagina/", "opruimen")];
  const bak = bouw([...urls, url("/oude-actiepagina/")], regels);
  const v = doelVan(bak, regels, "/oude-actiepagina/");
  check("zonder relevant doel wordt het 410", v?.trede, "410");
  check("en dan staat er geen bestemming", v?.doel, "");
}

// ── 3. Geen hub, wél externe links: de homepage als laatste redmiddel ─────
{
  const urls = [url("/"), url("/over-ons/"), url("/oude-actiepagina/")];
  const regels = [regel("/oude-actiepagina/", "opruimen")];
  const bak = bouw(urls, regels, [{ url: `${SITE}/oude-actiepagina/`, refDomains: 7, topKeyword: "" }]);
  const v = doelVan(bak, regels, "/oude-actiepagina/");
  check("met verwijzende domeinen wordt het de homepage", v?.trede, "homepage");
  check("en die wijst naar de wortel", v?.doel, "/");
}

// ── 4. De inhoudelijke opvolger wint van de hub ───────────────────────────
// Twee pagina's over hetzelfde onderwerp, één blijft. Dan is dát het doel, ook
// al bestaat er een categorie erboven.
{
  // Een site van vier pagina's is geen site: dan is elk woord even zeldzaam en
  // zeggen de cijfers niets. Daarom een realistische vulling eromheen.
  const vulling = ["hiv", "syfilis", "gonorroe", "hpv", "herpes", "trichomonas", "hepatitis", "soa",
    "prijzen", "afspraak", "contact", "over-ons", "blog", "vragen", "uitslag", "anoniem"];
  const urls = [
    url("/"), url("/thuistesten/"),
    url("/thuistesten/chlamydia-thuistest/"), url("/chlamydia-thuistest-kopen/"),
    ...vulling.map((v) => url(`/${v}/`)),
  ];
  const regels = [
    regel("/thuistesten/chlamydia-thuistest/", "uitbouwen"),
    regel("/chlamydia-thuistest-kopen/", "opruimen"),
  ];
  const bak = bouw(urls, regels);
  const v = doelVan(bak, regels, "/chlamydia-thuistest-kopen/");
  check("de pagina over hetzelfde onderwerp wint", v?.doel, "/thuistesten/chlamydia-thuistest/");
  check("en dat is trede 1", v?.trede, "opvolger");
}

// ── 5. Een pagina die zelf weggaat wordt nooit een doel ───────────────────
{
  const urls = [url("/"), url("/hub/"), url("/hub/kind-a/"), url("/hub/kind-b/")];
  const regels = [
    regel("/hub/kind-a/", "opruimen"),
    regel("/hub/kind-b/", "opruimen"),
  ];
  const bak = bouw(urls, regels);
  const alle = ladder(bak, regels).voorstellen;
  checkWaar("geen enkel voorstel wijst naar een pagina die zelf verdwijnt",
    alle.every((v) => !["/hub/kind-a", "/hub/kind-b"].includes(v.doel)),
    "Dat zou een keten opleveren: het oude adres wijst naar een adres dat straks ook weg is.");
  checkWaar("ze gaan allebei naar de hub erboven", alle.every((v) => v.doel === "/hub/"),
    `Kreeg: ${JSON.stringify(alle.map((v) => v.doel))}`);
  checkWaar("het doel houdt de schrijfwijze van de site zelf (met afsluitende slash)",
    alle.every((v) => v.doel.endsWith("/")),
    "Zonder die slash zet WordPress er zelf nog een omleiding achter, en dan zijn het twee hops.");
}

// ── 6. Nooit over de taalgrens heen ───────────────────────────────────────
{
  const urls = [url("/"), url("/en/"), url("/en/sti-test/"), url("/en/sti-test-amsterdam/")];
  const regels = [regel("/en/sti-test-amsterdam/", "opruimen"), regel("/en/sti-test/", "uitbouwen")];
  const bak = bouw(urls, regels);
  const v = doelVan(bak, regels, "/en/sti-test-amsterdam/");
  checkWaar("een Engelse pagina blijft binnen de Engelse versie", (v?.doel || "").startsWith("/en") || v?.trede === "410",
    `Kreeg: ${JSON.stringify(v)}`);
}

// ── 7. Veel-naar-één met gemengde types wordt wél gemeld ──────────────────
// Twintig plaatsen naar één locatiepagina kan prima; twintig verschillende
// soorten pagina's naar één hub is een reden om te controleren.
{
  const soorten = ["fiets", "auto", "boot", "tuin", "keuken", "badkamer", "dak", "vloer", "raam"];
  const urls = [url("/"), url("/diensten/"), ...soorten.map((x) => url(`/diensten/${x}-onderhoud-oud/`))];
  const regels = soorten.map((x) => regel(`/diensten/${x}-onderhoud-oud/`, "opruimen"));
  const bak = bouw(urls, regels);
  const v = doelVan(bak, regels, "/diensten/fiets-onderhoud-oud/");
  checkWaar("gemengde bronnen naar één doel leveren een waarschuwing op",
    (v?.waarschuwingen || []).some((w) => /verschillend type/.test(w)),
    `Kreeg: ${JSON.stringify(v?.waarschuwingen)}`);
}

// ── 8. De intentie-rem sloopt de hub niet ────────────────────────────────
// Trede 1 en 2 vergelijken twee pagina's die elkaar moeten vervangen; daar is
// een botsende zoekintentie een echte blokkade. Een categoriepagina is per
// definitie breder en bedient meer dan één soort vraag. Live ging dat meteen
// mis: zes plaatspagina's van One Day Clinic vielen terug op 410 omdat "soa
// poli bemmel" als informatief te boek stond en het locatie-overzicht als
// transactioneel, terwijl dat dezelfde vraag is. Het verschil hoort een
// waarschuwing te zijn, geen besluit.
{
  const plaatsen = ["bemmel", "cuijk", "nuenen", "abcoude", "grave", "malden", "baarn", "zeist", "vianen"];
  const urls = [
    url("/"), url("/soa-klinieken/", { title: "SOA klinieken | Kies je locatie" }),
    ...plaatsen.map((p) => url(`/soa-klinieken/soa-poli-${p}/`)),
  ];
  const regels = plaatsen.map((p) => regel(`/soa-klinieken/soa-poli-${p}/`, "opruimen", { herkomst: ["plaats"], term: `soa poli ${p}` }));
  const bak = maakBak({
    urls, ads: { paden: [], geen: true, ingevuld: true },
    tops: [{ url: `${SITE}/soa-klinieken/`, refDomains: null, topKeyword: "soa kliniek" }],
    vasteRegels: [], regels,
  });
  const intenties: Intenties = new Map([["soa poli bemmel", "informatief"], ["soa kliniek", "transactioneel"]]);
  const v = ladder(bak, regels, intenties).voorstellen.find((x) => x.van === "/soa-klinieken/soa-poli-bemmel/");
  check("een botsende intentie zet de hub niet opzij", v?.trede, "hub");
  checkWaar("maar hij wordt wel gemeld", (v?.waarschuwingen || []).some((w) => /zoekintentie/.test(w)),
    `Kreeg: ${JSON.stringify(v?.waarschuwingen)}`);
}

// ── 9. Mét gemeten afstand wint de dichtstbijzijnde vestiging ────────────
// Dit is de trede die het meeste oplevert, en tegelijk de gevaarlijkste: hij
// stuurt bezoekers naar een andere stad. Daarom drie dingen vastgelegd: dichtbij
// wint van de hub, te ver valt terug op de hub, en een bestemming die zelf niets
// voorstelt telt niet mee (anders voed je de zwakste pagina van de familie).
{
  const plaatsen = ["veldhoven", "nuenen", "mierlo", "koudekerke", "baarn", "zeist", "vianen", "grave", "malden"];
  const urls = [
    url("/"), url("/soa-klinieken/", { title: "SOA klinieken | Kies je locatie" }),
    url("/soa-klinieken/soa-test-eindhoven/", { gscClicks: 253, gscImpressions: 7158 }),
    url("/soa-klinieken/soa-test-rotterdam/", { gscClicks: 396, gscImpressions: 18739 }),
    url("/soa-klinieken/soa-test-leiden/"),   // bestaat, maar haalt niets: geen bestemming
    ...plaatsen.map((p) => url(`/soa-klinieken/soa-test-${p}/`)),
  ];
  const regels: WerkRegel[] = plaatsen.map((p) =>
    regel(`/soa-klinieken/soa-test-${p}/`, "opruimen", { herkomst: ["plaats"], groep: p, term: `soa test ${p}` }));
  // De kandidaat heeft een eigen zoekterm nodig, anders valt de intentie-rem
  // sowieso stil en test de laatste controle hieronder niets.
  const bak = bouw(urls, regels, [{ url: `${SITE}/soa-klinieken/soa-test-eindhoven/`, refDomains: null, topKeyword: "soa test eindhoven" }]);
  // Coördinaten zoals de plaatsendienst ze geeft. Veldhoven ligt naast
  // Eindhoven; Koudekerke ligt in Zeeland, ver van elke vestiging.
  const co = (lat: number, lon: number, naam: string) => ({ lat, lon, naam });
  const nabij: Nabijheid = {
    plaatsVan: new Map([
      ["/soa-klinieken/soa-test-veldhoven", "veldhoven"],
      ["/soa-klinieken/soa-test-koudekerke", "koudekerke"],
      ["/soa-klinieken/soa-test-eindhoven", "eindhoven"],
      ["/soa-klinieken/soa-test-rotterdam", "rotterdam"],
      ["/soa-klinieken/soa-test-leiden", "leiden"],
    ]),
    coord: new Map([
      ["veldhoven", co(51.4181, 5.4039, "Veldhoven")],
      ["koudekerke", co(51.4869, 3.5636, "Koudekerke")],
      ["eindhoven", co(51.4416, 5.4697, "Eindhoven")],
      ["rotterdam", co(51.9225, 4.4792, "Rotterdam")],
      ["leiden", co(52.1601, 4.4970, "Leiden")],
    ]),
    doelen: new Set(["/soa-klinieken/soa-test-eindhoven", "/soa-klinieken/soa-test-rotterdam"]),
  };
  // Met een botsend intentielabel erbij: dat mag trede 2 niet blokkeren. Ahrefs
  // labelt "soa test veldhoven" als informatief en "soa test eindhoven" als
  // transactioneel, terwijl dat dezelfde vraag is. Live blokkeerde die rem elf
  // van de achtendertig bestemmingen, waaronder Rotterdam compleet.
  const intenties: Intenties = new Map([["soa test veldhoven", "informatief"], ["soa test eindhoven", "transactioneel"]]);
  const uit = ladder(bak, regels, intenties, nabij);
  const veld = uit.voorstellen.find((v) => v.van === "/soa-klinieken/soa-test-veldhoven/");
  check("dichtbij wint van de hub", veld?.doel, "/soa-klinieken/soa-test-eindhoven/");
  check("en dat is trede 2", veld?.trede, "zuster");
  checkWaar("een botsend intentielabel blokkeert de vestiging niet, maar wordt wel gemeld",
    (veld?.waarschuwingen || []).some((w) => /zoekintentie/.test(w)),
    `Kreeg: ${JSON.stringify(veld?.waarschuwingen)}`);
  const koud = uit.voorstellen.find((v) => v.van === "/soa-klinieken/soa-test-koudekerke/");
  check("te ver valt terug op de hub", koud?.doel, "/soa-klinieken/");
  checkWaar("en dan staat erbij hoe ver het was",
    (koud?.waarom || []).some((w) => /te ver/.test(w)), `Kreeg: ${JSON.stringify(koud?.waarom)}`);
  checkWaar("een stadspagina die zelf niets haalt wordt nooit een bestemming",
    !uit.voorstellen.some((v) => v.doel.includes("leiden")),
    "Naar een lege stadspagina omleiden voedt precies de verkeerde pagina.");
  const zonderPlaats = uit.voorstellen.find((v) => v.van === "/soa-klinieken/soa-test-baarn/");
  check("een plaats zonder ligging valt netjes terug op de hub", zonderPlaats?.doel, "/soa-klinieken/");
}

// ── 10. Alleen een plaats mét vestiging mag een bestemming zijn ──────────
// De duurste fout van deze hele ladder, en hij zag er in de code redelijk uit:
// zonder dit filter koos hij de dichtstbijzijnde plaatspagina die bestond, en
// dat was een tussenplaats zonder kliniek. Naaldwijk ging naar Delft (nul
// bezoekers, geen vestiging) in plaats van naar Den Haag, en Veldhoven naar
// Tilburg in plaats van naar Eindhoven. Technisch dichtbij, inhoudelijk fout:
// de bezoeker zocht een kliniek en daar zit er geen.
{
  const urls = [
    url("/"), url("/soa-klinieken/"),
    url("/soa-klinieken/soa-test-den-haag/", { gscClicks: 231, gscImpressions: 10461 }),
    url("/hiv-test-den-haag/"),                         // over die stad, ander onderwerp
    url("/bloedonderzoek-nijmegen/"),                   // idem
    url("/soa-test-locaties/soa-test-delft/"),          // bestaat, geen vestiging
    url("/soa-klinieken/soa-test-nijmegen/"),           // vestiging, maar haalt niets
    url("/soa-klinieken-nijmegen/"),                    // vestiging, en aangewezen thuisbasis
    url("/soa-poli-naaldwijk/"), url("/soa-poli-schipluiden/"),
    // Genoeg soa-pagina's zodat "soa" ook echt als thema van de site telt; op
    // een site van zeven pagina's zegt "dit woord komt vaak voor" niets.
    ...["test", "zelftest", "thuistest", "kliniek", "poli", "uitslag", "kosten", "anoniem", "spoed", "chlamydia"]
      .map((x) => url(`/soa-${x}/`)),
  ];
  const regels: WerkRegel[] = [
    regel("/soa-klinieken-nijmegen/", "uitbouwen"),
    regel("/hiv-test-den-haag/", "uitbouwen"),          // wel aangewezen, tóch geen bestemming
    regel("/bloedonderzoek-nijmegen/", "uitbouwen"),
    regel("/soa-poli-naaldwijk/", "opruimen", { herkomst: ["plaats"], groep: "Naaldwijk" }),
  ];
  const bak = bouw(urls, regels);
  const gaatWeg = new Map([["/soa-poli-naaldwijk", "Naaldwijk"], ["/soa-poli-schipluiden", "Schipluiden"]]);
  const gekozen = kiesBestemmingen(bak, regels, gaatWeg, ["Den Haag", "Nijmegen"]);
  check("een vestigingsplaats levert precies één bestemming", gekozen.size, 2);
  checkWaar("een plaats zonder vestiging wordt nooit een bestemming",
    ![...gekozen.keys()].some((p) => p.includes("delft")),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}`);
  checkWaar("bij meerdere pagina's voor dezelfde vestiging wint de aangewezen thuisbasis",
    gekozen.has("/soa-klinieken-nijmegen") && !gekozen.has("/soa-klinieken/soa-test-nijmegen"),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}`);
  checkWaar("een pagina over die stad maar over een ander onderwerp valt af",
    ![...gekozen.keys()].some((p) => p.includes("hiv-test") || p.includes("bloedonderzoek")),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}. Een bestemming moet het onderwerp delen dat alle bronnen gemeen hebben.`);
  checkWaar("de stadspagina met bezoekers wint van een aangewezen bijzaakpagina",
    gekozen.has("/soa-klinieken/soa-test-den-haag"),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}`);
  checkWaar("de plaatsnaam met een spatie erin wordt gevonden",
    [...gekozen.keys()].some((p) => p.includes("den-haag")),
    "Den Haag hoort te matchen op den-haag in het pad.");
  checkWaar("een pagina die zelf weggaat wordt geen bestemming",
    ![...gekozen.keys()].some((p) => p.includes("naaldwijk")));
}

// ── 11. Een advertentiepagina die zelf bezoekers haalt, mag een doel zijn ─
// De hardste botsing tussen twee regels die allebei klopten. Advertentiepagina's
// worden overal uitgesloten, want een Ads-landingspagina op noindex haalt niets
// uit Google en oogt daardoor als dood gewicht. Maar bij One Day Clinic stonden
// juist de vijf sterkste locatiepagina's in die lijst (samen ruim 1.500
// bezoekers per maand), en uitsluiten liet als bestemming alleen blogpagina's
// over: /wat-kost-een-soa-test-in-amsterdam/ voor zestien plaatspagina's.
// De bescherming blijft (ze worden nooit opgeruimd), de uitsluiting als doel
// geldt alleen nog voor een pagina die organisch echt niets doet.
{
  const urls = [
    url("/"), url("/soa-klinieken/"),
    url("/soa-klinieken/soa-test-utrecht/", { gscClicks: 223, gscImpressions: 11347 }), // ads én sterk
    url("/soa-klinieken/soa-test-leiden/"),                                             // ads én leeg
    url("/een-soa-test-doen-in-utrecht/"),                                              // blog
    url("/soa-poli-zeist/"),
    ...["test", "zelftest", "thuistest", "kliniek", "poli", "uitslag", "kosten", "anoniem", "spoed", "chlamydia"]
      .map((x) => url(`/soa-${x}/`)),
  ];
  const regels = [regel("/soa-poli-zeist/", "opruimen", { herkomst: ["plaats"], groep: "Zeist" })];
  const ads = ["/soa-klinieken/soa-test-utrecht/", "/soa-klinieken/soa-test-leiden/"];
  const bak = bouw(urls, regels, [], ads);
  const gekozen = kiesBestemmingen(bak, regels, new Map([["/soa-poli-zeist", "Zeist"]]), ["Utrecht", "Leiden"]);
  check("een advertentiepagina met bezoekers is wél een bestemming", gekozen.get("/soa-klinieken/soa-test-utrecht"), "Utrecht");
  checkWaar("een advertentiepagina zonder bezoekers blijft uitgesloten",
    !gekozen.has("/soa-klinieken/soa-test-leiden"),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}`);
  checkWaar("en een blog over die stad wint er nooit van",
    ![...gekozen.keys()].some((p) => p.includes("een-soa-test-doen")),
    `Kreeg: ${JSON.stringify([...gekozen.keys()])}`);
}

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
