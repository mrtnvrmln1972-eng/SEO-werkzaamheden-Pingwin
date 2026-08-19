// Proef op de gedeelde bouwstenen: niemand geeft er een eigen uiterlijk aan.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 19-08-2026 werd het beheerscherm verbouwd naar inklapbare blokken, met de
// gedeelde inklapkaart van de cockpit (`strategy-card` plus `strategy-head`). Op
// zich precies goed. Maar er ging één regel opmaak overheen:
//
//     .vouwblok .strategy-head { background: var(--dark); color: var(--white); }
//
// met als reden "dezelfde zwarte balk als de kolomkop van de tabel eronder".
// Het gevolg was een scherm van zes zwarte balken onder elkaar, terwijl diezelfde
// bouwsteen op elk ander scherm een zacht kleurverloop met een oranje driehoekje
// is. Maartens oordeel: "allemaal zwarte balken, ik vind het er niet uitzien."
//
// Elke bestaande poort was groen. En terecht: die regel gebruikte nette tokens,
// de knoppen zaten op het knopsysteem, er stond geen losse pixelwaarde in en het
// scherm stond in het Intern-menu. Geen enkele controle vroeg de enige vraag die
// ertoe deed: ziet deze bouwsteen er hier hetzelfde uit als overal?
//
// Dat is dit bestand. Een gedeelde bouwsteen die op één scherm zijn eigen kleur,
// rand, schaduw of letter krijgt, is geen gedeelde bouwsteen meer, en dan valt
// het dashboard weer uit elkaar zonder dat iemand het besluit.
//
// WAT MAG WÉL
// ═══════════
//  - Positioneren en ruimte: padding, marge, gap, uitlijning, breedte, hoogte.
//    Een blok mag zijn inhoud anders neerzetten; het mag er niet anders uitzien.
//  - De varianten die het ontwerp zelf kent: `acc-orange` en familie (het
//    accentstreepje links van een kaart), `btn-primary` en familie (het
//    knopsysteem). Dat zijn keuzes bínnen het systeem, geen uitzonderingen erop.
//  - Onderdelen van dezelfde bouwsteen. `.strategy-head .strategy-title` is de
//    titel ín die kop, niet een scherm dat de kop overschrijft.
//
// DE ERFENIS-LIJST IS EEN RATEL
// ═════════════════════════════
// Wat er op de dag van deze proef al stond, staat in bouwstenen-erfenis.json.
// Die lijst mag alleen korter worden. Een NIEUWE regel staat er per definitie
// niet op en maakt de bouw dus rood.

import fs from "node:fs";
import path from "node:path";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

/**
 * De bouwstenen waarvan het uiterlijk de herkenbaarheid van het dashboard is.
 * Bewust niet élke gedeelde klasse: een tabelrij die groen kleurt omdat de taak
 * af is, is een toestand van data en geen huisstijl. Zet hier alleen iets bij
 * waarvan geldt: als dit er op twee schermen anders uitziet, is dat een fout.
 */
const BOUWSTENEN = [
  "strategy-head", "strategy-card", "strategy-body",
  "cockpit-card", "card", "btn", "chip", "ovc-icontile", "ovc-head",
];

/** Varianten die het ontwerp zelf kent; een keuze bínnen het systeem. */
const VARIANT = /^(acc-|btn-|chip-|card-)/;

/** Opmaak die het uiterlijk bepaalt. Ruimte en positie staan hier met opzet niet bij. */
const UITERLIJK = /(^|[;{\s])(background(-color|-image)?|color|border(-[a-z]+)?|box-shadow|font-size|font-weight|font-family|text-transform|letter-spacing)\s*:/;

/** De familienaam van een klasse: alles vóór het eerste streepje. */
const familie = (klasse: string) => klasse.split("-")[0];

const ERFENIS: string[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "bouwstenen-erfenis.json"), "utf8"),
);

const css = fs.readFileSync(path.join(WORTEL, "app", "globals.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const gevonden: string[] = [];
for (const blok of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = blok[1].trim();
  const inhoud = blok[2];
  if (!UITERLIJK.test(inhoud)) continue;
  for (const deel of selector.split(",")) {
    const d = deel.trim();
    const klassen = [...d.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
    const bouw = klassen.filter((k) => BOUWSTENEN.includes(k));
    if (!bouw.length) continue;
    const eigen = klassen.filter((k) =>
      !BOUWSTENEN.includes(k)
      && !VARIANT.test(k)
      // Een onderdeel van dezelfde bouwsteen hoort erbij, geen overschrijving.
      && !bouw.some((b) => familie(b) === familie(k)));
    if (eigen.length) { gevonden.push(d); break; }
  }
}

const nieuw = gevonden.filter((s) => !ERFENIS.includes(s));
const opgeruimd = ERFENIS.filter((s) => !gevonden.includes(s));

proef(
  `geen enkel scherm geeft een gedeelde bouwsteen een eigen uiterlijk (${gevonden.length} op de erfenis-lijst)`,
  nieuw.length === 0,
  nieuw.length
    ? `Nieuw:\n     | ${nieuw.slice(0, 6).join("\n     | ")}\n     | `
      + "Een gedeelde bouwsteen ziet er overal hetzelfde uit. Wil je hier iets anders, "
      + "maak er dan een variant van in het ontwerp zelf (zoals acc-orange of btn-ghost), "
      + "of verplaats de opmaak naar de bouwsteen. Ruimte en uitlijning mogen wél."
    : "",
);
proef(
  "de erfenis-lijst bevat niets wat allang opgeruimd is",
  opgeruimd.length === 0,
  opgeruimd.length
    ? `Haal deze van de lijst, die staan er niet meer:\n     | ${opgeruimd.join("\n     | ")}`
    : "",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
