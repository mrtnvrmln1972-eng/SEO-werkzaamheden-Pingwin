// Proef op het AANTAL stijlbeslissingen in het dashboard.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Er stonden al drie poorten op de opmaak. `opmaak.proef.ts` kijkt of een scherm
// de bouwstenen gebruikt, `huisstijl.proef.ts` of een knop het knopsysteem
// gebruikt, `nette-html.proef.ts` of tekst door de ene renderer gaat. Alle drie
// groen. En tóch stonden er op 17 augustus 2026 331 verschillende kleuren,
// 21 lettergroottes, 45 schaduwen en 98 eigen knop-classnamen in één stylesheet.
//
// Dat is geen tegenspraak maar een blinde vlek, en het is dezelfde vaste les die
// in dit project al vijf keer is opgeschreven, nu in een nieuwe vorm: die drie
// poorten vragen allemaal "doet DIT bestand het goed?". Geen enkele vraagt
// "hoeveel verschillende waarden bestaan er in TOTAAL?". Een scherm mag dus
// keurig volgens de regels een eigen kleur kiezen, en honderd schermen die dat
// allemaal netjes doen leveren honderd kleuren op. Elke afzonderlijke keuze is
// verdedigbaar, de optelsom is een ratjetoe.
//
// Deze proef telt de optelsom, en het getal mag alleen dalen. Dat is het enige
// wat een ontwerp bij elkaar houdt terwijl er vanuit meerdere chats aan gebouwd
// wordt: niet de belofte dat iedereen oplet, maar een plafond dat zakt.
//
// HOE JE HEM GROEN HOUDT
// ══════════════════════
// Boven het plafond → je hebt een nieuwe kleur, maat of schaduw verzonnen.
//   Gebruik een bestaande token uit :root, of, als er echt een nieuwe nodig is,
//   voeg hem daar toe (dan telt hij als benoemd) in plaats van los in een regel.
// Ruim onder het plafond → je hebt opgeruimd. Zet het nieuwe getal in
//   proeven/stijl-plafond.json, zodat die winst niet later terugglipt.
//
// Zet deze proef nooit uit en verhoog het plafond nooit. Precies dát is waar
// elke eerdere opmaakregel in dit project op stukliep.

import fs from "fs";
import path from "path";
import { meet } from "../lib/stijl-meting";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const plafondBestand = path.join(WORTEL, "proeven", "stijl-plafond.json");
const { plafond, doel, vloer } = JSON.parse(fs.readFileSync(plafondBestand, "utf8")) as {
  plafond: Record<string, number>;
  doel: Record<string, number>;
  vloer: Record<string, number>;
};

const meting = meet();

/**
 * De huidige stand per soort. De namen komen exact overeen met de sleutels in
 * stijl-plafond.json; zo is er één lijst en niet twee die uit elkaar lopen.
 */
const nu: Record<string, number> = {
  kleuren: meting.kleuren.verschillend,
  lettergroottes: meting.lettergroottes.verschillend,
  rondingen: meting.rondingen.verschillend,
  schaduwen: meting.schaduwen.verschillend,
  afstanden: meting.afstanden.verschillend,
  knopklassen: meting.families.find((f) => f.naam === "Knoppen")?.aantal ?? 0,
  inlineOpmaak: meting.inline.metVasteWaarde,
};

/**
 * Hoe ver je onder het plafond mag zakken voordat de proef zegt "leg dit vast".
 * Bewust ruim: een gewone wijziging schuift zo'n getal met één of twee op, en
 * daar hoort geen rode bouw bij. Pas als er écht is opgeruimd wil je dat de
 * ratel meekomt, want anders is de winst over twee weken stilletjes weg.
 */
const speling = (p: number) => Math.max(5, Math.round(p * 0.1));

const teLaag: string[] = [];
for (const soort of Object.keys(plafond)) {
  const huidig = nu[soort];
  const max = plafond[soort];
  if (huidig === undefined) {
    checkWaar(`"${soort}" wordt gemeten`, false,
      `stijl-plafond.json noemt "${soort}", maar deze proef meet dat niet. Haal hem eruit of voeg de meting toe in lib/stijl-meting.ts.`);
    continue;
  }
  const naarDoel = huidig - doel[soort];
  checkWaar(
    `${soort}: ${huidig} (plafond ${max}, doel ${doel[soort]}${naarDoel > 0 ? `, nog ${naarDoel} te gaan` : ", gehaald"})`,
    huidig <= max,
    `Er is een ${soort.replace(/n$/, "")} bijgekomen die niet uit de schaal komt. Gebruik een bestaande token uit :root in app/globals.css, of zet er een nieuwe token bij. Verhoog dit plafond niet: dan is de meter geen meter meer.`
  );
  if (huidig < max - speling(max)) teLaag.push(`"${soort}": ${huidig}`);
}

// De andere kant van de ratel. Zonder dit blok zakt een getal na een opruimronde
// wel, maar blijft het plafond hoog staan, en dan mag de rommel er ongemerkt
// weer bij. Dezelfde ratel als de erfenis-lijsten in huisstijl.proef.ts.
checkWaar(
  "het plafond staat strak tegen de werkelijkheid aan",
  teLaag.length === 0,
  `Er is opgeruimd, mooi. Leg het vast in proeven/stijl-plafond.json, anders glipt de winst er later weer in:\n       ${teLaag.join(",\n       ")}`
);

// ── De betekenislaag: bestaat hij nog, en wordt hij gebruikt? ──
// Toegevoegd op 18-08-2026, en dit is het deel dat het verschil maakt tussen
// een fundament en een vierde stapel. De laag --kleur-*/--type-*/--ruimte-*
// zegt waarvóór een waarde dient, in plaats van alleen hoe groot hij is. Zo'n
// laag is precies zo veel waard als het aantal plekken dat hem gebruikt: nul
// gebruik betekent dat er nu vier manieren bestaan om een kleur te kiezen in
// plaats van drie, en dan is dit een verslechtering geweest.
const { betekenis } = meting;

checkWaar(
  `de betekenislaag wijst alleen naar tokens (${betekenis.namen.length} namen)`,
  betekenis.eigenWaarde.length === 0,
  `Deze naam heeft een eigen waarde in plaats van een verwijzing:\n       ${betekenis.eigenWaarde.join("\n       ")}\n       Laat hem naar een token uit de schaal wijzen (var(--…)). Een betekenislaag met eigen waarden is geen laag erbovenop maar een tweede schaal ernaast.`
);

const aandeel = Math.round((betekenis.gebruik / (betekenis.gebruik + betekenis.schaalGebruik)) * 1000) / 10;
checkWaar(
  `de betekenislaag wordt gebruikt: ${betekenis.gebruik} plekken (${aandeel}% van de opmaak, vloer ${vloer.betekenislaag})`,
  betekenis.gebruik >= vloer.betekenislaag - speling(vloer.betekenislaag),
  `Het gebruik van de betekenislaag is gezakt. Dat betekent dat er opmaak is teruggezet op de kale schaal (--fs-*, --s-*, --orange). Zet het terug, of, als het weghalen klopte, verlaag de vloer in proeven/stijl-plafond.json naar ${betekenis.gebruik}.`
);
if (betekenis.gebruik > vloer.betekenislaag) {
  checkWaar(
    "de vloer staat strak tegen het gebruik aan",
    betekenis.gebruik <= vloer.betekenislaag + speling(vloer.betekenislaag),
    `Er is opmaak omgezet naar de betekenislaag, mooi. Leg het vast: zet "betekenislaag" in proeven/stijl-plafond.json op ${betekenis.gebruik}, zodat het niet stilletjes weer terugzakt.`
  );
}

// ── De inventaris die /admin/stijl toont, moet kloppen met de werkelijkheid ──
// Dat bestand wordt bij de bouw geschreven (scripts/stijl-inventaris.ts). Staat
// er iets anders in dan wat we hier meten, dan kijkt Maarten op dat scherm naar
// oude cijfers en gelooft hij iets dat niet meer waar is. Dan is de spiegel geen
// spiegel meer, en dat is erger dan geen spiegel hebben.
const inventarisPad = path.join(WORTEL, "lib", "stijl-inventaris.json");
if (!fs.existsSync(inventarisPad)) {
  checkWaar("de inventaris voor /admin/stijl bestaat", false,
    "Draai: npx tsx scripts/stijl-inventaris.ts (zit ook in prebuild).");
} else {
  const opgeslagen = JSON.parse(fs.readFileSync(inventarisPad, "utf8")) as typeof meting;
  const gelijk = opgeslagen.kleuren.verschillend === meting.kleuren.verschillend
    && opgeslagen.lettergroottes.verschillend === meting.lettergroottes.verschillend
    && opgeslagen.css.classnamen === meting.css.classnamen;
  checkWaar("de inventaris voor /admin/stijl is bij", gelijk,
    "lib/stijl-inventaris.json loopt achter op de opmaak. Draai: npx tsx scripts/stijl-inventaris.ts en commit het mee.");
}

console.log(fouten === 0 ? "\nAlle stijlmeters staan goed.\n" : `\n${fouten} meter(s) fout.\n`);
process.exit(fouten === 0 ? 0 : 1);
