// Zet de pixelmaten die in de schermen zelf staan op de schaal.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/maten-in-schermen.ts 2          (kijken)
//   npx tsx scripts/maten-in-schermen.ts 2 --doen   (echt doen)
//
// Het getal is hoeveel pixels een maat maximaal mag verschuiven, net als bij
// scripts/maten-op-de-schaal.ts. Dat script deed app/globals.css; dit doet het
// lek dat daarnaast open bleef staan: opmaak die niet in het stylesheet staat
// maar in de React-code, als `style={{ padding: "8px 10px" }}` of als een
// stijlobject bovenaan een bestand. Geen enkele CSS-controle ziet dat, en elke
// ronde die de opmaak strak trok gold er niet.
//
// WAT ER MET OPZET BLIJFT STAAN
// ═════════════════════════════
//  - berekende waarden (`top: (uur - start) * PX_PER_MIN`): dat is een positie
//    die uit data volgt, geen opmaakkeuze.
//  - breedtes en hoogtes: een kolom van 260px is een indelingsmaat, geen ruimte
//    tussen dingen. De schaal gaat over ruimte, tekst en ronding.
//  - 0 en 1: "geen ruimte" en een haarlijn.
//  - alles wat verder zou moeten springen dan de opgegeven sprong.
//
// In React is een kaal getal hetzelfde als pixels (`fontSize: 13`), dus die
// tellen mee. Ze worden een string met var() erin, want een var() is tekst.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const sprong = Number(process.argv[2]);
const doen = process.argv.includes("--doen");

if (!Number.isFinite(sprong) || sprong <= 0) {
  console.error("Geef een maximale sprong op, bijvoorbeeld: npx tsx scripts/maten-in-schermen.ts 2");
  process.exit(1);
}

const css = fs.readFileSync(path.join(WORTEL, "app/globals.css"), "utf8");
const rootStart = css.indexOf(":root {");
const root = css.slice(rootStart, css.indexOf("\n}", rootStart));

function schaal(voorvoegsel: string) {
  return [...root.matchAll(new RegExp(`(${voorvoegsel}[\\w-]*)\\s*:\\s*([\\d.]+)px\\s*;`, "g"))]
    .map((m) => ({ naam: m[1], px: parseFloat(m[2]) }))
    .filter((s) => s.px > 0)
    .sort((a, b) => a.px - b.px);
}

const SOORTEN = [
  { eigenschap: /^(padding|margin|gap|rowGap|columnGap)([A-Z]\w*)?$/, stappen: schaal("--s-"), naam: "ruimte" },
  { eigenschap: /^fontSize$/, stappen: schaal("--fs-"), naam: "tekstmaat" },
  { eigenschap: /^borderRadius$/, stappen: schaal("--r-"), naam: "ronding" },
];

const dichtst = (px: number, stappen: { naam: string; px: number }[]) =>
  stappen.reduce((a, b) => (Math.abs(b.px - px) < Math.abs(a.px - px) ? b : a));

function alleTsx(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const pad = path.join(map, naam.name);
    if (naam.isDirectory()) uit.push(...alleTsx(pad));
    else if (naam.name.endsWith(".tsx")) uit.push(pad);
  }
  return uit;
}

type Verschuiving = { soort: string; van: number; naar: number; token: string; aantal: number };
const geteld = new Map<string, Verschuiving>();
let teVer = 0;
let alGoed = 0;

/** Eén waarde omzetten, of null als hij blijft staan. */
function omzetten(px: number, stappen: { naam: string; px: number }[], naam: string): string | null {
  if (px === 0 || px === 1) return null;
  const grootste = stappen[stappen.length - 1].px;
  if (px > grootste) return null;
  const doel = dichtst(px, stappen);
  if (doel.px === px) { alGoed++; return `var(${doel.naam})`; }
  if (Math.abs(doel.px - px) > sprong) { teVer++; return null; }
  const sleutel = `${naam}|${px}|${doel.px}`;
  const bestaand = geteld.get(sleutel);
  if (bestaand) bestaand.aantal++;
  else geteld.set(sleutel, { soort: naam, van: px, naar: doel.px, token: doel.naam, aantal: 1 });
  return `var(${doel.naam})`;
}

function verwerk(inhoud: string): string {
  // Een eigenschap met óf een string ("8px 10px") óf een kaal getal (13).
  return inhoud.replace(
    /\b([a-zA-Z]+)\s*:\s*("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?)(?=\s*[,}])/g,
    (heel, eigenschap: string, waarde: string) => {
      const soort = SOORTEN.find((s) => s.eigenschap.test(eigenschap));
      if (!soort || !soort.stappen.length) return heel;

      if (waarde.startsWith('"')) {
        const binnen = waarde.slice(1, -1);
        // Alleen pure maat-strings; iets als "1px solid #ddd" of "calc(...)"
        // gaat over een rand of een som en niet over de schaal.
        if (!/^[\d.px\s]+$/.test(binnen) || !/\d/.test(binnen)) return heel;
        const delen = binnen.trim().split(/\s+/);
        const nieuw = delen.map((deel) => {
          const m = /^([\d.]+)px$/.exec(deel);
          if (!m) return deel;
          return omzetten(parseFloat(m[1]), soort.stappen, soort.naam) ?? deel;
        });
        return nieuw.join(" ") === delen.join(" ") ? heel : `${eigenschap}: "${nieuw.join(" ")}"`;
      }

      const naar = omzetten(parseFloat(waarde), soort.stappen, soort.naam);
      return naar ? `${eigenschap}: "${naar}"` : heel;
    },
  );
}

const bestanden = alleTsx(path.join(WORTEL, "app"));
let geraakt = 0;
const nieuweInhoud = new Map<string, string>();
for (const pad of bestanden) {
  const oud = fs.readFileSync(pad, "utf8");
  const nieuw = verwerk(oud);
  if (nieuw !== oud) { nieuweInhoud.set(pad, nieuw); geraakt++; }
}

const lijst = [...geteld.values()].sort((a, b) => b.aantal - a.aantal);
const plekken = lijst.reduce((n, v) => n + v.aantal, 0);

console.log(`${plekken} maten verschuiven naar de schaal, in ${geraakt} scherm(en).`);
console.log(`${alGoed} stonden al precies op een stap en krijgen alleen de naam.`);
console.log(`${teVer} blijven staan omdat ze verder dan ${sprong}px zouden moeten springen.\n`);
for (const v of lijst.slice(0, 12)) {
  console.log(`  ${v.soort.padEnd(10)} ${String(v.van).padStart(5)}px -> ${String(v.naar).padEnd(5)}px  ${v.aantal}x  (${v.token})`);
}
if (lijst.length > 12) console.log(`  … en nog ${lijst.length - 12}.`);

if (!doen) {
  console.log("\nNiets gewijzigd (dit was een kijkronde). Voeg --doen toe om het echt te doen.");
  process.exit(0);
}

for (const [pad, inhoud] of nieuweInhoud) fs.writeFileSync(pad, inhoud);
console.log(`\n${geraakt} scherm(en) bijgewerkt.\n`);
