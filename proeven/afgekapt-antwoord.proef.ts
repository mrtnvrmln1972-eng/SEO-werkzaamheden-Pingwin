// Proef: een afgekapt antwoord mag nooit stilzwijgend worden uitgevoerd.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Op 16 augustus 2026 kwam bij Kamsteeg de kaart "Klantprofiel bijwerken" langs
// met een SEO-strategie die ophield bij "Zij doen ontwerp, aanleg en onder". De
// prompt voor de plaatspagina's stond er domweg niet in, en die halve tekst was
// wél al in het klantprofiel opgeslagen. Er was geen foutmelding, want er ging
// technisch niets mis: het model was tegen zijn lengtegrens gelopen
// (`stop_reason: "max_tokens"`), en de afrondingsronde in `callClaudeAgentic`
// voerde gereedschap uit zonder ooit naar die reden te kijken.
//
// Dat is de gevaarlijkste soort fout in dit dashboard: geen scherm dat breekt,
// maar inhoud die stilletjes half wordt opgeslagen en er compleet uitziet. Deze
// proef houdt de twee regels vast die dat onmogelijk maken:
//   1. elke ronde vraagt opnieuw met meer ruimte als het antwoord afgekapt is;
//   2. is het daarna nog afgekapt, dan wordt er géén gereedschap uitgevoerd.
//
// Draait bij élke bouw (`prebuild`), dus ook op Vercel.

import fs from "fs";
import path from "path";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const WORTEL = path.join(__dirname, "..");
const bron = fs.readFileSync(path.join(WORTEL, "lib/anthropic.ts"), "utf8");

// ── 1. De opnieuw-met-meer-ruimte-lus bestaat ──
check("een afgekapt antwoord wordt opnieuw gevraagd met meer ruimte",
  /stop_reason === "max_tokens"/.test(bron) && /callHeel/.test(bron),
  "In lib/anthropic.ts hoort callHeel() te staan, die opnieuw vraagt zolang stop_reason max_tokens is.");

// ── 2. Geen enkele ronde haalt zijn antwoord nog rechtstreeks op ──
// `call(` is de kale aanroep; die hoort alleen nog vanuit callHeel gebruikt te
// worden. Roept een ronde hem rechtstreeks aan, dan is die ronde niet beschermd.
const agentisch = bron.slice(bron.indexOf("export async function callClaudeAgentic"));
// De body van callHeel zelf mag call() natuurlijk wél rechtstreeks aanroepen;
// dat ís de beschermde plek. Die knippen we er dus uit voordat we tellen.
const heelStart = agentisch.indexOf("async function callHeel");
const heelEind = agentisch.indexOf("return { j, afgekapt", heelStart);
const buitenHeel = heelStart === -1 ? agentisch : agentisch.slice(0, heelStart) + agentisch.slice(heelEind);
const kaleAanroepen = [...buitenHeel.matchAll(/await call\(/g)];
check("geen enkele ronde vraagt het antwoord nog rechtstreeks op", kaleAanroepen.length === 0,
  `${kaleAanroepen.length} rechtstreekse aanroep(en) van call() gevonden. Gebruik callHeel(), anders is die ronde niet beschermd tegen afkappen.`);

// ── 3. De afrondingsronde kijkt naar afgekapt vóór hij gereedschap uitvoert ──
// Dit was precies het gat: die ronde filterde de tool_use-blokken zonder enige
// controle en voerde ze uit.
const afrondBlok = agentisch.slice(agentisch.indexOf("if (!uitTijd) {"));
check("de afrondingsronde voert geen gereedschap uit uit een afgekapt antwoord",
  /afgekapt\s*\?\s*\[\]\s*:/.test(afrondBlok),
  "De afrondingsronde hoort tool_use-blokken over te slaan als het antwoord afgekapt is.");

// ── 4. Er zit een plafond op het opnieuw vragen ──
// Zonder plafond kan een model dat blijft doorschrijven eindeloos duurder worden.
check("het opnieuw vragen heeft een plafond", /RUIM_PLAFOND\s*=\s*\d+/.test(bron),
  "Zet een bovengrens op de ruimte die callHeel mag vragen.");

// ── 5. De overzichts-chat heeft genoeg ruimte voor een lange kaart ──
// Daar worden de vastgelegde strategie en de klantprofiel-aanvulling geschreven,
// en die moeten in één gereedschapsaanroep passen.
const chat = fs.readFileSync(path.join(WORTEL, "lib/chat.ts"), "utf8");
const m = chat.match(/rondes,\s*isOverview\s*\?\s*(\d+)\s*:/);
const overzichtRuimte = m ? Number(m[1]) : 0;
check("de overzichts-chat heeft ruimte voor een lange kaart", overzichtRuimte >= 6000,
  `nu ${overzichtRuimte}. Een vastgelegde strategie mag 8.000 tekens zijn; die past niet in een kleiner antwoord.`);

console.log(fouten === 0
  ? "\nEen half antwoord wordt niet meer uitgevoerd."
  : `\n${fouten} punt(en) mis.`);
process.exit(fouten === 0 ? 0 : 1);
