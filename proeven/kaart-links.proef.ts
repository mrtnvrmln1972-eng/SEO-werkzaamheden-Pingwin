import fs from "node:fs";
import path from "node:path";
import { kaartLinks, notitieTekst } from "../lib/kaart-links";

// ═══════════════════════════════════════════════════════════
// WAT OP DE KAART STAAT, IS TERUG TE VINDEN (MAAR NIET VOOR DE DEVELOPER)
// ═══════════════════════════════════════════════════════════
// LET OP, DE RICHTING IS OP 25-08-2026 OMGEDRAAID. Deze proef ging over "alles
// van de kaart gaat mee naar de developer". Dat geldt niet meer: een developer
// krijgt de link naar het document plus de zin die Maarten erbij schrijft, en
// verder niets (zie lib/naar-developer.ts en proeven/naar-developer.proef.ts).
// Wat hier overblijft gaat over het verzamelen zelf, en over de mail aan de
// KLANT; daar is de context nog steeds precies wat je nodig hebt.
// Waarom deze proef bestaat (20-08-2026, taak "Locaties aanhaken" bij Nationaal
// Oogcentrum): in de aantekeningen van die kaart stond het hele verhaal. Een link
// naar het stappenplan, een uitklapper met vijf vestigingen (adressen,
// mailadressen, een link naar de locatie) en onderaan een link naar de
// bespreekpunten. Wat de developer kreeg: de titel, de pagina en de documenten
// uit de pijplijn. Geen van die links. En de mail eruit was "kun jij de eerste
// vijf vestigingen aanmaken?", zonder één adres erbij.
//
// De aantekeningen zijn het enige veld op een kaart dat geen automatische stap
// aanraakt, dus wat daar staat, staat er bewust. Juist dat veld bleef achter.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De oogst zelf, op een echt stuk aantekening ───────────────────────────

const NOTITIE = `
<p>Vestigingen Oogwereld en Novio aanhaken, <a href="https://drive.google.com/file/d/abc123/view">stappenplan</a></p>
<details><summary>1e 5 vestigingen Oogwered en Novio</summary>
  <p><strong>Oogwereld Eindhoven</strong></p>
  <p>oosterhof@oogwereld.nl</p>
  <p>Adres - <a href="https://maps.google.com/?q=Elzentlaan+143">Elzentlaan 143, 5611 LL Eindhoven</a></p>
  <p><strong>Novio Nijmegen</strong></p>
  <p>nijmegen@novio-oogzorg.nl</p>
  <p>Zie ook https://novio-oogzorg.nl/vestigingen voor de rest.</p>
</details>
<p><a href="https://docs.google.com/document/d/xyz789/edit">bespreekpunten, oogwereld</a></p>
`;

const gevonden = kaartLinks(NOTITIE);
const urls = gevonden.map((l) => l.url);

check("een link met linktekst komt eruit met die tekst als label",
  gevonden.some((l) => l.label === "stappenplan" && l.url.includes("drive.google.com")),
  "Zonder label staat er een adres van honderd tekens in beeld in plaats van een woord.");

check("een link diep in een uitklapper komt er ook uit",
  urls.some((u) => u.includes("maps.google.com")),
  "De vestigingen stonden in een <details>-blok; dat is precies waar ze zich verstoppen.");

check("een kaal adres in de lopende tekst telt ook mee",
  urls.some((u) => u === "https://novio-oogzorg.nl/vestigingen"),
  "Een adres zonder <a> eromheen is net zo goed een link waar de developer heen moet.");

// Dit is de correctie van 20-08-2026, en hij is de belangrijkste toets in dit
// bestand. De eerste versie oogstte óók mailadressen, en het mailvenster kreeg
// meteen zeven vinkjes waarvan er vijf een vestigingsadres waren, met onderaan de
// mail een rijtje "oosterhof@oogwereld.nl, nijmegen@novio-oogzorg.nl…".
// Maartens oordeel: "die heeft niet 96 e-mails nodig; die adressen staan al in de
// context die meekomt." Ze staan er inderdaad al in, via notitieTekst hieronder,
// bij de vestiging waar ze horen. Als losse link drukken ze de échte stukken weg.
check("mailadressen worden GEEN losse link",
  !urls.some((u) => u.startsWith("mailto:")) && !urls.some((u) => u.includes("@")),
  "Alleen dingen die je kunt openen: een document, een pagina, een locatie.");

check("de meesturen-lijst blijft klein en gaat alleen over stukken",
  gevonden.length === 4,
  `Gevonden: ${gevonden.length} (${gevonden.map((l) => l.label).join(", ")}). Verwacht: stappenplan, de locatie, de vestigingenpagina en de bespreekpunten.`);

check("de laatste link onderaan valt er niet af",
  gevonden.some((l) => l.label === "bespreekpunten, oogwereld"),
  "Die stond los onder de uitklapper.");

const dubbel = kaartLinks('<a href="https://a.nl/x">hier</a>', '<a href="https://a.nl/x">het stappenplan</a>');
check("dezelfde link komt maar één keer terug, met het beste label",
  dubbel.length === 1 && dubbel[0].label === "het stappenplan",
  '"hier" zegt niets; het meest zeggende label hoort te winnen.');

check("een anker of een leeg veld levert niets op",
  kaartLinks('<a href="#top">boven</a>').length === 0 && kaartLinks("", null, undefined).length === 0,
  "Liever geen link dan een link die nergens heen gaat.");

const tekst = notitieTekst(NOTITIE);
check("de aantekeningen worden leesbare tekst met regels",
  tekst.includes("Oogwereld Eindhoven") && tekst.includes("Elzentlaan 143") && tekst.split("\n").length > 3,
  "Voor de mail moet dit gewone tekst zijn, met de opsomming nog als opsomming.");

check("de mailadressen staan wél gewoon in die context",
  tekst.includes("oosterhof@oogwereld.nl") && tekst.includes("nijmegen@novio-oogzorg.nl"),
  "Ze horen bij de vestiging waar ze bij staan, niet als losse regel onderaan een mail.");

check("er blijft geen HTML in die tekst staan", !/<[a-z]/i.test(tekst),
  "Ruwe markup in een mail is precies wat de opmaakregel verbiedt.");

// ── 2. De aantekeningen reizen mee, langs alle drie de wegen ─────────────────

const dev = lees("lib/developer.ts");
check("de developerlijst haalt de aantekeningen op uit de kaart",
  /w\.notitie/.test(dev) && /kaartNotitie: \(r\.notitie as string\)/.test(dev),
  "Zonder deze kolom in de query heeft de developer het verhaal simpelweg niet.");

check("de developerlijst verzamelt de links uit kaart én aantekeningen",
  /kaartLinks\(r\.toelichting as string, r\.notitie as string\)/.test(dev),
  "De links moeten uit allebei komen; in de aantekeningen staan meestal de belangrijkste.");

// ── Waar ze NIET meer heen gaan: de developer (25-08-2026) ──────────────────
// Hier stonden vijf controles die het omgekeerde afdwongen: de aantekeningen en
// alle losse links moesten in het taakvenster van de developer staan én in zijn
// mail. Dat kwam uit één geval bij Nationaal Oogcentrum, waar de developer een
// taak kreeg zonder de stukken die op de kaart stonden. Het loste dat geval op en
// maakte de standaard slechter: bij GardenSwimm kreeg de developer twee blokken
// met verwijzingen waarvan er twee letterlijk "Mail" heetten, en kwam het woord
// "mail" zes keer in één mail te staan. Maartens oordeel: "een developer moet
// niet hoeven nadenken; die moet een eenduidige tekst krijgen."
//
// De regel is omgedraaid en staat nu in lib/naar-developer.ts, met een eigen
// proef (proeven/naar-developer.proef.ts). Wat hier overblijft gaat alleen nog
// over het VERZAMELEN van die links, want dat werkt nog steeds en is nog steeds
// zinnig voor een mail aan de klant.

const doorzet = lees("app/api/admin/weekplan/dev/route.ts");
check("het doorzet-venster kent de links uit de kaart nog steeds",
  /kaartLinks\(kaart\.toelichting/.test(doorzet),
  "Ze zijn niet weg; ze staan alleen niet meer vanzelf aan.");

check("maar ze staan er niet meer standaard aan",
  !/uitKaart\.map\(\(l\) => l\.url\)/.test(doorzet),
  "Naar een developer gaat de link naar het document plus de zin die Maarten erbij schrijft.");

check("ze heten naar wat ze zijn, zonder voorvoegsel",
  !/Uit de kaart: \$\{/.test(doorzet),
  'Een rijtje "Uit de kaart: …" las in het mailvenster als systeemregels in plaats van als de stukken zelf.');

const explain = lees("app/api/admin/task/explain/route.ts");
check("de mailschrijver aan een KLANT kent de aantekeningen",
  /Aantekeningen bij deze taak/.test(explain) && /notitieTekst/.test(explain),
  "Anders schrijft hij netjes om de gegevens heen die er gewoon zijn. Voor een developer gaan ze er juist uit.");

check("de kaart stuurt zijn aantekeningen mee naar de mailschrijver",
  /notitie: t\.notitie/.test(lees("app/admin/client/[slug]/MailUitKaart.tsx")),
  "De server kan ze niet gebruiken als het scherm ze niet meestuurt.");

console.log(fouten === 0 ? "\nWat op de kaart staat, blijft vindbaar." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
