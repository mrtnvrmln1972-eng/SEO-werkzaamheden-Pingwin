// Proef op de Ahrefs-teller.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Deze teller waarschuwt voor iets dat zelden gebeurt: het Ahrefs-tegoed dat
// opraakt. Precies daarom kun je hem niet in de praktijk testen; als hij fout
// rekent, merk je dat op de dag dat de motoren stilvallen en je hem nodig had.
//
// Hier wordt de rekenregel dus vooraf nagerekend, met vaste datums zodat de
// uitkomst morgen hetzelfde is als vandaag. Gecontroleerd wordt vooral het punt
// waar een kaal percentage tekortschiet: 60% op is rustig aan het eind van de
// maand en een waarschuwing op dag vier.

import { tellerStand } from "../lib/ahrefs-teller";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// De reset staat vast op 15 augustus; de periode loopt dus van 16 juli af.
const RESET = "2026-08-15T00:00:00Z";
const dag = (d: number) => new Date(`2026-08-${String(d).padStart(2, "0")}T12:00:00Z`);

// ── 1. De echte stand van vandaag (gemeten bij Ahrefs op 6 augustus 2026) ──
const echt = tellerStand({ used: 250859, limit: 400000, resetIso: RESET }, dag(6));
checkWaar("63% van 400.000 wordt als deel teruggegeven", Math.round((echt.deel ?? 0) * 100) === 63,
  `deel = ${echt.deel}`);
checkWaar("dagen tot de reset kloppen", echt.dagenTotReset === 9, `gevonden: ${echt.dagenTotReset}`);
checkWaar("het oordeel noemt de dagen tot de reset", echt.oordeel.includes("9 dagen"), echt.oordeel);

// ── 2. Hetzelfde percentage, ander moment in de maand ──
// Dit is de hele reden dat deze teller niet gewoon een percentage toont.
const laat = tellerStand({ used: 240000, limit: 400000, resetIso: RESET }, dag(13));
const vroeg = tellerStand({ used: 240000, limit: 400000, resetIso: RESET }, dag(1));
checkWaar("60% op vlak voor de reset is rustig", laat.sein === "rustig", `sein: ${laat.sein}`);
checkWaar("60% op halverwege de periode is een waarschuwing", vroeg.sein !== "rustig", `sein: ${vroeg.sein}`);
checkWaar("de waarschuwing noemt het tempo", vroeg.oordeel.toLowerCase().includes("tempo"), vroeg.oordeel);

// ── 3. De harde grenzen ──
checkWaar("boven de 90% is het altijd krap",
  tellerStand({ used: 380000, limit: 400000, resetIso: RESET }, dag(14)).sein === "krap");
checkWaar("een lege teller aan het begin van de maand is rustig",
  tellerStand({ used: 2000, limit: 400000, resetIso: RESET }, dag(1)).sein === "rustig");

// ── 4. Wat er gebeurt als Ahrefs minder teruggeeft dan verwacht ──
// Nooit een crash en nooit een verzonnen percentage: dat is precies hoe een
// meting stil onbetrouwbaar wordt.
const zonderLimiet = tellerStand({ used: 1000, limit: null, resetIso: null });
checkWaar("zonder limiet geen percentage", zonderLimiet.deel === null && zonderLimiet.sein === "onbekend");
checkWaar("zonder limiet toch een leesbare zin", zonderLimiet.oordeel.length > 10, zonderLimiet.oordeel);
checkWaar("helemaal geen antwoord van Ahrefs geeft een lege stand", tellerStand(null).used === null);

// ── 5. Een reset die al voorbij is ──
// Ahrefs loopt soms achter op zijn eigen resetdatum. Dat mag nooit een negatief
// aantal dagen opleveren ("nog -2 dagen te gaan" in de kopbalk).
const voorbij = tellerStand({ used: 100, limit: 400000, resetIso: RESET }, dag(20));
checkWaar("een verstreken resetdatum geeft nul dagen, geen negatief getal", voorbij.dagenTotReset === 0,
  `gevonden: ${voorbij.dagenTotReset}`);

// ── 6. Op dag één van de periode wordt er geen prognose verzonnen ──
// Eén zware scan op dag één zou anders een prognose van miljoenen geven.
const dagEen = tellerStand({ used: 20000, limit: 400000, resetIso: RESET }, new Date("2026-07-18T12:00:00Z"));
checkWaar("geen prognose zolang de periode nog te kort is", dagEen.prognose === null,
  `gevonden: ${dagEen.prognose}`);

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
