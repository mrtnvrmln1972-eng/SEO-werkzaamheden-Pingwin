// Schrijft lib/stijl-basis.json opnieuw uit app/globals.css.
//
//   npx tsx scripts/stijl-basis-bijwerken.ts
//
// WAAROM DIT BESTAND BESTAAT
// ══════════════════════════
// De speelruimte rekent met vermenigvuldigers: "ruimte 85%" betekent elke stap
// van de ruimte-schaal maal 0,85. In de browser leest hij de uitgangsmaten uit
// het scherm zelf (getComputedStyle), dus daar is er niets te dupliceren.
//
// Sinds er een stijl vastgelegd kan worden, moet de server diezelfde som maken,
// vóórdat er een browser is. De server kan geen getComputedStyle doen, dus die
// heeft de uitgangsmaten nodig als getallen. Dit bestand is die lijst, en hij
// wordt niet met de hand bijgehouden: dit script schrijft hem uit de CSS, en
// proeven/stijl-basis.proef.ts wordt rood zodra hij achterloopt. Zelfde
// afspraak als bij lib/stijl-inventaris.json.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(WORTEL, "app/globals.css"), "utf8");

export function leesBasismaten(bron: string): Record<string, number> {
  const start = bron.indexOf(":root {");
  const root = bron.slice(start, bron.indexOf("\n}", start));
  const maten: Record<string, number> = {};
  for (const m of root.matchAll(/(--(?:s|fs|lh)-[\w-]+)\s*:\s*([\d.]+)px\s*;/g)) {
    maten[m[1]] = parseFloat(m[2]);
  }
  return maten;
}

if (require.main === module) {
  const maten = leesBasismaten(css);
  const uit = path.join(WORTEL, "lib/stijl-basis.json");
  fs.writeFileSync(uit, JSON.stringify(maten, null, 2) + "\n");
  console.log(`lib/stijl-basis.json bijgewerkt: ${Object.keys(maten).length} maten.`);
}
