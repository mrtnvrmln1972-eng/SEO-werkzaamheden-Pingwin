// Proef: op het werkplan staan zes lettergroottes, en geen zevende.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 26-08-2026 keek Maarten naar het werkplan en zei, voor de zoveelste keer:
// "ik zie weer een gaatje van allerlei stijlen. Ik snap niet waarom dit voor de
// zoveelste honderdduizendste keer verkeerd kan gaan. Het staat allemaal op een
// grid. Alles is vastgelegd."
//
// Hij had gelijk, en het antwoord op zijn vraag is precies waarom deze proef er
// staat. In één opengeklapte regel stonden VIER lettergroottes door elkaar:
//
//   11    de kapitaaltjes-labels        var(--type-label)
//   12,5  het pad en de waarden         var(--type-bijschrift)
//   14    de onderbouwing               (geërfd, want `.md` zet zelf geen maat)
//   16    de titel van het blok         var(--type-kaartkop)
//
// Die 14 is nooit besloten. `netteHtml` rendert in een `.md`-container, en dat
// gedeelde blok zet met opzet geen font-size zodat het zich aanpast aan waar het
// staat. Zet je zo'n container in een dichte kaart die op 11 en 12,5 draait, dan
// springt de tekst eruit. Er is geen enkele regel overtreden: elke maat kwam
// keurig uit een token, de bouwstenen klopten, alle poorten waren groen.
//
// DAAR ZAT HET GAT. De bestaande poorten controleren WELKE tokens je gebruikt,
// niet HOEVEEL verschillende je er in één scherm doorheen haalt, en al helemaal
// niet of een container die gerenderde tekst opvangt zélf een maat afspreekt.
// Een schaal met zes stappen waarvan je er vier willekeurig door elkaar gebruikt
// is geen schaal meer. Deze proef sluit dat gat met drie regels:
//
//   1. elke font-size in het werkplan-blok is een van de zes rollen;
//   2. er staat één lettertype op de pagina, geen monospace ernaast;
//   3. elke container waar `netteHtml`-tekst in landt, spreekt zelf een maat af.
//
// Regel 3 is de belangrijkste: die vangt precies het geval dat hier misging.

import fs from "fs";
import path from "path";

const WORTEL = path.join(__dirname, "..");
let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

// De zes rollen. Meer maten zijn er niet op dit scherm; wil je een zevende,
// dan is dat een ontwerpbesluit en hoort de rol hier eerst bij.
const ROLLEN = new Set([
  "--type-hero",        // de paginatitel
  "--type-sectiekop",   // een fase-kop
  "--type-kaartkop",    // de naam van een blok werk
  "--type-lopend",      // alle lopende tekst en alle waarden
  "--type-bijschrift",  // regels en meta in de bediening
  "--type-label",       // kapitaaltjes en chips
]);

const css = fs.readFileSync(path.join(WORTEL, "app/globals.css"), "utf8");
const begin = css.indexOf("/* werkplan:begin */");
const eind = css.indexOf("/* werkplan:eind */");
proef("het werkplan-blok is af te bakenen in globals.css",
  begin >= 0 && eind > begin,
  "de markers /* werkplan:begin */ en /* werkplan:eind */ moeten er allebei staan");
const blok = begin >= 0 && eind > begin ? css.slice(begin, eind) : "";

// ── 1. Elke maat komt uit een rol ──
const maten = [...blok.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
const buitenSchaal = maten.filter((m) => {
  const t = m.match(/var\((--[\w-]+)\)/);
  return !t || !ROLLEN.has(t[1]);
});
proef("elke lettergrootte in het werkplan komt uit een van de zes rollen",
  buitenSchaal.length === 0,
  buitenSchaal.length ? `buiten de schaal: ${[...new Set(buitenSchaal)].join(", ")}` : "");

const gebruikt = new Set(maten.map((m) => (m.match(/var\((--[\w-]+)\)/) || [])[1]).filter(Boolean));
proef(`er staan hooguit zes lettergroottes op dit scherm (nu ${gebruikt.size})`,
  gebruikt.size <= ROLLEN.size,
  [...gebruikt].join(", "));

// Een maat zonder bijbehorende regelhoogte geeft regels die net niet op elkaar
// aansluiten; dat is de helft van het "rommelig"-gevoel.
const regels = blok.split("\n").filter((r) => /font-size:/.test(r) && !/line-height:/.test(r) && !r.trim().startsWith("/*"));
proef("elke regel met een lettergrootte zet ook zijn regelhoogte",
  regels.length === 0,
  regels.map((r) => r.trim().slice(0, 90)).join("\n     | "));

// ── 2. Eén lettertype ──
// Er stond een monospace op het pad en op de datum, terwijl exact hetzelfde pad
// er een regel lager als gewone link bij stond: twee lettertypes voor één ding.
proef("het werkplan gebruikt één lettertype, geen losse monospace",
  !/font-family/.test(blok),
  "gevonden: " + (blok.match(/font-family:[^;]+;/g) || []).join(" "));

// ── 3. Een container die gerenderde tekst opvangt, spreekt zelf een maat af ──
// Dit is het geval dat misging. `.md` zet met opzet geen font-size (zodat hij
// zich aanpast), dus de container eromheen moet het doen; anders erft de tekst
// van de body en springt hij uit de kaart.
// Élk scherm-bestand van deze pagina, niet alleen het hoofdbestand. Toen het
// draaiboek erbij kwam als eigen component, keek deze proef daar nog niet naar;
// dan heeft een poort vanaf dag één een gat.
const SCHERM_MAP = "app/admin/client/[slug]/werkplanning-proef";
const tsxRegels: string[] = [];
for (const naam of fs.readdirSync(path.join(WORTEL, SCHERM_MAP)).sort()) {
  if (!naam.endsWith(".tsx")) continue;
  tsxRegels.push(`// ── bestand: ${naam} ──`);
  tsxRegels.push(...fs.readFileSync(path.join(WORTEL, SCHERM_MAP, naam), "utf8").split("\n"));
}

// Uit de JSX afleiden wélk element de ouder is, bleek te wankel: op inspringing
// zoeken vond de BUURREGEL (`<p class="wp-veldnaam">Waarom dit besluit</p>`) in
// plaats van de container. Die buur zet wél een maat, dus de proef bleef groen
// terwijl de fout er nog in zat. Dat is gebleken door de fout expres terug te
// zetten; een poort die nooit rood is geweest bewijst niets.
//
// Daarom nu geen gok maar een afspraak: een container voor gerenderde tekst
// draagt de merkklasse `wp-proza`, en die klasse spreekt de maat af. Exact te
// controleren, en niet stiekem te omzeilen.
proef("de merkklasse .wp-proza spreekt een lettergrootte en regelhoogte af",
  /\.wp-proza\s*\{[^}]*font-size:[^}]*\}/.test(blok) && /\.wp-proza\s*\{[^}]*line-height:[^}]*\}/.test(blok),
  "zonder maat op .wp-proza erft gerenderde tekst van de body en springt hij uit de kaart");

const ontbreekt: string[] = [];
tsxRegels.forEach((regel, i) => {
  if (!/className="md"/.test(regel) || !/dangerouslySetInnerHTML/.test(regel)) return;
  // De container staat boven de gerenderde tekst, binnen hetzelfde blokje JSX.
  // Twintig regels is ruim genoeg voor een kentabel of een paar labels ertussen,
  // en te krap om een container drie schermen verderop nog mee te tellen.
  const boven = tsxRegels.slice(Math.max(0, i - 20), i).join("\n");
  if (!/wp-proza/.test(boven)) {
    ontbreekt.push(`regel ${i + 1}: gerenderde tekst zonder een wp-proza-container erboven`);
  }
});
proef("elke gerenderde tekst staat in een container die als proza gemerkt is",
  ontbreekt.length === 0,
  ontbreekt.join("\n     | "));

// ── 4. Geen losse pixelmaten die de schaal omzeilen ──
const pixels = [...blok.matchAll(/(margin|padding|gap)[^:]*:\s*([^;]*\d+px[^;]*);/g)].map((m) => m[0].trim());
proef("afstanden komen uit de spacing-schaal, niet uit losse pixels",
  pixels.length === 0,
  pixels.join("\n     | "));

console.log(fouten === 0 ? "\nAlles klopt: zes rollen, één lettertype." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
