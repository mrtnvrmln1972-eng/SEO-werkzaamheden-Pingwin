// Proef op de Claude-teller.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Deze teller moet iets zeggen over een bedrag dat gewoon doorloopt: er is geen
// tegoed dat opraakt, dus er is ook geen moment waarop de werkelijkheid vanzelf
// laat zien of de rekenregel klopt. Als hij verkeerd rekent, merk je dat pas als
// de rekening komt, en dan is het te laat om er iets aan te doen.
//
// Dus wordt het hier vooraf nagerekend, met vaste datums zodat de uitkomst morgen
// hetzelfde is als vandaag. Het punt dat ertoe doet: hetzelfde bedrag betekent iets
// anders op de derde van de maand dan op de achtentwintigste.

import { claudeStand, budgetUitEnv, usd } from "../lib/claude-teller";

let fouten = 0;
function checkWaar(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

// Augustus 2026 heeft 31 dagen.
const dag = (d: number) => new Date(`2026-08-${String(d).padStart(2, "0")}T12:00:00Z`);

// ── 1. Zonder budget is de vorige maand het ijkpunt ──
const zelfdeTempo = claudeStand({ maandUsd: 10, vorigeMaandUsd: 31, budgetUsd: null }, dag(10));
checkWaar("hetzelfde tempo als vorige maand is rustig", zelfdeTempo.sein === "rustig", `sein: ${zelfdeTempo.sein}, oordeel: ${zelfdeTempo.oordeel}`);
checkWaar("de prognose trekt het tempo door naar het eind van de maand", Math.round(zelfdeTempo.prognose ?? 0) === 31, `prognose: ${zelfdeTempo.prognose}`);
checkWaar("het oordeel noemt de vorige maand", zelfdeTempo.oordeel.includes("Vorige maand"), zelfdeTempo.oordeel);

const dubbel = claudeStand({ maandUsd: 20, vorigeMaandUsd: 31, budgetUsd: null }, dag(10));
checkWaar("het dubbele tempo van vorige maand is een signaal", dubbel.sein === "krap", `sein: ${dubbel.sein}, oordeel: ${dubbel.oordeel}`);

const ietsMeer = claudeStand({ maandUsd: 12, vorigeMaandUsd: 31, budgetUsd: null }, dag(10));
checkWaar("een kwart meer dan vorige maand is let-op en geen alarm", ietsMeer.sein === "let-op", `sein: ${ietsMeer.sein}`);

// ── 2. Hetzelfde bedrag, ander moment in de maand ──
// Dit is de hele reden dat deze teller niet gewoon een bedrag toont.
const vroeg = claudeStand({ maandUsd: 15, vorigeMaandUsd: 30, budgetUsd: null }, dag(5));
const laat = claudeStand({ maandUsd: 15, vorigeMaandUsd: 30, budgetUsd: null }, dag(28));
checkWaar("$15 op dag 5 is te snel", vroeg.sein === "krap", `sein: ${vroeg.sein}, prognose: ${vroeg.prognose}`);
checkWaar("$15 op dag 28 is rustig", laat.sein === "rustig", `sein: ${laat.sein}, prognose: ${laat.prognose}`);

// ── 3. De eerste dagen zeggen niets ──
// Eén zwaar analysedocument op dag 1 zou anders een alarm van $600 opleveren.
const dagEen = claudeStand({ maandUsd: 20, vorigeMaandUsd: 30, budgetUsd: null }, dag(1));
checkWaar("op dag 1 wordt er geen tempo berekend", dagEen.prognose === null, `prognose: ${dagEen.prognose}`);
checkWaar("op dag 1 staat het sein niet op alarm", dagEen.sein === "onbekend", `sein: ${dagEen.sein}`);
checkWaar("het oordeel legt uit waarom er geen tempo staat", dagEen.oordeel.includes("te jong"), dagEen.oordeel);

// ── 4. Met een budget werkt hij als de Ahrefs-teller ──
// Dag 26: op dit tempo blijft hij net binnen de 100, maar driekwart is al op.
const budget = claudeStand({ maandUsd: 75, vorigeMaandUsd: null, budgetUsd: 100 }, dag(26));
checkWaar("75 van 100 geeft 75%", Math.round((budget.deel ?? 0) * 100) === 75, `deel: ${budget.deel}`);
checkWaar("75% van het budget is let-op", budget.sein === "let-op", `sein: ${budget.sein}, prognose: ${budget.prognose}`);

// Diezelfde 75% halverwege de maand is wél alarm: dan gaat het budget eraan.
const budgetVroeg = claudeStand({ maandUsd: 75, vorigeMaandUsd: null, budgetUsd: 100 }, dag(20));
checkWaar("75% halverwege de maand is krap", budgetVroeg.sein === "krap", `sein: ${budgetVroeg.sein}, prognose: ${budgetVroeg.prognose}`);
checkWaar("het oordeel noemt het budget", budget.oordeel.includes("maandbudget"), budget.oordeel);

const budgetVol = claudeStand({ maandUsd: 95, vorigeMaandUsd: null, budgetUsd: 100 }, dag(20));
checkWaar("95% van het budget is krap", budgetVol.sein === "krap", `sein: ${budgetVol.sein}`);

// Een budget dat op dit tempo overschreden wordt, is óók een signaal, ook als er
// pas de helft op is.
const budgetTempo = claudeStand({ maandUsd: 62, vorigeMaandUsd: null, budgetUsd: 100 }, dag(15));
checkWaar("op tempo over het budget heen is een signaal", budgetTempo.sein !== "rustig", `sein: ${budgetTempo.sein}, prognose: ${budgetTempo.prognose}`);

// ── 5. Zonder ijkpunt geen vals alarm ──
const kaal = claudeStand({ maandUsd: 40, vorigeMaandUsd: null, budgetUsd: null }, dag(15));
checkWaar("zonder budget en zonder vorige maand blijft het sein neutraal", kaal.sein === "onbekend", `sein: ${kaal.sein}`);
checkWaar("het oordeel zegt dat er geen vergelijking is", kaal.oordeel.includes("geen vorige maand"), kaal.oordeel);

// ── 6. Randgevallen die anders stilletjes fout gaan ──
checkWaar("een leeg budget is geen budget", budgetUitEnv(undefined) === null && budgetUitEnv("") === null && budgetUitEnv("nul") === null);
checkWaar("een budget met een komma wordt gelezen", budgetUitEnv("12,50") === 12.5, `${budgetUitEnv("12,50")}`);
checkWaar("kleine bedragen houden hun centen", usd(0.42) === "$ 0.42", usd(0.42));
checkWaar("grote bedragen worden afgerond", usd(1234.6) === "$ 1.235", usd(1234.6));
const leeg = claudeStand({ maandUsd: 0, vorigeMaandUsd: 20, budgetUsd: null }, dag(15));
checkWaar("nul verbruik geeft geen fout maar een rustig sein", leeg.sein === "rustig", `sein: ${leeg.sein}, oordeel: ${leeg.oordeel}`);

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
