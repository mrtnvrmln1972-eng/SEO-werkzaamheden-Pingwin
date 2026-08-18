// ═══════════════════════════════════════════════════════════
// NIETS DAT VANZELF OPKOMT, KOMT METEEN OP
// ═══════════════════════════════════════════════════════════
// Alles wat bij hover uit zichzelf verschijnt (het donkere uitleg-bolletje bij
// elk element met een title, de link-preview in de werk-tabel) wacht tot je
// even stil hangt. Zonder die wachttijd flikkerde er van alles in beeld zodra
// je de muis over het scherm bewoog, en dan leest niemand ze meer.
//
// Twee dingen die stilletjes terug kunnen komen, en die deze proef daarom
// nareken:
//  1. de wachttijd staat op één plek (--hint-vertraging in globals.css), dus
//     niemand schrijft er ergens een eigen getal naast;
//  2. het tonen gebeurt in een timer, niet meteen in de mouseover zelf.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const lees = (...p: string[]) => readFileSync(join(wortel, ...p), "utf8");

const css = lees("app", "globals.css");
const helper = lees("app", "_ui", "hint-vertraging.ts");
const hover = lees("app", "_ui", "HoverHint.tsx");
const preview = lees("app", "admin", "client", "[slug]", "LinkPreview.tsx");

// 1. Het getal leeft in de CSS, bij de andere maten.
const token = css.match(/--hint-vertraging:\s*([\d.]+)(ms|s)\s*;/);
proef(
  "de wachttijd staat als token in globals.css",
  !!token,
  "Zet `--hint-vertraging: 700ms;` terug in :root. Daar horen alle maten, en de schermen lezen hem daar.",
);
const ms = token ? (token[2] === "s" ? parseFloat(token[1]) * 1000 : parseFloat(token[1])) : 0;
proef(
  `de wachttijd is een menselijke maat (${ms}ms)`,
  ms >= 150 && ms <= 3000,
  "Onder 150ms flikkert het weer, boven 3 seconden denkt iedereen dat de uitleg kapot is.",
);

// 2. Eén bron: de helper leest de CSS-variabele, de schermen lezen de helper.
proef(
  "de helper leest de CSS-variabele in plaats van een eigen getal",
  /getPropertyValue\("--hint-vertraging"\)/.test(helper),
  "app/_ui/hint-vertraging.ts hoort de waarde uit globals.css te halen.",
);

for (const [naam, bron] of [["HoverHint", hover], ["LinkPreview", preview]] as const) {
  proef(
    `${naam} haalt de wachttijd bij de helper`,
    /leesHintVertraging\(\)/.test(bron),
    `Gebruik leesHintVertraging() uit app/_ui/hint-vertraging.ts; een eigen getal in ${naam} loopt uit de pas met de rest.`,
  );
  // Een los getal in een setTimeout is precies hoe een tweede wachttijd ontstaat.
  // De 250ms van de link-preview is het wegblijven na vertrek, niet het opkomen.
  const losseTimers = [...bron.matchAll(/setTimeout\([^)]*?,\s*(\d{2,5})\)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => n !== 250);
  proef(
    `${naam} schrijft geen eigen wachttijd uit`,
    losseTimers.length === 0,
    losseTimers.length ? `Gevonden losse wachttijd(en): ${losseTimers.join(", ")}ms.` : "",
  );
  proef(
    `${naam} toont pas na de timer, niet meteen bij binnenkomst`,
    /setTimeout\(/.test(bron) && !/mouseover[\s\S]{0,400}?setState\(\{/.test(bron),
    "Het tonen hoort in de vertraagde timer te staan; direct setState in de mouseover geeft het geflikker terug.",
  );
}

// 3. De browser-tooltip mag er tijdens het wachten niet alsnog overheen komen.
proef(
  "de title gaat er meteen af, ook al tonen we nog niets",
  /removeAttribute\("title"\)/.test(hover) && hover.indexOf('removeAttribute("title")') < hover.indexOf("setTimeout("),
  "Haal het title-attribuut weg vóór de wachttimer, anders toont de browser ondertussen zijn eigen tooltip.",
);

console.log(fouten === 0 ? "\nAlles goed: niets springt meer meteen in beeld." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
