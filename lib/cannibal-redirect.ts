import fs from "fs";
import path from "path";
import { sql, ensureSchema } from "./db";
import { createClient } from "@vercel/postgres";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscForPage, getGscKeywordUrlFlips } from "./google";
import { getAhrefsTopPages, getUrlOrganicKeywords, ahrefsConfigured } from "./ahrefs";
import { fetchPageContent } from "./page-content";
import { callClaude, callClaudeAgentic, type ToolDef, type ToolRunner } from "./anthropic";
import { regelsAlsInstructie, getAdsPaginas, isAdsPad, type AdsPaginas } from "./opruim-regels";
import { zwakkePaginas, type ZwakkePagina } from "./concurrenten";
import { weegKandidaten, weegPaden, termUitPad, type Oppakker } from "./opruim-waarde";
import { vindOnderwerpen, tweelingenVan, type Onderwerp } from "./opruim-onderwerpen";
import { feitenPerTerm, magSamenvoegen, intentieUitleg, intentieAlsInstructie } from "./opruim-intentie";
import { autoriteitVan, haalbaarheidAlsInstructie } from "./opruim-haalbaarheid";
import { vindGaten, type Gat } from "./opruim-gaten";
import { getEuroInstelling, berekenEuro, type EuroInstelling } from "./opruim-euro";
import { toetsTermen } from "./opruim-serp";
import { getSetting, setSetting, SETTING_OPRUIM_CRON_TIK } from "./settings";

// ═══════════════════════════════════════════════════════════
// KEYWORD-CANNIBALISATIE-ANALYSE (dashboard-integratie van de skill)
// ═══════════════════════════════════════════════════════════
// Dit draait EXACT de methodiek uit de agentic skill
// `skills/keyword-cannibalisatie-analyse` (SKILL.md + output-schema.md). Die
// bestanden zijn de enige bron van waarheid: pas je de skill aan, dan verandert
// zowel de Cowork-versie als deze dashboard-versie mee. Het dashboard levert de
// data via de eigen connectoren: per pagina de Ahrefs-zoekwoorden met positie
// (de motor die onthult welke pagina op welk merk+geo-zoekwoord rankt), de GSC-
// matrix + flip-tijdreeks, en Ahrefs-volumes. De gedeelde zoekwoorden (meerdere
// pagina's op één term) worden in code voorgekauwd: dat zijn de cannibalisatie-
// kandidaten, zoals in de handmatige Excel-analyse.
// ═══════════════════════════════════════════════════════════

// --- Output-schema-types (spiegel van references/output-schema.md) ---------
export type ClusterUrl = {
  url: string; rol?: string; positie?: number; klikken?: number; impressies?: number;
  verwijzendeDomeinen?: number; intentie?: string;
};
export type ClusterSignalen = { urlFlip?: boolean; flipsIn90d?: number; positiePlafond?: boolean; klikVerdeling?: boolean };
export type RedirectCluster = {
  keyword: string; volume?: number; score?: string; signalen?: ClusterSignalen; intentie?: string;
  urls: ClusterUrl[]; winnaar: string; actie: string; onderbouwing?: string; verwachteImpact?: string;
};
// verhuizen: de content gaat naar de doel-URL en de oude URL wijst daarheen. Dat
// is iets anders dan een gewone omleiding naar een bestaande, sterkere pagina;
// bij een verhuizing moet er eerst iets gebouwd worden.
export type RedirectMapItem = { van: string; naar: string; type?: string; mergeContent?: boolean; verhuizen?: boolean; reden?: string };
export type InterneLink = { vanaf: string; naar: string; ankertekst?: string; reden?: string };
export type Datakwaliteit = { gsc?: boolean; gscTijdreeks?: boolean; ahrefsZoekwoorden?: boolean; ahrefsBacklinks?: boolean; crawl?: boolean; opmerking?: string };
export type CannibalResult = {
  samenvatting: string; datakwaliteit?: Datakwaliteit; clusters: RedirectCluster[];
  redirectMap?: RedirectMapItem[]; interneLinks?: InterneLink[]; generatedAt: string | null;
  /** Pagina's die er in de data uitzien als dood gewicht, maar op een zoekterm
      met echt volume zitten. Die gaan niet naar de omleidlijst maar naar een
      eigen lijst: herontwikkelen in plaats van weghalen. */
  oppakken?: Oppakker[];
  /** Onderwerpen die over meerdere pagina's verspreid liggen zonder dat er één
      van in de top 10 staat. Eén omleiding is daar het verkeerde antwoord. */
  onderwerpen?: Onderwerp[];
  /** De andere helft van het verhaal: zoekwoorden met volume waar deze site op
      geen enkele pagina op mikt. Opruimen maakt een site schoon, dit laat hem
      groeien. */
  gaten?: Gat[];
};
// De analyse draait in hervatbare stappen. Reden: één volledige analyse kost 10 tot
// 20 minuten (agentisch onderzoek + de grote JSON-synthese + drie doorloop-rondes) en
// dat past in geen enkel serverless-tijdvenster. Tot 03-08-2026 draaide alles in één
// keer via waitUntil in een venster van 300s; de run van 05:52 werd daardoor rond 05:57
// stil afgekapt, bleef eeuwig op 'bezig' staan en leverde nooit iets op. Nu wordt na
// elke stap opgeslagen waar hij is gebleven, zodat de volgende werker verdergaat waar
// de vorige stopte in plaats van opnieuw te beginnen.
export type CannibalFase = "" | "gather" | "synth" | "ronde";
export type CannibalState = {
  status: "idle" | "running" | "done" | "error";
  result: CannibalResult | null; error: string; updatedAt: string | null;
  fase: CannibalFase; ronde: number; stap: number; stappen: number; stapLabel: string;
  // Wanneer het cron-vangnet voor het laatst langskwam, en of het stilstaat.
  cronTik: string | null; cronStil: boolean;
  // Hoever is hij door de opruimkandidaten? Zichtbaar op het scherm, zodat
  // "geen lijst" en "lijst helemaal gehad" niet meer op elkaar lijken.
  kandidaten: number; beoordeeld: number;
};

// Onderzoek, hoofdanalyse, en daarna de kandidatenlijst blok voor blok aflopen.
// 8 rondes van 40 = 320 kandidaten. One Day Clinic heeft er 283; met 6 rondes
// bleven er ruim veertig liggen en dat is precies het werk waar het om begonnen is.
const MAX_RONDES = 8;
const BLOK = 40;                 // kandidaten per ronde
const STAPPEN = 2 + MAX_RONDES;
function stapVan(fase: CannibalFase, ronde: number): { stap: number; label: string } {
  if (fase === "gather") return { stap: 1, label: "Data verzamelen en de verdachte pagina's onderzoeken" };
  if (fase === "synth") return { stap: 2, label: "De hoofdanalyse schrijven" };
  if (fase === "ronde") { const r = Math.min(Math.max(ronde, 0), MAX_RONDES - 1); return { stap: 3 + r, label: `Ronde ${r + 1} van ${MAX_RONDES}: de opruimkandidaten nalopen` }; }
  // Geen fase terwijl de run loopt: opstarten, of een oude run uit de opzet van
  // vóór de stappen. Nooit "Klaar" tonen; dat was precies de leugen op het scherm.
  return { stap: 1, label: "De analyse wordt opgestart" };
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_cannibal_analysis (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Hervatbaarheid: waar is hij gebleven, en de dure tussenproducten zodat een
  // hervatting niet opnieuw Ahrefs bevraagt of het onderzoek overdoet.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS fase TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS ronde INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS retries INT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS seed TEXT`;
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS findings TEXT`;
  // De al berekende opruimkandidaten (zwakkePaginas), zodat de doorloop-rondes ze
  // blok voor blok kunnen afwerken in plaats van ze zelf te moeten ontdekken.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS kandidaten TEXT`;
  // Welke kandidaten al zijn voorgelegd, inclusief de pagina's die mochten blijven.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS behandeld TEXT`;
  // De pagina's die juist NIET opgeruimd mogen worden omdat hun eigen zoekterm
  // volume heeft. Aparte kolom, zodat ze ook aan een oudere uitkomst worden
  // meegegeven zonder de analyse opnieuw te draaien.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS oppakken TEXT`;
  // Onderwerpen die over meerdere pagina's verspreid liggen: een keuze, geen regel.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS onderwerpen TEXT`;
  // De ontbrekende pagina's: waar de site helemaal niet op mikt.
  await sql`ALTER TABLE client_cannibal_analysis ADD COLUMN IF NOT EXISTS gaten TEXT`;
}

function pagePath(u: string): string { return (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || ""); }

// Haalt het eerste complete, gebalanceerde JSON-object uit een tekst (strings/escapes
// meegerekend), zodat losse accolades in proza de parse niet breken. Sluit het object
// niet (afgekapt antwoord), dan geeft hij de rest terug zodat we het kunnen herkennen.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  if (start < 0) return s;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return s.slice(start);
}

// Laadt de skill (methodiek + output-schema) van schijf. Dit is de single source
// of truth die zowel Cowork als het dashboard draaien.
let skillCache: string | null = null;
function loadSkillMethodology(): string {
  if (skillCache != null) return skillCache;
  try {
    const base = path.join(process.cwd(), "skills", "keyword-cannibalisatie-analyse");
    const skill = fs.readFileSync(path.join(base, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const schema = fs.readFileSync(path.join(base, "references", "output-schema.md"), "utf8");
    skillCache = `${skill}\n\n---\n\n${schema}`;
  } catch {
    skillCache = "";
  }
  return skillCache;
}

// ── Welke verbinding de rij-functies gebruiken ─────────────────────────────
// Standaard de gedeelde (gepoolde) verbinding. De cron-werker zet hier tijdelijk
// een eigen, niet-gepoolde verbinding neer. Reden: op 11-07-2026 bleek in dit
// project al eens dat een gepoolde verbinding naar een oude momentopname keek
// (de documenten-werker zag via de pool 0 wachtende runs en via een eigen
// verbinding wél de wachtende run). Op 03-08-2026 gebeurde hier hetzelfde: de
// cron las fase='' terwijl de rij fase='gather' bevatte, en zijn schrijfacties
// landden niet (retries bleef 0 na duizend claims).
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
let actieveSql: SqlTag = sql as unknown as SqlTag;
const q: SqlTag = (strings, ...values) => actieveSql(strings, ...values);

type CannibalRow = {
  status: string; result: CannibalResult | null; error: string; updatedAt: string | null;
  fase: CannibalFase; ronde: number; retries: number; seed: string; findings: string;
  kandidaten: ZwakkePagina[]; behandeld: string[]; oppakken: Oppakker[]; onderwerpen: Onderwerp[]; gaten: Gat[];
};

// JSON-kolom die ook leeg of stuk mag zijn: altijd een lijst terug, nooit een fout.
function lijstVan<T>(v: unknown): T[] {
  if (!v) return [];
  try { const j = JSON.parse(String(v)); return Array.isArray(j) ? (j as T[]) : []; } catch { return []; }
}

async function readRow(slug: string): Promise<CannibalRow | null> {
  const { rows } = await q`SELECT status, result, error, updated_at, fase, ronde, retries, seed, findings, kandidaten, behandeld, oppakken, onderwerpen, gaten FROM client_cannibal_analysis WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  let result: CannibalResult | null = null;
  try { result = r.result ? JSON.parse(r.result as string) : null; } catch { result = null; }
  return {
    status: (r.status as string) || "idle",
    result,
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
    fase: ((r.fase as string) || "") as CannibalFase,
    ronde: Number(r.ronde) || 0,
    retries: Number(r.retries) || 0,
    seed: (r.seed as string) || "",
    findings: (r.findings as string) || "",
    kandidaten: lijstVan<ZwakkePagina>(r.kandidaten),
    behandeld: lijstVan<string>(r.behandeld),
    oppakken: lijstVan<Oppakker>(r.oppakken),
    onderwerpen: lijstVan<Onderwerp>(r.onderwerpen),
    gaten: lijstVan<Gat>(r.gaten),
  };
}

/**
 * De bedragen erbij, op het moment van uitlezen. Bewust niet opgeslagen: past
 * Maarten de klantwaarde aan, dan hoort de hele lijst mee te veranderen zonder
 * dat er een analyse van twintig minuten overheen moet. Een opgeslagen bedrag zou
 * bovendien stilletjes verouderen, en dat is precies het soort fout dat niemand
 * opmerkt.
 *
 * De drie lijsten meten iets anders, dus de doelpositie verschilt:
 * - oppakken: de pagina bestaat, hij moet van zijn huidige plek omhoog;
 * - onderwerpen: de beste van de bundel is het vertrekpunt;
 * - gaten: er is nog niets, dus vanaf nul.
 */
/**
 * Advertentiepagina's uit elke lijst halen, op het moment van uitlezen. Vul je ze
 * pas ná een analyse in, dan verdwijnen ze meteen uit beeld in plaats van pas na
 * een nieuwe run. Ze worden ook nergens meer als bestemming voorgesteld: naar een
 * noindex-pagina omleiden is verkeer weggooien.
 */
function zonderAds(result: CannibalResult, ads: AdsPaginas): CannibalResult {
  if (!ads.paden.length) return result;
  const weg = (p: string) => isAdsPad(p, ads);
  return {
    ...result,
    redirectMap: (result.redirectMap || []).filter((m) => !weg(String(m.van || "")) && !weg(String(m.naar || ""))),
    oppakken: (result.oppakken || []).filter((o) => !weg(o.pad)),
    gaten: (result.gaten || []).filter((g) => !weg(g.voorstelPad)),
    onderwerpen: (result.onderwerpen || [])
      .map((o) => ({ ...o, paginas: o.paginas.filter((p) => !weg(p.pad)) }))
      // Blijft er na het schrappen geen cluster over, dan is het er ook geen meer.
      .filter((o) => o.paginas.length >= 2 && !weg(o.voorstel)),
    clusters: (result.clusters || [])
      .map((c) => ({ ...c, urls: c.urls.filter((u) => !weg(u.url)) }))
      .filter((c) => c.urls.length > 0),
  };
}

function metEuro(result: CannibalResult, inst: EuroInstelling): CannibalResult {
  if (!inst.ingevuld) return result;
  return {
    ...result,
    oppakken: (result.oppakken || []).map((o) => ({ ...o, euro: berekenEuro(o.volume, o.huidigePositie, o.haalbaarheid, inst) })),
    onderwerpen: (result.onderwerpen || []).map((o) => ({ ...o, euro: berekenEuro(o.volumeTotaal, o.bestePositie, o.haalbaarheid, inst) })),
    gaten: (result.gaten || []).map((g) => ({ ...g, euro: berekenEuro(g.volume, null, g.haalbaarheid, inst) })),
  };
}

export async function getCannibalAnalysis(slug: string): Promise<CannibalState> {
  await ensureSchema();
  await ensureTable();
  const r = await readRow(slug);
  // Vangnet-tik: staat hij langer dan een kwartier stil, dan draait de cron niet
  // en heeft wachten geen zin (de knop "Nu hervatten" is dan de weg).
  const cronTik = await getSetting(SETTING_OPRUIM_CRON_TIK).catch(() => null);
  const cronStil = !cronTik || (Date.now() - new Date(cronTik).getTime()) > 900000;
  const euroInst = await getEuroInstelling(slug).catch(() => ({ klantwaarde: 0, conversie: 0, ingevuld: false }));
  // De advertentiepagina's er hier nog een keer uitfilteren, bij het uitlezen.
  // Ze worden al bij de analyse geweerd, maar wie ze pas ná een analyse invult zou
  // ze anders in een lijst houden die naar een klant gaat, tot er een nieuwe run
  // van twintig minuten overheen is gegaan. Een instructie is een verzoek, een
  // filter bij het uitlezen is een garantie.
  const adsNu = await getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false }));
  if (!r) return { status: "idle", result: null, error: "", updatedAt: null, fase: "", ronde: 0, stap: 0, stappen: STAPPEN, stapLabel: "", cronTik, cronStil, kandidaten: 0, beoordeeld: 0 };
  const { stap, label } = stapVan(r.fase, r.ronde);
  return {
    cronTik,
    cronStil,
    kandidaten: r.kandidaten.length,
    beoordeeld: r.behandeld.length,
    status: (r.status as CannibalState["status"]) || "idle",
    result: r.result ? metEuro(zonderAds({ ...r.result, oppakken: r.oppakken, onderwerpen: r.onderwerpen, gaten: r.gaten }, adsNu), euroInst) : r.result,
    error: r.error,
    updatedAt: r.updatedAt,
    fase: r.fase,
    ronde: r.ronde,
    stap: r.status === "running" ? stap : STAPPEN,
    stappen: STAPPEN,
    stapLabel: r.status === "running" ? label : "",
  };
}

// Wanneer is de lijst die je NU ziet gemaakt? Niet `updatedAt`: dat is sinds de
// stap-opzet ook de hartslag van een lopende werker, dus een oude lijst zou tijdens
// een nieuwe run vers lijken. De lijst draagt zijn eigen datum in generatedAt.
export function resultDatum(st: CannibalState): string | null {
  return st.result?.generatedAt || (st.status === "done" ? st.updatedAt : null);
}

// Start een nieuwe run: terug naar stap 1, tellers op nul, en de vorige uitkomst
// blijft staan zodat het scherm niet leeg is terwijl de nieuwe analyse loopt.
export async function startCannibalRun(slug: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await q`
    INSERT INTO client_cannibal_analysis (client_slug, status, result, error, fase, ronde, retries, seed, findings, updated_at)
    VALUES (${slug}, 'running', NULL, NULL, 'gather', 0, 0, NULL, NULL, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = 'running', error = NULL, fase = 'gather', ronde = 0, retries = 0, seed = NULL, findings = NULL, kandidaten = NULL, behandeld = NULL, updated_at = now()`;
}

/**
 * De waarde-rem over een werklijst die er al ligt. Elke pagina die op de
 * omleidlijst staat maar een eigen zoekterm met volume heeft, verhuist naar de
 * lijst "oppakken". Zo geldt de nieuwe regel meteen voor de uitkomst die er nu
 * is, in plaats van pas na een nieuwe analyse van twintig minuten.
 */
export async function weegOpruimlijstOpnieuw(slug: string, domain: string): Promise<{ gered: number; over: number; oppakken: Oppakker[]; onderwerpen: number; gaten: number }> {
  await ensureSchema();
  await ensureTable();
  const row = await readRow(slug);

  // Meteen ook de verspreide onderwerpen en de ontbrekende pagina's bepalen. Eén
  // knop, drie controles: dit hoort bij elkaar en het scheelt Maarten handelingen.
  const [onderwerpen, gaten] = await Promise.all([
    vindOnderwerpen(slug, domain).catch(() => [] as Onderwerp[]),
    vindGaten(slug, domain).catch(() => [] as Gat[]),
  ]);
  if (onderwerpen.length) {
    await q`UPDATE client_cannibal_analysis SET onderwerpen = ${JSON.stringify(onderwerpen)}, updated_at = now() WHERE client_slug = ${slug}`;
  }
  if (gaten.length) {
    await q`UPDATE client_cannibal_analysis SET gaten = ${JSON.stringify(gaten)}, updated_at = now() WHERE client_slug = ${slug}`;
  }

  const result = row?.result;
  const rijen = result?.redirectMap || [];

  // De weging draait over TWEE lijsten tegelijk: de pagina's die nu nog op de
  // omleidlijst staan, én de pagina's die er eerder al af zijn gehaald. Dat
  // tweede is er op 6 augustus bij gekomen en het is geen detail: die oudere
  // regels zijn ooit gewogen zónder zoekintentie en zónder haalbaarheid, en
  // zonder deze stap zou het scherm oude en nieuwe regels door elkaar tonen
  // zonder dat je aan een regel kunt zien welke je voor je hebt. Precies het
  // soort stille verschil waar dit dashboard al twee keer op is misgegaan.
  const teWegen = [
    ...rijen.map((r) => ({ pad: padOf(String(r.van || "")) })),
    ...(row?.oppakken || []).map((o) => ({ pad: padOf(o.pad), vertoningen: o.vertoningen, dubbelMet: o.botstMet })),
  ].filter((k) => k.pad);
  if (!teWegen.length) return { gered: 0, over: 0, oppakken: row?.oppakken || [], onderwerpen: onderwerpen.length, gaten: gaten.length };

  const vers = await weegPaden(domain, teWegen);

  // De top 10-toets erbij: verdient deze zoekterm een eigen pagina, of hoort hij
  // als hoofdstuk op een bredere pagina? Dit is de vraag die de lijst "oppakken"
  // nooit stelde, en zonder antwoord bouwt hij drie pagina's waar er één hoort.
  // Eén opvraag per term, 90 dagen bewaard; alleen voor termen die er toe doen.
  const toetsbaar = vers.filter((o) => (o.volume || 0) >= 50).map((o) => o.term);
  const toetsen = await toetsTermen(toetsbaar).catch(() => new Map());
  for (const o of vers) o.eigenPagina = toetsen.get(o.term) || null;
  const versPerPad = new Map(vers.map((o) => [padOf(o.pad), o]));

  // Alleen wat NU nog op de omleidlijst staat telt als "gered"; de rest stond er
  // al af en is alleen bijgewerkt.
  const opLijst = new Set(rijen.map((r) => padOf(String(r.van || ""))));
  const gered = new Set([...versPerPad.keys()].filter((p) => opLijst.has(p)));

  // De verse weging wint van de oude. Een oude regel die nu niet meer door de
  // weging komt blijft wel staan: hij is ooit bewust van de opruimlijst gehaald,
  // en die stilletjes laten verdwijnen zou erger zijn dan een regel zonder label.
  const uniek = [...new Map([
    ...(row?.oppakken || []).map((o) => [padOf(o.pad), o] as const),
    ...vers.map((o) => [padOf(o.pad), o] as const),
  ]).values()].sort((a, b) => (b.volume || 0) - (a.volume || 0));

  if (!result) return { gered: 0, over: 0, oppakken: uniek, onderwerpen: onderwerpen.length, gaten: gaten.length };

  const over = rijen.filter((r) => !gered.has(padOf(String(r.van || ""))));
  const nieuw: CannibalResult = { ...result, redirectMap: over };
  await q`UPDATE client_cannibal_analysis SET result = ${JSON.stringify(nieuw)}, oppakken = ${JSON.stringify(uniek)}, updated_at = now() WHERE client_slug = ${slug}`;
  return { gered: gered.size, over: over.length, oppakken: uniek, onderwerpen: onderwerpen.length, gaten: gaten.length };
}

async function faal(slug: string, msg: string): Promise<void> {
  await q`UPDATE client_cannibal_analysis SET status = 'error', error = ${msg}, fase = '', seed = NULL, findings = NULL, updated_at = now() WHERE client_slug = ${slug}`;
}

async function afronden(slug: string): Promise<void> {
  await q`UPDATE client_cannibal_analysis SET status = 'done', error = NULL, fase = '', seed = NULL, findings = NULL, updated_at = now() WHERE client_slug = ${slug}`;
}

// Hartslag: zolang deze werker leeft, bewijst hij dat elke 30s. Stopt de hartslag
// (afgekapt venster, deploy), dan ziet de cron-werker de run als verlaten en pakt
// hem op bij de stap waar hij was.
function startHartslag(slug: string): () => void {
  const t = setInterval(() => {
    // Via q, dus via dezelfde verbinding als de rest van de stap. Stond op de
    // gedeelde verbinding en landde daardoor niet tijdens een cron-tik: de run
    // leek stil te staan terwijl hij gewoon werkte, met dubbel werk en een valse
    // "vastgelopen" tot gevolg.
    void q`UPDATE client_cannibal_analysis SET updated_at = now() WHERE client_slug = ${slug}`.catch(() => { /* stil */ });
  }, 30000);
  return () => clearInterval(t);
}

// De opdracht bovenop de skill-methodiek: draai op deze concrete data en lever
// uitsluitend de JSON uit het output-schema terug.
function buildSystemPrompt(): string {
  const methodology = loadSkillMethodology();
  const head = methodology
    ? `Je voert de volgende agentic skill uit. Dit is je volledige methodiek en je output-schema; volg het strikt.\n\n${methodology}`
    : `Je bent een senior SEO-specialist. Voer een keyword-cannibalisatie-analyse uit volgens de standaardmethodiek (URL-flip-detectie, positie-plafond, klik-verdeling, intentie-check, winnaar-weging, beslisboom).`;
  return `${head}

---

UITVOERING IN HET PINGWIN-DASHBOARD:
De data hieronder is al voor je verzameld. Redeneer per plaats/thema; verzin niets bij.
- Je PRIMAIRE bron is de AHREFS PER PAGINA-tabel: per pagina het top-zoekwoord met positie, verkeer en verwijzende domeinen. Cluster pagina's waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft.
- Let op het patroon van de handmatige analyse: een omliggende-plaats- of variant-pagina waarvan het top-zoekwoord de merk+geo-term van een GROTE stad is (bijv. top-zoekwoord "merk grote-stad" of "soa test grote-stad" terwijl de URL een andere/omliggende plaats of een variant is). De hoofd-stadspagina (hoogste positie, meeste verwijzende domeinen) is de winnaar; de kaper krijgt "de-optimaliseren" of een 301 bij een duplicaat. Gebruik de lijst PAGINA'S ZONDER Ahrefs-VERKEER om lege duplicaat-varianten per plaats (kliniek-/poli-/test-) te vinden; die krijgen meestal een 301 naar de plaatswinnaar.
- Neem ALLEEN echte cannibalisatie op (hard signaal + overlappende intentie). Een informatieve blog naast een transactionele pagina = geen cannibalisatie; laat die eruit.
- Winnaar-weging: verwijzende domeinen (zwaarst) > organische tractie > businesswaarde. De pagina met de meeste verwijzende domeinen is niet altijd de bestemming; redirect desnoods de link-rijke pagina naar de businesswaardige pagina. Gesloten/verplaatste locaties: 301 naar de dichtstbijzijnde open pagina, niet 410 (behoud de verwijzende domeinen).
- Vul per cluster "signalen" (urlFlip/flipsIn90d uit de flip-tijdreeks, positiePlafond 5-20, klikVerdeling) en per URL "verwijzendeDomeinen" in. Vul "datakwaliteit" in: gsc=true, gscTijdreeks (kwamen er flips mee?), ahrefsZoekwoorden=true, ahrefsBacklinks=true, crawl=false.
- Elk item in "redirectMap" mag een veld "verhuizen" (true/false) hebben. true betekent: deze pagina is zelf de sterkste voor zijn onderwerp, maar staat op de verkeerde URL-vorm; de content gaat naar de doel-URL en de oude URL wijst daarheen. false (of weglaten) is een gewone omleiding naar een bestaande, sterkere pagina. Zet true ALLEEN als de doelpagina nu nog niet bestaat of leeg is; anders is het een gewone omleiding.
- Antwoord met UITSLUITEND geldige JSON volgens het output-schema hierboven. Geen tekst eromheen, geen emoji, geen markdown-codeblok.`;
}

// FASE 1 (agentic): het model haalt zelf de diepte-data op via deze tools.
const CANNIBAL_TOOLS: ToolDef[] = [
  { name: "ahrefs_url_keywords", description: "Alle zoekwoorden waarop één specifieke URL organisch rankt (positie, volume, verkeer), uit Ahrefs. Gebruik dit om in te zoomen op een verdachte pagina en te zien op welke merk+geo-termen hij MEDE rankt, ook waar hij niet de winnaar is (bijv. een buitenwijkpagina die op 'one day clinic <grote stad>' pos 11 staat). Geef het pad, bijv. /soa-poli-gouda/.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "fetch_page_content", description: "De on-page inhoud van een pagina (titel, meta, H1, koppen, kern van de tekst) om de zoekintentie te bepalen. Cruciaal om echte cannibalisatie (zelfde intentie) te scheiden van false positives (andere intentie). Geef het pad of de volledige URL.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "gsc_page_queries", description: "De echte Search Console-zoekwoorden voor één pagina (klikken, vertoningen, gemiddelde positie, 90 dagen), om echte Google-tractie te bevestigen. Geef het pad.", input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
];

function makeCannibalRunner(domain: string): ToolRunner {
  const bare = domain.replace(/^www\./i, "").toLowerCase();
  const toFull = (u: string) => (u || "").startsWith("http") ? u : `https://${bare}${(u || "").startsWith("/") ? "" : "/"}${u || ""}`;
  return async (name, input) => {
    if (name === "ahrefs_url_keywords") {
      const kws = await getUrlOrganicKeywords(toFull(String(input.url || "")), "nl", 40).catch(() => []);
      return kws.length ? kws.map((k) => `"${k.keyword}" pos ${k.position ?? "?"} vol ${k.volume ?? "?"} verkeer ${k.traffic ?? "?"}`).join("\n") : "(geen Ahrefs-zoekwoorden voor deze URL)";
    }
    if (name === "fetch_page_content") {
      const c = await fetchPageContent(toFull(String(input.url || ""))).catch(() => null);
      if (!c) return "(kon pagina niet ophalen)";
      return `titel: ${c.title}\nH1: ${c.h1}\nkoppen: ${c.headings.slice(0, 10).join(" | ")}\ntekst: ${c.text.slice(0, 1000)}`;
    }
    if (name === "gsc_page_queries") {
      const rows = await getGscForPage(domain, toFull(String(input.url || "")), 90).catch(() => []);
      return rows.length ? rows.map((r) => `"${r.keyword}" pos ${r.position} ${r.clicks} clicks ${r.impressions} impr`).join("\n") : "(geen GSC-data voor deze URL)";
    }
    return "(onbekende tool)";
  };
}

// Onderzoeks-prompt: verken agentisch, rond snel af met een leesbare bevindingen-tekst
// (GEEN JSON). Tekst kan niet afgekapt/leeg de parse breken; fase 2 maakt er JSON van.
function buildGatherSystem(): string {
  const methodology = loadSkillMethodology();
  const head = methodology ? `Je bent een SEO-specialist die keyword-cannibalisatie onderzoekt. Methodiek:\n\n${methodology}` : `Je bent een senior SEO-specialist die keyword-cannibalisatie onderzoekt.`;
  return `${head}

---

ONDERZOEKSFASE (agentisch):
De KERN-DATA (Ahrefs per pagina + pagina's zonder verkeer + flips) staat in het bericht. Je taak: zoom met de tools in op de VERDACHTE pagina's en schrijf daarna je bevindingen.
- Kies de kandidaat-clusters uit de kern-data: pagina's waarvan het top-zoekwoord dezelfde plaats/merk+geo-term betreft, en variant-/duplicaat-URL's per plaats (kliniek-/poli-/test-).
- Gebruik ahrefs_url_keywords op verdachte pagina's om secundaire merk+geo-rankings te zien (een buitenwijkpagina die mede op 'merk grote-stad' rankt). Gebruik fetch_page_content om de intentie te checken (echte cannibalisatie vs. andere intentie). Gebruik gsc_page_queries voor echte tractie.
- Wees EFFICIËNT: enkele gerichte tool-aanroepen op de meest verdachte pagina's, dan afronden. Niet elke pagina uitputtend nalopen.
- Rond af met een LEESBARE bevindingen-tekst (geen JSON, geen tools meer): per plaats/thema-cluster de concurrerende pagina's met top-zoekwoord/positie/verwijzende domeinen, de winnaar met onderbouwing, de voorgestelde actie (301 / de-optimaliseren / interne links / behouden), en of de intentie echt overlapt. Noem ook lege duplicaat-varianten die naar de plaatswinnaar moeten redirecten.`;
}

// Harde klok op het agentische onderzoek van stap 1. Elke stap moet gegarandeerd
// binnen één venster passen; anders komt hij nooit af, ook niet met hervatten.
const ONDERZOEK_BUDGET_MS = 360000; // 6 minuten

const padOf = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

// Bouwt de kern-data één keer per run en bewaart hem, zodat een hervatting niet
// opnieuw Ahrefs en Search Console bevraagt (scheelt tijd én verbruik).
async function bouwSeed(slug: string, clientNaam: string, domain: string): Promise<{ ok: true; seed: string; kandidaten: ZwakkePagina[] } | { ok: false; error: string }> {
  const [topPages, urls, flips, zwak] = await Promise.all([
    getAhrefsTopPages(domain, 300).catch(() => [] as Awaited<ReturnType<typeof getAhrefsTopPages>>),
    getClientUrls(slug).catch(() => []),
    getGscKeywordUrlFlips(domain, 3).catch(() => [] as { keyword: string; topUrls: string[]; flips: number }[]),
    // Het dashboard weet zélf al welke pagina's geen eigen zoekterm hebben en met
    // welke pagina ze dubbelen. Tot 03-08-2026 kreeg de motor die lijst niet en
    // moest hij alles opnieuw ontdekken uit de Ahrefs-tabel; dat leverde 14 regels
    // op terwijl er 189 kandidaten klaarlagen. Nu gaat de lijst gewoon mee.
    zwakkePaginas(slug, domain).catch(() => ({ ok: false as const, tekst: "", kandidaten: [] as ZwakkePagina[] })),
  ]);
  if (!topPages.length) return { ok: false, error: "Geen Ahrefs-data terug voor dit domein. Controleer de Ahrefs-koppeling (AHREFS_API_TOKEN) en of het domein klopt." };

  // Advertentiepagina's gaan er meteen uit. Ze halen niets uit Google omdat ze op
  // noindex staan, dus ze zouden bovenaan de opruimlijst belanden terwijl de
  // advertenties erheen wijzen. Opruimen kost dan echt geld.
  const ads = await getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false }));

  const ahrefsSeen = new Set(topPages.map((t) => pagePath(t.url)));
  const ahrefsTable = [...topPages].sort((a, b) => (b.traffic || 0) - (a.traffic || 0)).slice(0, 240)
    .map((t) => `- ${pagePath(t.url)} | top:"${t.topKeyword}" pos ${t.position ?? "?"} | ${t.traffic ?? 0} verkeer | ${t.refDomains ?? "?"} verw.domeinen | ${t.keywords ?? "?"}kw`).join("\n");
  const zeroTraffic = urls.filter((u) => (u.status ?? 200) === 200 && !ahrefsSeen.has(pagePath(u.url))).slice(0, 150)
    .map((u) => `- ${pagePath(u.url)} | status ${u.status ?? "?"} | ${u.gscClicks} clicks`).join("\n");
  const flipLines = flips.slice(0, 60).map((f) => `- "${f.keyword}": ${f.topUrls.join(" -> ")} (${f.flips}x)`).join("\n");

  return { ok: true, kandidaten: (zwak.kandidaten || []).filter((k) => !isAdsPad(k.pad, ads)), seed: [
    `KLANT: ${clientNaam || slug} (domein: ${domain})`,
    "",
    `DATAKWALITEIT (neem over in datakwaliteit): gsc=true, gscTijdreeks=${flips.length > 0}, ahrefsZoekwoorden=true, ahrefsBacklinks=true (verwijzende domeinen per pagina), crawl=false.`,
    "",
    "AHREFS PER PAGINA (pagina | top-zoekwoord + positie | organisch verkeer | verwijzende domeinen | aantal zoekwoorden):",
    ahrefsTable || "- (geen)",
    "",
    "PAGINA'S ZONDER Ahrefs-VERKEER (status 200; vaak lege duplicaat-varianten die je per plaats naar de winnaar redirect):",
    zeroTraffic || "- (geen)",
    "",
    "URL-FLIP-TIJDREEKS (top-rankende URL per zoekwoord over 3 vensters van ~30 dagen):",
    flipLines || "- (geen flips gedetecteerd)",
    "",
    zwak.tekst || "",
  ].join("\n") };
}

// ── Eén stap van de analyse ────────────────────────────────────────────────
// Doet precies één ding en slaat het resultaat op. "verder" = er is nog werk,
// "klaar" = deze run is af (of afgebroken met een fout).
async function stapCannibal(slug: string): Promise<"verder" | "klaar"> {
  return (await stapMetReden(slug)).uit;
}

// Zelfde stap, maar vertelt er ook bij WAAROM hij stopte. Zonder die reden is een
// werker die instant "klaar" zegt niet te onderscheiden van een werker die zijn
// werk deed; op 03-08-2026 pakte de cron dezelfde klant duizend keer op zonder dat
// er iets veranderde, en was van buitenaf niet te zien welke tak dat veroorzaakte.
async function stapMetReden(slug: string): Promise<{ uit: "verder" | "klaar"; reden: string }> {
  const row = await readRow(slug);
  if (!row) return { uit: "klaar", reden: "geen rij gevonden" };
  if (row.status !== "running") return { uit: "klaar", reden: `status is ${row.status}, niet running` };
  // Een run zonder fase komt uit de oude opzet (alles in één keer) en is stil
  // afgekapt; die kan niet hervat worden omdat er niets van bewaard is.
  if (!row.fase) {
    await faal(slug, "Deze analyse is halverwege vastgelopen in de oude opzet en kan niet hervat worden. Klik op “Opnieuw analyseren”; hij loopt nu wel door tot het eind.");
    return { uit: "klaar", reden: "oude run zonder fase, niet hervatbaar" };
  }

  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) { await faal(slug, "Deze klant heeft nog geen domein ingevuld."); return { uit: "klaar", reden: "geen domein" }; }
  if (!ahrefsConfigured()) { await faal(slug, "Hiervoor is een AHREFS_API_TOKEN nodig in Vercel."); return { uit: "klaar", reden: "geen Ahrefs-sleutel" }; }

  const stopHartslag = startHartslag(slug);
  try {
    let seed = row.seed;
    if (!seed) {
      const s = await bouwSeed(slug, client?.name || "", domain);
      if (!s.ok) { await faal(slug, s.error); return { uit: "klaar", reden: "kern-data mislukt" }; }
      seed = s.seed;
      // De rem vóór de opruimlijst: kandidaten waarvan de eigen zoekterm volume
      // heeft en die niemand anders bezit, gaan er hier uit. Ze komen op een
      // eigen lijst ("oppakken") en worden dus nooit aan het model voorgelegd
      // als opruimkandidaat. Zonder deze stap stelde de analyse voor om
      // /soa-test-kopen/ (500 zoekopdrachten per maand) op te heffen.
      const gewogen = await weegKandidaten(domain, s.kandidaten).catch(() => null);
      const kandidaten = gewogen ? gewogen.rest : s.kandidaten;
      const oppakken = gewogen ? gewogen.oppakken : [];
      // Onderwerpen die over meerdere pagina's verspreid liggen zonder dat er één
      // van in de top 10 staat. Dat is geen omleidklusje maar een keuze welke
      // pagina de thuisbasis wordt, dus het krijgt een eigen lijst.
      const onderwerpen = await vindOnderwerpen(slug, domain).catch(() => [] as Onderwerp[]);
      // En de andere helft: waar mikt de site helemaal niet op. Opruimen maakt een
      // site schoon, dit laat hem groeien; het hoort in dezelfde lijst thuis.
      const gaten = await vindGaten(slug, domain).catch(() => [] as Gat[]);
      await q`UPDATE client_cannibal_analysis SET seed = ${seed}, kandidaten = ${JSON.stringify(kandidaten)}, oppakken = ${JSON.stringify(oppakken)}, onderwerpen = ${JSON.stringify(onderwerpen)}, gaten = ${JSON.stringify(gaten)}, updated_at = now() WHERE client_slug = ${slug}`;
    }

    // STAP 1 — agentic onderzoek: het model zoomt in op verdachte pagina's en schrijft
    // leesbare bevindingen. Faalt dit (leeg/te kort), dan gaat stap 2 door op de ruwe data.
    if (row.fase === "gather") {
      let findings = "";
      try {
        findings = await callClaudeAgentic(
          buildGatherSystem(),
          [{ role: "user", content: `${seed}\n\nOnderzoek de meest verdachte pagina's met de tools en schrijf daarna je bevindingen (leesbare tekst, geen JSON).`.slice(0, 40000) }],
          // Zes minuten en vijf rondes. Op 03-08-2026 liep deze stap zonder klok
          // 13 minuten door en werd toen door het venster afgekapt: alles weg, en
          // elke hervatting liep tegen dezelfde muur. Een stap die niet gegarandeerd
          // binnen één venster past komt nooit af, hoe vaak je hem ook hervat.
          CANNIBAL_TOOLS, makeCannibalRunner(domain), 5, 6000, { slug, action: "cannibal_gather" },
          Date.now() + ONDERZOEK_BUDGET_MS,
        );
      } catch { findings = ""; }
      const clean = findings.replace(/\(geen antwoord\)/gi, "").trim();
      await q`UPDATE client_cannibal_analysis SET findings = ${clean}, fase = 'synth', retries = 0, updated_at = now() WHERE client_slug = ${slug}`;
      return { uit: "verder", reden: `onderzoek klaar (${(await readRow(slug))?.kandidaten.length ?? 0} opruimkandidaten in de lijst)` };
    }

    // Eerdere besluiten van Maarten gaan mee als harde regels. Zo hoeft hij een
    // correctie ("Monster hoort bij Den Haag", "deze houden we") maar één keer te
    // maken en maakt de analyse dezelfde fout nooit meer.
    // Daarbij de twee remmen als instructie. De code filtert wat hij kan meten;
    // deze tekst zorgt dat het model niet alsnog zelf over de intentiegrens heen
    // samenvoegt of een kansloze term als kans presenteert.
    const eerdere = await regelsAlsInstructie(slug).catch(() => "");
    const dr = await autoriteitVan(domain).catch(() => null);
    const systeem = [buildSystemPrompt(), intentieAlsInstructie(), haalbaarheidAlsInstructie(dr), eerdere]
      .filter(Boolean).join("\n\n");

    // STAP 2 — vaste synthese naar JSON: altijd een antwoord, werkt ook zonder bevindingen.
    if (row.fase === "synth") {
      // Stap 2 schrijft het VERHAAL (clusters, onderbouwing, interne links), niet de
      // volledige werklijst; die komt uit de rondes, die de kandidatenlijst aflopen.
      // Zonder deze afbakening probeerde hij beide te doen, werd het antwoord te lang
      // en werd de JSON afgekapt (03-08-2026, 11:38). Twee keer hetzelfde werk doen
      // maakte het antwoord bovendien niet beter.
      const afbakening = `\n\nBELANGRIJK voor de omvang van je antwoord: zet in "redirectMap" ALLEEN de pagina's uit de echte cannibalisatie-clusters hierboven (de gevallen met een hard signaal). De lange lijst opruimkandidaten wordt in een aparte stap pagina voor pagina behandeld; die hoef je hier NIET over te nemen. Houd "onderbouwing" en "verwachteImpact" per cluster bij twee of drie zinnen. Lever compacte, geldige JSON die zeker afkomt.`;
      const phase2 = row.findings.length > 40
        ? `${seed}\n\nBEVINDINGEN UIT HET AGENTISCH ONDERZOEK (gebruik deze; ze bevatten diepte-data zoals secundaire merk+geo-rankings en intentie-checks):\n${row.findings}\n\nLever nu de analyse als JSON volgens het output-schema.${afbakening}`
        : `${seed}\n\nLever nu de analyse als JSON volgens het output-schema.${afbakening}`;

      // Ruimere limiet, en bij een afgekapt antwoord één herkansing met een strakkere
      // opdracht. Een te lang antwoord is geen reden om de hele analyse weg te gooien.
      let parsed: { samenvatting?: unknown; datakwaliteit?: unknown; clusters?: unknown; redirectMap?: unknown; interneLinks?: unknown } | null = null;
      let laatsteTekst = "";
      for (let poging = 0; poging < 2 && !parsed; poging++) {
        const extra = poging === 0 ? "" : `\n\nJe vorige antwoord werd afgekapt omdat het te lang was. Geef het nu KORTER: hooguit de acht belangrijkste clusters, onderbouwing van één zin per cluster, en een samenvatting van hooguit tien regels.`;
        const raw = await callClaude(systeem, [{ role: "user", content: (phase2 + extra).slice(0, 48000) }], 32000, { slug, action: poging === 0 ? "cannibal_redirect" : "cannibal_redirect_herkansing" });
        const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        laatsteTekst = cleaned;
        try { parsed = JSON.parse(extractJsonObject(cleaned)); } catch { parsed = null; }
      }

      // Nog steeds niets bruikbaars? Dan gaan we tóch door naar de rondes. Het verhaal
      // is dan leeg, maar de werklijst is wat Maarten nodig heeft en die komt daar
      // vandaan. Alles weggooien om een mislukte samenvatting is de verkeerde ruil.
      if (!parsed) {
        const leeg: CannibalResult = { samenvatting: "", clusters: [], redirectMap: [], interneLinks: [], generatedAt: new Date().toISOString() };
        await q`UPDATE client_cannibal_analysis SET result = ${JSON.stringify(leeg)}, fase = 'ronde', ronde = 0, retries = 0, updated_at = now() WHERE client_slug = ${slug}`;
        return { uit: "verder", reden: `hoofdanalyse gaf geen geldige JSON (${laatsteTekst.slice(0, 80).replace(/\s+/g, " ")}), door naar de kandidaten` };
      }

      const adsNu = await getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false }));
      const result: CannibalResult = {
        samenvatting: typeof parsed.samenvatting === "string" ? parsed.samenvatting : "",
        datakwaliteit: parsed.datakwaliteit && typeof parsed.datakwaliteit === "object" ? (parsed.datakwaliteit as Datakwaliteit) : undefined,
        clusters: Array.isArray(parsed.clusters) ? (parsed.clusters as RedirectCluster[]) : [],
        // Ook hier het Ads-slot dicht: een instructie is een verzoek, dit is een garantie.
        redirectMap: (Array.isArray(parsed.redirectMap) ? (parsed.redirectMap as RedirectMapItem[]) : [])
          .filter((m) => !isAdsPad(String(m.van || ""), adsNu)),
        interneLinks: Array.isArray(parsed.interneLinks) ? (parsed.interneLinks as InterneLink[]) : [],
        generatedAt: new Date().toISOString(),
      };
      await q`UPDATE client_cannibal_analysis SET result = ${JSON.stringify(result)}, fase = 'ronde', ronde = 0, retries = 0, updated_at = now() WHERE client_slug = ${slug}`;
      return { uit: "verder", reden: "hoofdanalyse klaar" };
    }

    // ── DE RONDES: de bekende kandidatenlijst blok voor blok aflopen ────────
    // Tot 03-08-2026 vroegen we het model hier om zélf de resterende overbodige
    // pagina's te vinden. Dat leverde 14 regels op, terwijl het dashboard al 189
    // kandidaten had berekend uit Search Console, mét het voor de hand liggende
    // doel erbij. We lieten de AI dus zoeken naar iets dat al bekend was. Nu
    // krijgt hij de lijst en hoeft hij alleen nog per pagina het doel te bepalen,
    // of te zeggen dat een pagina juist moet blijven.
    const result = row.result;
    if (!result) { await faal(slug, "De tussenstand is verdwenen; start de analyse opnieuw."); return { uit: "klaar", reden: "tussenstand weg" }; }
    if (row.ronde >= MAX_RONDES) { await afronden(slug); return { uit: "klaar", reden: `${MAX_RONDES} rondes gehad` }; }

    const gezien = new Set((result.redirectMap || []).map((m) => padOf(String(m.van || ""))));
    const behandeld = new Set([...gezien, ...(row.behandeld || [])]);

    // Lijst kwijt? Dan hem opnieuw ophalen in plaats van te doen alsof we klaar
    // zijn. Op 03-08-2026 stopte de analyse na één ronde omdat de lijst leeg in de
    // rij stond; "geen kandidaten" en "alle kandidaten gehad" zien er van buiten
    // hetzelfde uit, en dat verschil moet de motor zelf kunnen herstellen.
    const ads = await getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false }));
    // Pagina's met een waardevolle eigen zoekterm blijven buiten de opruimlijst,
    // ook als de kandidatenlijst onderweg opnieuw wordt opgehaald.
    const beschermd = new Set((row.oppakken || []).map((o) => padOf(o.pad)));
    const mag = (k: ZwakkePagina) => !isAdsPad(k.pad, ads) && !beschermd.has(padOf(k.pad));
    let kandidaten = (row.kandidaten || []).filter(mag);
    if (!kandidaten.length) {
      const opnieuw = await zwakkePaginas(slug, domain).catch(() => null);
      kandidaten = (opnieuw?.kandidaten || []).filter(mag);
      if (kandidaten.length) await q`UPDATE client_cannibal_analysis SET kandidaten = ${JSON.stringify(kandidaten)}, updated_at = now() WHERE client_slug = ${slug}`;
    }

    const blok = kandidaten.filter((k) => !behandeld.has(padOf(k.pad))).slice(0, BLOK);
    if (!blok.length) {
      await afronden(slug);
      return { uit: "klaar", reden: kandidaten.length ? `alle ${kandidaten.length} kandidaten beoordeeld` : "geen kandidatenlijst beschikbaar" };
    }

    // De inhoudelijke tweeling erbij: een bestaande pagina die over hetzelfde
    // gaat. Zonder dat koos de motor het doel puur op "wie bezit de geleende
    // term", en dan gaat /soa-test-thuis/ naar /anonieme-soa-test/ terwijl
    // /soa-thuistest/ er letterlijk staat.
    const allePaden = await getClientUrls(slug).then((u) => u.filter((x) => (x.status ?? 200) === 200).map((x) => padOf(x.url))).catch(() => [] as string[]);

    // REM 1 in de praktijk. De tweelingen worden gezocht op woorden, en woorden
    // zeggen niets over wat de bezoeker wil. Voordat een tweeling als bestemming
    // wordt voorgesteld, halen we de intentie van beide termen op en gooien we de
    // botsingen eruit. Zo kan "soa test kopen" nooit meer voorgesteld worden als
    // bestemming voor "wat is een soa test", en andersom ook niet.
    const tweelingPer = new Map<string, string[]>();
    for (const k of blok) tweelingPer.set(padOf(k.pad), tweelingenVan(k.pad, allePaden).filter((t) => padOf(t) !== padOf(k.pad)));
    const termenNodig: string[] = [];
    for (const k of blok) {
      termenNodig.push(termUitPad(k.pad));
      for (const t of tweelingPer.get(padOf(k.pad)) || []) termenNodig.push(termUitPad(t));
    }
    const feiten = await feitenPerTerm(termenNodig.filter((t) => t && t.split(" ").length >= 2)).catch(() => new Map());
    const intentieVanPad = (p: string) => feiten.get(termUitPad(p))?.intentie ?? "";

    const lijst = blok.map((k) => {
      const eigenIntentie = intentieVanPad(k.pad);
      const alle = tweelingPer.get(padOf(k.pad)) || [];
      const tweeling: string[] = [];
      const gescheiden: string[] = [];
      for (const t of alle) {
        const oordeel = magSamenvoegen(eigenIntentie, intentieVanPad(t));
        if (oordeel.mag) tweeling.push(t); else gescheiden.push(t);
      }
      const zelfdeOnderwerp = tweeling.length ? ` | pagina's over hetzelfde onderwerp: ${tweeling.join(", ")}` : "";
      // De afgevallen tweelingen gaan wél mee, met het verbod erbij. Stilzwijgend
      // weglaten zou het model ze zelf laten herontdekken uit de andere data.
      const botsing = gescheiden.length
        ? ` | NIET samenvoegen met ${gescheiden.join(", ")}: andere zoekintentie (deze pagina ${intentieUitleg(eigenIntentie)})`
        : "";
      const intentie = eigenIntentie ? ` | bezoeker ${intentieUitleg(eigenIntentie)}` : "";
      const doel = k.dubbelMet.length === 1 ? `voorstel doel: ${k.dubbelMet[0]}`
        : k.dubbelMet.length > 1 ? `voorstel doel: ${k.dubbelMet.slice(0, 2).join(" OF ")} (kies de beste)`
        : "geen doel af te leiden uit de data";
      const leent = k.geleendeTop ? `leent "${k.geleendeTop.keyword}" (pos ${k.geleendeTop.positie}, ${k.geleendeTop.vertoningen} vert.)` : "krijgt geen vertoningen";
      return `- ${k.pad} [${k.klikken} klikken, ${k.vertoningen} vertoningen] ${leent}; ${doel}${zelfdeOnderwerp}${botsing}${intentie}`;
    }).join("\n");

    let extraRuw = "";
    try {
      extraRuw = await callClaude(
        systeem,
        [{ role: "user", content: `${seed}

BEOORDEEL NU DEZE ${blok.length} PAGINA'S, en UITSLUITEND deze. Het zijn opruimkandidaten die het dashboard al uit Search Console heeft afgeleid: ze ranken op geen enkele zoekterm die hun eigen onderwerp bevat, dus alles wat ze binnenhalen is geleend van merk- of andere-plaatstermen. Het voorgestelde doel is óók uit de data afgeleid (de pagina die de geleende term wél bezit).

${lijst}

Let op de twee soorten kandidaat-bestemmingen. Het "voorstel doel" is de pagina die de GELEENDE zoekterm bezit; dat is een aanwijzing, geen bewijs. Staat er ook een pagina bij "pagina's over hetzelfde onderwerp", dan gaat die vaak vóór: een bezoeker die op deze pagina zou landen, hoort thuis bij de pagina over hetzelfde onderwerp, niet bij de pagina die toevallig de meeste vertoningen had. Kies de bestemming waar de bezoeker het antwoord vindt dat hij zocht, en zeg in de reden waarom je die kiest.

Jouw taak per pagina: bevestig het voorgestelde doel, of corrigeer het als de data een beter doel aanwijst, en geef in één korte zin de reden. Neem een pagina NIET op als hij moet blijven (bijvoorbeeld een functionele pagina zoals contact of afspraak maken, of een pagina met een eigen duidelijke rol); laat hem dan gewoon weg. Verzin geen pagina's die niet in deze lijst staan. Stuur nooit naar een doel dat zelf zwak is.

Lever UITSLUITEND JSON: {"redirectMap":[{"van":"/pad/","naar":"/doel/","type":"301","mergeContent":false,"verhuizen":false,"reden":"..."}]}. Hoort er niets uit deze lijst opgeruimd te worden, geef dan {"redirectMap":[]}.`.slice(0, 48000) }],
        16000, { slug, action: `cannibal_redirect_ronde${row.ronde + 2}` },
      );
    } catch {
      await slaBlokOver(slug, row, blok);
      return { uit: "verder", reden: `ronde ${row.ronde + 1} gaf een fout, blok overgeslagen` };
    }

    let nieuweRijen: RedirectMapItem[] = [];
    try {
      const j = JSON.parse(extractJsonObject(extraRuw.replace(/```json/gi, "").replace(/```/g, "").trim())) as { redirectMap?: unknown };
      nieuweRijen = Array.isArray(j.redirectMap) ? (j.redirectMap as RedirectMapItem[]) : [];
    } catch {
      await slaBlokOver(slug, row, blok);
      return { uit: "verder", reden: `ronde ${row.ronde + 1} gaf geen geldige JSON, blok overgeslagen` };
    }

    // Alleen pagina's uit dit blok; verzonnen paden vallen af.
    const inBlok = new Set(blok.map((k) => padOf(k.pad)));
    const echtNieuw = nieuweRijen.filter((m) => {
      const v = padOf(String(m.van || ""));
      if (!v || gezien.has(v) || !inBlok.has(v) || beschermd.has(v)) return false;
      gezien.add(v);
      return true;
    });

    // Het hele blok is behandeld, ook de pagina's die mochten blijven. Zonder dat
    // te onthouden zou de volgende ronde dezelfde pagina's opnieuw voorleggen en
    // nooit door de lijst heen komen.
    const nuBehandeld = [...new Set([...(row.behandeld || []), ...blok.map((k) => padOf(k.pad))])];
    result.redirectMap = [...(result.redirectMap || []), ...echtNieuw];
    await q`UPDATE client_cannibal_analysis SET result = ${JSON.stringify(result)}, behandeld = ${JSON.stringify(nuBehandeld)}, ronde = ${row.ronde + 1}, retries = 0, updated_at = now() WHERE client_slug = ${slug}`;
    return { uit: "verder", reden: `ronde ${row.ronde + 1}: ${echtNieuw.length} van ${blok.length} beoordeeld als opruimen` };
  } finally {
    stopHartslag();
  }
}

// Een blok dat niet te beoordelen was, telt tóch als behandeld en de analyse gaat
// door met het volgende blok. Eén mislukte ronde mag nooit de hele analyse
// beëindigen; dat gebeurde op 03-08-2026 en kostte de complete werklijst.
async function slaBlokOver(slug: string, row: CannibalRow, blok: ZwakkePagina[]): Promise<void> {
  const nu = [...new Set([...(row.behandeld || []), ...blok.map((k) => padOf(k.pad))])];
  await q`UPDATE client_cannibal_analysis SET behandeld = ${JSON.stringify(nu)}, ronde = ${row.ronde + 1}, retries = 0, updated_at = now() WHERE client_slug = ${slug}`;
}

// Tijdsbudget per werker: ruim binnen het venster van 800s, zodat de werker zelf
// stopt in plaats van midden in een stap afgekapt te worden.
const WERKER_BUDGET_MS = 660000;

// Draait zoveel stappen als er in dit venster passen. Wat overblijft pakt de
// cron-werker op; de opgeslagen fase zorgt dat hij verdergaat waar deze stopte.
export async function runCannibalRedirect(slug: string): Promise<void> {
  try {
    await ensureSchema();
    await ensureTable();
    const t0 = Date.now();
    while (Date.now() - t0 < WERKER_BUDGET_MS) {
      if (await stapCannibal(slug) === "klaar") return;
    }
  } catch (e) {
    try { await faal(slug, `Analyse mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`); } catch { /* stil */ }
  }
}

// ── Cron-werker: hervat verlaten runs ──────────────────────────────────────
// Een run zonder hartslag van vijf minuten is verlaten (venster afgekapt, deploy).
// Die wordt hier opgepakt bij de stap waar hij was. Na drie vergeefse pogingen
// stopt hij definitief: zonder die noodrem blijft een stap die telkens sneuvelt
// eindeloos opnieuw draaien, en elke poging kost het volle AI-bedrag.
export async function processCannibalQueue(): Promise<{ opgepakt: string[]; redenen: string[] }> {
  await ensureSchema();
  await ensureTable();
  // Meteen vastleggen dát hij langskwam, vóór al het werk. Zo is op het scherm te
  // zien of het vangnet draait, ook als er niets op te pakken viel.
  await setSetting(SETTING_OPRUIM_CRON_TIK, new Date().toISOString()).catch(() => { /* stil */ });
  const opgepakt: string[] = [];

  // Eigen, niet-gepoolde verbinding voor deze hele tik. Zie de toelichting bij
  // actieveSql: via de pool las deze werker verouderde waarden en landden zijn
  // schrijfacties niet.
  const vers = createClient();
  await vers.connect();
  const vorige = actieveSql;
  actieveSql = vers.sql.bind(vers) as unknown as SqlTag;
  try {
    return await werkAf(opgepakt);
  } finally {
    actieveSql = vorige;
    await vers.end().catch(() => { /* opruimen mag nooit breken */ });
  }
}

async function werkAf(opgepakt: string[]): Promise<{ opgepakt: string[]; redenen: string[] }> {

  await q`
    UPDATE client_cannibal_analysis
    SET status = 'error', fase = '', seed = NULL, findings = NULL, updated_at = now(),
        error = 'Vastgelopen: de analyse is drie keer opnieuw opgepakt en bleef steken. Klik op “Opnieuw analyseren” om hem opnieuw te starten.'
    WHERE status = 'running' AND retries >= 3 AND updated_at < now() - interval '3 minutes'`;

  const t0 = Date.now();
  const redenen: string[] = [];
  // Elke klant hoogstens één keer per tik. Zonder deze rem draaide de werker op
  // 03-08-2026 duizend rondjes om dezelfde klant in 661 seconden: de claim zei
  // telkens "ik heb hem", maar er veranderde niets aan de rij. De documenten-
  // werker heeft dezelfde rem, met dezelfde reden. Verandert een run niets, dan
  // is doorgaan zinloos en schadelijk, want elke ronde kost geld.
  const gezien = new Set<string>();
  while (Date.now() - t0 < WERKER_BUDGET_MS && gezien.size < 8) {
    // Claimen en hartslag zetten in één stap, zodat twee cron-tikken nooit
    // dezelfde run tegelijk oppakken.
    const { rows } = await q`
      UPDATE client_cannibal_analysis SET retries = retries + 1, updated_at = now()
      WHERE client_slug = (
        SELECT client_slug FROM client_cannibal_analysis
        WHERE status = 'running' AND updated_at < now() - interval '3 minutes'
        ORDER BY updated_at ASC LIMIT 1)
      RETURNING client_slug`;
    if (!rows.length) break;
    const slug = String(rows[0].client_slug);
    if (gezien.has(slug)) { redenen.push(`${slug}: claim blijft dezelfde rij teruggeven, gestopt`); break; }
    gezien.add(slug);
    opgepakt.push(slug);
    // Alle resterende stappen van deze klant afwerken zolang er tijd is.
    while (Date.now() - t0 < WERKER_BUDGET_MS) {
      const r = await stapMetReden(slug);
      redenen.push(`${slug}: ${r.reden}`);
      if (r.uit === "klaar") break;
    }
  }
  return { opgepakt, redenen };
}
