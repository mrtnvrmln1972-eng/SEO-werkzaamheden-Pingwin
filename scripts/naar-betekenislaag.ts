// Zet de opmaak van één scherm om naar de betekenislaag.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/naar-betekenislaag.ts opr-          (kijken, verandert niets)
//   npx tsx scripts/naar-betekenislaag.ts opr- --doen   (echt omzetten)
//   npx tsx scripts/zelfde-uitkomst.ts                  (bewijs dat er niets veranderde)
//
// WAAROM DIT EEN SCRIPT IS EN GEEN ZOEK-EN-VERVANG
// ════════════════════════════════════════════════
// De omzetting van stap 3 (elk scherm laten lezen uit de betekenislaag) is voor
// tientallen schermen dezelfde handeling, en hij is op twee manieren makkelijk
// fout te doen. Allebei zijn ze in de eerste ronden echt gebeurd, dus ze staan
// hier in code in plaats van in een instructie.
//
// FOUT 1: een rol toekennen die niet klopt.
// `padding-left: var(--s-6)` op een lijst-inspringing werd `--ruimte-kaart`.
// Pixel-identiek, maar de naam liegt: verandert iemand later de kaartpadding,
// dan schuift die inspringing mee zonder dat iemand dat bedoelde. Daarom zet dit
// script alleen de maten om waarvan de rol eenduidig is (--s-1 tot --s-4, en de
// tekst-, ronding- en schaduwschaal). Alles daarboven blijft staan; dat vraagt
// een blik per geval, en een ontbrekende naam is beter dan een verkeerde.
//
// FOUT 2: een kleur omzetten die er alleen op lijkt.
// Alleen een hexcode die EXACT gelijk is aan een token wordt omgezet. Een kleur
// die er bijna op lijkt omzetten verandert hem zichtbaar, en dat is een keuze
// die op /admin/stijl thuishoort, niet in een script.
//
// Wit en oranje hebben twee rollen, en welke het is blijkt uit de eigenschap:
// wit is een vlak bij `background` en tekst-op-een-vlak bij `color`; oranje is
// het accent, behalve op een `border-color`, waar het de accentrand is.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const BESTAND = path.join(WORTEL, "app/globals.css");

const voorvoegsel = process.argv[2];
const doen = process.argv.includes("--doen");
if (!voorvoegsel) {
  console.error('Geef een voorvoegsel op, bijvoorbeeld: npx tsx scripts/naar-betekenislaag.ts opr-');
  process.exit(1);
}

/** Eén rol per token. Alleen wat eenduidig is; zie FOUT 1 hierboven. */
const ROL: Record<string, string> = {
  "--gray": "--kleur-tekst-stil", "--muted": "--kleur-tekst-zacht",
  "--body-text": "--kleur-tekst", "--brand-charcoal": "--kleur-kop",
  "--gray-light": "--kleur-rustig", "--border": "--kleur-rand",
  "--card-border": "--kleur-rand-zacht", "--app-bg": "--kleur-pagina",
  "--orange": "--kleur-accent", "--orange-dark": "--kleur-accent-diep",
  "--orange-light": "--kleur-accent-vlak", "--brand-orange-faint": "--kleur-accent-waas",
  "--red": "--kleur-fout", "--red-light": "--kleur-fout-vlak",
  "--good": "--kleur-goed", "--good-light": "--kleur-goed-vlak",
  "--warn-dark": "--kleur-let-op", "--highlight-manual": "--kleur-let-op-vlak",
  "--link": "--kleur-link",
  "--fs-xs": "--type-label", "--lh-xs": "--regel-label",
  "--fs-sm": "--type-bijschrift", "--lh-sm": "--regel-bijschrift",
  "--fs-base": "--type-lopend", "--lh-base": "--regel-lopend",
  "--fs-md": "--type-kaartkop", "--lh-md": "--regel-kaartkop",
  "--fs-lg": "--type-sectiekop", "--lh-lg": "--regel-sectiekop",
  "--fs-xl": "--type-paginakop", "--lh-xl": "--regel-paginakop",
  // Alleen de kleine stappen: die betekenen overal hetzelfde (een tussenruimte).
  // --s-5 en hoger blijven met opzet staan, zie FOUT 1.
  "--s-1": "--ruimte-krap", "--s-2": "--ruimte-naast",
  "--s-3": "--ruimte-regel", "--s-4": "--ruimte-groep",
  "--r-sm": "--ronding-klein", "--r-md": "--ronding-knop",
  "--r-lg": "--ronding-kaart", "--r-full": "--ronding-pil",
  "--shadow-sm": "--diepte-rust", "--shadow-md": "--diepte-kaart",
  "--shadow-lg": "--diepte-zwevend",
};

/** Hexcodes die EXACT gelijk zijn aan een token. Alleen exact; zie FOUT 2. */
const HEX: Record<string, string> = {
  "#f5f5f5": "--kleur-rustig", "#e0e0e0": "--kleur-rand", "#f0e7df": "--kleur-rand-zacht",
  "#181818": "--kleur-tekst", "#444444": "--kleur-tekst-zacht", "#444": "--kleur-tekst-zacht",
  "#616161": "--kleur-tekst-stil", "#33302e": "--kleur-kop", "#f5f6fa": "--kleur-pagina",
  "#e7773f": "--kleur-accent", "#c95e28": "--kleur-accent-diep",
  "#fff4ee": "--kleur-accent-vlak", "#fff6f0": "--kleur-accent-waas",
  "#d32f2f": "--kleur-fout", "#ffebee": "--kleur-fout-vlak",
  "#2e7d32": "--kleur-goed", "#e7f6ea": "--kleur-goed-vlak",
  "#b25a00": "--kleur-let-op", "#fff6e5": "--kleur-let-op-vlak", "#1a6dd6": "--kleur-link",
};

function zetOm(regel: string): string {
  let r = regel;
  r = r.replace(/\bcolor:\s*var\(--white\)/g, "color: var(--kleur-tekst-op-vlak)");
  r = r.replace(/\bbackground(-color)?:\s*var\(--white\)/g, (_, k) => `background${k ?? ""}: var(--kleur-kaart)`);
  r = r.replace(/\bborder-color:\s*var\(--orange\)/g, "border-color: var(--kleur-rand-accent)");
  for (const [van, naar] of Object.entries(ROL)) {
    r = r.replace(new RegExp(`var\\(${van.replace(/-/g, "\\-")}\\)`, "g"), `var(${naar})`);
  }
  r = r.replace(/\bcolor:\s*(#fff|#ffffff)\b/gi, "color: var(--kleur-tekst-op-vlak)");
  r = r.replace(/\bbackground(-color)?:\s*(#fff|#ffffff)\b/gi, (_, k) => `background${k ?? ""}: var(--kleur-kaart)`);
  r = r.replace(/#[0-9a-fA-F]{3,8}\b/g, (h) => (HEX[h.toLowerCase()] ? `var(${HEX[h.toLowerCase()]})` : h));
  return r;
}

/**
 * Plekken die BEWUST op de kale schaal blijven.
 *
 * Zonder dit heeft dit gereedschap geen geheugen: bij een tweede ronde over
 * hetzelfde scherm zet het precies de namen terug die er de vorige ronde met de
 * hand zijn uitgehaald. Dat is op 18-08-2026 echt gebeurd, bij een sweep over
 * alle voorvoegsels tegelijk. Een oordeel dat alleen in een commit-bericht
 * staat, is de volgende ronde weg.
 */
type Uitzondering = { selector: string; eigenschap: string; waarde: string; waarom: string };
const UITZONDERINGEN: Uitzondering[] = JSON.parse(
  fs.readFileSync(path.join(WORTEL, "scripts/rol-uitzonderingen.json"), "utf8")
).uitzonderingen;

/** Zet de bewust-op-de-schaal-plekken terug, ná de omzetting. */
function respecteerUitzonderingen(regel: string, selector: string): string {
  let r = regel;
  for (const u of UITZONDERINGEN) {
    if (u.selector !== selector) continue;
    r = r.replace(new RegExp(`\\b${u.eigenschap}:\\s*var\\(--[\\w-]+\\)`), `${u.eigenschap}: ${u.waarde}`);
  }
  return r;
}

const regels = fs.readFileSync(BESTAND, "utf8").split("\n");
const stapel: string[] = [];
const geraakt: string[] = [];
let om = 0;

for (let i = 0; i < regels.length; i++) {
  const r = regels[i];
  const onder = [...stapel].reverse().find((s) => !s.startsWith("@")) ?? "";
  const eigen = r.includes("{") ? r.split("{")[0] : "";
  const selector = r.includes("{") && !eigen.trim().startsWith("@") ? eigen.trim() : onder;

  if (new RegExp(`\\.${voorvoegsel}[\\w-]*`).test(selector)) {
    const nieuw = respecteerUitzonderingen(zetOm(r), selector);
    if (nieuw !== r) {
      om++;
      geraakt.push(`  ${i + 1}: ${nieuw.trim().slice(0, 100)}`);
      regels[i] = nieuw;
    }
  }
  for (const teken of r) {
    if (teken === "{") stapel.push(eigen.trim() || onder);
    else if (teken === "}") stapel.pop();
  }
}

if (om === 0) {
  console.log(`Niets te doen voor .${voorvoegsel}*: alles staat al op de betekenislaag, of dit voorvoegsel bestaat niet.`);
  process.exit(0);
}

console.log(`${om} regels onder .${voorvoegsel}* gaan om.`);
console.log(geraakt.slice(0, 8).join("\n") + (geraakt.length > 8 ? `\n  … en nog ${geraakt.length - 8}.` : ""));

if (!doen) {
  console.log("\nNiets gewijzigd (dit was een kijkronde). Voeg --doen toe om het echt te doen.");
  process.exit(0);
}

fs.writeFileSync(BESTAND, regels.join("\n"));
console.log(`\napp/globals.css bijgewerkt. Bewijs nu dat er niets veranderde:\n  npx tsx scripts/zelfde-uitkomst.ts\n`);
