import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// EEN GEPLAKTE GOOGLE-LINK HEET NAAR ZIJN DOCUMENT
// ═══════════════════════════════════════════════════════════
// Wat er in de aantekeningen van een taak stond na het plakken van een sheet:
// twee regels adres van honderd tekens, en je moest hem openen om te weten wat
// het was. Drive weet gewoon hoe het bestand heet.
//
// Twee dingen die deze proef vasthoudt, want ze zijn allebei makkelijk stuk te
// maken: het opzoeken mag het plakken niet ophouden (dus achteraf, en een
// mislukking laat de link staan), en een naam die iemand zélf heeft getypt mag
// nooit overschreven worden.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

const bron = lees("lib/drive-naam.ts");

check("alleen Google-links worden benoemd",
  /docs\|sheets\|slides\|drive\)\\\.google\\\.com/.test(bron) || /\(docs\|sheets\|slides\|drive\)/.test(bron),
  "Een willekeurige link heeft geen naam in Drive en hoort met rust gelaten te worden.");

check("een link die zijn eigen adres toont wordt vervangen",
  /function toontZijnEigenAdres/.test(bron),
  "Dat is precies het geval waar het om gaat: het adres in beeld in plaats van een naam.");

check("een zelfgetypte linktekst blijft staan",
  /if \(tekst === href\) return true;/.test(bron) && /if \(!tekst\) return true;/.test(bron),
  'Heeft iemand er "de vestigingenlijst" van gemaakt, dan is dat een bewuste keuze.');

check("dezelfde link wordt maar één keer opgezocht",
  /const gevonden = new Map<string, string>\(\)/.test(bron),
  "Tien keer hetzelfde adres in één veld is tien keer hetzelfde rondje naar Drive.");

check("het volledige adres blijft zichtbaar als tooltip",
  /setAttribute\("title"/.test(bron),
  "Je moet kunnen zien waar een link echt heen gaat voordat je klikt.");

check("een mislukte opzoeking laat de link met rust",
  /catch \{ \/\* stil: de link blijft staan zoals hij was \*\/ \}/.test(bron),
  "Een adres is lelijk maar werkt; een lege link werkt niet.");

const veld = lees("app/_velden/RijkTekstVeld.tsx");
check("het tekstveld benoemt na élke manier van plakken",
  (veld.match(/benoemEnMeld\(\)/g) || []).length >= 4,
  "Er zijn vier plakwegen (opgemaakte HTML, markdown, platte tekst met links, en de terugval);\n"
  + "       eentje overslaan betekent dat het per keer verschilt of je een naam krijgt.");

check("het opzoeken houdt het plakken niet op",
  /void benoemDriveLinks\(editorRef\.current\)\.then/.test(veld),
  "De tekst hoort er meteen te staan; de naam mag een seconde later komen.");

const route = lees("app/api/admin/drive/naam/route.ts");
check("het eindpunt zit achter de adminlogin",
  /verifyAdminSession/.test(route),
  "Het vertelt hoe bestanden in de Drive van Pingwin heten; dat is niets voor buiten.");

check("het eindpunt geeft alleen de naam terug",
  /fields=name|fileName\(/.test(route + lees("lib/drive.ts")),
  "Alleen lezen, alleen de naam.");

console.log(fouten === 0 ? "\nEen geplakte Google-link heet naar zijn document." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
