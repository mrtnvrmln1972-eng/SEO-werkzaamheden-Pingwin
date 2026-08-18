// Bewaakt dat lib/stijl-basis.json nog klopt met app/globals.css.
//
// Dat bestand is de lijst uitgangsmaten waarmee de server een vastgelegde stijl
// uitrekent (zie scripts/stijl-basis-bijwerken.ts). Loopt hij achter, dan rekent
// de server met andere maten dan er in de opmaak staan en zie je een vastgelegde
// stijl anders dan de proefstijl in je browser. Dat is precies het soort verschil
// dat niemand opmerkt tot het uren kost, dus het is een poort en geen afspraak.
//
// Word je hier rood: npx tsx scripts/stijl-basis-bijwerken.ts

import fs from "fs";
import path from "path";
import { leesBasismaten } from "../scripts/stijl-basis-bijwerken";

const WORTEL = path.join(__dirname, "..");
const uitCss = leesBasismaten(fs.readFileSync(path.join(WORTEL, "app/globals.css"), "utf8"));
const opgeslagen = JSON.parse(fs.readFileSync(path.join(WORTEL, "lib/stijl-basis.json"), "utf8")) as Record<string, number>;

const fouten: string[] = [];
for (const [naam, px] of Object.entries(uitCss)) {
  if (opgeslagen[naam] === undefined) fouten.push(`${naam} staat in de CSS maar niet in lib/stijl-basis.json`);
  else if (opgeslagen[naam] !== px) fouten.push(`${naam} is ${px}px in de CSS maar ${opgeslagen[naam]} in lib/stijl-basis.json`);
}
for (const naam of Object.keys(opgeslagen)) {
  if (uitCss[naam] === undefined) fouten.push(`${naam} staat in lib/stijl-basis.json maar niet meer in de CSS`);
}

if (fouten.length) {
  console.error("De uitgangsmaten lopen achter op app/globals.css:");
  for (const f of fouten) console.error(`  - ${f}`);
  console.error("\nHerstel met: npx tsx scripts/stijl-basis-bijwerken.ts");
  process.exit(1);
}

console.log(`stijl-basis: ${Object.keys(uitCss).length} uitgangsmaten kloppen met de opmaak.`);
