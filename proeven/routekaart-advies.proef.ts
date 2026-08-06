// Proef op het advies "begin hier" van de routekaart.
//
// Waarom dit bestand er is: op 6 augustus 2026 stond R1 te lopen en raadde het
// scherm R4 aan. Allebei raken ze "Verbruik", en twee regels lager waarschuwt
// datzelfde scherm dat je die niet gelijktijdig moet doen. Zo'n advies ziet er
// precies zo uit als een goed advies; je merkt het pas als twee chats in
// hetzelfde bestand schrijven en het werk half af blijft.
//
// De regel die hier bewaakt wordt: wat er nu loopt telt mee. Een punt dat een
// scherm raakt waar al aan gewerkt wordt, wordt nooit aangeraden.

import { PUNTEN, nuDoen, botstMetLopend, kanStarten, geenAdviesReden, type Punt } from "../lib/routekaart";

let fouten = 0;
function check(naam: string, ok: boolean) {
  if (!ok) fouten++;
  console.log(`  ${ok ? "ok  " : "FOUT"} ${naam}`);
}

// De echte lijst laten staan; voor de gevallen hieronder rekenen we met de
// functies zelf, zodat deze proef niet omvalt zodra een punt van stand wisselt.
console.log("\nHet advies botst nooit met wat er loopt:");
const advies = nuDoen();
check("er is een advies, of een reden waarom niet", Boolean(advies) !== Boolean(geenAdviesReden()));
if (advies) {
  check(`${advies.code} botst niet met een lopend punt`, botstMetLopend(advies).length === 0);
  check(`${advies.code} kan ook echt beginnen`, kanStarten(advies));
}

console.log("\nEen lopend punt raadt zichzelf niet aan:");
const lopend = PUNTEN.filter((p) => p.stand === "loopt");
check("advies staat niet op loopt", !advies || advies.stand === "open");
for (const p of lopend) {
  check(`${p.code} loopt en wordt niet aangeraden`, advies?.code !== p.code);
}

console.log("\nBotsen is wederzijds en telt zichzelf niet mee:");
for (const p of PUNTEN.slice(0, 6)) {
  const botst = botstMetLopend(p);
  check(`${p.code} zit niet in zijn eigen botslijst`, !botst.some((x: Punt) => x.code === p.code));
  check(`${p.code} botst alleen met lopende punten`, botst.every((x: Punt) => x.stand === "loopt"));
}

console.log("\nDe reden klopt met de uitkomst:");
const reden = geenAdviesReden();
check("advies en reden sluiten elkaar uit", advies ? reden === null : reden !== null);
if (reden === "botst") {
  check("er kán wel iets, het botst alleen", PUNTEN.filter(kanStarten).length > 0);
}
if (reden === "leeg") {
  check("er kan echt niets", PUNTEN.filter(kanStarten).length === 0);
}

console.log(fouten === 0 ? "\nAlles goed.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
