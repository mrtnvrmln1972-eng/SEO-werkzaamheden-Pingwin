// Proef op het weken- en dagenrekenwerk van de planning.
//
// Waarom dit bestand er is: een planning die de verkeerde week aanwijst ziet er
// precies zo uit als een goede. Je ziet pas dat het fout is als je het werk mist.
// Twee dingen gaan hier gegarandeerd een keer mis als niemand ze vastlegt:
//
//  1. De jaarwisseling. Week 1 komt ná week 52, maar is een kleiner getal. Wie op
//     weeknummers rekent, zet werk van 1 januari op "later" in plaats van op
//     "volgende week".
//  2. De dag die meeverhuist bij slepen. Sleep je een klus van woensdag naar de
//     week erna, dan hoort hij daar op woensdag te staan, en niet op de dag
//     waarop je toevallig sleepte.

import { isoVan, weekVanIso, mondayOfISOWeek, maandagVanWeek, datumNaVerplaatsing, dagenTussen } from "../lib/week-datum";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

console.log("\n── In welke week valt een dag ──");
// 6 augustus 2026 is een donderdag in week 32.
check("6 aug 2026 is week 32", JSON.stringify(weekVanIso("2026-08-06")), JSON.stringify({ year: 2026, week: 32 }));
check("maandag van week 32 is 3 aug", maandagVanWeek(2026, 32), "2026-08-03");
check("zondag hoort nog bij dezelfde week", JSON.stringify(weekVanIso("2026-08-09")), JSON.stringify({ year: 2026, week: 32 }));
check("maandag erna is week 33", JSON.stringify(weekVanIso("2026-08-10")), JSON.stringify({ year: 2026, week: 33 }));
check("lege datum levert geen week op", String(weekVanIso("")), "null");

console.log("\n── De jaarwisseling ──");
// 31 december 2026 is een donderdag; die hele week hoort bij 2026, week 53.
// 1 januari 2027 (vrijdag) valt in diezelfde week 53, niet in week 1.
check("31 dec 2026 is week 53 van 2026", JSON.stringify(weekVanIso("2026-12-31")), JSON.stringify({ year: 2026, week: 53 }));
check("1 jan 2027 valt in diezelfde week", JSON.stringify(weekVanIso("2027-01-01")), JSON.stringify({ year: 2026, week: 53 }));
check("4 jan 2027 is week 1 van 2027", JSON.stringify(weekVanIso("2027-01-04")), JSON.stringify({ year: 2027, week: 1 }));
// De echte reden dat het overzicht van maandag tot maandag rekent in plaats van
// met weeknummers: week 1 van 2027 ligt precies zeven dagen ná week 53 van 2026,
// terwijl het weeknummer 52 kleiner is.
const stap = Math.round((mondayOfISOWeek(2027, 1).getTime() - mondayOfISOWeek(2026, 53).getTime()) / (7 * 864e5));
check("week 1 van 2027 is één week na week 53 van 2026", stap, 1);

console.log("\n── De dag die meeverhuist bij slepen ──");
// Woensdag 5 augustus (week 32) naar week 33 wordt woensdag 12 augustus.
check("woensdag blijft woensdag", datumNaVerplaatsing("2026-08-05", 2026, 33), "2026-08-12");
check("zondag blijft zondag", datumNaVerplaatsing("2026-08-09", 2026, 33), "2026-08-16");
check("terugslepen werkt net zo goed", datumNaVerplaatsing("2026-08-12", 2026, 32), "2026-08-05");
// Dit is de afspraak van 6 augustus 2026: een kaart zonder dag krijgt bij het
// slepen de maandag van die week. Zonder deze regel verdwijnt een kaart die je
// net bewust in een week neerlegde uit de dagplanning.
check("zonder dag wordt het de maandag", datumNaVerplaatsing("", 2026, 33), "2026-08-10");
check("onzin-datum wordt ook de maandag", datumNaVerplaatsing("morgenmiddag", 2026, 33), "2026-08-10");

console.log("\n── Afstand tussen twee dagen ──");
check("vandaag is nul dagen", dagenTussen("2026-08-06", "2026-08-06"), 0);
check("morgen is één dag", dagenTussen("2026-08-06", "2026-08-07"), 1);
check("gisteren is min één", dagenTussen("2026-08-06", "2026-08-05"), -1);
// Over een zomertijdgrens heen blijft een dag een dag; daarom rekent alles in UTC.
check("over de wintertijd heen blijft het kloppen", dagenTussen("2026-10-24", "2026-10-26"), 2);
check("isoVan en weekVanIso zeggen hetzelfde", JSON.stringify(isoVan(new Date("2026-08-06T12:00:00Z"))), JSON.stringify(weekVanIso("2026-08-06")));

console.log(fouten === 0 ? "\nAlles klopt.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
