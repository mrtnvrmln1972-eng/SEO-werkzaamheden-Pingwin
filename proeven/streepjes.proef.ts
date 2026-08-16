// Proef op de schrijfregel: geen los liggend lang streepje in beeld.
//
// WAAROM DIT BESTAAT
// ══════════════════
// "Geen em-dash of en-dash als zinsscheiding" staat al maanden in het
// projectgeheugen én in de instructies aan het model. Op 16 augustus 2026 kwam
// er tóch een vastgelegde strategie voorbij met "SEO-STRATEGIE KAMSTEEG —
// VASTGELEGD IN GESPREK" en "Laag 1 — Dienstpagina's".
//
// Dat is de vaste les van dit dashboard, nu voor een schrijfregel: een model
// houdt zich niet met zekerheid aan een stijlafspraak, een functie wel. De
// opschoning zit daarom in de weergave-laag (dus met terugwerkende kracht op
// alles wat er al staat) en deze proef houdt vast dat hij daar blijft.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel.

import fs from "fs";
import path from "path";
import { zonderLosStreepje } from "../lib/streepjes";
import { mdToHtml } from "../lib/markdown";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De echte gevallen van 16-08-2026 ──
const GEVALLEN: Array<[string, string, string]> = [
  ["een kop met een streepje wordt een komma",
    "SEO-STRATEGIE KAMSTEEG — VASTGELEGD IN GESPREK", "SEO-STRATEGIE KAMSTEEG, VASTGELEGD IN GESPREK"],
  ["een label ervoor wordt ook gewoon een komma",
    "Laag 1 — Dienstpagina's (het wat):", "Laag 1, Dienstpagina's (het wat):"],
  ["middenin een zin wordt het een komma",
    "uitleg over het onderwerp zelf — werkwijze, materialen, prijzen", "uitleg over het onderwerp zelf, werkwijze, materialen, prijzen"],
  ["een en-dash telt net zo goed",
    "Primaire zoekterm: [INVULLEN] – Secundaire zoektermen: [INVULLEN]", "Primaire zoekterm: [INVULLEN], Secundaire zoektermen: [INVULLEN]"],
  ["tegen de woorden aan geplakt wordt ook opgeruimd",
    "tuinaanleg—tuinontwerp", "tuinaanleg, tuinontwerp"],
  ["aan het begin van een regel is het een opsommingsteken",
    "— eerste punt", "- eerste punt"],
];
for (const [naam, invoer, verwacht] of GEVALLEN) {
  const uit = zonderLosStreepje(invoer);
  check(naam, uit === verwacht, `kreeg: "${uit}"\n       wilde: "${verwacht}"`);
}

// ── 2. Wat NIET mag veranderen ──
// Een te grove opschoning is erger dan de fout zelf: een meta-title heeft de
// vaste vorm "Onderwerp - Merknaam", en een koppelteken in een samenstelling is
// gewoon Nederlands.
const ONGEMOEID = [
  "SEO-strategie voor AI-tools en e-mail",
  "Tuinaanleg Breda - Kamsteeg Tuinen",
  "---",
  "Een gewone zin zonder streepjes.",
  "- eerste bullet\n- tweede bullet",
];
for (const t of ONGEMOEID) {
  const uit = zonderLosStreepje(t);
  check(`blijft ongemoeid: ${JSON.stringify(t.slice(0, 40))}`, uit === t, `werd: ${JSON.stringify(uit)}`);
}

// ── 3. De opschoning zit in de weergave, dus met terugwerkende kracht ──
// Dit is het punt: alles wat er al staat is er meteen vanaf, zonder dat er iets
// herschreven of opnieuw opgeslagen hoeft te worden.
const html = mdToHtml("Laag 1 — Dienstpagina's");
check("de gedeelde renderer schoont het op", !/[—–]/.test(html), html);

for (const bestand of ["lib/markdown.ts", "lib/card-info.ts"]) {
  check(`${bestand} gebruikt de opschoner`, /zonderLosStreepje/.test(lees(bestand)),
    "Zonder deze aanroep blijven bestaande kaarten en teksten hun streepjes houden.");
}

// ── 4. Het model krijgt de regel ook mee ──
// Opschonen achteraf is het vangnet, niet de bedoeling: liever schrijft hij het
// meteen goed, dan leest de tekst ook natuurlijker.
check("de instructie aan het model noemt de regel",
  /em-dash|lang streepje|lange streepjes/i.test(lees("lib/chat.ts")),
  "Zet de schrijfregel ook in de instructie, zodat de opschoning een vangnet blijft.");

console.log(fouten === 0
  ? "\nGeen los liggend lang streepje meer in beeld."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);
