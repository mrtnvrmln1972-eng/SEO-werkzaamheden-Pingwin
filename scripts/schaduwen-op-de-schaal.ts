// Zet losse schaduwen op de diepte-schaal, en laat staan wat je zou zien.
//
// GEBRUIK
// ═══════
//   npx tsx scripts/schaduwen-op-de-schaal.ts 3          (kijken)
//   npx tsx scripts/schaduwen-op-de-schaal.ts 3 --doen   (echt doen)
//
// Het getal is hoe ver een schaduw van een bestaande naam af mag liggen om
// samengevoegd te worden. Zelfde idee als bij de kleuren: onder de drempel is
// het dezelfde schaduw nog een keer opgeschreven, daarboven is het een keuze en
// die is niet aan een script.
//
// DE MAAT
// ═══════
// Een schaduw is een verschuiving, een waas en een doorzichtigheid. Die drie
// wegen niet even zwaar voor het oog: een pixel meer waas zie je niet, maar een
// tiende meer doorzichtigheid wél, want dat is het verschil tussen "ligt ergens
// op" en "zweeft eroverheen". Vandaar de weging hieronder.
//
// WAT ER MET OPZET BUITEN VALT
// ════════════════════════════
//  - `inset`: dat is een streep of een binnenrand, geen schaduw.
//  - `0 0 0 Npx`: dat is de ring om een veld dat de aandacht heeft. Ook geen
//    schaduw; die heeft een eigen naam nodig, geen plek op deze schaal.
//  - `none` en alles wat al een var() is.
//  - schaduwen die verder liggen dan de drempel. Die worden geteld en getoond,
//    zodat zichtbaar is wat er nog te kiezen valt.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const BESTAND = path.join(WORTEL, "app/globals.css");
const drempel = Number(process.argv[2]);
const doen = process.argv.includes("--doen");
// Hoe ruim er families gevormd mogen worden uit wat er overblijft. Ruimer dan de
// drempel, want binnen een familie kies je de middelste waarde en ligt elk lid er
// dus hooguit de helft vandaan.
const clusterAfstand = Number(process.argv[3]) || Number(process.argv[2]) * 4;

if (!Number.isFinite(drempel) || drempel <= 0) {
  console.error("Geef een drempel op, bijvoorbeeld: npx tsx scripts/schaduwen-op-de-schaal.ts 3");
  process.exit(1);
}

const css = fs.readFileSync(BESTAND, "utf8");
const rootStart = css.indexOf(":root {");
const rootEind = css.indexOf("\n}", rootStart);
const root = css.slice(rootStart, rootEind);

/**
 * De diepte-schaal: elke naam die in :root staat, niet een lijstje in dit script.
 *
 * Zo groeit de schaal mee zodra er een stap bij komt. Een naam mag rechtstreeks
 * een schaduw zijn of doorverwijzen naar een primitieve (--shadow-*); allebei
 * worden hier tot de echte waarde uitgelezen.
 */
const SCHAAL = [...root.matchAll(/(--diepte-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => {
  const naam = m[1];
  const via = /^var\((--[\w-]+)\)$/.exec(m[2].trim());
  if (!via) return { naam, waarde: m[2].trim() };
  const waarde = new RegExp(`${via[1]}\\s*:\\s*([^;]+);`).exec(root);
  return { naam, waarde: (waarde?.[1] || "").trim() };
});

type Vorm = { x: number; y: number; waas: number; alfa: number; kleur: [number, number, number] };

/** De eerste laag van een schaduw als getallen; een tweede laag is een accent. */
function ontleed(waarde: string): Vorm | null {
  // De eenheid mag ontbreken bij 0; zo staat het overal in de CSS ("0 1px 3px").
  const px = String.raw`(-?[\d.]+)(?:px)?`;
  const m = new RegExp(`^${px}\\s+${px}\\s+${px}(?:\\s+${px})?\\s+rgba?\\(([^)]+)\\)`).exec(waarde.trim());
  if (!m) return null;
  const delen = m[5].split(",").map((s) => parseFloat(s.trim()));
  return {
    x: parseFloat(m[1]), y: parseFloat(m[2]), waas: parseFloat(m[3]),
    alfa: delen.length > 3 ? delen[3] : 1,
    kleur: [delen[0], delen[1], delen[2]],
  };
}

// Een pixel verschuiving telt vol, een pixel waas half (die zie je nauwelijks),
// en een honderdste doorzichtigheid telt als een pixel: dat is wat het oog leest
// als "ligt erop" tegenover "zweeft erboven".
// En de kleur telt mee naar rato van hoe hard hij aanstaat: een oranje gloed van
// 35% grijs maken is zichtbaar, terwijl zwart en warm donkergrijs bij 5% niet uit
// elkaar te houden zijn. Zonder dit werd een oranje gloed onder een kaart stilletjes
// een gewone grijze schaduw.
const kleurAf = (a: Vorm, b: Vorm) => {
  const d = Math.sqrt(a.kleur.reduce((n, v, i) => n + (v - b.kleur[i]) ** 2, 0));
  return d * ((a.alfa + b.alfa) / 2) * 0.15;
};

const afstand = (a: Vorm, b: Vorm) =>
  Math.abs(a.y - b.y) + Math.abs(a.waas - b.waas) * 0.5 + Math.abs(a.alfa - b.alfa) * 100 + kleurAf(a, b);

// Een schaduw die opzij of omhoog valt, zegt iets over waar het ding vandaan
// komt: een zijpaneel dat van rechts inschuift, een balk die van onderen komt.
// Dat is geen diepte maar richting, en die hoort niet op deze schaal.
const heeftRichting = (v: Vorm) => v.x !== 0 || v.y < 0;

const schaalVormen = SCHAAL.map((s) => ({ ...s, vorm: ontleed(s.waarde) })).filter((s) => s.vorm);

const rest = css.slice(0, rootStart) + css.slice(rootEind);
const losse = [...rest.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());

type Regel = { van: string; naar: string; afstand: number; aantal: number };
const samen = new Map<string, Regel>();
const teVer = new Map<string, Regel>();
let overgeslagen = 0;

for (const waarde of losse) {
  if (waarde === "none" || waarde.startsWith("var(") || waarde.startsWith("inset")
    || /^0\s+0\s+0\s+/.test(waarde)) { overgeslagen++; continue; }
  // Een schaduw met twee lagen mag alleen mee als hij letterlijk gelijk is aan
  // een naam die al bestaat. Anders zou hij op zijn eerste laag beoordeeld
  // worden, en juist de tweede laag is dan de grote zwevende schaduw die je wél
  // ziet. Zo werd "0 1px 2px …, 0 12px 28px -8px …" bijna een schaduw die bijna
  // plat ligt.
  const lagen = waarde.split(/\)\s*,/).length;
  if (lagen > 1) {
    const gelijk = schaalVormen.find((s) => s.waarde.replace(/\s+/g, "") === waarde.replace(/\s+/g, ""));
    if (!gelijk) { overgeslagen++; continue; }
    const bestaand = samen.get(waarde);
    if (bestaand) bestaand.aantal++;
    else samen.set(waarde, { van: waarde, naar: gelijk.naam, afstand: 0, aantal: 1 });
    continue;
  }

  const vorm = ontleed(waarde);
  if (!vorm || heeftRichting(vorm)) { overgeslagen++; continue; }

  let beste = schaalVormen[0];
  let besteAfstand = Infinity;
  for (const s of schaalVormen) {
    const d = afstand(vorm, s.vorm!);
    if (d < besteAfstand) { besteAfstand = d; beste = s; }
  }
  const lijst = besteAfstand <= drempel ? samen : teVer;
  const bestaand = lijst.get(waarde);
  if (bestaand) bestaand.aantal++;
  else lijst.set(waarde, { van: waarde, naar: beste.naam, afstand: Math.round(besteAfstand * 10) / 10, aantal: 1 });
}

const gaatSamen = [...samen.values()].sort((a, b) => b.aantal - a.aantal);
const blijft = [...teVer.values()].sort((a, b) => b.aantal - a.aantal);
const plekken = gaatSamen.reduce((n, s) => n + s.aantal, 0);

console.log(`${gaatSamen.length} verschillende schaduwen gaan op de schaal (${plekken} plekken).`);
console.log(`${blijft.length} blijven staan: die zou je zien veranderen.`);
console.log(`${overgeslagen} overgeslagen (none, al een naam, een ring of een binnenlijn).\n`);
for (const s of gaatSamen.slice(0, 16)) {
  console.log(`  ${s.van.padEnd(46)} -> var(${s.naar})  ${s.aantal}x  (afstand ${s.afstand})`);
}
if (gaatSamen.length > 16) console.log(`  … en nog ${gaatSamen.length - 16}.`);
if (blijft.length) {
  console.log(`\nBlijven staan, dichtstbijzijnde naam erbij:`);
  for (const s of blijft.slice(0, 40)) {
    console.log(`  ${s.van.padEnd(46)} ~ ${s.naar}  ${s.aantal}x  (afstand ${s.afstand})`);
  }
  if (blijft.length > 40) console.log(`  … en nog ${blijft.length - 20}.`);
}

// ── Families voorstellen ──
// Wat er overblijft is niet willekeurig: het zijn een paar groepjes die telkens
// net anders zijn opgeschreven. Hieronder worden ze bij elkaar geveegd, met de
// middelste waarde als voorstel. Die krijgen met de hand een naam, want een naam
// zegt waarvóór iets dient en dat kan een script niet weten. Daarna staan ze in
// :root en pakt deze zelfde ronde ze op.
const midden = (getallen: number[]) => [...getallen].sort((a, b) => a - b)[Math.floor(getallen.length / 2)];

if (blijft.length) {
  const families: { leden: (Regel & { vorm: Vorm })[]; kern: Vorm }[] = [];
  for (const r of blijft) {
    const vorm = ontleed(r.van)!;
    const bij = families.find((f) => afstand(vorm, f.kern) <= clusterAfstand);
    if (bij) {
      bij.leden.push({ ...r, vorm });
      bij.kern = {
        x: 0,
        y: midden(bij.leden.map((l) => l.vorm.y)),
        waas: midden(bij.leden.map((l) => l.vorm.waas)),
        alfa: midden(bij.leden.map((l) => l.vorm.alfa)),
        kleur: [51, 48, 46],
      };
    } else families.push({ leden: [{ ...r, vorm }], kern: vorm });
  }
  console.log(`\nVoorstel: ${families.length} familie(s) uit die ${blijft.length}.`);
  for (const f of families.sort((a, b) => b.leden.length - a.leden.length)) {
    const plekken = f.leden.reduce((n, l) => n + l.aantal, 0);
    const grootste = Math.max(...f.leden.map((l) => afstand(l.vorm, f.kern)));
    console.log(`  ${f.leden.length} soorten, ${plekken} plekken -> `
      + `0 ${f.kern.y}px ${f.kern.waas}px rgba(51, 48, 46, ${f.kern.alfa})   (grootste stap ${Math.round(grootste * 10) / 10})`);
  }
}

if (!doen) {
  console.log("\nNiets gewijzigd (dit was een kijkronde). Voeg --doen toe om het echt te doen.");
  process.exit(0);
}

const vervangen = new Map(gaatSamen.map((s) => [s.van, s.naar]));
const doeHet = (stuk: string) =>
  stuk.replace(/box-shadow:\s*([^;]+);/g, (heel, waarde: string) => {
    const naar = vervangen.get(waarde.trim());
    return naar ? `box-shadow: var(${naar});` : heel;
  });

fs.writeFileSync(BESTAND, doeHet(css.slice(0, rootStart)) + css.slice(rootStart, rootEind) + doeHet(css.slice(rootEind)));
console.log(`\napp/globals.css bijgewerkt: ${plekken} plekken.\n`);
