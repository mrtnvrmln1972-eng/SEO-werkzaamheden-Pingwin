import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════
// POORT: de schema-stempel moet meebewegen met de code
// ═══════════════════════════════════════════════════════════
// De tabellen worden nog maar één keer per database aangemaakt in plaats van
// bij elke koude server (zie lib/schema-stand.ts). Dat werkt met een
// versienummer: staat dat nummer al in de database, dan wordt het hele blok
// overgeslagen.
//
// Daar zit één risico in: iemand voegt een kolom toe en vergeet het nummer op
// te hogen. Dan draait die nieuwe kolom nooit en gaat het dashboard stuk op een
// plek die niets met de wijziging te maken lijkt te hebben.
//
// Deze proef maakt dat onmogelijk. Hij rekent een vingerafdruk uit over de
// bouwcode zelf en vergelijkt die met het opgegeven nummer. Klopt het niet, dan
// mislukt de bouw (hij draait mee in `prebuild`, dus ook op Vercel) en staat er
// meteen bij welk nummer je moet invullen.
// ═══════════════════════════════════════════════════════════

type Blok = {
  bestand: string;
  /** Waar het bouwblok begint (eerste voorkomen). */
  vanaf: string;
  /** Waar het bouwblok eindigt (eerste voorkomen ná `vanaf`). */
  tot: string;
  /** De naam van de constante met het versienummer. */
  constante: string;
  /** Voorvoegsel van het versienummer, zodat het leesbaar blijft. */
  merk: string;
};

const BLOKKEN: Blok[] = [
  {
    bestand: "lib/db.ts",
    vanaf: "async function init(): Promise<void> {",
    tot: "\nexport function ensureSchema",
    constante: "KERN_SCHEMA_VERSIE",
    merk: "k1",
  },
  {
    bestand: "lib/site-urls.ts",
    vanaf: "async function doEnsureTables(): Promise<void> {",
    tot: "\nfunction normUrl",
    constante: "SITE_URLS_SCHEMA_VERSIE",
    merk: "su1",
  },
  {
    bestand: "lib/dev-worklist.ts",
    vanaf: "async function doEnsure(): Promise<void> {",
    tot: "\nexport async function getDevWorklist",
    constante: "DEV_WORKLIST_SCHEMA_VERSIE",
    merk: "dw1",
  },
  {
    bestand: "lib/fase-historie.ts",
    vanaf: "async function doeHet(): Promise<void> {",
    tot: "\nexport type FaseSinds",
    constante: "FASE_HISTORIE_SCHEMA_VERSIE",
    merk: "fh1",
  },
  {
    bestand: "lib/tweaks.ts",
    vanaf: "async function doeBouw(): Promise<void> {",
    tot: "\nexport function ensureTweaks",
    constante: "TWEAKS_SCHEMA_VERSIE",
    merk: "tw1",
  },
  {
    bestand: "lib/bouw-historie.ts",
    vanaf: "async function doeBouw(): Promise<void> {",
    tot: "\nexport function ensureBouwHistorie",
    constante: "BOUW_HISTORIE_SCHEMA_VERSIE",
    merk: "bh1",
  },
  {
    bestand: "lib/grote-punten.ts",
    vanaf: "async function doeBouw(): Promise<void> {",
    tot: "\nexport function ensureGrotePunten",
    constante: "GROTE_PUNTEN_SCHEMA_VERSIE",
    merk: "gp1",
  },
];

const wortel = join(__dirname, "..");
const fouten: string[] = [];

for (const b of BLOKKEN) {
  const bron = readFileSync(join(wortel, b.bestand), "utf8");

  const i = bron.indexOf(b.vanaf);
  if (i < 0) {
    fouten.push(`${b.bestand}: het bouwblok begint niet meer met "${b.vanaf}". Pas deze proef aan.`);
    continue;
  }
  const j = bron.indexOf(b.tot, i);
  if (j < 0) {
    fouten.push(`${b.bestand}: het einde van het bouwblok ("${b.tot.trim()}") is niet gevonden. Pas deze proef aan.`);
    continue;
  }

  // Commentaar en witruimte tellen niet mee: een tekstuitleg bijwerken hoort
  // geen migratie uit te lokken. Alleen de echte opdrachten tellen.
  const blok = bron
    .slice(i, j)
    .replace(/\/\*[\s\S]*?\*\//g, "")     // /* ... */
    .replace(/^\s*\/\/.*$/gm, "")          // // ...
    .replace(/\s+/g, " ")
    .trim();

  const afdruk = createHash("sha256").update(blok).digest("hex").slice(0, 8);
  const verwacht = `${b.merk}-${afdruk}`;

  const m = new RegExp(`${b.constante}\\s*=\\s*"([^"]+)"`).exec(bron);
  if (!m) {
    fouten.push(`${b.bestand}: constante ${b.constante} niet gevonden.`);
    continue;
  }
  if (m[1] !== verwacht) {
    fouten.push(
      `${b.bestand}: het bouwblok is gewijzigd maar ${b.constante} staat nog op "${m[1]}".\n` +
      `      Zet hem op: "${verwacht}"\n` +
      `      (zonder dit draait de wijziging nooit op een database die de oude versie al heeft)`,
    );
  }
}

// Sluitstuk: een nieuw onderdeel dat de stempel gebruikt MOET hier ook bewaakt
// worden. Zonder deze controle kan iemand `eenmalig(...)` toevoegen, de versie
// nooit ophogen, en dan draait zijn migratie stilletjes nooit.
const bewaakt = new Set(BLOKKEN.map((b) => b.bestand));
for (const naam of readdirSync(join(wortel, "lib")).filter((f) => f.endsWith(".ts"))) {
  const pad = `lib/${naam}`;
  if (pad === "lib/schema-stand.ts" || bewaakt.has(pad)) continue;
  if (/\beenmalig\s*\(/.test(readFileSync(join(wortel, pad), "utf8"))) {
    fouten.push(`${pad} gebruikt eenmalig() maar staat niet in BLOKKEN van deze proef. Zet er een regel bij.`);
  }
}

if (fouten.length) {
  console.error("\n✗ Schema-versie klopt niet:\n");
  for (const f of fouten) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ Schema-versie: ${BLOKKEN.length} bouwblok(ken) hebben een kloppende stempel.`);
