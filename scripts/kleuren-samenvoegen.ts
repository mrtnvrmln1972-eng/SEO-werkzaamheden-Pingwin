// Voegt losse kleuren samen met de kleur die er al een naam heeft.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/kleuren-samenvoegen.ts 30          (kijken)
//   npx tsx scripts/kleuren-samenvoegen.ts 30 --doen   (echt doen)
//
// Het getal is hoe ver een kleur van een bestaande naam af mag liggen om
// samengevoegd te worden. De schaal is de gewogen kleurafstand uit
// lib/stijl-meting.ts: onder de 3 is het dezelfde kleur anders opgeschreven,
// onder de 30 kun je het verschil op een scherm niet zien, daarboven wel.
//
// WAAROM DIT APART STAAT VAN DE OMZETTING NAAR DE BETEKENISLAAG
// ════════════════════════════════════════════════════════════
// Die omzetting was aantoonbaar onzichtbaar: dezelfde waarde, andere naam. Dit
// niet. Hier verandert een kleur écht, alleen zó weinig dat niemand het ziet.
// Dat is een ander soort ingreep en die hoort niet stiekem mee te liften in een
// script dat "verandert niets" belooft.
//
// Boven de drempel wordt niets aangeraakt. Die kleuren staan op /admin/stijl in
// de stapels "dezelfde familie, andere tint" en "echt een andere kleur", met
// het staaltje erbij, want daar zit een keuze in en die is niet aan een script.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const BESTAND = path.join(WORTEL, "app/globals.css");
const drempel = Number(process.argv[2]);
const doen = process.argv.includes("--doen");

if (!Number.isFinite(drempel) || drempel <= 0) {
  console.error("Geef een drempel op, bijvoorbeeld: npx tsx scripts/kleuren-samenvoegen.ts 30");
  process.exit(1);
}

/** De rolnaam bij een primitieve token, zodat we de betekenislaag gebruiken. */
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
  "--link": "--kleur-link", "--white": "--kleur-kaart",
};

const css = fs.readFileSync(BESTAND, "utf8");
const rootStart = css.indexOf(":root {");
const rootEind = css.indexOf("\n}", rootStart);
const root = css.slice(rootStart, rootEind);

function rgb(hex: string): [number, number, number] | null {
  const k = hex.replace("#", "");
  const zes = k.length === 3 ? k.split("").map((c) => c + c).join("") : k.slice(0, 6);
  if (zes.length !== 6 || /[^0-9a-f]/i.test(zes)) return null;
  return [parseInt(zes.slice(0, 2), 16), parseInt(zes.slice(2, 4), 16), parseInt(zes.slice(4, 6), 16)];
}

/** Dezelfde gewogen afstand als lib/stijl-meting.ts; het oog ziet groen scherper. */
function afstand(a: [number, number, number], b: [number, number, number]): number {
  const rGem = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + rGem / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rGem) / 256) * db * db);
}

const tokens = [...root.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)]
  .map((m) => ({ naam: m[1], rgb: rgb(m[2])! }))
  .filter((t) => t.rgb !== null);

// ── Waar er gezocht wordt ──
// Standaard alleen de opmaak. Met --schermen worden de losse kleuren in de
// schermen zelf gedaan (een inline `style={{ borderColor: "#f1e9db" }}`), want
// die staan buiten de opmaak en bewegen dus nergens in mee. Bewust dezelfde
// weegschaal en dezelfde drempel: het is dezelfde ingreep, alleen in een ander
// soort bestand.
const inSchermen = process.argv.includes("--schermen");

function alleTsx(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const pad = path.join(map, naam.name);
    if (naam.isDirectory()) uit.push(...alleTsx(pad));
    else if (naam.name.endsWith(".tsx")) uit.push(pad);
  }
  return uit;
}

const bestanden = inSchermen ? alleTsx(path.join(WORTEL, "app")) : [];
const rest = inSchermen
  ? bestanden.map((p) => fs.readFileSync(p, "utf8")).join("\n")
  : css.slice(0, rootStart) + css.slice(rootEind);
const losseKleuren = [...new Set([...rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]))];

type Samen = { van: string; naar: string; afstand: number; aantal: number };
const samen: Samen[] = [];
const teVer: Samen[] = [];

// Wit heeft twee rollen (een vlak, of tekst óp een gekleurd vlak) en welke het
// is blijkt uit de eigenschap, niet uit de kleur. Dat onderscheid maakt
// scripts/naar-betekenislaag.ts al; hier zou wit altijd "kaart" worden en dan
// liegt de naam op elke plek waar het tekst is.
const WIT = new Set(["#fff", "#ffffff"]);

for (const hex of losseKleuren) {
  const kleur = rgb(hex);
  if (!kleur || WIT.has(hex.toLowerCase())) continue;
  let beste = tokens[0];
  let besteAfstand = Infinity;
  for (const t of tokens) {
    const d = afstand(kleur, t.rgb);
    if (d < besteAfstand) { besteAfstand = d; beste = t; }
  }
  const naam = ROL[beste.naam] ?? beste.naam;
  const aantal = (rest.match(new RegExp(hex.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) ?? []).length;
  const regel: Samen = { van: hex, naar: naam, afstand: Math.round(besteAfstand), aantal };
  if (besteAfstand <= drempel) samen.push(regel); else teVer.push(regel);
}

samen.sort((a, b) => b.aantal - a.aantal);
const plekken = samen.reduce((n, s) => n + s.aantal, 0);
const grootste = samen.reduce((m, s) => Math.max(m, s.afstand), 0);

console.log(`${samen.length} kleuren gaan samen met een kleur die al een naam heeft (${plekken} plekken).`);
console.log(`Grootste verschuiving: ${grootste} op de schaal waar 30 "niet te zien" is.`);
console.log(`${teVer.length} kleuren blijven staan, want die liggen verder dan ${drempel} van elke naam af.\n`);
for (const s of samen.slice(0, 12)) console.log(`  ${s.van.padEnd(9)} -> var(${s.naar})  ${s.aantal}x  (afstand ${s.afstand})`);
if (samen.length > 12) console.log(`  … en nog ${samen.length - 12}.`);

if (!doen) {
  console.log("\nNiets gewijzigd (dit was een kijkronde). Voeg --doen toe om het echt te doen.");
  process.exit(0);
}

// Alleen buiten :root vervangen; de tokens zelf houden hun eigen waarde.
const vervangen = new Map(samen.map((s) => [s.van.toLowerCase(), s.naar]));
const doeHet = (stuk: string) =>
  stuk.replace(/#[0-9a-fA-F]{3,8}\b/g, (h) => {
    const naar = vervangen.get(h.toLowerCase());
    return naar ? `var(${naar})` : h;
  });

if (inSchermen) {
  let geraakt = 0;
  for (const pad of bestanden) {
    const oud = fs.readFileSync(pad, "utf8");
    const nieuw = doeHet(oud);
    if (nieuw !== oud) { fs.writeFileSync(pad, nieuw); geraakt++; }
  }
  console.log(`\n${geraakt} scherm(en) bijgewerkt: ${plekken} plekken.\n`);
} else {
  fs.writeFileSync(BESTAND, doeHet(css.slice(0, rootStart)) + css.slice(rootStart, rootEind) + doeHet(css.slice(rootEind)));
  console.log(`\napp/globals.css bijgewerkt: ${plekken} plekken.\n`);
}
