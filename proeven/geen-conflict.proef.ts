// ═══════════════════════════════════════════════════════════
// ER MAG NOOIT EEN HALF SAMENGEVOEGD BESTAND DE BOUW IN
// ═══════════════════════════════════════════════════════════
// Op 11 augustus 2026 zijn twee keer conflictmarkeringen meegecommit
// (`<<<<<<<`, `=======`, `>>>>>>>` in lib/uitleg.ts). Gevolg: de bouw mislukte
// met een onbegrijpelijke TypeScript-fout ergens midden in een regel, de site
// bleef twee opleveringen lang op oude code staan, en niemand zag het, want een
// mislukte bouw ziet er van buitenaf hetzelfde uit als een trage.
//
// Deze proef maakt van die onbegrijpelijke fout een leesbare: hij noemt het
// bestand en de regel, en zegt wat er moet gebeuren. Hij lost het botsen niet
// op (dat doen de eenregelige opzet van lib/wat-is-nieuw.ts en de merge=union
// in .gitattributes), hij zorgt dat een half samengevoegd bestand nooit stil
// voorbijkomt.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const WORTEL = join(__dirname, "..");
const OVERSLAAN = new Set([".git", ".next", "node_modules", "legacy", ".vercel"]);
const SOORTEN = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|sh|yml|yaml)$/i;

// De markering staat aan het begin van een regel, gevolgd door een spatie of
// het einde van de regel. Zo wordt een `=======`-scheidingslijn in een tekst of
// een `<<<<<<<` in een uitleg over dit onderwerp niet per ongeluk geraakt.
const MARKERING = /^(<{7}|>{7})(\s|$)/;

type Vondst = { bestand: string; regel: number; tekst: string };

function loop(map: string, uit: Vondst[]): void {
  for (const naam of readdirSync(map)) {
    if (OVERSLAAN.has(naam)) continue;
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) { loop(pad, uit); continue; }
    if (!SOORTEN.test(naam)) continue;
    // Dit bestand zelf beschrijft de markeringen; het zou zichzelf betrappen.
    if (pad.endsWith("geen-conflict.proef.ts")) continue;
    const regels = readFileSync(pad, "utf8").split("\n");
    regels.forEach((r, i) => {
      if (MARKERING.test(r)) uit.push({ bestand: pad.slice(WORTEL.length + 1), regel: i + 1, tekst: r.slice(0, 70) });
    });
  }
}

const vondsten: Vondst[] = [];
loop(WORTEL, vondsten);

if (vondsten.length === 0) {
  console.log("OK   | geen half samengevoegde bestanden");
  console.log("\nAlle proeven geslaagd.");
  process.exit(0);
}

console.log(`FOUT | ${vondsten.length} conflictmarkering(en) gevonden:`);
for (const v of vondsten) console.log(`     | ${v.bestand}:${v.regel}  ${v.tekst}`);
console.log("\nEr staat een half samengevoegd bestand in de code: twee wijzigingen zijn");
console.log("op dezelfde plek beland en er is niet gekozen welke er moet gelden.");
console.log("Los de botsing op (kies of combineer beide kanten), haal de markeringen");
console.log("weg, en draai deze proef opnieuw. Nooit zo committen: de bouw mislukt");
console.log("dan en de site blijft op de vorige versie staan.");
process.exit(1);
