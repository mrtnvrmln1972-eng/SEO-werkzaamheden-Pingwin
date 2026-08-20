import fs from "node:fs";
import path from "node:path";
import { devTaakNu } from "../lib/weekplan";

// ═══════════════════════════════════════════════════════════
// DE TITEL DIE DE SITEBOUWER ZIET, LOOPT MEE MET DE KAART
// ═══════════════════════════════════════════════════════════
// Bij het doorzetten mag je de opdracht anders formuleren dan op de kaart staat:
// "Locaties aanhaken" op de kaart, "GMB vestigingen maken voor 1e 5 vestigingen"
// voor de bouwer. Die eigen formulering hoort te blijven staan.
//
// Maar hij bleef ook staan als de kaart intussen iets ánders was geworden. De
// aantekeningen liepen wél mee (die worden live gelezen), de titel niet. Je paste
// de kaart aan, en de developer bleef de oude formulering zien zonder dat iets
// dat verraadde (gemeld 20-08-2026).
//
// De oplossing is één regel met een geheugen: bij het doorzetten onthouden we de
// kaarttitel van dat moment. Deze proef houdt alle vier de gevallen vast, want ze
// slaan makkelijk om.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De vier gevallen ──────────────────────────────────────────────────────

check("zonder eigen formulering wint de kaart",
  devTaakNu("Locaties aanhaken", "", "") === "Locaties aanhaken",
  "Verreweg het gewoonste geval: je zet door zonder de titel te herschrijven.");

check("een eigen formulering blijft staan zolang de kaart niet verandert",
  devTaakNu("Locaties aanhaken", "GMB vestigingen maken", "Locaties aanhaken") === "GMB vestigingen maken",
  "Daar is over nagedacht; die mag niet zomaar overschreven worden.");

check("verandert de kaart, dan is die formulering ingehaald",
  devTaakNu("Vestigingen Oogwereld aanhaken", "GMB vestigingen maken", "Locaties aanhaken") === "Vestigingen Oogwereld aanhaken",
  "Dit is de melding zelf: de aantekeningen liepen mee en de titel bleef hangen.");

check("een doorzetting van vóór deze regel verandert niet",
  devTaakNu("Locaties aanhaken", "GMB vestigingen maken", "") === "GMB vestigingen maken",
  "Zonder basis weten we niet of hij is ingehaald, en dan is niets veranderen het veilige antwoord.");

check("een lege kaarttitel maakt de doorgeefversie niet leeg",
  devTaakNu("", "GMB vestigingen maken", "") === "GMB vestigingen maken",
  "Liever een oude titel dan geen titel.");

// ── 2. Eén regel, op beide schermen ─────────────────────────────────────────

const weekplan = lees("lib/weekplan.ts");
check("het doorzet-venster leest via die ene regel",
  /taak: devTaakNu\(/.test(weekplan),
  "Anders toont het venster iets anders dan de developerlijst ernaast.");

check("de developerlijst leest via dezelfde regel",
  /taak: devTaakNu\(r\.taak as string, r\.dev_taak as string, r\.dev_taak_basis as string\)/.test(lees("lib/developer.ts")),
  "Twee plekken die zelf beslissen welke titel wint, is hoe ze uiteen gaan lopen.");

check("de basis wordt bij het doorzetten ook echt bewaard",
  /dev_taak_basis  = COALESCE\(\$\{basis\}, dev_taak_basis\)/.test(weekplan),
  "Zonder die kolom is er niets om mee te vergelijken en werkt de hele regel niet.");

check("het doorzet-venster geeft de huidige kaarttitel mee",
  /kaartTaak: huidigeKaart\?\.taak/.test(lees("app/api/admin/weekplan/dev/route.ts")),
  "De server kan de basis niet bewaren als het venster hem niet meestuurt.");

check("de kolom bestaat in het schema",
  /dev_taak_basis TEXT/.test(lees("lib/db.ts")),
  "Zonder ALTER TABLE bestaat de kolom niet en valt alles terug op de oude titel.");

console.log(fouten === 0 ? "\nDe titel voor de sitebouwer loopt mee met de kaart." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
