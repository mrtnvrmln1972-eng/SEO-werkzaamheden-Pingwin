// Proef op de advertentiepagina's, en op één regel in het bijzonder: de homepage.
//
// Waarom dit bestand er is. Op 7 augustus 2026 stond "/" tussen de
// advertentiepagina's van One Day Clinic. Na het strippen van de slash is dat een
// lege tekst, en de vergelijking "begint dit pad met '' + '/'" is waar voor élk
// pad van de site. Eén regel in een invulveld zette daarmee alle 432 pagina's
// buiten schot: werklijst, onderwerpen, kansen en gaten kwamen leeg terug en de
// analyse die eroverheen liep leverde nul regels op. Er kwam geen foutmelding;
// er kwam gewoon niets, en dat is precies de fout die niemand opmerkt.
//
// Wat hier vastligt: een pad dekt zichzelf en alles eronder, en de homepage dekt
// uitsluitend zichzelf.

import { isAdsPad, type AdsPaginas } from "../lib/opruim-regels";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

const maak = (paden: string[]): AdsPaginas => ({ paden, geen: false, ingevuld: true });

const metHome = maak(["/", "/soa-klinieken/soa-test-utrecht/"]);
check("de homepage zelf telt mee", isAdsPad("/", metHome), true);
check("maar sleept de rest van de site NIET mee", isAdsPad("/soa-test-bestellen/", metHome), false);
check("en ook geen diepere pagina", isAdsPad("/soa-klinieken/soa-test-breda/", metHome), false);
check("een gewone regel dekt zichzelf", isAdsPad("/soa-klinieken/soa-test-utrecht/", metHome), true);

const map = maak(["/ads/"]);
check("een map dekt alles eronder", isAdsPad("/ads/actie-soa/", map), true);
check("een map dekt de map zelf", isAdsPad("/ads/", map), true);
check("maar niet een pagina die er alleen op lijkt", isAdsPad("/adsl-test/", map), false);

const leeg = maak([]);
check("zonder advertentiepagina's valt niets af", isAdsPad("/wat-dan-ook/", leeg), false);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
