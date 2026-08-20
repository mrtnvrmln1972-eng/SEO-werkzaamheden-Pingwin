import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════
// DE VOORVERTONING IS GROOT GENOEG, EN VALT NIET BUITEN BEELD
// ═══════════════════════════════════════════════════════════
// Wijs je een documentlink aan, dan komt er een voorvertoning tevoorschijn. Die
// was 384 bij 300 pixels, en dan lees je van een spreadsheet twee kolommen en
// drie regels: net genoeg om te zien dát het een tabel is, te weinig om te weten
// wat erin staat. Maarten: "de preview is heel fijn, die zou alleen nog iets
// groter kunnen."
//
// De maat staat op twee plekken, en dat kan niet anders: de CSS tekent hem, en
// het scherm moet zijn maat weten om hem binnen beeld te houden (anders valt hij
// half buiten het venster als je een link onderaan de pagina aanwijst). Deze
// proef bewaakt dus precies dat: dezelfde twee getallen aan beide kanten.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

const css = lees("app/globals.css");
const tsx = lees("app/admin/client/[slug]/LinkPreview.tsx");

const cssBreed = Number((css.match(/\.link-preview \{[^}]*width: min\((\d+)px/) || [])[1] || 0);
const cssHoog = Number((css.match(/\.link-preview iframe \{[^}]*height: min\([^,]+, (\d+)px\)/) || [])[1] || 0);
const tsxBreed = Number((tsx.match(/PREVIEW_BREED = (\d+)/) || [])[1] || 0);
const tsxHoog = Number((tsx.match(/PREVIEW_HOOG = (\d+)/) || [])[1] || 0);

check("de breedte staat aan beide kanten gelijk", cssBreed > 0 && cssBreed === tsxBreed,
  `CSS zegt ${cssBreed}, het scherm rekent met ${tsxBreed}. Lopen ze uiteen, dan valt de voorvertoning half buiten beeld.`);

check("de hoogte staat aan beide kanten gelijk", cssHoog > 0 && cssHoog === tsxHoog,
  `CSS zegt ${cssHoog}, het scherm rekent met ${tsxHoog}.`);

check("hij is groot genoeg om een tabel in te lezen", cssBreed >= 560 && cssHoog >= 420,
  `Nu ${cssBreed} bij ${cssHoog}. Kleiner dan dit en je ziet van een spreadsheet twee kolommen.`);

check("hij past ook op een smal scherm", /width: min\(\d+px, 9\dvw\)/.test(css),
  "Een vaste breedte loopt op een laptop of tablet gewoon van het scherm af.");

check("de hoogte past ook op een laag venster", /height: min\(\d+vh, \d+px\)/.test(css),
  "Op een klein scherm moet hij meekrimpen in plaats van eronderuit te steken.");

check("hij wordt binnen het venster gehouden, ook aan de bovenkant",
  /const top = Math\.max\(8, Math\.min\(state\.y \+ 6, h - hoog\)\)/.test(tsx),
  "Zonder die ondergrens schuift hij bij een link onderaan het scherm boven de rand uit.");

check("de breedte telt mee bij het uitlijnen",
  /Math\.min\(state\.x, w - breed - 8\)/.test(tsx),
  "Anders steekt hij rechts buiten beeld bij een link aan de rechterkant.");

console.log(fouten === 0 ? "\nDe voorvertoning is groot genoeg en blijft in beeld." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
