import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getGscQueryPagePairs, getGscQueryPagePairsCompare, getGscKeywordUrlFlips } from "./google";
import { getPageSchemaStatusAll } from "./page-schema";
import { getSiteOrganicKeywords, getAiResponsesCount, ahrefsConfigured, getKeywordsOverview, getBrokenBacklinks } from "./ahrefs";
import { getMetaKansen } from "./meta-ctr";
import { getCannibalAnalysis } from "./cannibal-redirect";
import { getInternalLinksState, markInternalLinksRunning, runInternalLinks } from "./internal-links";
import { anthropicConfigured } from "./anthropic";
import { getOpportunities } from "./keyword-opportunities";
import { getOrgData } from "./org-data";
import {
  scoreBevinding, wijsTiersToe, confidenceVoorLens, verwachteUplift,
  ctrVoorPositie, type Bevinding,
} from "./prioriteiten-score";
import {
  bouwKlantContext, weeg, bepaalIntentie, bepaalFit, type KlantContext,
} from "./prioriteiten-context";
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
  // "pass" betekent: gekeken, niets gevonden. "niet-gedraaid" betekent: de
  // onderliggende analyse bestaat wel, maar is voor deze klant nog nooit gedraaid,
  // dus er is niet gekeken. Dat verschil moet zichtbaar zijn, anders leest een
  // lege lijst als "hier is niets te halen" terwijl niemand heeft gekeken.
  status: "pass" | "aandacht" | "kritiek" | "niet-aangesloten" | "niet-gedraaid";
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

// De weging (hoe koopgericht is dit zoekwoord, past het bij deze klant) staat in
// lib/prioriteiten-context.ts. Hier stonden twee losse functies plus een vaste
// lijst van veertien grote steden; die lijst kende het werkgebied van geen enkele
// klant buiten de Randstad. Hier alleen nog doorgegeven voor wie ze importeert.
export { bepaalIntentie, bepaalFit };

// ── Stap 1: uitlezen wat het dashboard al weet ────────────────────────────
async function stapEigen(slug: string, ctx: KlantContext): Promise<Bevinding[]> {
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
      ...weeg(m.keyword, ctx),
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
      ...weeg(c.keyword, ctx),
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
      ...weeg(kw, ctx),
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
      ...weeg(g.keyword, ctx),
      effort: 6, timeToEffect: 4, confidence: confidenceVoorLens("content_gap"),
      rationale: g.reason || "Er is zoekvraag op dit onderwerp, maar geen eigen pagina die erop mikt.",
      bron: "de kansenlijst (Ahrefs plus concurrenten)",
    });
  }
  return uit;
}

// ── Stap 2: verse cijfers voor de lenzen die nog niet als motor bestaan ───
async function stapVers(slug: string, ctx: KlantContext, startId: number): Promise<Bevinding[]> {
  const client = await getClientBySlug(slug);
  const domein = client?.domain || "";
  const uit: Bevinding[] = [];
  let n = startId;
  const id = (p: string) => `${p}${++n}`;
  if (!domein) return uit;

  // Lens 1, striking distance: positie 5 tot 20 met serieuze vertoningen. De twee
  // bronnen worden ontdubbeld op zoekwoord plus pagina, zoals de skill voorschrijft.
  const gezien = new Set<string>();
  // ELK zoekwoord per pagina, niet alleen het grootste. Hier stond eerst
  // getGscPageOpportunities, en dat houdt per pagina één zoekwoord over (dat met
  // de meeste vertoningen) en gooit de rest weg. Daarmee kon deze bril nooit meer
  // dan één kans per pagina vinden: bij een site van 22 pagina's dus hooguit 22
  // kandidaten, en na de positiefilter bleven er twee over. Terwijl juist het
  // tweede en derde zoekwoord van een pagina vaak net buiten de top 10 hangen.
  // Bewust getGscQueryPagePairs en niet de kleine variant: die haalt één keer
  // 5000 rijen op, en Google sorteert op klikken. De rijen die we zoeken (weinig
  // klikken, wel vertoningen) staan juist onderaan en vielen daar buiten. Deze
  // bladert door tot 50.000 rijen en heeft een kort geheugen, dus hij is ook niet
  // duurder als een ander scherm hem net ophaalde.
  const matrix = await getGscQueryPagePairs(domein, 90).catch(() => []);
  const kandidaten = matrix
    .filter((m) => m.keyword && m.page && m.position >= 5 && m.position <= 20
      && m.impressions >= 100                      // ruim 30 vertoningen per maand
      && !isMerkterm(m.keyword, client?.name || "", domein))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 150);                                // grote sites niet laten ontploffen

  // Zoekvolume erbij waar Ahrefs het weet, in één call. Weet hij het niet, dan
  // blijven de vertoningen de basis; dat is een meting, geen schatting.
  const volMap = new Map<string, number>();
  if (ahrefsConfigured() && kandidaten.length) {
    const uniek = [...new Set(kandidaten.map((m) => m.keyword))].slice(0, 100);
    const ov = await getKeywordsOverview(uniek, "nl").catch(() => []);
    for (const o of ov) if (o.volume != null) volMap.set(o.keyword.toLowerCase(), o.volume);
  }

  for (const m of kandidaten) {
    const sleutel = `${m.keyword}|${pad(m.page)}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("SD"), type: "striking_distance",
      titel: `"${m.keyword}" staat op ${m.position.toFixed(0)}, net buiten beeld`,
      url: pad(m.page), zoekwoord: m.keyword,
      maandvolume: Math.max(volMap.get(m.keyword.toLowerCase()) || 0, Math.round(m.impressions / 3)),
      huidigePositie: Math.round(m.position), targetPositie: 3,
      ...weeg(m.keyword, ctx),
      effort: 3, timeToEffect: 2, confidence: confidenceVoorLens("striking_distance"),
      rationale: `Deze pagina staat al op positie ${m.position.toFixed(0)} en werd de afgelopen 90 dagen ${m.impressions} keer getoond op dit zoekwoord. Van pagina 2 naar de top 3 is de kortste weg naar meer bezoekers, want de pagina bestaat al.`,
      bron: "Search Console, laatste 90 dagen",
    });
  }

  // Lens 1 en 4 uit Ahrefs: striking distance die GSC mist, plus wegzakkers.
  if (ahrefsConfigured()) {
    // Het vergelijkmoment MOET mee, anders vraagt Ahrefs de vorige positie niet
    // op en is `positionPrev` altijd leeg. De wegzakker-toets hieronder begint met
    // `if (vorig && ...)` en was daardoor sinds de bouw dood: die bril meldde bij
    // elke klant "niets gevonden dat aandacht vraagt" zonder ooit te kunnen
    // vinden. Negentig dagen terug, zelfde venster als de rest van de scan.
    const toen = new Date(); toen.setDate(toen.getDate() - 90);
    const kws = await getSiteOrganicKeywords(domein, "nl", 400, toen.toISOString().slice(0, 10)).catch(() => []);
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
          ...weeg(k.keyword, ctx),
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
          ...weeg(k.keyword, ctx),
          effort: 3, timeToEffect: 2, confidence: confidenceVoorLens("striking_distance"),
          rationale: `Positie ${pos} met ${vol} zoekopdrachten per maand. De pagina bestaat al, dus dit is bijwerken in plaats van bouwen.`,
      bron: "Ahrefs, organische zoekwoorden",
        });
      }
    }

  }

  // ── Dezelfde brillen, maar op Search Console ─────────────────────────────
  // Ahrefs is blind voor kleine lokale sites: van een hovenier kent hij vier
  // zoekwoorden terwijl Search Console er honderden ziet. Alles hieronder werkt
  // dus voor élke klant, groot of klein, en kost geen Ahrefs-credits.

  // Wegzakkers: stond in de top 5, staat nu lager. Zelfde vraag als de
  // Ahrefs-variant hierboven, maar dan op cijfers die er voor elke klant zijn.
  const vergelijk = await getGscQueryPagePairsCompare(domein, 90).catch(() => []);
  for (const v of vergelijk) {
    if (v.positieVorig == null || v.positieVorig > 5) continue;
    if (v.position <= 5 || v.position > 25) continue;
    if (v.impressions < 100 && v.vertoningenVorig < 100) continue;
    if (isMerkterm(v.keyword, client?.name || "", domein)) continue;
    const sleutel = `${v.keyword}|${pad(v.page)}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("OUD"), type: "verouderde_topper",
      titel: `"${v.keyword}" zakt weg, van ${v.positieVorig} naar ${v.position}`,
      url: pad(v.page), zoekwoord: v.keyword,
      maandvolume: Math.round(Math.max(v.impressions, v.vertoningenVorig) / 3),
      huidigePositie: Math.round(v.position), targetPositie: Math.max(1, Math.round(v.positieVorig)),
      ...weeg(v.keyword, ctx),
      effort: 4, timeToEffect: 2, confidence: confidenceVoorLens("verouderde_topper"),
      rationale: `Deze pagina stond de vorige periode op positie ${v.positieVorig} en staat nu op ${v.position}. Terugwinnen wat je had is bijna altijd goedkoper dan iets nieuws bouwen; meestal is de content ingehaald door een concurrent.`,
      bron: "Search Console, laatste 90 dagen tegen de 90 daarvoor",
    });
  }

  // Content-gaten: er is aantoonbaar vraag (vertoningen), maar geen pagina die er
  // goed op mikt. De Ahrefs-variant hiervan valt stil zonder concurrentenlijst;
  // deze niet, want hij leest wat Google al over deze site laat zien.
  for (const m of matrix) {
    if (!m.keyword || !m.page) continue;
    if (m.position <= 20 || m.position > 60) continue;
    if (m.impressions < 200) continue;
    if (isMerkterm(m.keyword, client?.name || "", domein)) continue;
    const sleutel = `gap|${m.keyword}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("GAP"), type: "content_gap",
      titel: `Vraag naar "${m.keyword}", maar geen pagina die erop mikt`,
      url: "", zoekwoord: m.keyword,
      maandvolume: Math.round(m.impressions / 3),
      huidigePositie: 0, targetPositie: 5,
      ...weeg(m.keyword, ctx),
      effort: 6, timeToEffect: 4, confidence: confidenceVoorLens("content_gap"),
      rationale: `Google toont deze site hier al ${m.impressions} keer op in 90 dagen, maar blijft steken rond positie ${Math.round(m.position)} met ${pad(m.page)}. Dat is een pagina die er niet echt over gaat; een eigen pagina op dit onderwerp pakt die vraag wel.`,
      bron: "Search Console, laatste 90 dagen",
    });
  }

  // Cannibalisatie op het enige harde signaal: wisselt Google over de maanden van
  // URL op hetzelfde zoekwoord? Dat betekent dat hij niet weet welke pagina moet
  // ranken. Deze functie lag al in de code maar werd door de scan niet gebruikt;
  // de bril leunde op een AI-analyse die iemand apart moest starten.
  const flips = await getGscKeywordUrlFlips(domein, 3).catch(() => []);
  const vertoningenPer = new Map<string, number>();
  for (const m of matrix) vertoningenPer.set(m.keyword, (vertoningenPer.get(m.keyword) || 0) + m.impressions);
  for (const f of flips) {
    if (f.flips < 2 || f.topUrls.length < 2) continue;
    if (isMerkterm(f.keyword, client?.name || "", domein)) continue;
    const impr = vertoningenPer.get(f.keyword) || 0;
    if (impr < 100) continue;
    const sleutel = `flip|${f.keyword}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("CAN"), type: "cannibalisatie",
      titel: `Google wisselt van pagina op "${f.keyword}"`,
      url: pad(f.topUrls[0] || ""), zoekwoord: f.keyword,
      maandvolume: Math.round(impr / 3),
      huidigePositie: 0, targetPositie: 3,
      ...weeg(f.keyword, ctx),
      effort: 4, timeToEffect: 2, confidence: 0.9,
      rationale: `Over de laatste drie maanden liet Google hier ${f.topUrls.length} verschillende pagina's van deze site voor zien: ${f.topUrls.map((u) => pad(u)).join(", ")}. Wisselen betekent twijfel, en twijfel kost posities. Kies één pagina en laat de andere ernaar wijzen.`,
      bron: "Search Console, wisselende pagina's over drie maanden",
    });
  }

  // Structured data: pagina's die vertoningen krijgen maar waarvoor nog nooit een
  // schema-advies is gemaakt. De motor hiervoor staat al in het dashboard; deze
  // bril stond als "niet aangesloten" terwijl de data er gewoon was.
  const schemaStatus = await getPageSchemaStatusAll(slug).catch(() => ({} as Record<string, string>));
  const perPagina = new Map<string, number>();
  for (const m of matrix) perPagina.set(m.page, (perPagina.get(m.page) || 0) + m.impressions);
  const zonderSchema = [...perPagina.entries()]
    .filter(([u, impr]) => impr >= 300 && (schemaStatus[urlKey(u)] || "idle") !== "done")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  for (const [u, impr] of zonderSchema) {
    uit.push({
      id: id("SCH"), type: "schema_gap",
      titel: `Nog geen structured data op ${pad(u)}`,
      url: pad(u), zoekwoord: "",
      maandvolume: Math.round(impr / 3),
      huidigePositie: 0, targetPositie: 0,
      intentie: "commercial", relevanceFit: 0.7,
      effort: 2, timeToEffect: 2, confidence: 0.9,
      rationale: `Deze pagina werd in 90 dagen ${impr} keer getoond, maar heeft nog geen structured data. Daarmee mist Google de kans om er een rijker zoekresultaat van te maken, en AI-antwoorden pakken de feiten er minder makkelijk uit.`,
      bron: "het schema-tabje, plus Search Console voor het belang",
    });
  }

  // Antwoordblok: vraag-zoekwoorden waar de site al op de eerste pagina staat.
  // Dat is precies de plek waar het blok bovenaan te pakken is; verder weg dan
  // positie 10 wordt het een gok, en een gok hoort niet in deze lijst.
  const VRAAGWOORD = /^(hoe|wat|waarom|wanneer|welke|wie|waar|kan|mag|moet|hoeveel|is het|zijn er)\b/i;
  for (const m of matrix) {
    if (!VRAAGWOORD.test(m.keyword)) continue;
    if (m.position < 2 || m.position > 10) continue;
    if (m.impressions < 150) continue;
    if (isMerkterm(m.keyword, client?.name || "", domein)) continue;
    const sleutel = `fs|${m.keyword}|${pad(m.page)}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      id: id("FS"), type: "featured_snippet",
      titel: `Kans op het antwoordblok bij "${m.keyword}"`,
      url: pad(m.page), zoekwoord: m.keyword,
      maandvolume: Math.round(m.impressions / 3),
      huidigePositie: Math.round(m.position), targetPositie: 1,
      ...weeg(m.keyword, ctx),
      effort: 2, timeToEffect: 1, confidence: confidenceVoorLens("featured_snippet"),
      rationale: `Dit is een vraag, en deze pagina staat er al op ${Math.round(m.position)}. Google pakt het blok bovenaan bijna altijd van de eerste pagina. Zet het antwoord in twee of drie zinnen direct onder de kop, en de kans is er.`,
      bron: "Search Console, vraag-zoekwoorden op de eerste pagina",
    });
  }

  if (ahrefsConfigured()) {
    // Kapotte backlinks: verdiende autoriteit die in een 404 valt. Eén omleiding
    // en je hebt hem terug; goedkoper dan welke linkbuilding ook.
    const kapot = await getBrokenBacklinks(domein, 100).catch(() => []);
    const perDoel = new Map<string, { n: number; beste: number; van: string }>();
    for (const b of kapot) {
      const p = pad(b.naar);
      const cur = perDoel.get(p) || { n: 0, beste: 0, van: b.van };
      cur.n += 1;
      if ((b.domainRating || 0) > cur.beste) { cur.beste = b.domainRating || 0; cur.van = b.van; }
      perDoel.set(p, cur);
    }
    for (const [doel, info] of [...perDoel.entries()].sort((a, b) => b[1].beste - a[1].beste).slice(0, 10)) {
      uit.push({
        id: id("BL"), type: "backlinks",
        titel: `${info.n} ${info.n === 1 ? "kapotte link wijst" : "kapotte links wijzen"} naar ${doel}`,
        url: doel, zoekwoord: "",
        maandvolume: Math.max(50, info.n * 50),
        huidigePositie: 0, targetPositie: 0,
        intentie: "commercial", relevanceFit: 0.7,
        effort: 1, timeToEffect: 1, confidence: 0.9,
        rationale: `Andere sites linken hier naartoe, maar de pagina bestaat niet meer. De sterkste verwijzing komt van ${info.van}${info.beste ? ` (domeinsterkte ${Math.round(info.beste)})` : ""}. Eén omleiding naar de juiste pagina en die waarde staat weer aan; dat is goedkoper dan welke linkbuilding ook.`,
        bron: "Ahrefs, kapotte backlinks",
      });
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
  ["schema_gap", "Ontbrekende structured data"],
  ["backlinks", "Kapotte en verdwenen backlinks"],
  ["featured_snippet", "Kans op het antwoordblok bovenaan"],
];
const NIET_AANGESLOTEN: [string, string][] = [
  ["site_audit", "Technische fouten"],
];

/**
 * Drie lenzen lezen niet zelf, maar halen hun bevindingen uit een analyse die
 * elders in het dashboard draait. Is die voor deze klant nooit gedraaid, dan komt
 * er niets uit, en dat is iets ánders dan "niets gevonden". Zonder dit onderscheid
 * meldt de scan "pass, niets dat aandacht vraagt" over een bril die dicht zat.
 */
// Alleen interne links staat hier nog. Opruimen en content-gaten hadden ook zo'n
// afhankelijkheid, maar die hebben nu een eigen Search Console-bron en vinden dus
// altijd iets als er iets te vinden is.
const LENS_BRON: Record<string, string> = {
  interne_links: "de interne-link-analyse, op het tabje Interne links",
};
async function bronnenGedraaid(slug: string): Promise<Set<string>> {
  const [canni, links, gaps] = await Promise.all([
    getCannibalAnalysis(slug).catch(() => null),
    getInternalLinksState(slug).catch(() => null),
    getOpportunities(slug).catch(() => []),
  ]);
  const uit = new Set<string>();
  if (canni?.result?.clusters?.length) uit.add("cannibalisatie");
  if (links?.result?.doelpaginas?.length) uit.add("interne_links");
  if (gaps.length) uit.add("content_gap");
  return uit;
}

/**
 * Ontbreekt de interne-link-analyse, start hem dan zelf in plaats van Maarten een
 * knop te laten zoeken. Bewust fire-and-forget en bewust alleen als er niets
 * loopt: de analyse zet zichzelf meteen op "running", dus een tweede scan start
 * hem niet opnieuw. Hij telt mee vanaf de volgende scan, en dat staat ook zo in
 * de toelichting van die bril.
 */
async function startOntbrekendeAnalyses(slug: string, gedraaid: Set<string>): Promise<boolean> {
  if (gedraaid.has("interne_links")) return false;
  if (!anthropicConfigured()) return false;
  const st = await getInternalLinksState(slug).catch(() => null);
  if (st?.status === "running") return true;
  try {
    await markInternalLinksRunning(slug, []);
    void runInternalLinks(slug, []).catch(() => { /* de bril meldt het vanzelf */ });
    return true;
  } catch { return false; }
}

function bouwLenzen(regels: Bevinding[], gedraaid: Set<string>, gestart: boolean): Lens[] {
  const lenzen: Lens[] = LENS_NAMEN.map(([sleutel, naam]) => {
    const eigen = regels.filter((r) => r.type === sleutel && r.tier !== "SKIP");
    const urgent = eigen.filter((r) => r.tier === "1").length;
    if (!eigen.length && LENS_BRON[sleutel] && !gedraaid.has(sleutel)) {
      return {
        sleutel, naam, status: "niet-gedraaid" as const, gevonden: 0,
        toelichting: gestart
          ? `Hier is nog niet gekeken, maar ik heb ${LENS_BRON[sleutel]} zojuist voor je gestart. Die draait nu; bij de volgende scan telt deze bril mee.`
          : `Hier is niet gekeken: ${LENS_BRON[sleutel]} is voor deze klant nog niet gedraaid. Draai die eerst, dan telt deze bril mee.`,
      };
    }
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

/**
 * De klantcontext voor deze run: waar gaat deze klant over, wat verkoopt hij, en
 * waar werkt hij? Bewust uit gemeten data (Search Console, de eigen pagina's, de
 * bedrijfsgegevens) en niet uit een vaste lijst, want een vaste lijst kent geen
 * enkele klant buiten de vier grote steden.
 *
 * De Search Console-aanroep is dezelfde als die stap 2 doet, en die heeft een kort
 * geheugen; deze regel kost dus geen extra opvraag.
 */
async function bouwContextVoor(slug: string, domein: string, profiel: string, naam: string, propositie: string): Promise<KlantContext> {
  const [matrix, org] = await Promise.all([
    domein ? getGscQueryPagePairs(domein, 90).catch(() => []) : Promise.resolve([]),
    getOrgData(slug).catch(() => null),
  ]);
  const d = org?.data;
  const extraPlaatsen = [
    ...(d?.plaats ? [d.plaats] : []),
    ...(d?.areaServed || []),
    ...((d?.vestigingen || []).map((v) => v.plaats).filter(Boolean) as string[]),
  ];
  return bouwKlantContext({
    profiel, naam, propositie,
    zoekwoorden: [...new Set(matrix.map((m) => m.keyword).filter(Boolean))],
    urls: [...new Set(matrix.map((m) => m.page).filter(Boolean))],
    extraPlaatsen,
  });
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
    const ctx = await bouwContextVoor(slug, client.domain || "", client.seoProfile || "", client.name || "", propositie);

    // Stap 1
    let bevindingen: Bevinding[] = r?.tussenstand || [];
    if (!r?.tussenstand || r.fase === "eigen") {
      bevindingen = await stapEigen(slug, ctx);
      await sql`UPDATE client_prioriteiten_scan SET fase = 'vers', tussenstand = ${JSON.stringify(bevindingen)}, updated_at = now() WHERE client_slug = ${slug}`;
    }

    // Stap 2
    const verseNodig = !r?.tussenstand || r.fase === "eigen" || r.fase === "vers";
    if (verseNodig) {
      const vers = await stapVers(slug, ctx, bevindingen.length);
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

    // Ontbrekende analyse meteen zelf starten, zodat de volgende scan compleet is.
    const gedraaid = await bronnenGedraaid(slug);
    const gestart = await startOntbrekendeAnalyses(slug, gedraaid);

    const uplift = verwachteUplift(bevindingen);
    const result: PrioResult = {
      samenvatting: bouwSamenvatting(bevindingen, uplift, delta),
      propositie,
      verwachteKlikkenPerMaand: uplift,
      lenzen: bouwLenzen(bevindingen, gedraaid, gestart),
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
