// ═══════════════════════════════════════════════════════════
// EEN TAAK IN TWEEËN KNIPPEN VERPLAATST DATA, DUS DIT MOET KLOPPEN
// ═══════════════════════════════════════════════════════════
// De kaart "Nieuw projecten op de site" bij GardenSwimm had twee losse projecten
// met elk twee documenten. Daar loopt het vast op iets simpels: er kan maar één
// versie "geldend" zijn per kaart, dus vink je de ene aan, dan lijkt de andere
// vervallen. En de developer krijgt twee opdrachten in één taak, terwijl de
// afspraak juist is dat hij één link plus één zin krijgt.
//
// Splitsen verhuist documenten van de ene kaart naar de andere. Gaat dat mis,
// dan raakt een document zoek of staat het straks op twee kaarten. Deze proef
// bewaakt de drie dingen waar dat op kan misgaan.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAAK_SLEUTEL } from "../lib/taak-splitsen";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}
const lees = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

proef("de sleutel van een taak is één vorm", TAAK_SLEUTEL(12) === "taak:12", TAAK_SLEUTEL(12));

const bron = lees("lib/taak-splitsen.ts");

// 1. Verhuizen, niet kopiëren. Twee kopieën van hetzelfde stuk is precies het
//    probleem dat we oplossen.
proef("documenten verhuizen, ze worden niet gekopieerd",
  /UPDATE page_doc_versions SET url/.test(bron) && !/INSERT INTO page_doc_versions/.test(bron),
  "Een kopie betekent twee keer hetzelfde document, en dan is de vraag welke geldt terug.");

// 2. Alleen wat écht aan deze taak hangt. Een document dat aan een PAGINA hangt
//    hoort bij die pagina; dat weghalen zou het daar laten verdwijnen.
proef("alleen documenten van déze taak verhuizen",
  /url = \$\{TAAK_SLEUTEL\(taakId\)\}/.test(bron) || /url = \$\{TAAK_SLEUTEL\(taakId\)/.test(bron),
  "Zonder die voorwaarde kun je met een meegestuurd nummer een document van een pagina afhalen.");

// 3. De nieuwe kaart is niet doorgezet, ook al was de oude dat wel.
proef("de nieuwe taak staat niet meteen bij de developer",
  !/naar_dev/.test(bron.split("INSERT INTO client_weekplan")[1]?.split("RETURNING")[0] || ""),
  "De tweede helft is nog niet doorgezet; anders staat er ineens werk bij de developer dat niemand heeft nagekeken.");

// 4. Zonder naam gebeurt er niets: een tweede kaart zonder titel is niet terug
//    te vinden in de weekplanning.
proef("zonder naam wordt er niet gesplitst", /Geef de nieuwe taak een naam/.test(bron));
proef("een taak die niet bestaat levert een nette melding op",
  /staat niet meer in de weekplanning/.test(bron));

// 5. Het scherm biedt het alleen aan waar het kan.
{
  const ui = lees("app/admin/client/[slug]/DocVersies.tsx");
  proef("de knop staat er alleen bij een taak zonder eigen pagina",
    /url === `taak:\$\{taakId\}`/.test(ui),
    "Bij een kaart mét pagina hangen de documenten aan die pagina; splitsen zou ze daar weghalen.");
  proef("en alleen als er meer dan één document ligt",
    /versies\.length > 1/.test(ui),
    "Met één document valt er niets te verdelen.");
  proef("je moet zelf aanwijzen wat er meeverhuist",
    /Object\.values\(splitsMee\)\.some\(Boolean\)/.test(ui),
    "Splitsen zonder iets te verplaatsen levert een lege tweede kaart op.");

  const route = lees("app/api/admin/weekplan/splits/route.ts");
  proef("de route controleert of je binnen mag", /verifyAdminSession/.test(route) && /guardSlug/.test(route));
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
