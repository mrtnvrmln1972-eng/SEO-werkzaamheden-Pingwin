// ═══════════════════════════════════════════════════════════
// DE INTERNE CLUSTERMAP ZIT ALTIJD ACHTER EEN WACHTWOORD
// ═══════════════════════════════════════════════════════════
// Onder public/share/cluster/ staan twee versies van dezelfde pagina naast
// elkaar: één die je met een klant mag delen, en één met de interne
// afwegingen erin. Ze verschillen alleen in hun map. Statische bestanden in
// public/ worden zonder middleware zomaar uitgeserveerd, dus het enige dat de
// interne versie dichthoudt is de poort in middleware.ts.
//
// Twee dingen kunnen dat stilletjes slopen: de regel in `matcher` die eraf
// valt bij een opruimbeurt (dan draait de middleware er niet eens overheen),
// en een terugval naar "geen wachtwoord ingesteld = maar open dan". Dat
// tweede is precies de fout die op 02-08-2026 op /admin/enter live is
// aangetroffen. Deze proef bewaakt allebei.

import { readFileSync } from "node:fs";
import { join } from "node:path";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const wortel = join(__dirname, "..");
const mw = readFileSync(join(wortel, "middleware.ts"), "utf8");

const PAD = "/share/cluster/onedayclinic/intern-9f3a2b";

proef("de interne map staat in de matcher",
  mw.includes(`"${PAD}"`) && mw.includes(`"${PAD}/:path*"`),
  "Zonder die twee regels draait de middleware niet over de map en staat de interne pagina open.");

proef("het slot zit vóór elke andere regel in de middleware",
  mw.indexOf("INTERN_PAD)") < mw.indexOf("vensterKlant()"),
  "Staat de controle verderop, dan kan een eerdere regel eromheen sturen.");

proef("de gebruikersnaam en het wachtwoord komen niet uit een bestand",
  mw.includes("process.env.INTERN_WACHTWOORD") && !/INTERN_WACHTWOORD\s*=\s*["']/.test(mw),
  "Een wachtwoord in de repo is een gelekt wachtwoord; deze repo is bovendien openbaar.");

proef("geen wachtwoord ingesteld betekent dicht, niet open",
  /if\s*\(!wachtwoord\)\s*return new NextResponse\([^)]*\{\s*status:\s*404/.test(mw),
  "Beveiliging mag nooit iets zijn dat je eerst aan moet zetten.");

proef("een verkeerd wachtwoord levert 401 met een inlogvraag op",
  mw.includes("WWW-Authenticate") && mw.includes("status: 401"),
  "Zonder die kop vraagt de browser niet om een gebruikersnaam en wachtwoord.");

proef("het wachtwoord wordt vergeleken zonder dat de duur iets verraadt",
  /function gelijk\([\s\S]{0,300}\^/.test(mw),
  "Een gewone === vergelijking stopt bij het eerste verkeerde teken.");

proef("de openbare versie ernaast blijft vrij toegankelijk",
  !mw.includes('"/share/cluster/onedayclinic/:path*"'),
  "De klantversie hoort zonder inlog te openen; alleen de intern-map zit op slot.");

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
