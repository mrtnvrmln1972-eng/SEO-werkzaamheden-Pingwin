// Proef op het koppelen van een ontwikkelpunt aan zijn beschrijving.
//
// Waarom dit bestand er is: de routekaart toont de beschrijving nu bij het punt
// zelf, en die tekst komt uit een ánder bestand (lib/uitleg.ts). Zo'n koppeling
// op titeltekst faalt stil: je ziet een lege of verkeerde beschrijving en dat
// ziet er precies zo uit als een punt dat nog geen tekst heeft.
//
// Twee dingen gaan hier gegarandeerd een keer mis:
//
//  1. R1 dat R10 tot en met R15 mee opslokt. "R1" is een prefix van "R10", dus
//     wie op de code alleen matcht, plakt de verkeerde tekst onder het punt.
//  2. Een nieuw punt in lib/routekaart.ts zonder beschrijving in lib/uitleg.ts.
//     Dat mag (null), maar het mag nooit een fout of de tekst van de buurman geven.

import { PUNTEN } from "../lib/routekaart";
import { beschrijvingVoor, beschrijvingen } from "../lib/routekaart-tekst";

let fouten = 0;
function check(naam: string, ok: boolean) {
  if (!ok) fouten++;
  console.log(`  ${ok ? "ok  " : "FOUT"} ${naam}`);
}

console.log("\nElk punt van de routekaart vindt zijn eigen beschrijving:");
for (const p of PUNTEN) {
  const html = beschrijvingVoor(p.code);
  check(`${p.code} heeft tekst`, typeof html === "string" && html.length > 50);
}

console.log("\nR1 pakt niet de tekst van R10 t/m R15:");
const r1 = beschrijvingVoor("R1") || "";
for (const code of ["R10", "R11", "R12", "R13", "R14", "R15"]) {
  const ander = beschrijvingVoor(code) || "";
  check(`R1 verschilt van ${code}`, r1 !== ander && ander.length > 50);
}

console.log("\nEen punt zonder beschrijving geeft null, geen fout en geen buurman:");
check("onbekende code", beschrijvingVoor("R999") === null);
check("lege code", beschrijvingVoor("") === null);
check("rommel", beschrijvingVoor("../etc") === null);

console.log("\nDe tekst is gerenderd, niet ruw:");
check("geen ruwe kopjes", !r1.includes("**Wat er nu mis is.**"));
check("wel html", r1.includes("<") && r1.includes(">"));

console.log("\nAlles in één keer ophalen geeft hetzelfde:");
const alles = beschrijvingen(PUNTEN.map((p) => p.code));
check("even veel als punten", Object.keys(alles).length === PUNTEN.length);
check("R2 gelijk", alles["R2"] === beschrijvingVoor("R2"));
check("onbekende code komt er niet in", !("R999" in beschrijvingen(["R999"])));

console.log(fouten === 0 ? "\nAlles goed.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
