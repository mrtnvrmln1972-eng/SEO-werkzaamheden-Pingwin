// Proef: een universeel kind-selector (`.iets > *`, `.iets *`) mag nooit een
// concreet uiterlijk opleggen aan wat erin zit.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 26-08-2026 kreeg het rooster van "Wat staat er nog open" en "De vorige
// rit" een rij-opmaak (padding, randlijn, lettergrootte, tekstkleur) via:
//
//     .ob-rooster li > * { padding: var(--ruimte-naast) 0; border-top: ...;
//       font-size: var(--type-bijschrift); color: var(--kleur-tekst-zacht); }
//
// Zo'n regel raakt LETTERLIJK ALLES wat als kind in die rij staat, ook het
// `.ob-chip`-pilletje dat daar toevallig ook een direct kind is. Een
// selector met een klasse ervoor (`.ob-rooster li > *`) is specifieker dan de
// kale `.ob-chip`-regel, dus won de rij-opmaak de cascade en verloor het
// chipje zijn eigen compacte pil-padding: een lompe, opgerekte rechthoek in
// plaats van het subtiele pilletje dat overal elders staat. `proeven/
// bouwstenen.proef.ts` had dit niet gezien: die zoekt naar een bouwsteen-
// klasse die letterlijk in dezelfde selector staat, niet naar een universele
// selector die toevallig óók een bouwsteen raakt.
//
// DE REGEL
// ════════
// Een universele selector (het laatste, stijlbepalende deel is kaal `*`,
// eventueel na een spatie of `>`) mag layout-eigenschappen zetten (padding,
// marge, breedte, uitlijning) maar geen concreet UITERLIJK: geen eigen
// achtergrond, tekstkleur, rand, schaduw, lettergrootte of letterdikte. Wél
// toegestaan: een neutraliserende waarde (`inherit`, `unset`, `initial`,
// `transparent`, `none`) die opmaak van BUITEN wegneemt in plaats van een
// nieuw uiterlijk oplegt — dat is precies wat `.rich-cell *` hieronder al
// jaren doet (zie CLAUDE.md, 17-08-2026) en blijft toegestaan.
//
// Geen erfenis-lijst: dit patroon kwam één keer voor (de fout hierboven, al
// hersteld) en hoort nul keer voor te komen. Een regel zonder uitzonderingen
// is de enige soort die niet langzaam uitholt (zie ook de emoji-regel in
// huisstijl.proef.ts).

import fs from "node:fs";
import path from "node:path";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

/** Dezelfde eigenschappen als bouwstenen.proef.ts: wat het uiterlijk bepaalt. */
const UITERLIJK = /(^|[;{\s])(background(-color|-image)?|color|border(-[a-z]+)?|box-shadow|font-size|font-weight|font-family|text-transform|letter-spacing)\s*:\s*([^;]+)/g;

/** Waarden die opmaak van buiten wegNEMEN in plaats van een nieuw uiterlijk opleggen. */
const NEUTRAAL = /^(inherit|unset|initial|transparent|none)(\s*!important)?$/i;

/** Het laatste deel van een selector is een kale universele selector: `*`, `> *`, of `foo *`. */
const UNIVERSEEL_KIND = /(^|[\s>+~])\*$/;

const css = fs.readFileSync(path.join(WORTEL, "app", "globals.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

const gevonden: string[] = [];
for (const blok of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = blok[1].trim();
  const inhoud = blok[2];
  for (const deel of selector.split(",")) {
    const d = deel.trim();
    if (!UNIVERSEEL_KIND.test(d)) continue;
    for (const m of inhoud.matchAll(UITERLIJK)) {
      const eigenschap = m[2];
      const waarde = m[5].trim();
      if (NEUTRAAL.test(waarde)) continue;
      gevonden.push(`${d} { ${eigenschap}: ${waarde} }`);
    }
  }
}

proef(
  "een universele kind-selector legt nergens een concreet uiterlijk op",
  gevonden.length === 0,
  gevonden.length
    ? `Gevonden:\n     | ${gevonden.join("\n     | ")}\n     | `
      + "Zo'n selector raakt ALLES wat daar toevallig als kind in staat, ook een gedeelde "
      + "bouwsteen zoals .ob-chip of .btn, en wint dan de cascade van die bouwsteen zijn eigen "
      + "stijl. Geef in plaats daarvan elke cel een eigen omhulsel (bijv. .ob-cel) en zet de "
      + "opmaak dáárop, of gebruik alleen een neutraliserende waarde (inherit/unset/transparent/none)."
    : "",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
