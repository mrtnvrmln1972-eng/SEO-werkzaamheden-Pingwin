// ═══════════════════════════════════════════════════════════
// DE CLAUDE-TELLER: WAT KOST HET DENKWERK, EN LOOPT DAT UIT DE HAND?
// ═══════════════════════════════════════════════════════════
// Naast het Ahrefs-tegoed is er een tweede meter die stilletjes doorloopt: de
// AI-kosten. Die stonden alleen op het verbruikscherm, en daar kwam niemand uit
// zichzelf. Het verschil met Ahrefs is belangrijk: bij Ahrefs is er een tegoed dat
// óp kan raken, bij Claude loopt de rekening gewoon door. Er is dus geen harde
// grens die vanzelf een sein afgeeft.
//
// Daarom is de vraag hier niet "hoeveel is er nog" maar "loopt het uit de pas".
// Twee ijkpunten, in deze volgorde:
//  1. Een maandbudget, als dat is ingesteld (env CLAUDE_MAANDBUDGET_USD). Dan werkt
//     de teller net als die van Ahrefs: een percentage met een oordeel erover.
//  2. Anders de vorige maand. Uitkomen op hetzelfde bedrag als vorige maand is
//     rustig; op het dubbele is een signaal, ook zonder dat er een grens bestaat.
//
// Net als bij Ahrefs telt het tempo mee: veertig dollar op de derde van de maand
// is iets anders dan veertig dollar op de achtentwintigste. Pure rekenregels,
// geen database en geen netwerk, zodat `proeven/claude-teller.proef.ts` het kan
// narekenen in plaats van dat we moeten afwachten tot een rekening tegenvalt.
// ═══════════════════════════════════════════════════════════

import type { Sein } from "./sein";

export type ClaudeStand = {
  /** Uitgegeven sinds het begin van deze kalendermaand, in dollar. */
  maandUsd: number;
  /** Totaal van de vorige kalendermaand, of null als die er niet is. */
  vorigeMaandUsd: number | null;
  /** Maandbudget in dollar, als dat is ingesteld. */
  budgetUsd: number | null;
  /** 0 tot 1 van het budget, of null als er geen budget is. */
  deel: number | null;
  sein: Sein;
  /** Waar de maand op uitkomt als het huidige tempo doorzet. Null in de eerste dagen. */
  prognose: number | null;
  /** Hele dagen tot de eerste van de volgende maand. */
  dagenTotReset: number;
  /** Eén zin in gewone taal: wat betekent dit. Nooit leeg. Voor de tooltip. */
  oordeel: string;
  /**
   * Dezelfde boodschap, opgeknipt voor een smal paneel: één korte kernregel plus
   * losse bijzinnen. Achter elkaar in een uitklappaneel wordt een volzin een
   * tekstmuur; dit is dezelfde afspraak als bij de Ahrefs-teller ernaast.
   */
  kern: string;
  bij: string[];
};

/** Dollars leesbaar: kleine bedragen met centen, grote afgerond. */
export function usd(n: number): string {
  return "$ " + (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("nl-NL"));
}

const DAG_MS = 86400000;

/** Hoeveel dagen telt de maand waar deze datum in valt. */
function dagenInMaand(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Zet de gemeten bedragen om in een stand met een oordeel.
 *
 * `nu` is een parameter en geen `new Date()` binnenin, zodat de proef een vaste
 * datum kan meegeven en de uitkomst niet elke dag verandert.
 */
export function claudeStand(
  meting: { maandUsd: number; vorigeMaandUsd: number | null; budgetUsd: number | null },
  nu: Date = new Date(),
): ClaudeStand {
  const maandUsd = Math.max(0, meting.maandUsd);
  const vorigeMaandUsd = meting.vorigeMaandUsd !== null && meting.vorigeMaandUsd > 0 ? meting.vorigeMaandUsd : null;
  const budgetUsd = meting.budgetUsd !== null && meting.budgetUsd > 0 ? meting.budgetUsd : null;

  const lengte = dagenInMaand(nu);
  const dagNu = nu.getUTCDate();
  const dagenTotReset = Math.max(0, Math.ceil((Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() + 1, 1) - nu.getTime()) / DAG_MS));

  // Prognose: het tempo van de dagen die al verstreken zijn, doorgetrokken tot het
  // eind van de maand. In de eerste twee dagen zegt dat tempo niets (één zwaar
  // analysedocument maakt er dan een raket van), dus daaronder rekenen we niet.
  const prognose = dagNu >= 3 ? (maandUsd / dagNu) * lengte : null;

  const deel = budgetUsd === null ? null : Math.min(maandUsd / budgetUsd, 1);

  let sein: Sein = "onbekend";
  if (budgetUsd !== null) {
    const teSnel = prognose !== null && prognose > budgetUsd;
    if ((deel ?? 0) >= 0.9 || (teSnel && (deel ?? 0) >= 0.6)) sein = "krap";
    else if ((deel ?? 0) >= 0.7 || teSnel) sein = "let-op";
    else sein = "rustig";
  } else if (prognose !== null && vorigeMaandUsd !== null) {
    const verhouding = prognose / vorigeMaandUsd;
    if (verhouding > 1.5) sein = "krap";
    else if (verhouding > 1.15) sein = "let-op";
    else sein = "rustig";
  }

  return {
    maandUsd, vorigeMaandUsd, budgetUsd, deel, sein,
    prognose: prognose === null ? null : Math.round(prognose * 100) / 100,
    dagenTotReset,
    oordeel: oordeelVan({ maandUsd, vorigeMaandUsd, budgetUsd, deel, sein, prognose, dagenTotReset }),
    kern: kernVan(sein, budgetUsd, vorigeMaandUsd, prognose),
    bij: bijVan({ budgetUsd, vorigeMaandUsd, prognose, dagenTotReset }),
  };
}

function oordeelVan(s: {
  maandUsd: number; vorigeMaandUsd: number | null; budgetUsd: number | null;
  deel: number | null; sein: Sein; prognose: number | null; dagenTotReset: number;
}): string {
  const rest = s.dagenTotReset <= 1
    ? " De maand is bijna om."
    : ` Nog ${s.dagenTotReset} dagen in deze maand.`;

  if (s.budgetUsd !== null) {
    const pct = Math.round((s.deel ?? 0) * 100);
    const eind = s.prognose === null ? "" : ` Op dit tempo eindig je op ${usd(s.prognose)}.`;
    if (s.sein === "krap") return `${pct}% van het maandbudget van ${usd(s.budgetUsd)} is op.${eind}${rest} Zware analyses even doseren.`;
    if (s.sein === "let-op") return `${pct}% van het maandbudget van ${usd(s.budgetUsd)} is op.${eind}${rest} Het loopt, maar er is nog ruimte.`;
    return `${pct}% van het maandbudget van ${usd(s.budgetUsd)} is op.${eind}${rest} Ruim binnen het budget.`;
  }

  if (s.prognose === null) {
    return `${usd(s.maandUsd)} deze maand. De maand is nog te jong om er een tempo uit te halen.${rest}`;
  }
  if (s.vorigeMaandUsd === null) {
    return `${usd(s.maandUsd)} deze maand, op dit tempo ${usd(s.prognose)} aan het eind.${rest} Er is nog geen vorige maand om mee te vergelijken.`;
  }
  const keer = s.prognose / s.vorigeMaandUsd;
  const vergelijk = ` Vorige maand werd het ${usd(s.vorigeMaandUsd)}.`;
  if (s.sein === "krap") {
    return `${usd(s.maandUsd)} deze maand, op dit tempo ${usd(s.prognose)}: ruim ${keer >= 2 ? "het dubbele" : "de helft meer"} dan vorige maand.${vergelijk}${rest}`;
  }
  if (s.sein === "let-op") {
    return `${usd(s.maandUsd)} deze maand, op dit tempo ${usd(s.prognose)}: wat meer dan vorige maand.${vergelijk}${rest}`;
  }
  return `${usd(s.maandUsd)} deze maand, op dit tempo ${usd(s.prognose)}: hetzelfde beeld als vorige maand.${vergelijk}${rest}`;
}

/** De kwalificatie zonder de bedragen; die staan in het paneel al boven. */
function kernVan(sein: Sein, budgetUsd: number | null, vorigeMaandUsd: number | null, prognose: number | null): string {
  if (prognose === null) return "Nog te vroeg in de maand voor een tempo.";
  if (budgetUsd !== null) {
    if (sein === "krap") return prognose > budgetUsd ? "Op dit tempo gaat het budget eraan." : "Bijna door het maandbudget heen.";
    if (sein === "let-op") return prognose > budgetUsd ? "Op dit tempo kom je tegen het budget aan." : "Er is nog ruimte, maar het loopt.";
    return "Ruim binnen het maandbudget.";
  }
  if (vorigeMaandUsd === null) return "Nog geen vorige maand om mee te vergelijken.";
  if (sein === "krap") return "Fors meer dan vorige maand.";
  if (sein === "let-op") return "Iets meer dan vorige maand.";
  return "Hetzelfde beeld als vorige maand.";
}

/** De cijfers eronder, elk op een eigen regel, en alleen als ze iets toevoegen. */
function bijVan(s: { budgetUsd: number | null; vorigeMaandUsd: number | null; prognose: number | null; dagenTotReset: number }): string[] {
  const uit: string[] = [];
  if (s.prognose !== null) uit.push(`Op dit tempo ${usd(s.prognose)} aan het eind van de maand`);
  if (s.budgetUsd === null && s.vorigeMaandUsd !== null) uit.push(`Vorige maand werd het ${usd(s.vorigeMaandUsd)}`);
  uit.push(s.dagenTotReset <= 1 ? "De maand is bijna om" : `Nog ${s.dagenTotReset} dagen in deze maand`);
  return uit;
}

/**
 * Het maandbudget uit de omgeving, of null. Bewust een env-var en geen getal in de
 * code: een budget is een bedrijfskeuze, geen ontwerpkeuze, en hoort dus niet in
 * een bestand te staan dat bij elke wijziging opnieuw langs de bouw moet.
 */
export function budgetUitEnv(waarde: string | undefined): number | null {
  if (!waarde) return null;
  const n = Number(waarde.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
