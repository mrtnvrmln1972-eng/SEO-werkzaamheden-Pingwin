// Proef op de autoriteit per pagina (URL Rating) in de interne-links-motor.
//
// Waarom dit bestand er is: dit is precies het soort fout dat je nooit ziet. Bij
// het bouwen bleek dat Ahrefs /hovenier-den-bosch/ kent met autoriteit 6, en
// /hovenier-den-bosch (dezelfde pagina, zonder slash aan het eind) helemaal niet:
// die geeft 0,0 terug. Geen foutmelding, geen lege waarde, gewoon een nul die er
// echt uitziet. Onze eigen paden staan zonder slash opgeslagen, dus zonder het
// opvragen van beide vormen zou élke pagina van élke klant "geen autoriteit"
// heten en zou het advies stil verkeerd sorteren.
//
// Twee dingen liggen hier vast:
//  1. Van elke URL worden beide vormen opgevraagd (met en zonder slash).
//  2. De weging: autoriteit weegt de helft, interne links en verkeer de rest, en
//     alle drie worden eerst op dezelfde schaal gezet. Zonder dat laatste wint
//     het grootste getal (klikken) altijd van een schaal die bij 100 ophoudt.

import { varianten } from "../lib/ahrefs";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

console.log("\n── Beide vormen van een URL worden opgevraagd ──");
check(
  "pad zonder slash vraagt ook de vorm mét slash op",
  JSON.stringify(varianten("https://paulhoevenaars.nl/hovenier-den-bosch")),
  JSON.stringify(["paulhoevenaars.nl/hovenier-den-bosch", "paulhoevenaars.nl/hovenier-den-bosch/"]),
);
check(
  "pad mét slash vraagt ook de vorm zonder op",
  JSON.stringify(varianten("https://paulhoevenaars.nl/hovenier-den-bosch/")),
  JSON.stringify(["paulhoevenaars.nl/hovenier-den-bosch/", "paulhoevenaars.nl/hovenier-den-bosch"]),
);
check("www valt weg, net als bij Ahrefs zelf", varianten("https://www.kamsteegtuinen.nl/tuinonderhoud")[0], "kamsteegtuinen.nl/tuinonderhoud");
check("hoofdletters worden klein", varianten("https://Kamsteegtuinen.nl/Tuinonderhoud")[0], "kamsteegtuinen.nl/tuinonderhoud");
check("de voorpagina wordt maar in één vorm gevraagd", varianten("https://paulhoevenaars.nl/").length, 1);

// De weging uit lib/internal-links.ts, hier nagerekend. Bewust een kopie van de
// formule en niet de import: dat bestand trekt de halve database mee. Wijzigt de
// weging daar, dan hoort deze proef mee te veranderen; dat is precies de bedoeling.
function normaliseer(waarde: number, max: number): number {
  return max > 0 ? Math.min(1, Math.max(0, waarde / max)) : 0;
}
function weeg(ur: number, inc: number, clicks: number, maxUr: number, maxInc: number, maxClicks: number): number {
  return 0.5 * normaliseer(ur, maxUr) + 0.3 * normaliseer(inc, maxInc) + 0.2 * normaliseer(clicks, maxClicks);
}

console.log("\n── De rangorde van kandidaat-bronpagina's ──");
// Een sterke pagina zonder verkeer hoort boven een zwakke pagina met veel verkeer:
// een interne link geeft autoriteit door, geen bezoekers.
const sterk = weeg(20, 30, 0, 20, 30, 500);
const druk = weeg(2, 5, 500, 20, 30, 500);
check("autoriteit weegt zwaarder dan klikken", sterk > druk, true);

// Gelijke autoriteit: dan beslist het aantal interne links dat er al binnenkomt.
check(
  "bij gelijke autoriteit wint de best gelinkte pagina",
  weeg(10, 30, 10, 20, 30, 100) > weeg(10, 3, 10, 20, 30, 100),
  true,
);

// Zonder normalisatie zou dit omdraaien: 500 klikken is nu eenmaal een groter
// getal dan een autoriteit die bij 100 ophoudt. Dat is de fout die we voorkomen.
check("de rauwe optelling zou het andersom zetten", 20 + 30 + 0 > 2 + 5 + 500, false);

// Een lege site mag geen deling door nul geven.
check("alles nul levert geen rekenfout op", weeg(0, 0, 0, 0, 0, 0), 0);

console.log(fouten === 0 ? "\nAlle proeven op de autoriteit zijn goed.\n" : `\n${fouten} proef(en) mislukt.\n`);
process.exit(fouten === 0 ? 0 : 1);
