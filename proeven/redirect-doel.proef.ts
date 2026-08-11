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
//   - bij plaatspagina's wordt de zusterstad bewust overgeslagen.
//
// De ladder rekent hier op verzonnen sites, zonder database en zonder Ahrefs.

import { maakBak, ladder, type Bak } from "../lib/opruim-doelvinder";
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
  plan: "", hasClusterAdvice: false, lastScanned: null, ...extra,
});
const regel = (pad: string, uitkomst: WerkRegel["uitkomst"], extra: Partial<WerkRegel> = {}): WerkRegel => ({
  pad, uitkomst, naar: "", herkomst: [], reden: "", onderbouwing: [], term: "",
  volume: null, klikken: 0, vertoningen: 0, positie: null, groep: "", ...extra,
});

function bouw(urls: ClientUrl[], regels: WerkRegel[], tops: { url: string; refDomains: number | null; topKeyword: string }[] = []): Bak {
  return maakBak({ urls, ads: { paden: [], geen: true, ingevuld: true }, tops, vasteRegels: [], regels });
}
const doelVan = (bak: Bak, regels: WerkRegel[], pad: string) => {
  const v = ladder(bak, regels).voorstellen.find((x) => x.van === pad);
  return v ? { trede: v.trede, doel: v.doel, waarschuwingen: v.waarschuwingen } : null;
};

// ── 1. Plaatspagina's: de hub, niet de zusterstad ─────────────────────────
// Achttien plaatspagina's, één locatie-overzicht erboven, en twee plaatsen die
// blijven. De ladder mag "soa test veldhoven" niet naar de pagina van Breda
// sturen: dat iemand die naar Veldhoven zocht daar geholpen is, kunnen we niet
// aantonen. De hub kan dat wel, want daar kiest de bezoeker zelf.
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
  checkWaar("de zusterstad wordt nooit het doel",
    !ladder(bak, regels).voorstellen.some((x) => x.doel.includes("breda")),
    "Een andere stad als bestemming is een aanname over afstand die we niet kunnen aantonen.");
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

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
