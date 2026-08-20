// Proef op de HubSpot-koppeling: één richting, en één baas per veld.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De afspraak uit HUBSPOT-LEADS.md is kort: HubSpot is de baas over de pijplijn
// (fase, sluitingsdatum, eerstvolgend contactmoment, kans), het dashboard is de
// baas over het beoogde maandbudget. Het dashboard leest dus, en schrijft niet
// terug, op één uitzondering na: een notitie bij de deal, en alleen als Maarten
// dat zelf heeft aangezet.
//
// Die afspraak is precies het soort dat sneuvelt zodra iemand haast heeft ("ik
// zet de kans even terug in HubSpot, scheelt een klik"). En dan zijn er twee
// waarheden, moet je bij elk verschil uitzoeken wie er gelijk had, en is de
// koppeling niet meer te vertrouwen. Vandaar een poort in plaats van een zin in
// een document.
//
// Wat deze proef bewaakt:
//   1. lib/hubspot.ts schrijft nergens een veld: geen PATCH, geen PUT, geen
//      DELETE, en POST alleen naar de lees-endpoints van HubSpot (zoeken en
//      batch-lezen) plus die ene notitie.
//   2. De ronde die elk kwartier draait raakt HubSpot niet aan: hubspot-leads.ts
//      gebruikt de schrijffunctie niet.
//   3. Een handmatig gezette kans of startmaand wordt nooit overschreven door
//      een koppeling.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const WORTEL = join(__dirname, "..");
const lees = (p: string) => readFileSync(join(WORTEL, p), "utf8");

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}

const api = lees("lib/hubspot.ts");
const sync = lees("lib/hubspot-leads.ts");

// ── 1. De koppeling leest ────────────────────────────────────────────────────

for (const methode of ["PATCH", "PUT", "DELETE"]) {
  proef(
    `lib/hubspot.ts doet geen ${methode} naar HubSpot`,
    !new RegExp(`"${methode}"`).test(api),
    `Een ${methode} wijzigt of verwijdert iets in HubSpot. Dat hoort in HubSpot zelf te gebeuren, niet hier.`,
  );
}

// Elke aanroep met "POST" moet naar een pad gaan dat leest (zoeken, batch-lezen)
// of naar de ene toegestane notitie. Het pad staat als eerste argument van hs().
const postPaden = [...api.matchAll(/hs\(\s*[`"']([^`"']+)[`"'][^)]*?"POST"/g)].map((m) => m[1]);
const TOEGESTAAN = [/\/search$/, /\/batch\/read$/, /^\/crm\/v3\/objects\/notes$/];
const verkeerd = postPaden.filter((p) => !TOEGESTAAN.some((r) => r.test(p)));
proef(
  `elke POST gaat naar een lees-endpoint of naar de ene notitie (${postPaden.length} gevonden)`,
  verkeerd.length === 0,
  verkeerd.length ? `Deze niet: ${verkeerd.join(", ")}` : "",
);

const schrijfFuncties = [...api.matchAll(/export async function (hs[A-Z]\w*)/g)]
  .map((m) => m[1])
  .filter((n) => /Maak|Zet|Wijzig|Verwijder|Update/.test(n));
proef(
  "er is precies één schrijfactie, en dat is de notitie",
  schrijfFuncties.length === 1 && schrijfFuncties[0] === "hsMaakNotitie",
  `Gevonden: ${schrijfFuncties.join(", ") || "geen"}. Komt er een tweede bij, dan is de afspraak "één richting" stilletjes vervallen.`,
);

// ── 2. De automatische ronde schrijft nooit ─────────────────────────────────

proef(
  "de kwartierronde raakt HubSpot niet aan",
  !/hsMaakNotitie/.test(sync),
  "lib/hubspot-leads.ts draait vanzelf. Een ronde die uit zichzelf iets in HubSpot zet, is precies wat niemand verwacht.",
);

// ── 3. Handmatig wint ────────────────────────────────────────────────────────

const prognose = lees("lib/prognose.ts");
proef(
  "een koppeling overschrijft geen handmatige kans of startmaand",
  /saveRegelUitBron/.test(prognose) && /!==\s*bron\)\s*return false/.test(prognose),
  "saveRegelUitBron hoort te stoppen zodra de bestaande regel van iemand anders is (handmatig, of een andere koppeling).",
);
proef(
  "wat Maarten zelf opslaat wordt als handmatig gemerkt",
  /bron = 'handmatig'/.test(prognose),
  "Zonder dat merk kan een koppeling er de volgende ronde overheen schrijven.",
);
proef(
  "het budget van een lead komt niet uit HubSpot",
  !/setClientBudget/.test(sync),
  "De bedragen zet Maarten in het dashboard: SEO en advertenties per maand, de kosten, en een eenmalige website. Daar rekent de prognose mee en zo staat elk bedrag op één plek.",
);
proef(
  "de contactenronde zet alleen de kans, niet het bedrag of de startmaand",
  /saveRegelUitBron\(klant\.slug, \{ kans: instelling\.kans \}\)/.test(sync),
  "Een ronde die elk kwartier draait mag nooit over een bedrag of een startmaand heen schrijven; die zijn van Maarten.",
);
proef(
  "leads komen standaard uit je contacten, niet uit deals",
  /bron: bron === "deals" \? "deals" : "contacten"/.test(sync),
  "Niet elk bureau werkt met deals. De standaard hoort de werkwijze te zijn die hier echt gebruikt wordt.",
);
proef(
  "zonder gekozen leadstatus komt er niets binnen",
  /if \(!instelling\.filterVeld \|\| !instelling\.filterWaarde\)/.test(sync),
  "Zonder filter zou je hele adresboek als lead in het dashboard belanden. Liever niets dan alles.",
);

// ── 4. Hetzelfde gesprek komt niet twee keer in het dossier ─────────────────

proef(
  "gesprekken uit HubSpot worden ontdubbeld op hun herkomst",
  /bron LIKE 'hubspot:%'/.test(sync) && /gezien\.has\(bron\)/.test(sync),
  "Het dossier is append-only. Zonder ontdubbeling staat dezelfde notitie er elk kwartier opnieuw in.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
