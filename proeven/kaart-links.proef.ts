import fs from "node:fs";
import path from "node:path";
import { kaartLinks, notitieTekst } from "../lib/kaart-links";

// ═══════════════════════════════════════════════════════════
// WAT OP DE KAART STAAT, GAAT MEE NAAR DE DEVELOPER
// ═══════════════════════════════════════════════════════════
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

check("mailadressen worden aanklikbaar",
  urls.includes("mailto:oosterhof@oogwereld.nl") && urls.includes("mailto:nijmegen@novio-oogzorg.nl"),
  "In dit soort aantekeningen (vestigingen, contactpersonen) staan de mailadressen die hij nodig heeft.");

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

const overzicht = lees("app/admin/developer/DeveloperOverview.tsx");
check("het taakvenster toont de aantekeningen",
  /Aantekeningen bij deze taak/.test(overzicht),
  'De developer opent de taak en moet daar "het verhaal" zien staan, niet alleen een titel.');

check("het taakvenster rendert ze opgemaakt, met werkende links",
  /netteHtml\(taak\?\.kaartNotitie/.test(overzicht),
  "Via netteHtml, zoals alles wat het dashboard op het scherm zet; dan blijven de links klikbaar.");

check("het taakvenster zet de links ook los op een rij",
  /Links uit deze taak/.test(overzicht),
  "In een lange aantekening staat een link makkelijk verstopt.");

check("de mail naar de developer neemt de links mee",
  /for \(const l of r\.kaartLinks \|\| \[\]\)/.test(overzicht),
  'Anders gaat er een mail uit met "kun jij dit doen?" zonder de gegevens erbij.');

check("de mail naar de developer neemt de aantekeningen mee",
  /notitieTekst\(r\.kaartNotitie/.test(overzicht),
  "Als tekst, want een mail hoort simpel te blijven; de gegevens erin zijn wat telt.");

const doorzet = lees("app/api/admin/weekplan/dev/route.ts");
check("het doorzet-venster biedt de links uit de kaart aan",
  /kaartLinks\(kaart\.toelichting/.test(doorzet),
  "Daar kies je wat er meegaat, dus daar moeten ze in de lijst staan.");

check("die links staan standaard aan",
  /uitKaart\.map\(\(l\) => l\.url\)/.test(doorzet),
  "Ze zijn er niet voor niets bij gezet; standaard uit betekent dat ze vergeten worden.");

const explain = lees("app/api/admin/task/explain/route.ts");
check("de mailschrijver kent de aantekeningen",
  /Aantekeningen bij deze taak/.test(explain) && /notitieTekst/.test(explain),
  "Anders schrijft hij netjes om de gegevens heen die er gewoon zijn.");

check("de kaart stuurt zijn aantekeningen mee naar de mailschrijver",
  /notitie: t\.notitie/.test(lees("app/admin/client/[slug]/MailUitKaart.tsx")),
  "De server kan ze niet gebruiken als het scherm ze niet meestuurt.");

console.log(fouten === 0 ? "\nWat op de kaart staat, komt bij de developer terecht." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
