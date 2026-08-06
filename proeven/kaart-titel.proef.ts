// Proef op de titel van een projectkaart.
//
// Waarom dit bestand er is: de titel groeide vanzelf vol. Er werd bij elke keer
// dat de planning geladen werd een nieuwe opdracht met " + " achter de titel
// geplakt. De kaart van /hovenier/etten-leur/ stond op 6 augustus 2026 op 183
// tekens. Die aangroei is gestopt, en deze proef legt vast wat er daarna hoort
// te gebeuren, zodat het niet stilletjes terugkomt.
//
// Twee dingen zijn hier belangrijker dan de titel zelf:
//  1. Een titel die al kort is, mag nooit opnieuw gewijzigd worden. Anders doet
//     de opschoning bij élke keer laden werk, en dat merk je pas als je bord
//     traag wordt of als je eigen titel steeds terugspringt.
//  2. Er mag geen opdracht verloren gaan. Wat uit de oude titel wordt gehaald,
//     hoort er als losse opdrachten weer uit te komen.

import { werkwoordVoor, korteTitel, isKorteTitel, opdrachtenUitTitel, padVan } from "../lib/kaart-titel";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

// De echte titel van de Kamsteeg-kaart, 183 tekens, zoals hij op 6 augustus 2026
// in de database stond.
const ECHT = "Fix 404 en controleer live-status /hovenier/etten-leur/ + bevestig en controleer locatiepagina's in menu/footer + controleer en publiceer locatiepagina's in menu/footer (actie Sander)";
const URL = "https://kamsteegtuinen.nl/hovenier/etten-leur/";

console.log("\n── Wat doen we met deze pagina ──");
check("een 404 herstel je", werkwoordVoor(ECHT, { live: false }), "herstellen");
check("publiceren herken je", werkwoordVoor("Zet de nieuwe pagina live en publiceer hem", { live: false }), "publiceren");
check("controleren herken je", werkwoordVoor("Controleer of de copy erop staat", { live: true }), "controleren");
check("bestaande pagina zonder signaalwoord: optimaliseren", werkwoordVoor("Nieuwe teksten verwerken", { live: true }), "optimaliseren");
check("pagina die nog niet bestaat: maken", werkwoordVoor("Nieuwe teksten verwerken", { live: false }), "maken");

console.log("\n── De nieuwe titel ──");
check("de echte kaart wordt één regel", korteTitel(ECHT, URL, { live: false }), "/hovenier/etten-leur/ · herstellen");
check("en die is kort", korteTitel(ECHT, URL, { live: false }).length <= 40, true);
check("pad uit een volledige URL", padVan(URL), "/hovenier/etten-leur/");
check("zonder pagina houdt hij zijn eigen woorden", korteTitel("Werklijst sitebouwer: meta's en alt-teksten", null), "Werklijst sitebouwer: meta's en alt-teksten");
check("een lange titel zonder pagina wordt afgekapt", korteTitel("a".repeat(120), null).endsWith("…"), true);

console.log("\n── Nooit twee keer ──");
// Dit is de poort die voorkomt dat de opschoning bij elke keer laden werk doet.
const nieuw = korteTitel(ECHT, URL, { live: false });
check("de nieuwe vorm wordt herkend", isKorteTitel(nieuw), true);
check("en dus blijft hij bij een tweede ronde gelijk", korteTitel(nieuw, URL, { live: false }), nieuw);
check("de oude vorm wordt niet als kort herkend", isKorteTitel(ECHT), false);
check("een gewone zin ook niet", isKorteTitel("Fix de 404 op deze pagina"), false);

console.log("\n── Er gaat geen opdracht verloren ──");
const opdrachten = opdrachtenUitTitel(ECHT);
check("vier stukken uit de oude titel", opdrachten.length, 4);
check("de aantekening uit de haakjes staat erbij", opdrachten.includes("actie Sander"), true);
check("de eerste opdracht klopt", opdrachten[1], "Fix 404 en controleer live-status /hovenier/etten-leur/");
check("de laatste opdracht klopt", opdrachten[3], "Controleer en publiceer locatiepagina's in menu/footer");
check("een titel zonder plusjes levert één regel", opdrachtenUitTitel("Optimaliseer /hovenier/").length, 1);
check("een lege titel levert niets", opdrachtenUitTitel("").length, 0);

console.log(fouten === 0 ? "\nAlles klopt.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
