// ═══════════════════════════════════════════════════════════
// EEN DATUM UIT DE DATABASE KOMT ALTIJD ALS "JJJJ-MM-DD" IN BEELD
// ═══════════════════════════════════════════════════════════
// Een DATE-kolom komt als JS-datum terug, niet als tekst. `String(x).slice(0, 10)`
// maakt daar "Sun Aug 17" van, een datumvakje toont dat als leeg, en bij het
// volgende opslaan wordt de datum echt gewist. Op 21-08-2026 zaten twee extra
// regels onder een lead daar op vast: er stond een opvolgdatum, je zag hem niet,
// en ze namen de datum van het bedrijf erboven ook niet over.
//
// Deze proef bewaakt twee dingen: dat lib/dag-uit-db.ts het goed doet (ook bij
// een tijdzone die niet UTC is), en dat niemand er ergens anders opnieuw zijn
// eigen versie van neerzet.
// ═══════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { dagUitDb } from "../lib/dag-uit-db";

let fout = 0;
const meld = (goed: boolean, wat: string, extra = "") => {
  console.log(`${goed ? "OK  " : "FOUT"} | ${wat}${extra ? `\n       ${extra}` : ""}`);
  if (!goed) fout++;
};

// ── 1. Wat er uit de database kan komen ──
meld(dagUitDb(new Date(2026, 7, 17)) === "2026-08-17",
  "een DATE-kolom (JS-datum) wordt 2026-08-17",
  `kreeg: ${dagUitDb(new Date(2026, 7, 17))}`);

// Middernacht in een tijdzone vóór UTC verschuift met toISOString een dag terug.
// Uit de losse onderdelen lezen doet dat niet, en die dag mag nooit opschuiven.
meld(dagUitDb(new Date(2026, 7, 17, 0, 0, 0)) === "2026-08-17",
  "middernacht blijft dezelfde dag, ook buiten UTC");
meld(dagUitDb(new Date(2026, 0, 1)) === "2026-01-01", "januari krijgt een 01, geen 1");

meld(dagUitDb("2026-08-17") === "2026-08-17", "tekst die al goed staat blijft staan");
meld(dagUitDb("2026-08-17T00:00:00.000Z") === "2026-08-17", "een tijdstempel wordt de dag ervan");

meld(dagUitDb(null) === null, "niets blijft niets");
meld(dagUitDb(undefined) === null, "ontbrekend blijft niets");
meld(dagUitDb("") === null, "leeg blijft niets");
meld(dagUitDb("Sun Aug 17 2026") === null,
  "een onleesbare datum wordt niets, geen half woord dat later stil gewist wordt");
meld(dagUitDb(new Date("kaas")) === null, "een kapotte datum wordt niets");

// ── 2. Niemand schrijft er zijn eigen versie van ──
// Het patroon dat fout ging: String(iets_met_datum).slice(0, 10).
const verdacht = /String\(\s*[A-Za-z_$][\w.$]*(?:datum|date|_at)[\w.$]*\s*\)\s*\.slice\(\s*0\s*,\s*10\s*\)/i;
const overslaan = new Set(["dag-uit-db.ts"]);

function loop(map: string, gevonden: string[]): string[] {
  for (const naam of readdirSync(map)) {
    const pad = join(map, naam);
    if (statSync(pad).isDirectory()) { loop(pad, gevonden); continue; }
    if (!naam.endsWith(".ts") && !naam.endsWith(".tsx")) continue;
    if (overslaan.has(naam)) continue;
    readFileSync(pad, "utf8").split("\n").forEach((regel, i) => {
      if (verdacht.test(regel)) gevonden.push(`${pad}:${i + 1}`);
    });
  }
  return gevonden;
}

const eigenwijs = [...loop("lib", []), ...loop("app", [])];
meld(eigenwijs.length === 0,
  "geen enkel bestand snijdt zelf een datum af met String(...).slice(0, 10)",
  eigenwijs.length ? `${eigenwijs.join(", ")}. Gebruik dagUitDb uit lib/dag-uit-db.ts.` : "");

console.log(fout === 0
  ? "\nDe datums uit de database komen overal op dezelfde manier in beeld."
  : `\n${fout} ding(en) fout.`);
if (fout > 0) process.exit(1);
