// Proef op de maat van een bestand.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Er wordt vanuit zes tot acht chats tegelijk aan dit dashboard gewerkt, elk aan
// een ander onderdeel. Zolang een onderdeel in één groot bestand woont, botsen
// die chats altijd: twee wijzigingen die niets met elkaar te maken hebben komen
// toch in dezelfde regels terecht. Dat is op 11 augustus 2026 twee keer misgegaan
// met `lib/wat-is-nieuw.ts`, waarbij de conflictmarkeringen zijn meegecommit en
// de site twee opleveringen lang op oude code bleef staan.
//
// Sindsdien zijn `lib/uitleg.ts` (2.629 regels) en `WeekplanCard.tsx` (1.206
// regels) opgeknipt in een bestand per onderwerp. Deze proef houdt dat vast: hij
// wordt rood zodra er een nieuw bestand boven de grens uitkomt.
//
// DE GRENS MAG ALLEEN OMLAAG, NOOIT OMHOOG. Word je rood, knip dan op in een
// bestand per onderwerp, precies zoals bij de uitleg en de projectkaart. Een
// hogere grens zetten is het probleem verplaatsen naar de volgende chat.
//
// De erfenis-lijst werkt als een ratel, één kant op: een bestand dat er niet in
// staat moet onder de grens blijven, en een opgeknipt bestand haal je eraf en kan
// daarna nooit meer terugvallen. Bewust geen strengere grens met een lijst van
// zestig bestanden: dan is de proef ruis en zet iemand hem uit.

import fs from "fs";
import path from "path";

const GRENS = 1000;

// De bestanden die op 11 augustus 2026 al te groot waren. Alleen korter maken.
const ERFENIS = new Set<string>([
  "app/admin/client/[slug]/PageChat.tsx",
  "app/admin/client/[slug]/KpiPanel.tsx",
  "lib/chat.ts",
  "lib/google.ts",
]);

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");

function bestanden(map: string): string[] {
  const uit: string[] = [];
  for (const naam of fs.readdirSync(map)) {
    if (naam === "node_modules" || naam === ".next") continue;
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) { uit.push(...bestanden(vol)); continue; }
    if (naam.endsWith(".ts") || naam.endsWith(".tsx")) uit.push(vol);
  }
  return uit;
}

const teGroot: string[] = [];
const erfenisGezien = new Set<string>();
for (const map of ["app", "lib"]) {
  for (const vol of bestanden(path.join(WORTEL, map))) {
    const rel = path.relative(WORTEL, vol).split(path.sep).join("/");
    const regels = fs.readFileSync(vol, "utf8").split("\n").length;
    if (ERFENIS.has(rel)) { erfenisGezien.add(rel); continue; }
    if (regels > GRENS) teGroot.push(`${rel}: ${regels} regels`);
  }
}

console.log(`\n── Geen bestand groter dan ${GRENS} regels ──`);
check(`alle bestanden passen (${erfenisGezien.size} nog op de erfenis-lijst)`, teGroot.length === 0,
  `Te groot: ${teGroot.join(", ")}. Knip op in een bestand per onderwerp (zie lib/uitleg/ en app/admin/client/[slug]/weekplan-kaart/). Verhoog de grens niet.`);

const verdwenen = [...ERFENIS].filter((f) => !erfenisGezien.has(f));
check("de erfenis-lijst bevat geen bestanden die niet meer bestaan", verdwenen.length === 0,
  `Haal deze eruit: ${verdwenen.join(", ")}`);

// Een bestand dat inmiddels ónder de grens is gebracht hoort van de lijst af;
// anders krijgt het stilletjes weer ruimte om terug te groeien.
const onnodig = [...erfenisGezien].filter((rel) => fs.readFileSync(path.join(WORTEL, rel), "utf8").split("\n").length <= GRENS);
check("de erfenis-lijst bevat alleen bestanden die écht nog te groot zijn", onnodig.length === 0,
  `Deze passen inmiddels; haal ze van de lijst zodat ze niet meer terug kunnen groeien: ${onnodig.join(", ")}`);

console.log(`\n${fouten === 0 ? "Alles goed." : `${fouten} fout(en).`}`);
if (fouten > 0) process.exit(1);
