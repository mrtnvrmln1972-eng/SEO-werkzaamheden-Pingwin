import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════
// POORT: EEN INGEVULDE WAARDE IN SQL DIE GEREKEND WORDT, KRIJGT EEN TYPE
// ═══════════════════════════════════════════════════════════
// Wat er misging (15-08-2026, live). Er kwam een vraag bij die de vervaltijd van
// het bouwslot per baan berekent:
//
//     gestart < now() - (CASE WHEN baan = 'punt'
//                             THEN ${VERVAL_MINUTEN.punt}
//                             ELSE ${VERVAL_MINUTEN.tweak} END * INTERVAL '1 minute')
//
// Dat ziet er goed uit en de bouw was groen: TypeScript kijkt niet in een
// SQL-sjabloon en er draait bij het bouwen geen database. Maar zo'n ingevulde
// waarde gaat NIET als tekst mee naar de database; hij wordt een losse parameter
// zonder type. In een gewone vergelijking leidt Postgres dat type af uit de
// kolom ernaast. Hier stond hij tussen twee andere parameters in een CASE en
// werd hij vermenigvuldigd met een INTERVAL, en dan valt Postgres terug op
// tekst: `operator does not exist: text * interval`.
//
// Gevolg: élke pagina die deze vraag stelt viel om met een serverfout. Niet
// alleen het nieuwe scherm, ook de tweak-stapel, want die deelt hetzelfde slot.
// Het kwam pas aan het licht toen Maarten het scherm opende.
//
// Deze proef sluit dat gat op de plek waar het te zien is zonder database: een
// ingevulde waarde die met een INTERVAL wordt gecombineerd, moet een expliciet
// type meekrijgen (`${...}::int`). Dan bestaat de twijfel niet meer.
//
// Bewust NIET elke som gecontroleerd. `rondes = rondes + ${n}` is veilig: daar
// staat een kolom met een bekend type naast, dus Postgres weet het. Een proef
// die ook dat rood maakt, meldt vooral dingen die goed staan, en zo'n proef zet
// iemand uit. Alleen de combinatie die echt is misgegaan.
// ═══════════════════════════════════════════════════════════

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const WORTEL = join(__dirname, "..");

/**
 * Elk sql`...`-sjabloon uit een bestand halen.
 *
 * Met een echte scanner en niet met een reguliere uitdrukking: een sjabloon kan
 * zelf accolades bevatten (`${JSON.stringify(x)}`), en daar loopt een regex op
 * vast. Diezelfde les staat in proeven/huisstijl.proef.ts.
 */
function sjablonen(bron: string): { sql: string; regel: number }[] {
  const uit: { sql: string; regel: number }[] = [];
  let i = 0;
  while ((i = bron.indexOf("sql`", i)) >= 0) {
    let j = i + 4;
    let diep = 0;
    for (; j < bron.length; j++) {
      if (bron[j] === "\\") { j++; continue; }
      if (bron[j] === "$" && bron[j + 1] === "{") { diep++; j++; continue; }
      if (bron[j] === "}" && diep > 0) { diep--; continue; }
      if (bron[j] === "`" && diep === 0) break;
    }
    uit.push({ sql: bron.slice(i + 4, j), regel: bron.slice(0, i).split("\n").length });
    i = j + 1;
  }
  return uit;
}

const bestanden = readdirSync(join(WORTEL, "lib"))
  .filter((n) => n.endsWith(".ts"))
  .map((n) => `lib/${n}`);

let gezien = 0;
const zonderType: string[] = [];

for (const bestand of bestanden) {
  for (const { sql, regel } of sjablonen(readFileSync(join(WORTEL, bestand), "utf8"))) {
    if (!/\bINTERVAL\b/i.test(sql)) continue;
    // Per ingevulde waarde kijken of hij in dezelfde ademtocht als een INTERVAL
    // gebruikt wordt, en zo ja of er een type achter staat.
    for (const m of sql.matchAll(/\$\{[^}]*\}/g)) {
      const na = sql.slice((m.index ?? 0) + m[0].length);
      const voor = sql.slice(Math.max(0, (m.index ?? 0) - 80), m.index ?? 0);
      const rekentMetInterval =
        /^\s*(::[a-z]+\s*)?[*/+-]\s*INTERVAL\b/i.test(na)
        || /INTERVAL\s*'[^']*'\s*[*/+-]\s*$/i.test(voor);
      if (!rekentMetInterval) continue;
      gezien++;
      if (!/^\s*::/.test(na)) {
        zonderType.push(`${bestand}:${regel} → ${m[0]} (geen ::type vóór de rekensom met INTERVAL)`);
      }
    }
  }
}

proef(`elke ingevulde waarde die met een INTERVAL rekent heeft een type (${gezien} gevonden)`,
  zonderType.length === 0,
  `${zonderType.join("\n     | ")}\n     | Zonder ::int gokt Postgres op tekst, en 'text * interval' bestaat niet: de pagina valt om met een serverfout terwijl de bouw groen was.`);

// Het vangnet zelf moet blijven bestaan: staat er nergens meer zo'n som, dan
// bewaakt deze proef niets en is dat het weten waard.
proef("er is minstens één zo'n som om te bewaken", gezien > 0,
  "Geen enkele INTERVAL-berekening met een ingevulde waarde gevonden. Klopt dat, dan mag deze proef weg; anders is de scanner stuk.");

if (fouten) {
  console.error("\n✗ SQL-vorm klopt niet.\n");
  process.exit(1);
}
console.log("\n✓ SQL-vorm: elke berekende waarde in een SQL-vraag heeft een type.\n");
