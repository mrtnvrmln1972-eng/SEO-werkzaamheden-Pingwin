// Zet elke losse pixelmaat op de dichtstbijzijnde stap van de schaal.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/maten-op-de-schaal.ts 2          (kijken)
//   npx tsx scripts/maten-op-de-schaal.ts 2 --doen   (echt doen)
//
// Het getal is hoeveel pixels een maat maximaal mag verschuiven. Alles wat
// verder moet springen blijft staan; dat is geen opruimwerk meer maar een
// ontwerpkeuze, en die hoort op /admin/stijl te staan in plaats van in een
// script.
//
// WAAROM DIT ER IS
// ════════════════
// Na het omzetten naar de betekenislaag en het samenvoegen van de kleuren bleef
// er één soort rommel over, en dat bleek de grootste: losse pixelwaarden voor
// ruimte. Op de fundament-pagina waren dat er 57 tegenover nog maar twee losse
// kleuren. Precies díe bewegen niet mee als je in de speelruimte aan "ruimte"
// draait, want ze staan buiten de schaal.
//
// De vorige afrondronde pakte alleen enkelvoudige waarden (`padding: 10px`).
// Verreweg de meeste staan in de praktijk als combinatie (`padding: 18px 0`,
// `margin: 12px 0 4px`), en die bleven daardoor allemaal liggen.
//
// WAT ER MET OPZET BLIJFT STAAN
// ═════════════════════════════
//  - 0 en 1px: dat zijn "geen ruimte" en een haarlijn, geen maat.
//  - alles boven de grootste stap van de schaal: dat zijn layout-maten
//    (kolombreedtes, vaste hoogtes), geen ruimte tussen dingen.
//  - alles wat verder dan de opgegeven sprong zou moeten verschuiven.
//  - percentages, em, rem, vh, calc(): geen pixelmaat.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const BESTAND = path.join(WORTEL, "app/globals.css");
const sprong = Number(process.argv[2]);
const doen = process.argv.includes("--doen");

if (!Number.isFinite(sprong) || sprong <= 0) {
  console.error("Geef een maximale sprong op in pixels, bijvoorbeeld: npx tsx scripts/maten-op-de-schaal.ts 2");
  process.exit(1);
}

const css = fs.readFileSync(BESTAND, "utf8");
const rootStart = css.indexOf(":root {");
const rootEind = css.indexOf("\n}", rootStart);
const root = css.slice(rootStart, rootEind);

/** De schaal per soort: naam en waarde in pixels, klein naar groot. */
function schaal(voorvoegsel: string) {
  return [...root.matchAll(new RegExp(`(${voorvoegsel}[\\w-]*)\\s*:\\s*([\\d.]+)px\\s*;`, "g"))]
    .map((m) => ({ naam: m[1], px: parseFloat(m[2]) }))
    .sort((a, b) => a.px - b.px);
}

const SOORTEN = [
  { eigenschap: "(?:padding|margin|gap|row-gap|column-gap)[a-z-]*", stappen: schaal("--s-"), naam: "ruimte" },
  { eigenschap: "font-size", stappen: schaal("--fs-"), naam: "tekstmaat" },
  { eigenschap: "border-radius", stappen: schaal("--r-"), naam: "ronding" },
];

type Verschuiving = { soort: string; van: number; naar: number; token: string; aantal: number };
const geteld = new Map<string, Verschuiving>();
let teVer = 0;

/**
 * De dichtstbijzijnde stap, maar nooit 0.
 *
 * Zonder die uitzondering wordt 2px afgerond naar 0px (even ver van 0 als van 4,
 * en 0 komt eerst), en dan verdwijnt de ruimte hélemaal in plaats van iets
 * kleiner te worden. Dat gebeurde bij 148 plekken tegelijk, waaronder de padding
 * van elk labeltje en elke pil. Een maat die bestaat mag kleiner worden, niet weg.
 */
function dichtst(px: number, stappen: { naam: string; px: number }[]) {
  const echt = stappen.filter((s) => s.px > 0);
  return (echt.length ? echt : stappen).reduce((a, b) => (Math.abs(b.px - px) < Math.abs(a.px - px) ? b : a));
}

function verwerk(stuk: string, echt: boolean): string {
  let uit = stuk;
  for (const { eigenschap, stappen, naam } of SOORTEN) {
    if (!stappen.length) continue;
    const grootste = stappen[stappen.length - 1].px;
    uit = uit.replace(new RegExp(`\\b(${eigenschap}):\\s*([^;{}]+)`, "g"), (heel, eig: string, waarde: string) => {
      if (waarde.includes("calc(") || waarde.includes("%")) return heel;
      let geraakt = false;
      const nieuw = waarde.replace(/(-?)([\d.]+)px/g, (deel, min: string, getal: string) => {
        const px = parseFloat(getal);
        // 0 en 1 zijn geen maat maar "niets" en een haarlijn; boven de schaal
        // gaat het om layout, niet om ruimte tussen dingen.
        if (px === 0 || px === 1 || px > grootste) return deel;
        const doel = dichtst(px, stappen);
        if (doel.px === px) return `${min}var(${doel.naam})`;
        if (Math.abs(doel.px - px) > sprong) { teVer++; return deel; }
        const sleutel = `${naam}|${px}|${doel.px}`;
        const bestaand = geteld.get(sleutel);
        if (bestaand) bestaand.aantal++;
        else geteld.set(sleutel, { soort: naam, van: px, naar: doel.px, token: doel.naam, aantal: 1 });
        geraakt = true;
        // Een negatieve marge wordt een negatieve var; dat kan niet rechtstreeks,
        // dus daar blijft de pixelwaarde staan. Zeldzaam, en ze verplaatsen iets
        // in plaats van ruimte te maken.
        return min ? deel : `var(${doel.naam})`;
      });
      return geraakt || nieuw !== waarde ? `${eig}: ${nieuw}` : heel;
    });
  }
  return echt ? uit : stuk;
}

// Eerst tellen (zonder te schrijven), dan pas eventueel echt doen.
verwerk(css.slice(0, rootStart) + css.slice(rootEind), false);
const lijst = [...geteld.values()].sort((a, b) => b.aantal - a.aantal);
const plekken = lijst.reduce((n, v) => n + v.aantal, 0);

console.log(`${plekken} maten gaan op de schaal (${lijst.length} verschillende verschuivingen).`);
console.log(`${teVer} blijven staan omdat ze verder dan ${sprong}px zouden moeten springen.\n`);
for (const v of lijst.slice(0, 14)) {
  console.log(`  ${v.soort.padEnd(10)} ${String(v.van).padStart(5)}px -> ${String(v.naar).padEnd(5)}px  ${v.aantal}x  (${v.token})`);
}
if (lijst.length > 14) console.log(`  … en nog ${lijst.length - 14}.`);

if (!doen) {
  console.log("\nNiets gewijzigd (dit was een kijkronde). Voeg --doen toe om het echt te doen.");
  process.exit(0);
}

geteld.clear();
const nieuw = verwerk(css.slice(0, rootStart), true) + css.slice(rootStart, rootEind) + verwerk(css.slice(rootEind), true);
fs.writeFileSync(BESTAND, nieuw);
console.log(`\napp/globals.css bijgewerkt.\n`);
