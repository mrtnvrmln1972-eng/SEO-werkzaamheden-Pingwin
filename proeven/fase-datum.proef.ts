import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// ELKE FASE ZEGT WANNEER HIJ VOOR HET LAATST IETS OPLEVERDE
// ═══════════════════════════════════════════════════════════
// Bij /hovenier-oss/ stonden strategie, gelieerde pagina's, analyse, blauwdruk en
// copy alle vijf op groen. Vijf vinkjes, en niets dat verraadt dat de strategie
// van vandaag is en de andere drie documenten van 2 augustus, dus van vóór de
// herziening. Maarten: "zodat je kunt zien waar je bent gebleven, of dat een
// oude of een nieuwe fase draaien is."
//
// Er stond al een teller in die rij (lib/fase-historie.ts, "sinds wanneer staat
// deze fase zo"), maar die begint pas te tellen vanaf de eerste uitlezing: een
// fase die al maanden af was zou daarmee "vandaag" gaan heten. Dat is precies
// het verkeerde antwoord op deze vraag. Daarom leest lib/fase-datum.ts de échte
// momenten uit de database en dienen die als eerste stempel.
//
// De les die deze proef bewaakt: één datum in die rij, uit de echte bron. Geen
// tweede chip ernaast, en geen verzonnen "vandaag".

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. Elke fase heeft een bron voor zijn datum ──────────────────────────────

const bron = lees("lib/fase-datum.ts");
for (const [fase, waaruit] of [
  ["strategie", /page_plans/],
  ["gelieerde pagina's", /page_cluster_advice/],
  ["analyse, blauwdruk en copy", /client_activiteit/],
  ["het handmatige vinkje", /page_phase_marks/],
] as [string, RegExp][]) {
  check(`${fase} heeft een echte bron voor de datum`, waaruit.test(bron),
    "Zonder die tabel is er voor die fase geen moment op te halen en valt hij terug op 'vandaag'.");
}

for (const fase of ["analyse", "blauwdruk", "copy", "bouw", "structured"]) {
  check(`fase ${fase} is gekoppeld aan een soort activiteit`,
    new RegExp(`\\b${fase}: \\[`).test(bron),
    "Staat hij niet in SOORT_VOOR_FASE, dan blijft zijn datum leeg terwijl hij wél te weten is.");
}

check("de nieuwste van twee momenten wint",
  /if \(!rij\[fase\] \|\| rij\[fase\]! < datum\) rij\[fase\] = datum/.test(bron),
  "Een fase kan meerdere sporen hebben (een document én een handmatig vinkje); het laatste telt.");

// ── 2. Die echte datum is ook echt de eerste stempel ─────────────────────────

const historie = lees("lib/fase-historie.ts");
check("de fase-historie neemt de echte datums aan",
  /echteDatums/.test(historie),
  "Anders krijgt een fase die al maanden af is bij de eerste uitlezing de datum van vandaag.");

check("de echte datum wordt ook zo weggeschreven",
  /VALUES \(\$\{slug\}, \$\{k\}, \$\{f\}, \$\{af\}, \$\{wanneer\}\)/.test(historie),
  "Werd hier now() weggeschreven terwijl het antwoord de echte datum gaf, dan lopen scherm en database uiteen.");

check("het echte moment wint ALTIJD, ook van een datum die er al stond",
  /const echt = af \? \(echteDatums\[k\]\?\.\[f\] \|\| ""\) : ""/.test(historie),
  "Gold dit alleen bij de eerste stempel, dan bleven verkeerde datums staan: op /hovenier-oss/\n"
  + "       stond bij vier fases '5 aug 16:32' terwijl de strategie van die ochtend 10:25 was.");

check("een bijgetrokken datum wordt ook echt weggeschreven",
  /if \(!eerder \|\| eerder\.af !== af \|\| eerder\.sinds !== echt\)/.test(historie),
  "Anders staat het scherm goed en de database fout, en is het bij de volgende ronde weer mis.");

check("een fase die nog niet af is houdt zijn eigen teller",
  /Geen echt moment te vinden/.test(historie),
  '"Wacht 14 dagen" komt uit deze tabel; daar is geen echt moment voor.');

check("het bord geeft die datums mee",
  /getFaseDatumsAll\(slug\)/.test(lees("app/api/admin/weekplan/route.ts")),
  "De lijst moet meegegeven worden, anders gebeurt er niets met al dat opzoekwerk.");

// ── 3. Eén datum in de rij, niet twee ───────────────────────────────────────

const kaart = lees("app/admin/client/[slug]/weekplan-kaart/KaartFases.tsx");
const chips = (kaart.match(/wp-fase-datum/g) || []).length;
check("er staat precies één datum-chip in een fase-rij", chips === 1,
  `Gevonden: ${chips}. Twee chips naast elkaar is hoe dezelfde vraag twee verschillende antwoorden krijgt.`);

console.log(fouten === 0 ? "\nElke fase laat zien wanneer hij voor het laatst iets opleverde." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
