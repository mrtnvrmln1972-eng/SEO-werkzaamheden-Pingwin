// Proef op het terugvinden van het copydocument bij een pagina.
//
// Waarom dit bestand er is: op 11 augustus 2026 meldde de knop "Is dit
// doorgevoerd?" bij /tuinontwerp/strandtuin/ (Kamsteeg) dat er "geen
// copydocument om tegen te vergelijken" was, terwijl het copydocument één regel
// lager in diezelfde kaart als link stond. De oorzaak: de controle vergeleek de
// URL letterlijk, terwijl de rest van het dashboard hem eerst normaliseert. Eén
// schuine streep verschil, en het dashboard beweert dat werk niet bestaat.
//
// Deze proef legt vast dat dezelfde pagina herkend wordt hoe hij ook opgeschreven
// is, en dat twee verschillende pagina's nooit als één worden gezien.

import { zelfdePagina } from "../lib/copy-tekst";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}

const DOEL = "https://kamsteegtuinen.nl/tuinontwerp/strandtuin/";

check("dezelfde URL", zelfdePagina(DOEL, DOEL), true);
check("zonder slot-streep", zelfdePagina("https://kamsteegtuinen.nl/tuinontwerp/strandtuin", DOEL), true);
check("met www ervoor", zelfdePagina("https://www.kamsteegtuinen.nl/tuinontwerp/strandtuin/", DOEL), true);
check("via http", zelfdePagina("http://kamsteegtuinen.nl/tuinontwerp/strandtuin/", DOEL), true);
check("hoofdletters", zelfdePagina("https://Kamsteegtuinen.nl/Tuinontwerp/Strandtuin/", DOEL), true);
// De mailcontrole kent vaak alleen het pad; die moet dezelfde pagina vinden.
check("alleen het pad als vraag", zelfdePagina(DOEL, "/tuinontwerp/strandtuin/"), true);
check("alleen het pad als opgeslagen waarde", zelfdePagina("/tuinontwerp/strandtuin", DOEL), true);

// En het omgekeerde: nooit een andere pagina meepakken.
check("andere pagina", zelfdePagina("https://kamsteegtuinen.nl/tuinontwerp/", DOEL), false);
check("bovenliggende map", zelfdePagina("https://kamsteegtuinen.nl/", DOEL), false);
check("lijkt erop, is het niet", zelfdePagina("https://kamsteegtuinen.nl/tuinontwerp/strandtuinen/", DOEL), false);
check("lege waarde", zelfdePagina("", DOEL), false);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
