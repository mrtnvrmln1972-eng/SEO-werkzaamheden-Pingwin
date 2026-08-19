// ═══════════════════════════════════════════════════════════
// EEN KAART MAG GEEN VELD LEZEN DAT DE VRAAG NIET OPHAALT
// ═══════════════════════════════════════════════════════════
// Op 19-08-2026 leek het alsof de aantekeningen bij een taak niet bewaard
// werden. In het overzicht over alle klanten was dat ook echt zo, en de oorzaak
// was één woord: de vraag aan de database haalde `notitie` niet op, terwijl de
// vertaler eronder wél `r.notitie` uitlas. Dat geeft geen foutmelding en geen
// rood scherm; je krijgt gewoon een lege tekst terug. Vul je die kaart dan in,
// dan schrijf je over je eigen aantekening heen.
//
// Deze proef rekent daarom na wat niemand kan onthouden: elk veld dat een
// vertaler uitleest (`r.<veld>`) moet in dezelfde functie ook echt opgehaald
// worden, en de twee takenlijsten (één klant, alle klanten) moeten dezelfde
// velden ophalen. Wijkt er één af, dan mislukt de bouw en komt het niet live.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const bron = readFileSync(join(__dirname, "..", "lib", "weekplan.ts"), "utf8");

/** De tekst van één functie: vanaf zijn naam tot de volgende export. */
function functie(naam: string): string {
  const start = bron.indexOf(`export async function ${naam}(`);
  if (start < 0) return "";
  const rest = bron.slice(start + 1);
  const eind = rest.indexOf("\nexport ");
  return eind === -1 ? rest : rest.slice(0, eind);
}

/** De velden die een SELECT ophaalt, op de naam waaronder ze terugkomen. */
function opgehaaldeVelden(tekst: string): string[] {
  const m = tekst.match(/SELECT([\s\S]*?)\sFROM\s/i);
  if (!m) return [];
  const stukken: string[] = [];
  let diep = 0;
  let huidig = "";
  for (const teken of m[1]) {
    if (teken === "(") diep++;
    if (teken === ")") diep--;
    if (teken === "," && diep === 0) { stukken.push(huidig); huidig = ""; continue; }
    huidig += teken;
  }
  stukken.push(huidig);
  const namen: string[] = [];
  for (const stuk of stukken) {
    const schoon = stuk.replace(/\s+/g, " ").trim();
    if (!schoon) continue;
    // "… AS archief_aantal" telt onder zijn eigen naam; "w.notitie" onder de
    // kolomnaam zonder de tabelletter ervoor.
    const alias = schoon.match(/\sAS\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (alias) { namen.push(alias[1].toLowerCase()); continue; }
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(schoon)) namen.push(schoon.split(".").pop()!.toLowerCase());
  }
  return namen;
}

/** De velden die de vertaler eronder uitleest. */
function gelezenVelden(tekst: string): string[] {
  return [...tekst.matchAll(/\br\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1].toLowerCase());
}

const LIJSTEN = ["getWeekplan", "getWeekplanAlleKlanten"] as const;
const perLijst: Record<string, string[]> = {};

for (const naam of LIJSTEN) {
  const tekst = functie(naam);
  proef(`${naam} is gevonden`, !!tekst);
  if (!tekst) continue;

  const opgehaald = opgehaaldeVelden(tekst);
  perLijst[naam] = opgehaald;
  proef(`${naam} haalt velden op`, opgehaald.length > 5, `Gevonden: ${opgehaald.join(", ") || "niets"}`);

  const mist = [...new Set(gelezenVelden(tekst))].filter((v) => !opgehaald.includes(v));
  proef(
    `${naam} leest geen veld dat hij niet ophaalt`,
    mist.length === 0,
    mist.length
      ? `Deze velden worden uitgelezen maar staan niet in de SELECT: ${mist.join(", ")}.\n`
        + "     | Dat geeft geen foutmelding: je krijgt stilletjes een lege waarde terug,\n"
        + "     | en wat er in het dashboard overheen wordt getypt is de echte tekst kwijt."
      : "",
  );
}

// De twee lijsten horen dezelfde kaart te beschrijven. Wat de ene ophaalt en de
// andere niet, is precies hoe de aantekening in het alle-klanten-bord verdween.
if (perLijst.getWeekplan && perLijst.getWeekplanAlleKlanten) {
  const alleen = perLijst.getWeekplan.filter((v) => !perLijst.getWeekplanAlleKlanten.includes(v));
  proef(
    "het overzicht over alle klanten haalt alles op wat de klantlijst ook ophaalt",
    alleen.length === 0,
    alleen.length ? `Ontbreekt in getWeekplanAlleKlanten: ${alleen.join(", ")}` : "",
  );
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
