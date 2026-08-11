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
import { koppenUitCopy } from "../lib/copy-live";

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

// ── Welke koppen horen bij de pagina, en welke bij ons eigen document? ──
// Dit is de echte structuur van het copydocument van /tuinontwerp/strandtuin/,
// zoals hij op 11 augustus 2026 in het dashboard stond. Twee dingen gingen hier
// mis: de aanduiding stond als "H1:" met een dubbele punt en achter drie hekjes,
// en de hoofdstukken van de briefing werden voor paginakoppen aangezien. De
// controle meldde daardoor "0 van de 5 koppen gevonden" op een pagina waar de
// teksten gewoon op stonden.
const BRIEFING = [
  "# Copy-briefing: strandtuin-pagina Kamsteeg Tuinen",
  "Op basis van de SEO-analyse hebben we deze copy ontwikkeld.",
  "## 1. Waar de nieuwe teksten over gaan",
  "De pagina groeit van een korte introductie naar een volwaardige dienstenpagina.",
  "## 2. Welke zoekwoorden erin verwerkt zijn",
  "- strandtuin",
  "## 3. Wat dit voor jullie vindbaarheid betekent",
  "Jullie staan al in de top 10 voor strandtuin.",
  "## De volledige webteksten (lees na en corrigeer)",
  "> Hieronder staan de volledige teksten voor de pagina.",
  "### Paginatitel (zichtbaar in Google)",
  "Strandtuin laten ontwerpen en aanleggen, Kamsteeg Tuinen",
  "### Meta description (zichtbaar onder de paginatitel in Google)",
  "Kamsteeg Tuinen is de bedenker van de strandtuin.",
  "### H1: Strandtuin laten aanleggen door Kamsteeg Tuinen",
  "Een strandtuin brengt de rust van de kust naar je eigen achtertuin.",
  "### H2: Wat kenmerkt een strandtuin?",
  "Een strandtuin is open, rustig en vol karakter.",
  "### H2: Materialen voor een strandtuin",
  "Wie een strandtuin aanleggen wil, vraagt zich af welke materialen erbij horen.",
].join("\n");

const koppen = koppenUitCopy(BRIEFING);
check("de paginakoppen komen eruit", koppen.join(" | "),
  "Strandtuin laten aanleggen door Kamsteeg Tuinen | Wat kenmerkt een strandtuin? | Materialen voor een strandtuin");
check("geen hoofdstuk van de briefing erbij", koppen.some((k) => /waar de nieuwe teksten|zoekwoorden erin|vindbaarheid betekent|copy-briefing/i.test(k)), false);
check("paginatitel en meta tellen niet als kop", koppen.some((k) => /^paginatitel|^meta description/i.test(k)), false);

// De oudere schrijfwijze met een streepje moet blijven werken.
check("H2 met een streepje", koppenUitCopy("## De volledige webteksten\n**H2 — Onze werkwijze**").join(""), "Onze werkwijze");

// Een aangeleverd document zonder aanduidingen: dan tellen de gewone koppen,
// maar nooit de hoofdstuknummers van een briefing.
check("gewoon document zonder labels",
  koppenUitCopy("# Strandtuin aanleggen\n## Wat kost het?\n## 1. Inleiding").join(" | "),
  "Strandtuin aanleggen | Wat kost het?");

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef/proeven mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
