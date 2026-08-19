// Proef op tekens die als icoon in beeld staan.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op /admin/stijl stond een regel "Icoontjes als letter in beeld: 18 plekken →
// 0". Dat getal was met de hand ingetypt. De werkelijkheid op 19-08-2026 was
// 419 tekens, verdeeld over 40 verschillende, en Maarten zag er zelf een paar
// als leeg vierkantje op zijn scherm staan.
//
// Een getal dat niemand narekent is erger dan geen getal, want het zegt dat er
// niets meer te doen is. Vandaar deze proef, en vandaar dat hetzelfde getal nu
// gemeten op dat scherm staat in plaats van getypt.
//
// WAT HIJ CONTROLEERT
// ═══════════════════
//  1. Elk niet-ASCII teken dat op een scherm terechtkomt is te tekenen: het zit
//     in Montserrat, in de bijgeladen symbolenfamilies, of het is een gewone
//     letter met een accent. Zo niet, dan wordt dit rood en komt het niet live.
//  2. De bijgeladen lijst en de opmaak-stapel horen bij elkaar. Laadt iemand een
//     familie zonder hem in --letter te zetten (of andersom), dan doet de
//     bijlading niets en staat er alsnog een vierkantje.
//
// WAT HIJ NIET CONTROLEERT
// ════════════════════════
// Of Google Fonts het teken echt meelevert. Daar is een download voor nodig en
// een bouw hoort niet van het netwerk af te hangen. De lijst in
// lib/icoontekens.ts is dus een belofte; hij is één keer nagemeten in de echte
// woff2-bestanden en wie hem uitbreidt, hoort dat opnieuw te doen.

import fs from "node:fs";
import path from "node:path";
import { TOEGESTAAN, SYMBOOL_FAMILIES, symboolFontUrls } from "../lib/icoontekens";
import { zoekIcoontekens } from "../lib/stijl-meting";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

// De scanner zelf staat in lib/stijl-meting.ts, want de meter op /admin/stijl
// gebruikt exact dezelfde telling. Twee keer uitschrijven levert in dit project
// gegarandeerd twee verschillende antwoorden op.
const vondsten = zoekIcoontekens();

const nietTeTekenen = vondsten.filter((v) => !TOEGESTAAN.includes(v.teken));
const perTeken = new Map<string, typeof nietTeTekenen>();
for (const v of nietTeTekenen) perTeken.set(v.teken, [...(perTeken.get(v.teken) ?? []), v]);

console.log(`\nIcoontekens in beeld: ${vondsten.length}, waarvan ${nietTeTekenen.length} niet te tekenen.\n`);

proef(
  "elk teken in beeld is te tekenen door Montserrat of de bijgeladen symbolen",
  nietTeTekenen.length === 0,
  nietTeTekenen.length
    ? [...perTeken.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8)
        .map(([teken, lijst]) =>
          `${teken} (U+${teken.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) ${lijst.length}x, o.a. ${lijst[0].bestand}:${lijst[0].regel}`)
        .join("\n     | ")
      + "\n     | Vervang ze door een tekening (app/_ui/Pijl.tsx) of door gewone tekst."
    : "",
);

// De bijlading en de opmaak horen bij elkaar; los van elkaar doet geen van beide
// iets. Dit is dezelfde vaste les als altijd: één bron, de rest leest daaruit.
const css = fs.readFileSync(path.join(WORTEL, "app", "globals.css"), "utf8");
const letterRegel = css.split("\n").find((r) => r.trim().startsWith("--letter:")) ?? "";
const letterBlok = css.slice(css.indexOf("--letter:"), css.indexOf("--letter:") + 220);
for (const familie of SYMBOOL_FAMILIES) {
  proef(
    `${familie} staat in de opmaak-stapel`,
    letterBlok.includes(familie),
    `Zet '${familie}' in --letter, direct na Montserrat. Nu: ${letterRegel.trim().slice(0, 80)}`,
  );
}
const layout = fs.readFileSync(path.join(WORTEL, "app", "layout.tsx"), "utf8");
proef(
  "de symbolenfamilies worden ook echt geladen",
  layout.includes("symboolFontUrls"),
  "app/layout.tsx hoort de adressen uit lib/icoontekens.ts in de kop te zetten.",
);
proef(
  "de bijlading is uitgeknipt tot de tekens die we gebruiken",
  symboolFontUrls().every((u) => u.includes("text=")),
  "Zonder text= haal je honderden kilobytes binnen voor een handvol tekens.",
);

console.log(fouten === 0 ? "\nAlle proeven geslaagd." : `\n${fouten} proef(en) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
