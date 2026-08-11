// Draait álle proeven in deze map, en vindt ze zelf.
//
// Waarom dit bestand er is: de lijst met proeven stond twee keer met de hand in
// package.json (bij "proef" en bij "prebuild"), en die twee liepen uit elkaar.
// Op 11 augustus 2026 bestonden er 22 proeven, waarvan er bij een bouw 5 draaiden.
// De andere 17 draaiden alleen als iemand ze handmatig aanriep, dus in de praktijk
// nooit. Precies die 17 bewaakten de dingen die stilletjes breken als er vanuit een
// andere chat iets naast je verandert.
//
// De oplossing is dezelfde als altijd binnen Pingwin: één bron. Er is geen lijst
// meer. Deze loper leest de map, en elk bestand dat op `.proef.ts` eindigt draait
// automatisch mee. Een nieuwe proef bewaakt dus vanaf zijn eerste commit, zonder
// dat iemand hem ergens moet bijschrijven en zonder dat hij vergeten kan worden.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel. Rood betekent: de bouw
// mislukt en het komt niet live. Dat is het hele punt.

import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WORTEL = join(HIER, "..");

// Hoeveel proeven tegelijk. Elke proef start een eigen Node-proces; tegelijk
// draaien scheelt op 22 proeven ruim een halve minuut bouwtijd.
const TEGELIJK = Number(process.env.PROEF_TEGELIJK) || 8;

// Een proef die blijft hangen mag de bouw niet eindeloos ophouden.
const TIJDSLIMIET_MS = Number(process.env.PROEF_TIJDSLIMIET_MS) || 120_000;

// tsx staat als devDependency in package.json, dus hij ligt hier klaar. Geen
// `npx --yes` meer: dat deed per proef een netwerkrondje, en 22 daarvan tegelijk
// op een verse Vercel-bouwer vechten om dezelfde download.
const TSX = join(WORTEL, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

const proeven = readdirSync(HIER)
  .filter((naam) => naam.endsWith(".proef.ts"))
  .sort();

if (proeven.length === 0) {
  console.error("✗ Geen enkele proef gevonden in proeven/. Dat klopt niet.");
  process.exit(1);
}

function draai(bestand) {
  return new Promise((klaar) => {
    const begin = Date.now();
    const kind = spawn(TSX, [join(HIER, bestand)], {
      cwd: WORTEL,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let uitvoer = "";
    kind.stdout.on("data", (d) => (uitvoer += d));
    kind.stderr.on("data", (d) => (uitvoer += d));

    const klok = setTimeout(() => {
      kind.kill("SIGKILL");
      uitvoer += `\n(afgebroken na ${TIJDSLIMIET_MS / 1000} seconden)`;
    }, TIJDSLIMIET_MS);

    kind.on("error", (fout) => {
      clearTimeout(klok);
      klaar({ bestand, goed: false, uitvoer: `Kon de proef niet starten: ${fout.message}`, duur: 0 });
    });

    kind.on("close", (code) => {
      clearTimeout(klok);
      klaar({ bestand, goed: code === 0, uitvoer, duur: (Date.now() - begin) / 1000 });
    });
  });
}

// Werkverdeling: TEGELIJK lopers die om beurten het volgende bestand pakken.
const wachtrij = [...proeven];
const uitslagen = [];

await Promise.all(
  Array.from({ length: Math.min(TEGELIJK, wachtrij.length) }, async () => {
    for (let bestand = wachtrij.shift(); bestand; bestand = wachtrij.shift()) {
      uitslagen.push(await draai(bestand));
    }
  })
);

uitslagen.sort((a, b) => a.bestand.localeCompare(b.bestand));

const gezakt = uitslagen.filter((u) => !u.goed);

for (const u of uitslagen) {
  console.log(`${u.goed ? "✓" : "✗"} ${u.bestand.padEnd(30)} ${u.duur.toFixed(1)}s`);
}

if (gezakt.length) {
  for (const u of gezakt) {
    console.error(`\n${"─".repeat(60)}\n✗ ${u.bestand}\n${"─".repeat(60)}`);
    console.error(u.uitvoer.trimEnd());
  }
  console.error(
    `\n${gezakt.length} van de ${uitslagen.length} proeven is rood. De bouw stopt hier, dus dit komt niet live.\n`
  );
  process.exit(1);
}

console.log(`\nAlle ${uitslagen.length} proeven groen.\n`);
