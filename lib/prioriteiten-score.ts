import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════
// DE REKENKERN VAN DE PRIORITEITENSCAN
// ═══════════════════════════════════════════════════════════
// De getallen (CTR-curve, intentie-multipliers, drempels, tier-regels) staan NIET
// in dit bestand maar in skills/vindbaarheid-prioriteiten-scan/scoring-config.json.
// Datzelfde bestand wordt gelezen door de Python-versie van de skill die in Cowork
// draait. Zo kan een drempel niet op twee plekken stil uit elkaar lopen; dat is
// precies de fout die het brein beschrijft (dezelfde vraag op meerdere plekken
// apart uitgeschreven gaat onopgemerkt uiteen).
//
// Het model rekent hier NIETS uit. Een ROI-score is een som, geen oordeel; laat
// je die door een taalmodel schatten, dan krijg je elke run een ander antwoord.
// ═══════════════════════════════════════════════════════════

type TierRegel = { naam: string; confidence_min?: number; effort_max?: number; tte_max?: number; roi_top25?: boolean };
type Config = {
  ctr_curve: Record<string, number>;
  intentie_multiplier: Record<string, number>;
  impact: { factor: number };
  relevance_fit: Record<string, number>;
  tiers: Record<string, unknown> & {
    skip_relevance_fit_onder: number; skip_roi_onder: number; top25_percentiel: number;
    tier1: TierRegel; tier2: TierRegel; tier3: TierRegel; tier4: TierRegel;
  };
  confidence_per_lens: Record<string, number>;
};

let cfgCache: Config | null = null;
export function scoringConfig(): Config {
  if (cfgCache) return cfgCache;
  const p = path.join(process.cwd(), "skills", "vindbaarheid-prioriteiten-scan", "scoring-config.json");
  cfgCache = JSON.parse(fs.readFileSync(p, "utf8")) as Config;
  return cfgCache;
}

/** Verwachte organische CTR voor een positie. Positie 0 = rankt hier nog niet, dus nul. */
export function ctrVoorPositie(positie: number): number {
  const c = scoringConfig().ctr_curve;
  if (!positie || positie < 1) return 0;
  const exact = c[String(Math.round(positie))];
  if (typeof exact === "number") return exact;
  if (positie >= 11 && positie <= 20) return c["11_tot_20"];
  return c["21_en_verder"];
}

export function intentieMultiplier(intentie: string): number {
  const m = scoringConfig().intentie_multiplier;
  return typeof m[intentie] === "number" ? m[intentie] : m["_onbekend"];
}

/** Standaardzekerheid per lens: 0.9 harde meting, 0.6 afgeleid, 0.3 schatting. */
export function confidenceVoorLens(type: string): number {
  const c = scoringConfig().confidence_per_lens;
  return typeof c[type] === "number" ? c[type] : 0.6;
}

export type Bevinding = {
  id: string;
  type: string;              // lens-sleutel, bv. "striking_distance"
  titel: string;
  url: string;
  zoekwoord: string;
  maandvolume: number;       // hoogste van Ahrefs-volume en GSC-vertoningen
  huidigePositie: number;    // 0 = rankt nog niet
  targetPositie: number;
  intentie: string;
  relevanceFit: number;
  effort: number;            // 1 tot 10
  timeToEffect: number;      // 1 tot 5
  confidence: number;        // 0.3, 0.6 of 0.9
  ctrActueel?: number | null;             // alleen lens 2
  benchmarkCtr?: number | null;           // alleen lens 2
  rationale: string;
  /** Niet meer gevuld: de categorie wordt bij het tonen afgeleid uit `type`, zodat
   *  ook eerder gedraaide scans meteen de nieuwe namen krijgen. */
  vervolgSkill?: string;
  bron: string;              // waar de cijfers vandaan komen, voor de controle
  // Berekend
  ctrUplift?: number;
  impact?: number;
  roiScore?: number;
  extraKlikkenPerMaand?: number;
  tier?: string;
  skipReden?: string;
};

function ctrUpliftVan(b: Bevinding): number {
  if (b.type === "ctr_underperform") {
    if (b.ctrActueel == null || b.benchmarkCtr == null) return 0;
    return Math.max(0, b.benchmarkCtr - b.ctrActueel);
  }
  return Math.max(0, ctrVoorPositie(b.targetPositie) - ctrVoorPositie(b.huidigePositie));
}

const rond = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function scoreBevinding(b: Bevinding): Bevinding {
  const cfg = scoringConfig();
  b.ctrUplift = rond(ctrUpliftVan(b), 4);
  const volume = Math.max(1, b.maandvolume || 0);
  const basis = Math.log10(volume) * cfg.impact.factor;
  b.impact = rond(basis * b.ctrUplift * intentieMultiplier(b.intentie) * b.relevanceFit, 2);
  b.extraKlikkenPerMaand = rond(b.ctrUplift * volume, 1);
  const noemer = Math.max(1, b.effort) * Math.max(1, b.timeToEffect);
  b.roiScore = rond((b.impact * b.confidence) / noemer, 3);
  return b;
}

function percentiel(waarden: number[], p: number): number {
  if (!waarden.length) return 0;
  const s = [...waarden].sort((a, b) => a - b);
  return s[Math.floor(p * (s.length - 1))];
}

/**
 * Wijst tiers toe volgens de tabel in SKILL.md. Volgorde is hard:
 * eerst de merk-poort, dan "geen meetbare winst", dan tier 1 tot 4.
 */
export function wijsTiersToe(bevindingen: Bevinding[]): Bevinding[] {
  if (!bevindingen.length) return bevindingen;
  const t = scoringConfig().tiers;
  const rois = bevindingen.map((b) => b.roiScore ?? 0).filter((r) => r >= t.skip_roi_onder);
  const top25 = rois.length ? percentiel(rois, t.top25_percentiel) : 0;

  for (const b of bevindingen) {
    const roi = b.roiScore ?? 0;
    if (b.relevanceFit < t.skip_relevance_fit_onder) {
      b.tier = "SKIP";
      b.skipReden = "past niet bij wat deze klant wil zijn";
      continue;
    }
    if (roi < t.skip_roi_onder) {
      b.tier = "SKIP";
      b.skipReden = "levert vrijwel niets op";
      continue;
    }
    if (b.confidence >= (t.tier1.confidence_min ?? 0) && b.effort <= (t.tier1.effort_max ?? 99)
      && b.timeToEffect <= (t.tier1.tte_max ?? 99) && roi >= top25) b.tier = "1";
    else if (b.confidence >= (t.tier2.confidence_min ?? 0) && b.effort <= (t.tier2.effort_max ?? 99)
      && b.timeToEffect <= (t.tier2.tte_max ?? 99)) b.tier = "2";
    else if (b.effort <= (t.tier3.effort_max ?? 99) && b.timeToEffect <= (t.tier3.tte_max ?? 99)) b.tier = "3";
    else b.tier = "4";
  }
  return bevindingen;
}

export const TIER_NAAM: Record<string, string> = {
  "1": "Deze week", "2": "Deze maand", "3": "Dit kwartaal", "4": "Strategisch", SKIP: "Niet doen",
};

// De categorie-tabel staat in een apart bestand zonder server-afhankelijkheden,
// zodat het scherm hem ook kan gebruiken. Hier doorgegeven voor de serverkant.
export { CATEGORIE, categorieVan, type Categorie } from "./prioriteiten-categorie";

/**
 * De verwachte opbrengst voor de samenvatting: extra klikken per maand uit tier 1
 * en 2, elk gewogen met de zekerheid. Bewust een verwachting, geen belofte.
 */
export function verwachteUplift(bevindingen: Bevinding[]): number {
  return Math.round(bevindingen
    .filter((b) => b.tier === "1" || b.tier === "2")
    .reduce((s, b) => s + (b.extraKlikkenPerMaand ?? 0) * b.confidence, 0));
}
