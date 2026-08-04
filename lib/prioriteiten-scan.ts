import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getGscPageOpportunities } from "./google";
import { getSiteOrganicKeywords, getAiResponsesCount, ahrefsConfigured } from "./ahrefs";
import { getMetaKansen } from "./meta-ctr";
import { getCannibalAnalysis } from "./cannibal-redirect";
import { getInternalLinksState } from "./internal-links";
import { getOpportunities } from "./keyword-opportunities";
import {
  scoreBevinding, wijsTiersToe, confidenceVoorLens, verwachteUplift,
  ctrVoorPositie, type Bevinding,
} from "./prioriteiten-score";
import { getSetting, setSetting } from "./settings";
import { getWeekplan } from "./weekplan";
import { urlKey } from "./url-key";

// ═══════════════════════════════════════════════════════════
// VINDBAARHEID-PRIORITEITENSCAN (dashboard-motor van de skill)
// ═══════════════════════════════════════════════════════════
// Draait de methodiek uit skills/vindbaarheid-prioriteiten-scan site-breed en
// zegt: dit eerst, dat tweede, dit niet doen.
//
// Twee dingen zijn bewust zo:
//
// 1. VIER LENZEN DRAAIEN AL ALS MOTOR IN DIT DASHBOARD (Meta & CTR, Opruimen,
//    Interne links, AI-vindbaarheid). Die vragen we uit in plaats van ze opnieuw
//    op te halen. Anders staat hetzelfde cijfer op twee tabjes verschillend, en
//    dat is precies de fout die het brein beschrijft.
//
// 2. DE SCAN DRAAIT IN HERVATBARE STAPPEN, met na elke stap een opgeslagen
//    tussenstand. Serverless kapt een lang venster af; bij het opruimen stond een
//    analyse daardoor veertig minuten dood op "bezig" zonder ooit iets op te
//    leveren. Een cron-werker pakt een run zonder hartslag weer op.
// ═══════════════════════════════════════════════════════════

export const SETTING_PRIO_CRON_TIK = "prio_cron_laatste_tik";

export type Lens = {
  sleutel: string;
  naam: string;
  status: "pass" | "aandacht" | "kritiek" | "niet-aangesloten";
  toelichting: string;
  gevonden: number;
};

export type PrioRegel = Bevinding & { nieuw?: boolean; opgelost?: boolean };

export type PrioResult = {
  samenvatting: string;
  propositie: string;
  verwachteKlikkenPerMaand: number;
  lenzen: Lens[];
  regels: PrioRegel[];
  /** Wat er veranderd is sinds de vorige scan. Leeg bij de allereerste run. */
  delta: { nieuw: number; opgelost: number; vorigeDatum: string | null } | null;
  generatedAt: string;
};

export type PrioFase = "" | "eigen" | "vers" | "scoren" | "duiden";
export type PrioState = {
  status: "idle" | "running" | "done" | "error";
  result: PrioResult | null;
  error: string;
  updatedAt: string | null;
  fase: PrioFase;
  stap: number;
  stappen: number;
  stapLabel: string;
  cronTik: string | null;
  cronStil: boolean;
  /** Draait hij vanzelf, en wanneer was de laatste automatische ronde? */
  laatsteAutoRonde: string | null;
  /**
   * Voor welke pagina's staat er al een kaart in de planning (nog niet klaar)?
   * Als `urlKey`, zodat www en een slash op het eind niet uitmaken.
   *
   * Bewust NIET apart bijgehouden op de bevinding zelf: dan zou het vinkje op het
   * winstscherm uit de pas gaan lopen zodra je een kaart afvinkt of weggooit. Nu
   * is de planning de enige waarheid en klopt het scherm altijd.
   */
  inPlanning: string[];
};

const STAPPEN = 4;
function stapVan(fase: PrioFase): { stap: number; label: string } {
  switch (fase) {
    case "eigen": return { stap: 1, label: "Uitlezen wat het dashboard al weet" };
    case "vers":  return { stap: 2, label: "Verse cijfers ophalen uit Search Console en Ahrefs" };
    case "scoren": return { stap: 3, label: "Kansen scoren en op volgorde zetten" };
    case "duiden": return { stap: 4, label: "De uitkomst in gewone taal zetten" };
    default: return { stap: 1, label: "De scan wordt opgestart" };
  }
}

// ── Opslag ────────────────────────────────────────────────────────────────
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_prioriteiten_scan (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      fase        TEXT NOT NULL DEFAULT '',
      tussenstand TEXT,
      propositie  TEXT,
      auto_ronde  TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // De vorige uitkomst bewaren we apart, zodat "wat is er veranderd" ook klopt
  // nadat de nieuwe run het hoofdveld heeft overschreven.
  await sql`ALTER TABLE client_prioriteiten_scan ADD COLUMN IF NOT EXISTS vorig_result TEXT`;
}

type Row = {
  status: string; result: PrioResult | null; error: string; fase: PrioFase;
  tussenstand: Bevinding[] | null; propositie: string; updatedAt: string | null;
  autoRonde: string | null; vorigResult: PrioResult | null;
};

function parse<T>(s: unknown): T | null {
  if (!s || typeof s !== "string") return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

async function readRow(slug: string): Promise<Row | null> {
  const { rows } = await sql`SELECT * FROM client_prioriteiten_scan WHERE client_slug = ${slug}`;
  const r = rows[0];
  if (!r) return null;
  return {
    status: String(r.status || "idle"),
    result: parse<PrioResult>(r.result),
    error: (r.error as string) || "",
    fase: ((r.fase as PrioFase) || ""),
    tussenstand: parse<Bevinding[]>(r.tussenstand),
    propositie: (r.propositie as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    autoRonde: r.auto_ronde ? new Date(r.auto_ronde as string).toISOString() : null,
    vorigResult: parse<PrioResult>(r.vorig_result),
  };
}

export async function getPrioriteitenScan(slug: string): Promise<PrioState> {
  await ensureSchema();
  await ensureTable();
  const r = await readRow(slug);
  const cronTik = await getSetting(SETTING_PRIO_CRON_TIK).catch(() => null);
  const cronStil = !cronTik || (Date.now() - new Date(cronTik).getTime()) > 900000;
  // Welke pagina's staan al in de planning? Rechtstreeks uit de weekplanning, dus
  // afvinken of weggooien laat het vinkje vanzelf verdwijnen.
  const inPlanning = await getWeekplan(slug)
    .then((ks) => [...new Set(ks.filter((k) => k.status !== "klaar" && k.url).map((k) => urlKey(k.url)))])
    .catch(() => [] as string[]);
  if (!r) {
    return { status: "idle", result: null, error: "", updatedAt: null, fase: "", stap: 0,
      stappen: STAPPEN, stapLabel: "", cronTik, cronStil, laatsteAutoRonde: null, inPlanning };
  }
  const { stap, label } = stapVan(r.fase);
  return {
    status: r.status as PrioState["status"],
    result: r.result,
    error: r.error,
    updatedAt: r.updatedAt,
    fase: r.fase,
    stap: r.status === "running" ? stap : STAPPEN,
    stappen: STAPPEN,
    stapLabel: r.status === "running" ? label : "",
    cronTik, cronStil,
    laatsteAutoRonde: r.autoRonde,
    inPlanning,
  };
}

/** De propositie-zin: waar de klant wél en niet voor staat. */
export async function getPropositie(slug: string): Promise<{ zin: string; voorstel: string }> {
  await ensureSchema();
  await ensureTable();
  const r = await readRow(slug);
  if (r?.propositie) return { zin: r.propositie, voorstel: "" };
  // Nog niets vastgelegd: een voorzet uit het klantprofiel dat er al ligt.
  const client = await getClientBySlug(slug);
  const profiel = (client?.seoProfile || "").trim();
  const eersteZin = profiel.split(/\n|\. /).map((s) => s.trim()).filter(Boolean)[0] || "";
  return { zin: "", voorstel: eersteZin.slice(0, 240) };
}

export async function setPropositie(slug: string, zin: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_prioriteiten_scan (client_slug, propositie, updated_at)
    VALUES (${slug}, ${zin}, now())
    ON CONFLICT (client_slug) DO UPDATE SET propositie = ${zin}, updated_at = now()`;
}

export async function startPrioRun(slug: string, auto = false): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_prioriteiten_scan (client_slug, status, error, fase, tussenstand, updated_at)
    VALUES (${slug}, 'running', NULL, 'eigen', NULL, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = 'running', error = NULL, fase = 'eigen', tussenstand = NULL, updated_at = now()`;
  if (auto) await sql`UPDATE client_prioriteiten_scan SET auto_ronde = now() WHERE client_slug = ${slug}`;
}

async function faal(slug: string, msg: string): Promise<void> {
  await sql`UPDATE client_prioriteiten_scan SET status = 'error', error = ${msg}, fase = '', updated_at = now() WHERE client_slug = ${slug}`;
}

function startHartslag(slug: string): () => void {
  const t = setInterval(() => {
    void sql`UPDATE client_prioriteiten_scan SET updated_at = now() WHERE client_slug = ${slug}`.catch(() => { /* stil */ });
  }, 30000);
  return () => clearInterval(t);
}

// ── Hulpjes ───────────────────────────────────────────────────────────────
const pad = (u: string) => (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || "");

/** Merk- en site-brede termen eruit: anders overlapt alles met alles. */
function isMerkterm(kw: string, naam: string, domein: string): boolean {
  const k = (kw || "").toLowerCase();
  const merk = (naam || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const dom = (domein || "").toLowerCase().replace(/^www\./, "").split(".")[0];
  if (merk && merk.length > 3 && k.includes(merk)) return true;
  if (dom && dom.length > 3 && k.includes(dom)) return true;
  return false;
}

/**
 * Intentie uit het zoekwoord. Bewust dezelfde woordenlijsten als de skill, en op
 * hele woorden gematcht: op losse letters maakte "vs" van "advies" een
 * vergelijkings-zoekwoord en "test" van "protest".
 */
const INTENT_WOORDEN: [string, string[]][] = [
  ["transactional", ["kopen", "bestellen", "offerte", "abonnement", "prijzen", "korting", "boeken", "afsluiten"]],
  ["lokaal-commercial", ["in de buurt", "bij mij", "regio", "amsterdam", "rotterdam", "utrecht", "den haag",
    "eindhoven", "groningen", "tilburg", "almere", "breda", "nijmegen", "haarlem", "arnhem"]],
  ["commercial", ["beste", "vergelijken", "review", "test", "alternatief", "vs", "top 10", "tips", "welke", "advies"]],
  ["navigational", ["login", "inloggen", "contact", "klantenservice"]],
  ["informational", ["wat is", "hoe werkt", "waarom", "uitleg", "betekenis", "verschil tussen", "soorten", "voorbeelden"]],
];
export function bepaalIntentie(keyword: string): string {
  const k = (keyword || "").toLowerCase();
  for (const [intent, woorden] of INTENT_WOORDEN) {
    for (const w of woorden) {
      if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(k)) return intent;
    }
  }
  return "lokaal-commercial";
}

/**
 * Merk-fit: past dit zoekwoord bij wat de klant wil zijn? Onder de 0,4 vliegt het
 * uit de lijst, hoe hoog het volume ook is. Dat is de hele reden dat de scan om
 * een propositie-zin vraagt.
 */
const BUDGET_WOORDEN = ["goedkop", "goedkoop", "voordelig", "budget", "lage prijs", "laagste prijs", "discount", "aanbieding", "afgeprijsd", "korting"];
const TEGEN_BUDGET = ["geen prijsvechter", "niet goedkoop", "niet de goedkoopste", "niet budget", "geen budget", "geen discount"];
const PREMIUM_PROP = ["premium", "luxe", "exclusief", "topkwaliteit", "hoogwaardig", "specialist"];
const PREMIUM_WOORDEN = ["premium", "luxe", "exclusief", "high-end", "topkwaliteit", "op maat"];

export function bepaalFit(keyword: string, kernwoorden: string[], propositie: string): number {
  const k = (keyword || "").toLowerCase();
  const p = (propositie || "").toLowerCase();
  let overlap = 0;
  for (const kw of kernwoorden) if (kw && k.includes(kw.toLowerCase())) overlap++;
  let base = Math.min(0.5 + 0.15 * overlap, 0.9);
  if (TEGEN_BUDGET.some((m) => p.includes(m)) && BUDGET_WOORDEN.some((b) => k.includes(b))) {
    return Math.round(Math.min(base, 0.25) * 100) / 100;
  }
  if (PREMIUM_PROP.some((m) => p.includes(m)) && PREMIUM_WOORDEN.some((b) => k.includes(b))) base = Math.min(base + 0.1, 1);
  if (overlap === 0 && !PREMIUM_PROP.some((m) => p.includes(m))) base = Math.min(base, 0.5);
  return Math.round(base * 100) / 100;
}

/** Kernwoorden uit het klantprofiel: waar gaat deze klant eigenlijk over? */
function kernwoordenUit(profiel: string, naam: string): string[] {
  const stop = new Set(["de", "het", "een", "en", "van", "voor", "met", "in", "op", "die", "dat", "wij", "we", "onze", "is", "zijn", "bij", "aan", "als", "ook", "naar", "door", "uit", "over", "meer", "worden", "wordt"]);
  const woorden = (profiel || "").toLowerCase().replace(/[^a-zà-ü0-9\s-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 4 && !stop.has(w));
  const telling = new Map<string, number>();
  for (const w of woorden) telling.set(w, (telling.get(w) || 0) + 1);
  const top = [...telling.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  const merk = (naam || "").toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return [...new Set([...top, ...merk])];
}

// ── Stap 1: uitlezen wat het dashboard al weet ────────────────────────────
async function stapEigen(slug: string, propositie: string, kern: string[]): Promise<Bevinding[]> {
  const uit: Bevinding[] = [];
  let n = 0;
  const id = (p: string) => `${p}${++n}`;

  // Wie zijn merknaam intikt heeft je al gevonden; daar valt niets te winnen.
  // De striking-distance-lens filterde dat al, deze twee niet, en daardoor stonden
  // merkregels bovenaan de lijst. Bij opruimen en interne links blijft een
  // merkzoekwoord wél staan: dáár betekent het echt werk (twee pagina's die om de
  // merknaam vechten is een probleem).
  const eigenaar = await getClientBySlug(slug).catch(() => null);
  const merk = (kw: string) => isMerkterm(kw, eigenaar?.name || "", eigenaar?.domain || "");

  // Lens 2, CTR-onderkans. Draait al als Meta & CTR; hier alleen uitgelezen.
  const meta = await getMetaKansen(slug).catch(() => []);
  for (const m of meta.slice(0, 40)) {
    if (!m.keyword || m.impressions < 500) continue;
    if (merk(m.keyword)) continue;
    const huidig = m.ctr / 100, verwacht = m.expectedCtr / 100;
    if (verwacht - huidig < 0.005) continue;
    uit.push({
      id: id("CTR"), type: "ctr_underperform",
      titel: `Veel vertoningen, te weinig klikken op ${pad(m.url)}`,
      url: pad(m.url), zoekwoord: m.keyword,
      maandvolume: Math.max(m.volume || 0, Math.round(m.impressions / 3)),
      huidigePositie: Math.round(m.position), targetPositie: Math.round(m.position),
      intentie: bepaalIntentie(m.keyword), relevanceFit: bepaalFit(m.keyword, kern, propositie),
      effort: 1, timeToEffect: 1, confidence: confidenceVoorLens("ctr_underperform"),
      ctrActueel: huidig, benchmarkCtr: verwacht,
      rationale: `Deze pagina wordt goed getoond op positie ${m.position.toFixed(1)}, maar de CTR is ${m.ctr.toFixed(1)}% terwijl ${m.expectedCtr.toFixed(1)}% normaal is voor die positie. Een betere titel en omschrijving pakken dat direct.`,
      bron: "Search Console, via het tabje Meta & CTR",
    });
  }

  // Lens 3, cannibalisatie. Draait al als Opruimen.
  const canni = await getCannibalAnalysis(slug).catch(() => null);
  for (const c of (canni?.result?.clusters || []).slice(0, 25)) {
    if (!c.keyword || (c.urls?.length || 0) < 2) continue;
    const beste = c.urls.reduce((a, b) => ((a.positie ?? 99) <= (b.positie ?? 99) ? a : b));
    uit.push({
      id: id("CAN"), type: "cannibalisatie",
      titel: `${c.urls.length} pagina's strijden om "${c.keyword}"`,
      url: pad(c.winnaar || beste.url || ""), zoekwoord: c.keyword,
      maandvolume: c.volume || 0,
      huidigePositie: Math.round(beste.positie ?? 0), targetPositie: Math.max(1, Math.round((beste.positie ?? 6) / 2)),
      intentie: bepaalIntentie(c.keyword), relevanceFit: bepaalFit(c.keyword, kern, propositie),
      effort: 4, timeToEffect: 2, confidence: confidenceVoorLens("cannibalisatie"),
      rationale: c.onderbouwing || `Meerdere pagina's ranken op dit zoekwoord, waardoor ze elkaar verdringen. ${c.actie || "Samenvoegen of omleiden naar de sterkste."}`,
      bron: "de opruimanalyse, via het tabje Opruimen",
    });
  }

  // Lens 9, interne links. Draait al als eigen tabje.
  const il = await getInternalLinksState(slug).catch(() => null);
  for (const t of (il?.result?.doelpaginas || []).slice(0, 20)) {
    const doel = t as { url?: string; primairZoekwoord?: string; huidigePositie?: number; impressies?: number };
    if (!doel.url) continue;
    const kw = doel.primairZoekwoord || "";
    uit.push({
      id: id("LNK"), type: "interne_links",
      titel: `Te weinig interne links naar ${pad(doel.url)}`,
      url: pad(doel.url), zoekwoord: kw,
      maandvolume: doel.impressies || 0,
      huidigePositie: Math.round(doel.huidigePositie || 0), targetPositie: Math.max(1, Math.round((doel.huidigePositie || 10) / 2)),
      intentie: bepaalIntentie(kw), relevanceFit: bepaalFit(kw, kern, propositie),
      effort: 3, timeToEffect: 2, confidence: confidenceVoorLens("interne_links"),
      rationale: "Deze pagina krijgt weinig interne links, terwijl hij commercieel belangrijk is. Meer links vanaf sterke pagina's duwt hem omhoog zonder nieuwe content.",
      bron: "de interne-link-analyse, via het tabje Interne links",
    });
  }

  // Lens 5, content gaps. De kansenlijst die al per klant verzameld wordt.
  const gaps = await getOpportunities(slug).catch(() => []);
  for (const g of gaps.slice(0, 30)) {
    if (!g.keyword || !(g.volume || 0)) continue;
    if (merk(g.keyword)) continue;
    uit.push({
      id: id("GAP"), type: "content_gap",
      titel: `Geen pagina voor "${g.keyword}"`,
      url: "", zoekwoord: g.keyword, maandvolume: g.volume || 0,
      huidigePositie: 0, targetPositie: 5,
      intentie: bepaalIntentie(g.keyword), relevanceFit: bepaalFit(g.keyword, kern, propositie),
      effort: 6, timeToEffect: 4, confidence: confidenceVoorLens("content_gap"),
      rationale: g.reason || "Er is zoekvraag op dit onderwerp, maar geen eigen pagina die erop mikt.",
      bron: "de kansenlijst (Ahrefs plus concurrenten)",
    });
  }
  return uit;
}

// ── Stap 2: verse cijfers voor de lenzen die nog niet als motor bestaan ───
async function stapVers(slug: string, propositie: string, kern: string[], startId: number): Promise<Bevinding[]> {
  const client = await getClientBySlug(slug);
  const domein = client?.domain || "";
  const uit: Bevinding[] = [];
  let n = startId;
  const id = (p: string) => `${p}${++n}`;
  if (!domein) return uit;

  // Lens 1, striking distance: positie 5 tot 20 met serieuze vertoningen. De twee
  // bronnen worden ontdubbeld op zoekwoord plus pagina, zoals de skill voorschrijft.
  const gezien = new Set<string>();
  const gsc = await getGscPageOpportunities(domein, 90).catch(() => []);
  for (const p of gsc) {
    const kw = p.bestKeyword || "";
    const pos = p.bestPosition ?? p.position;
    if (!kw || !pos || pos < 5 || pos > 20) continue;
    // Vertoningen van het ZOEKWOORD, niet van de pagina. Stond hier eerst wel: een
    // pagina die op twintig zoekwoorden samen 200.000 keer verschijnt werd zo één
    // zoekwoord van 200.000, en dat schoof onzin naar de top van de lijst.
    const kwVertoningen = p.bestImpressions || 0;
    if (kwVertoningen < 300) continue;              // 100/maand over 90 dagen
    if (isMerkterm(kw, client?.name || "", domein)) continue;
    const sleutel = `${kw}|${pad(p.url)}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("SD"), type: "striking_distance",
      titel: `"${kw}" staat op ${pos.toFixed(0)}, net buiten beeld`,
      url: pad(p.url), zoekwoord: kw,
      maandvolume: Math.max(p.bestVolume || 0, Math.round(kwVertoningen / 3)),
      huidigePositie: Math.round(pos), targetPositie: 3,
      intentie: bepaalIntentie(kw), relevanceFit: bepaalFit(kw, kern, propositie),
      effort: 3, timeToEffect: 2, confidence: confidenceVoorLens("striking_distance"),
      rationale: `Deze pagina staat al op positie ${pos.toFixed(0)} en wordt goed getoond. Van pagina 2 naar de top 3 is de kortste weg naar meer bezoekers, want de pagina bestaat al.`,
      bron: "Search Console, laatste 90 dagen",
    });
  }

  // Lens 1 en 4 uit Ahrefs: striking distance die GSC mist, plus wegzakkers.
  if (ahrefsConfigured()) {
    const kws = await getSiteOrganicKeywords(domein, "nl", 400).catch(() => []);
    for (const k of kws) {
      if (!k.keyword || k.branded) continue;
      if (isMerkterm(k.keyword, client?.name || "", domein)) continue;
      const pos = k.position ?? 0, vorig = k.positionPrev ?? 0;
      const vol = k.volume || 0;
      if (vol < 100) continue;
      const sleutel = `${k.keyword}|${pad(k.url || "")}`;

      // Verouderde topper: stond in de top 5, staat nu 6 tot 20.
      if (vorig && vorig <= 5 && pos >= 6 && pos <= 20) {
        uit.push({
          id: id("OUD"), type: "verouderde_topper",
          titel: `"${k.keyword}" zakt weg, van ${vorig} naar ${pos}`,
          url: pad(k.url || ""), zoekwoord: k.keyword, maandvolume: vol,
          huidigePositie: Math.round(pos), targetPositie: Math.max(1, Math.round(vorig)),
          intentie: bepaalIntentie(k.keyword), relevanceFit: bepaalFit(k.keyword, kern, propositie),
          effort: 4, timeToEffect: 2, confidence: confidenceVoorLens("verouderde_topper"),
          rationale: `Deze pagina stond op positie ${vorig} en is gezakt naar ${pos}. Terugwinnen wat je had is bijna altijd goedkoper dan iets nieuws bouwen; meestal is de content ingehaald door een concurrent.`,
      bron: "Ahrefs, positie nu tegen vorige meting",
        });
        gezien.add(sleutel);
        continue;
      }
      if (pos >= 5 && pos <= 20 && !gezien.has(sleutel)) {
        gezien.add(sleutel);
        uit.push({
          id: id("SD"), type: "striking_distance",
          titel: `"${k.keyword}" staat op ${pos}, net buiten beeld`,
          url: pad(k.url || ""), zoekwoord: k.keyword, maandvolume: vol,
          huidigePositie: Math.round(pos), targetPositie: 3,
          intentie: bepaalIntentie(k.keyword), relevanceFit: bepaalFit(k.keyword, kern, propositie),
          effort: 3, timeToEffect: 2, confidence: confidenceVoorLens("striking_distance"),
          rationale: `Positie ${pos} met ${vol} zoekopdrachten per maand. De pagina bestaat al, dus dit is bijwerken in plaats van bouwen.`,
      bron: "Ahrefs, organische zoekwoorden",
        });
      }
    }

    // Lens 12, AI-zichtbaarheid. Draait al bij de KPI's; hier als kans geduid.
    const ai = await getAiResponsesCount(domein).catch(() => []);
    const totaal = ai.reduce((s, a) => s + (a.citations || 0), 0);
    if (ai.length && totaal < 10) {
      uit.push({
        id: id("AI"), type: "aeo",
        titel: "AI-antwoorden noemen deze klant nauwelijks",
        url: "", zoekwoord: client?.name || domein, maandvolume: 500,
        huidigePositie: 0, targetPositie: 5,
        intentie: "commercial", relevanceFit: 0.8,
        effort: 7, timeToEffect: 4, confidence: confidenceVoorLens("aeo"),
        rationale: `Over alle AI-platforms samen wordt deze site ${totaal} keer aangehaald. Klanten zoeken steeds vaker via AI; wie daar niet genoemd wordt, bestaat in dat kanaal niet.`,
      bron: "Ahrefs Brand Radar, via de KPI's",
      });
    }
  }
  return uit;
}

// ── Stap 4: de scorecard en de samenvatting ──────────────────────────────
const LENS_NAMEN: [string, string][] = [
  ["striking_distance", "Zoekwoorden net buiten de top 5"],
  ["ctr_underperform", "Veel vertoningen, weinig klikken"],
  ["cannibalisatie", "Pagina's die elkaar in de weg zitten"],
  ["verouderde_topper", "Oude toppers die wegzakken"],
  ["content_gap", "Content-gaten"],
  ["interne_links", "Pagina's met te weinig interne links"],
  ["aeo", "Zichtbaarheid in AI-antwoorden"],
];
const NIET_AANGESLOTEN: [string, string][] = [
  ["featured_snippet", "Kans op het antwoordblok bovenaan"],
  ["site_audit", "Technische fouten"],
  ["schema_gap", "Ontbrekende structured data"],
  ["backlinks", "Kapotte en verdwenen backlinks"],
];

function bouwLenzen(regels: Bevinding[]): Lens[] {
  const lenzen: Lens[] = LENS_NAMEN.map(([sleutel, naam]) => {
    const eigen = regels.filter((r) => r.type === sleutel && r.tier !== "SKIP");
    const urgent = eigen.filter((r) => r.tier === "1").length;
    const status: Lens["status"] = urgent > 0 ? "kritiek" : eigen.length > 0 ? "aandacht" : "pass";
    return {
      sleutel, naam, status, gevonden: eigen.length,
      toelichting: eigen.length === 0 ? "Niets gevonden dat aandacht vraagt."
        : urgent > 0 ? `${eigen.length} gevonden, waarvan ${urgent} deze week op te pakken.`
        : `${eigen.length} gevonden, geen spoed.`,
    };
  });
  for (const [sleutel, naam] of NIET_AANGESLOTEN) {
    lenzen.push({
      sleutel, naam, status: "niet-aangesloten", gevonden: 0,
      toelichting: "Deze bril zit wel in de methode, maar de bron is nog niet aan het dashboard gekoppeld. Hij telt dus niet mee in de uitkomst.",
    });
  }
  return lenzen;
}

function bouwSamenvatting(regels: Bevinding[], uplift: number, delta: PrioResult["delta"]): string {
  const t1 = regels.filter((r) => r.tier === "1").length;
  const t2 = regels.filter((r) => r.tier === "2").length;
  const skip = regels.filter((r) => r.tier === "SKIP").length;
  const stukken: string[] = [];
  stukken.push(t1
    ? `${t1} ${t1 === 1 ? "ding" : "dingen"} kun je deze week oppakken, ${t2} deze maand.`
    : `Niets dat deze week moet; ${t2} ${t2 === 1 ? "punt" : "punten"} voor deze maand.`);
  if (uplift > 0) stukken.push(`Samen goed voor naar schatting ${uplift} extra bezoekers per maand, gewogen naar hoe zeker we het weten. Dat is een verwachting, geen belofte.`);
  if (skip) stukken.push(`${skip} ${skip === 1 ? "kans is" : "kansen zijn"} bewust afgevallen, met de reden erbij.`);
  if (delta && delta.vorigeDatum) {
    stukken.push(delta.nieuw || delta.opgelost
      ? `Sinds de vorige scan: ${delta.nieuw} nieuw, ${delta.opgelost} opgelost.`
      : "Sinds de vorige scan is er niets veranderd.");
  }
  return stukken.join(" ");
}

// ── De run ────────────────────────────────────────────────────────────────
export async function runPrioriteitenScan(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const stopHartslag = startHartslag(slug);
  try {
    const client = await getClientBySlug(slug);
    if (!client) { await faal(slug, "Klant niet gevonden."); return; }
    const r = await readRow(slug);
    const propositie = r?.propositie || "";
    const kern = kernwoordenUit(client.seoProfile || "", client.name || "");

    // Stap 1
    let bevindingen: Bevinding[] = r?.tussenstand || [];
    if (!r?.tussenstand || r.fase === "eigen") {
      bevindingen = await stapEigen(slug, propositie, kern);
      await sql`UPDATE client_prioriteiten_scan SET fase = 'vers', tussenstand = ${JSON.stringify(bevindingen)}, updated_at = now() WHERE client_slug = ${slug}`;
    }

    // Stap 2
    const verseNodig = !r?.tussenstand || r.fase === "eigen" || r.fase === "vers";
    if (verseNodig) {
      const vers = await stapVers(slug, propositie, kern, bevindingen.length);
      bevindingen = [...bevindingen, ...vers];
      await sql`UPDATE client_prioriteiten_scan SET fase = 'scoren', tussenstand = ${JSON.stringify(bevindingen)}, updated_at = now() WHERE client_slug = ${slug}`;
    }

    // Stap 3, rekenen. Geen model: een som hoort niet geschat te worden.
    for (const b of bevindingen) scoreBevinding(b);
    wijsTiersToe(bevindingen);
    bevindingen.sort((a, b) => {
      const rang = (t?: string) => (t === "SKIP" ? 9 : Number(t || 9));
      return rang(a.tier) - rang(b.tier) || (b.roiScore ?? 0) - (a.roiScore ?? 0);
    });
    await sql`UPDATE client_prioriteiten_scan SET fase = 'duiden', tussenstand = ${JSON.stringify(bevindingen)}, updated_at = now() WHERE client_slug = ${slug}`;

    // Stap 4, duiden plus het verschil met de vorige scan.
    const vorige = r?.result || null;
    const vorigeSleutels = new Set((vorige?.regels || []).filter((x) => x.tier !== "SKIP").map((x) => `${x.type}|${x.zoekwoord}|${x.url}`));
    const nuSleutels = new Set(bevindingen.filter((x) => x.tier !== "SKIP").map((x) => `${x.type}|${x.zoekwoord}|${x.url}`));
    const regels: PrioRegel[] = bevindingen.map((b) => ({
      ...b, nieuw: vorige ? !vorigeSleutels.has(`${b.type}|${b.zoekwoord}|${b.url}`) : false,
    }));
    const opgelost = [...vorigeSleutels].filter((k) => !nuSleutels.has(k)).length;
    const delta = vorige
      ? { nieuw: regels.filter((x) => x.nieuw && x.tier !== "SKIP").length, opgelost, vorigeDatum: vorige.generatedAt }
      : null;

    const uplift = verwachteUplift(bevindingen);
    const result: PrioResult = {
      samenvatting: bouwSamenvatting(bevindingen, uplift, delta),
      propositie,
      verwachteKlikkenPerMaand: uplift,
      lenzen: bouwLenzen(bevindingen),
      regels,
      delta,
      generatedAt: new Date().toISOString(),
    };
    await sql`
      UPDATE client_prioriteiten_scan
      SET status = 'done', error = NULL, fase = '', tussenstand = NULL,
          vorig_result = result, result = ${JSON.stringify(result)}, updated_at = now()
      WHERE client_slug = ${slug}`;
  } catch (e) {
    await faal(slug, (e as Error).message || "Onbekende fout.");
  } finally {
    stopHartslag();
  }
}

/**
 * Cron-vangnet. Twee taken: runs oppakken die zonder hartslag zijn achtergebleven
 * (afgekapt venster, deploy), en één keer per maand vanzelf een verse scan starten
 * per klant.
 */
export async function processPrioQueue(): Promise<{ hervat: string[]; gestart: string[] }> {
  await ensureSchema();
  await ensureTable();
  await setSetting(SETTING_PRIO_CRON_TIK, new Date().toISOString()).catch(() => { /* stil */ });

  const hervat: string[] = [];
  const { rows: vast } = await sql`
    SELECT client_slug FROM client_prioriteiten_scan
    WHERE status = 'running' AND updated_at < now() - interval '3 minutes'
    ORDER BY updated_at ASC LIMIT 2`;
  for (const r of vast) {
    const slug = String(r.client_slug);
    hervat.push(slug);
    await runPrioriteitenScan(slug);
  }

  // Maandelijkse ronde: alleen als er niets loopt en de vorige automatische ronde
  // meer dan dertig dagen geleden is. Eén klant per tik, zodat een cron-venster
  // nooit vol raakt en de Ahrefs-credits gespreid worden.
  const gestart: string[] = [];
  if (!hervat.length) {
    const { rows } = await sql`
      SELECT c.slug FROM clients c
      LEFT JOIN client_prioriteiten_scan p ON p.client_slug = c.slug
      WHERE (p.status IS NULL OR p.status <> 'running')
        AND (p.auto_ronde IS NULL OR p.auto_ronde < now() - interval '30 days')
      ORDER BY p.auto_ronde ASC NULLS FIRST LIMIT 1`;
    for (const r of rows) {
      const slug = String(r.slug);
      gestart.push(slug);
      await startPrioRun(slug, true);
      await runPrioriteitenScan(slug);
    }
  }
  return { hervat, gestart };
}
