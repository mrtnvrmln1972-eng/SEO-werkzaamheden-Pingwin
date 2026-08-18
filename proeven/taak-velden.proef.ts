// ═══════════════════════════════════════════════════════════
// EEN TAAK DIE JE AANMAAKT, HOUDT ALLES WAT JE MEEGEEFT
// ═══════════════════════════════════════════════════════════
// Waarom deze proef bestaat (18-08-2026, gevonden bij Bogard):
//
// `appendTasks` kreeg van vier plekken netjes `stepKind`, `docLink` en
// `clientDocLink` mee, en schreef die drie stilzwijgend niet weg. Er kwam geen
// foutmelding, TypeScript was tevreden (het zijn geldige velden van het type),
// en alle proeven waren groen. Wat er in de praktijk gebeurde:
//
//  - Elke motor die zijn eigen taak ontdubbelt op `stepKind` vond de vorige
//    nooit terug, dus elke klik zette er een kopie bij. Bij Bogard stonden er
//    vier identieke "Site-brede structured data doorvoeren".
//  - De documenten bij zo'n taak (`docLink`) kwamen er niet in, dus de
//    sitebouwer kreeg de opdracht zonder het document dat erbij hoort.
//
// Dat is precies de soort fout die niemand ziet: een veld dat je meegeeft en dat
// er niet in gaat. Vandaar een poort op de kolommenlijst zelf.

import fs from "node:fs";
import path from "node:path";

const WORTEL = path.resolve(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

let fouten = 0;
function check(naam: string, goed: boolean, waarom: string) {
  if (!goed) fouten++;
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) console.log(`       ${waarom}`);
}

const tasks = lees("lib/tasks.ts");

// De INSERT van appendTasks: pak het stuk tussen "export async function appendTasks"
// en het einde van die functie, zodat de andere INSERTs in dit bestand niet meetellen.
const vanaf = tasks.indexOf("export async function appendTasks");
const stuk = tasks.slice(vanaf, tasks.indexOf("\n}", vanaf));
check("appendTasks bestaat nog", vanaf > 0, "De functie is hernoemd of weg; werk deze proef bij.");

for (const kolom of ["step_kind", "doc_link", "client_doc_link"]) {
  check(`appendTasks schrijft ${kolom} weg`, stuk.includes(kolom),
    `De kolom ${kolom} staat niet in de INSERT van appendTasks. Een aanroeper geeft hem wel mee, dus hij verdwijnt stil, en dan ontdubbelt geen enkele motor zijn eigen taak meer.`);
}

// En hij moet ook echt de meegegeven waarde gebruiken, niet een lege plaatshouder.
for (const veld of ["t.stepKind", "t.docLink", "t.clientDocLink"]) {
  check(`de waarde van ${veld} gaat mee`, stuk.includes(veld),
    `${veld} komt niet voor in appendTasks; de kolom staat er dan wel, maar krijgt niets.`);
}

// De aanroepers die op dit gedrag leunen. Verdwijnt hier een stepKind, dan is dat
// een keuze; verdwijnt hij in appendTasks, dan is het een stille storing.
const ontdubbelaars: [string, string][] = [
  ["app/api/admin/org-data/sitewide/route.ts", "structured_data_sitewide"],
  ["lib/page-schema.ts", "structured_data"],
  ["lib/page-internal-links.ts", "internal_links"],
  ["lib/page-cannibal.ts", "cannibal_redirects"],
];
for (const [bestand, soort] of ontdubbelaars) {
  const inhoud = lees(bestand);
  check(`${soort} ontdubbelt op zijn eigen soort`,
    inhoud.includes(`"${soort}"`) && /stepKind/.test(inhoud),
    `${bestand} gebruikt de soort ${soort} niet meer om zijn vorige taak te herkennen; dan komt er bij elke klik een kopie bij.`);
}

console.log("\n── Delen met de developer zet de taak ook echt op de developerlijst ──");
const sitewide = lees("app/api/admin/org-data/sitewide/route.ts");
const dev = lees("lib/developer.ts");

check("de doorgezette taak krijgt de stand die de developerlijst leest",
  /status: "Naar dev"/i.test(sitewide),
  'De knop "Delen met developer" maakt een taak aan die niet op /admin/developer terechtkomt. Die lijst leest alleen taken met de stand "naar dev"; op "Gepland" blijft de taak alleen in Werkzaamheden staan, terwijl de mail die er direct achteraan gaat wél naar de developerlijst verwijst.');
check("de developerlijst leest die stand nog steeds",
  /lower\(coalesce\(t\.status, ''\)\) = 'naar dev'/.test(dev),
  "De developerlijst selecteert niet meer op 'naar dev'. Verandert die regel, verander dan ook wat de doorzet-knoppen wegschrijven; anders komt er niets meer op de lijst.");
check("de oude kopieën zonder soort worden ook opgeruimd",
  /zelfdeTitel/.test(sitewide),
  "Zonder terugval op de titel blijven de kopieën staan die vóór 18-08-2026 zonder step_kind zijn aangemaakt.");

console.log("\n── De titelmigratie blijft van de motor-taken af ──");
check("de migratie slaat de motor-taken over",
  /step_kind NOT IN \('structured_data'/.test(tasks),
  "Nu step_kind wél wordt opgeslagen, pakt de oude titelmigratie ook de taken van de motoren en verandert die hun woord (document) in (link). Sluit ze uit.");

console.log(fouten === 0 ? "\nAlles klopt.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
