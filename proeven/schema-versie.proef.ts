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
//
// ── Waarom hier geen lijst meer staat (17-08-2026) ──────────────────
// Hier stond een handgeschreven lijst met per onderdeel het bestand, de
// beginregel en de eindregel van het bouwblok. Dat werkte zolang het er acht
// waren. Toen alle 51 tabel-helpers op de stempel gingen, zou die lijst 51
// regels worden waarin elk item drie keer een stukje code woordelijk herhaalt
// dat elders in de repo staat. Dat is exact de fout die deze repo al twee keer
// gemaakt heeft: de proeven-lijst in package.json die uiteenliep met de
// werkelijkheid, en de vier plekken die zelf beslisten hoe tekst HTML werd.
//
// Dus net als `proeven/alles.mjs`: niet opschrijven wat er is, maar kijken wat
// er is. Deze proef leest élk bestand in `lib/`, zoekt de aanroepen van
// `eenmalig(...)` en werkt van daaruit terug naar de bouwfunctie. Een nieuw
// onderdeel hoef je nergens aan te melden; het wordt bewaakt vanaf zijn eerste
// commit. Zet hier dus nooit weer een handmatige lijst neer.
// ═══════════════════════════════════════════════════════════

// eenmalig("naam", CONSTANTE, bouwfunctie)
const AANROEP = /eenmalig\(\s*"([^"]+)"\s*,\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;

/** Het lichaam van een functie, van de openende accolade tot zijn sluitgenoot. */
function functieLichaam(bron: string, naam: string): string | null {
  const kop = new RegExp(`(?:async\\s+)?function\\s+${naam}\\s*\\([^)]*\\)\\s*:[^{]*\\{`).exec(bron);
  if (!kop) return null;
  let diepte = 0;
  for (let i = kop.index + kop[0].length - 1; i < bron.length; i++) {
    const c = bron[i];
    if (c === "{") diepte++;
    else if (c === "}") {
      diepte--;
      if (diepte === 0) return bron.slice(kop.index + kop[0].length, i);
    }
  }
  return null;
}

const wortel = join(__dirname, "..");
const fouten: string[] = [];
// Twee onderdelen met dezelfde stempelnaam zouden elkaars bouwblok overslaan;
// dat is stil en onvindbaar, dus dat vangen we hier af.
const namen = new Map<string, string>();
let geteld = 0;

for (const bestand of readdirSync(join(wortel, "lib")).filter((f) => f.endsWith(".ts"))) {
  const pad = `lib/${bestand}`;
  if (pad === "lib/schema-stand.ts") continue;
  const bron = readFileSync(join(wortel, pad), "utf8");

  AANROEP.lastIndex = 0;
  for (let m = AANROEP.exec(bron); m; m = AANROEP.exec(bron)) {
    const [, naam, constante, bouwer] = m;
    geteld++;

    const eerder = namen.get(naam);
    if (eerder) fouten.push(`${pad}: de stempelnaam "${naam}" is al in gebruik in ${eerder}. Twee blokken met dezelfde naam slaan elkaar over; kies een andere naam.`);
    else namen.set(naam, pad);

    const lichaam = functieLichaam(bron, bouwer);
    if (lichaam === null) {
      fouten.push(`${pad}: de bouwfunctie ${bouwer}() is niet gevonden (of staat niet in dit bestand). De stempel kan dan niet nagerekend worden.`);
      continue;
    }

    // Commentaar en witruimte tellen niet mee: een tekstuitleg bijwerken hoort
    // geen migratie uit te lokken. Alleen de echte opdrachten tellen.
    const blok = lichaam
      .replace(/\/\*[\s\S]*?\*\//g, "")   // /* ... */
      .replace(/^\s*\/\/.*$/gm, "")        // // ...
      .replace(/\s+/g, " ")
      .trim();

    const verwacht = `${naam}-${createHash("sha256").update(blok).digest("hex").slice(0, 8)}`;

    const v = new RegExp(`\\b${constante}\\s*=\\s*"([^"]+)"`).exec(bron);
    if (!v) {
      fouten.push(`${pad}: constante ${constante} niet gevonden.`);
      continue;
    }
    if (v[1] !== verwacht) {
      fouten.push(
        `${pad}: het bouwblok ${bouwer}() is gewijzigd maar ${constante} staat nog op "${v[1]}".\n` +
        `      Zet hem op: "${verwacht}"\n` +
        `      (zonder dit draait de wijziging nooit op een database die de oude versie al heeft)`,
      );
    }
  }
}

if (!geteld) {
  fouten.push("Geen enkel eenmalig()-blok gevonden. Dat kan niet kloppen; is de vorm van de aanroep veranderd?");
}

if (fouten.length) {
  console.error("\n✗ Schema-versie klopt niet:\n");
  for (const f of fouten) console.error(`  • ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ Schema-versie: ${geteld} bouwblok(ken) hebben een kloppende stempel.`);
