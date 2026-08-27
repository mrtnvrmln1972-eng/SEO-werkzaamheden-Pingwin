// ═══════════════════════════════════════════════════════════
// DE KETEN-POORT WORDT NAGEREKEND, NIET ONTHOUDEN
// ═══════════════════════════════════════════════════════════
// De keten-poort (lib/keten-poort.ts) heeft vier keer een pagina onterecht
// geblokkeerd, en de eerste drie keer is dat "opgelost" door er instructietekst
// bij te schrijven. Dat werkte nooit, want de fout zat niet in de tekst maar in
// de vorm: het model kon alleen maar conflicten opschrijven, ook als het zelf
// concludeerde dat er geen conflict was. Sinds 17-08-2026 staan de sloten in de
// code, en die kunnen alleen blijven staan als iets ze bewaakt. Dat is deze
// proef. Hij draait via proeven/alles.mjs bij élke bouw, dus ook op Vercel.
//
// Wat hij bewaakt, en waarom elk slot er is:
//   A. De poort slaat over als de pagina niet live staat (het geval van 17-08).
//   B. Alleen een expliciet "hard": true blokkeert; twijfel gaat door.
//   C. Een conflict dat zichzelf tegenspreekt ("dat klopt") wordt weggegooid.
//   D. Een conflict dat een verhaal is in plaats van een feit wordt weggegooid.
//   E. Er is altijd een uitweg: de knop "Toch genereren" op beide schermen.
//   F. De poort faalt open: een stukke controle blokkeert nooit.
// Haal hier nooit een slot uit om een blokkade te "repareren"; los het op in de
// code en breid deze proef uit.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";

import { isEchtConflict } from "../lib/keten-poort";

const fouten: string[] = [];
const lees = (p: string) => { try { return readFileSync(p, "utf8"); } catch { fouten.push(`Bestand ontbreekt: ${p}`); return ""; } };

const poort = lees("lib/keten-poort.ts");
const melding = lees("lib/keten-poort-melding.ts");
const doc = lees("lib/page-doc.ts");
const run = lees("lib/page-doc-run.ts");
const route = lees("app/api/admin/page-doc/run/route.ts");
const kaart = lees("app/admin/client/[slug]/weekplan-kaart/KaartFases.tsx");
const vervolg = lees("app/admin/client/[slug]/pagina-chat/VervolgstappenKaart.tsx");

// ── SLOT A: geen poort op een pagina die niet live staat ───────────────────
if (!/paginaLeeft\s*===\s*false\)\s*return \[\]/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de harde uitgang voor een niet-live pagina is weg. Een plan voor een pagina die nog gebouwd moet worden kan niet botsen met een meting die zegt dat hij er niet is; zonder deze if blokkeert de poort daar weer op (geval /hovenier/oosterhout/, 17-08-2026).");
}
if (!/paginaStaatLive/.test(doc) || !/paginaLeeft:\s*context\.paginaLeeft/.test(doc)) {
  fouten.push("lib/page-doc.ts: de poort krijgt niet meer door of de pagina live staat. Slot A staat dan wel in keten-poort.ts, maar wordt nooit geraakt.");
}

// ── SLOT B: alleen een expliciet hard oordeel blokkeert ────────────────────
if (!/c\.hard\s*!==\s*true/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de controle op \"hard === true\" is weg. Dan blokkeert elke observatie weer, ook een twijfelgeval dat het model expliciet als niet-hard bedoelde.");
}
if (!/"hard":true/.test(poort) || !/"waarom"/.test(poort)) {
  fouten.push("lib/keten-poort.ts: het antwoordformaat mist het veld \"hard\" of \"waarom\". Zonder een apart veld voor de afweging schrijft het model zijn twijfel weer IN het conflict, en dat is precies hoe de blokkade van 17-08-2026 ontstond.");
}

// ── SLOT C: een zelfweerleggend conflict is geen conflict ──────────────────
if (!/ZELFWEERLEGGEND/.test(poort) || !/geen conflict/.test(poort) || !/dat klopt/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de filter op zelfweerleggende meldingen is weg of uitgekleed. De blokkade van 17-08-2026 bevatte letterlijk \"dat klopt\" en \"Dit is geen conflict\"; die woorden moeten in de lijst blijven staan.");
}

// ── SLOT D: een conflict is één zin, geen beschouwing ──────────────────────
if (!/MAX_VELDLENGTE/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de lengtegrens op claim/feit is weg. Een harde tegenspraak past in één zin; alles daarboven is een redenering en hoort de keten niet dicht te gooien.");
}

// ── SLOT G: een voorgenomen wijziging is geen tegenspraak ─────────────────
// Vijfde onterechte blokkade (27-08-2026): het plan stelde een 301-redirect
// voor op /hovenier-uden/ en de meting zei dat die pagina bestaat en verkeer
// heeft. Dat is de aanleiding voor het plan, niet een weerlegging ervan. Hier
// draaien we de echte functie, niet de tekst van het bestand.
{
  const toekomst: [string, string, boolean][] = [
    ["Het plan stelt voor de URL via 301-redirect om te zetten.",
     "De huidige URL staat actief in GSC met 326 vertoningen en 14 klikken.", false],
    ["De pagina moet worden samengevoegd met /hovenier-oss/.",
     "De pagina bestaat en rankt op positie 3.", false],
    ["Het plan wil deze pagina verplaatsen naar een nieuw pad.",
     "De pagina is live en heeft 12 interne links.", false],
    // Dit blijft wél een conflict: het doel van de omleiding bestaat niet.
    ["Het plan stelt een 301-redirect voor naar /hovenier/uden/.",
     "Dat adres geeft 404 en bestaat niet.", true],
    // En een gewone harde tegenspraak blijft ook staan.
    ["Het plan zegt dat er geen FAQ-blok op de pagina staat.",
     "De live pagina heeft een FAQ-blok met zes vragen.", true],
  ];
  for (const [claim, feit, verwacht] of toekomst) {
    if (isEchtConflict(claim, feit) !== verwacht) {
      fouten.push(`lib/keten-poort.ts: "${claim.slice(0, 55)}…" hoort ${verwacht ? "WEL" : "GEEN"} conflict te zijn. Een voorgenomen wijziging (redirect, samenvoegen, verplaatsen) kan een meting van de huidige situatie niet tegenspreken; alleen een doel dat niet bestaat is wél hard.`);
    }
  }
  if (!/isToekomstplan/.test(poort) || !/DOEL_ONTBREEKT/.test(poort)) {
    fouten.push("lib/keten-poort.ts: slot G (voorgenomen wijziging is geen tegenspraak) is weg. Dit was de vijfde onterechte blokkade; zonder dit slot komt hij terug.");
  }
}

// ── SLOT E: er is altijd een uitweg ────────────────────────────────────────
if (!/negeerPoort/.test(doc) || !/if \(!negeerPoort\)/.test(doc)) {
  fouten.push("lib/page-doc.ts: de overslaan-route (negeerPoort) is weg. Dan is de poort weer een muur zonder deur en kost één vals alarm opnieuw een halve dag.");
}
if (!/poort_negeren/.test(run) || !/negeerPoort/.test(route)) {
  fouten.push("De keten van de knop naar de generatie is onderbroken: page-doc-run.ts (kolom poort_negeren) of de run-route (body.negeerPoort) geeft de keuze niet meer door.");
}
for (const [naam, inhoud] of [["KaartFases.tsx", kaart], ["VervolgstappenKaart.tsx", vervolg]] as const) {
  if (!/isPoortBlokkade/.test(inhoud) || !/Toch genereren/.test(inhoud)) {
    fouten.push(`${naam}: de knop "Toch genereren" bij een poort-blokkade is weg. Maarten kan dan niet meer verder zonder dat er code aangepast wordt.`);
  }
}
// De schermen mogen de poort alleen via het melding-bestand herkennen; via
// lib/keten-poort.ts trekken ze de Anthropic-client de browserbundel in.
for (const [naam, inhoud] of [["KaartFases.tsx", kaart], ["VervolgstappenKaart.tsx", vervolg]] as const) {
  if (/from ".*lib\/keten-poort"/.test(inhoud)) {
    fouten.push(`${naam}: importeert lib/keten-poort (met de AI-client erin) in een clientscherm. Gebruik lib/keten-poort-melding.`);
  }
}
if (!/POORT_MARKERING/.test(melding) || !/isPoortBlokkade/.test(melding)) {
  fouten.push("lib/keten-poort-melding.ts: de markering of de herkenner ontbreekt; dan weten de schermen niet meer wanneer ze de uitwijkknop moeten tonen.");
}
// De melding die de poort produceert moet met de markering beginnen, anders
// herkent geen enkel scherm hem en verdwijnt de knop stilletjes.
if (!/return `\$\{POORT_MARKERING\}/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de blokkade-melding begint niet meer met POORT_MARKERING. De schermen herkennen hem dan niet en de knop \"Toch genereren\" verschijnt nooit.");
}

// ── SLOT F: de poort faalt open ────────────────────────────────────────────
if (!/catch\s*\{\s*\n?\s*return \[\];/.test(poort)) {
  fouten.push("lib/keten-poort.ts: de poort faalt niet meer open. Een controle die zelf stukloopt mag nooit de reden zijn dat er niets meer gegenereerd kan worden.");
}

if (fouten.length) {
  console.error("Keten-poort-proef gezakt:\n" + fouten.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("Keten-poort-proef geslaagd: alle zes sloten staan er nog (niet-live, hard-oordeel, zelfweerlegging, lengte, uitweg, faalt-open).");
