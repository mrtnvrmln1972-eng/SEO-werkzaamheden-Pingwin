import { sql, ensureSchema } from "./db";
import { generateDocSpec, type DocKind } from "./page-doc";
import { buildPingwinDoc } from "./pingwin-docx";
import { upsertStepTask } from "./tasks";
import { getPageDriveFolder } from "./site-urls";
import { uploadDocx } from "./drive";

// ═══════════════════════════════════════════════════════════
// ACHTERGROND-RUN: analyse -> blauwdruk -> copy los van de browser
// ═══════════════════════════════════════════════════════════
// Je start de run (page_doc_runs-rij), een cron-worker draait de drie stappen
// server-side sequentieel af (elke stap bouwt op de vorige, net als "Alles achter
// elkaar"), en de status wordt in de database bijgehouden. Zo kun je vrij wegklikken
// en later de resultaten terugzien. Puur additief naast de bestaande synchrone knop.
// ═══════════════════════════════════════════════════════════

const STEPS: DocKind[] = ["analyse", "blauwdruk", "copy"];

export type RunStepState = "pending" | "running" | "done" | "error";
export type RunStatus = "running" | "done" | "error";

export type DocRun = {
  id: number;
  slug: string;
  url: string;
  status: RunStatus;
  steps: Record<DocKind, RunStepState>;
  links: Record<DocKind, string>;
  error: string;
  updatedAt: string | null;
};

const STEP_KIND: Record<DocKind, string> = { analyse: "analyse_doc", blauwdruk: "blauwdruk_doc", copy: "copy_doc" };
const STEP_TITLE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copywriting" };
const STEP_KLANT: Record<DocKind, string> = {
  analyse: "We hebben de huidige pagina beoordeeld op de belangrijkste SEO-punten en vastgelegd wat er beter kan voor de gekozen zoekwoorden.",
  blauwdruk: "We hebben de ideale opzet voor deze pagina uitgewerkt: welke onderwerpen, structuur en zoekwoorden nodig zijn om goed te scoren.",
  copy: "We hebben de nieuwe, geoptimaliseerde teksten voor deze pagina geschreven. In de klantversie staat de uitleg, de zoekwoorden én de volledige tekst: lees die na en corrigeer waar nodig, dan verwerken wij hem SEO-geoptimaliseerd op de site.",
};
function pagePath(u: string): string { try { return new URL(u).pathname || u; } catch { return u; } }
function safeName(s: string): string { return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document"; }
// Harde bovengrens op één generatie-stap: hangt er iets (externe call zonder time-out),
// dan wordt het na ms een nette fout i.p.v. dat de stap eindeloos op 'bezig' blijft staan.
function withHardTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => { setTimeout(() => reject(new Error(msg)), ms); })]);
}

// Eigen, geïsoleerde tabel-voorbereiding (raakt de gedeelde ensureSchema niet aan).
let runTableReady: Promise<void> | null = null;
function ensureRunTable(): Promise<void> {
  if (!runTableReady) runTableReady = doEnsureRunTable().catch((e) => { runTableReady = null; throw e; });
  return runTableReady;
}
async function doEnsureRunTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_doc_runs (
      id              SERIAL PRIMARY KEY,
      client_slug     TEXT NOT NULL,
      url             TEXT NOT NULL,
      extra           TEXT,
      folder_id       TEXT,
      status          TEXT NOT NULL DEFAULT 'running',
      analyse_state   TEXT NOT NULL DEFAULT 'pending',
      blauwdruk_state TEXT NOT NULL DEFAULT 'pending',
      copy_state      TEXT NOT NULL DEFAULT 'pending',
      analyse_link    TEXT,
      blauwdruk_link  TEXT,
      copy_link       TEXT,
      error           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // audience: "klant" (standaard, korte klantversie) of "intern" (uitgebreide versie op verzoek).
  await sql`ALTER TABLE page_doc_runs ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'klant'`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRun(r: any): DocRun {
  return {
    id: Number(r.id),
    slug: r.client_slug as string,
    url: r.url as string,
    status: (r.status as RunStatus) || "running",
    steps: { analyse: r.analyse_state, blauwdruk: r.blauwdruk_state, copy: r.copy_state },
    links: { analyse: (r.analyse_link as string) || "", blauwdruk: (r.blauwdruk_link as string) || "", copy: (r.copy_link as string) || "" },
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

// Start een nieuwe achtergrond-run voor een pagina. Zonder expliciete Drive-map
// valt hij terug op de per-pagina opgeslagen map (indien aanwezig).
export async function createDocRun(slug: string, url: string, extra: string, folderId: string, steps: DocKind[], audience: "intern" | "klant" = "klant"): Promise<number> {
  await ensureSchema();
  await ensureRunTable();
  let fid = (folderId || "").trim();
  if (!fid) { const saved = await getPageDriveFolder(slug, url).catch(() => null); if (saved) fid = saved.folderId; }
  // Gevraagde stappen krijgen 'pending', de rest 'skipped' (worden overgeslagen).
  const st = (k: DocKind) => (steps.includes(k) ? "pending" : "skipped");
  const { rows } = await sql`
    INSERT INTO page_doc_runs (client_slug, url, extra, folder_id, audience, analyse_state, blauwdruk_state, copy_state)
    VALUES (${slug}, ${url}, ${extra || null}, ${fid || null}, ${audience}, ${st("analyse")}, ${st("blauwdruk")}, ${st("copy")})
    RETURNING id`;
  return Number(rows[0].id);
}

export async function getLatestDocRun(slug: string, url: string): Promise<DocRun | null> {
  await ensureSchema();
  await ensureRunTable();
  const { rows } = await sql`SELECT * FROM page_doc_runs WHERE client_slug = ${slug} AND url = ${url} ORDER BY id DESC LIMIT 1`;
  return rows[0] ? rowToRun(rows[0]) : null;
}

// Welke stappen zijn OOIT klaar (over alle runs voor deze pagina), zodat de knoppen
// ook retroactief groen zijn als analyse/blauwdruk in een eerdere run zijn gemaakt.
export async function getStepsEverDone(slug: string, url: string): Promise<{ analyse: boolean; blauwdruk: boolean; copy: boolean }> {
  await ensureSchema();
  await ensureRunTable();
  const { rows } = await sql`
    SELECT
      bool_or(analyse_state = 'done' OR analyse_link IS NOT NULL) AS analyse,
      bool_or(blauwdruk_state = 'done' OR blauwdruk_link IS NOT NULL) AS blauwdruk,
      bool_or(copy_state = 'done' OR copy_link IS NOT NULL) AS copy
    FROM page_doc_runs WHERE client_slug = ${slug} AND url = ${url}`;
  const r = rows[0] || {};
  return { analyse: !!r.analyse, blauwdruk: !!r.blauwdruk, copy: !!r.copy };
}

// ── Cron-worker: verwerk wachtende runs, stap voor stap ──
export async function processQueuedRuns(): Promise<{ processed: number }> {
  await ensureSchema();
  await ensureRunTable();
  await recoverStale();
  // Blijf binnen één tick runs oppakken zolang er tijdsbudget is: zo werkt één
  // cron-tick een stapel direct-falende (oude) runs in één keer weg in plaats van
  // één per minuut, terwijl een echte generatie de tick vult en de loop vanzelf
  // stopt. De seen-set voorkomt eindeloos herhalen als een run niets verandert.
  const t0 = Date.now();
  const seen = new Set<number>();
  let processed = 0;
  while (Date.now() - t0 < 45000) {
    // Runs die werk nodig hebben en niet nú al een stap 'running' hebben (voorkomt
    // dat twee cron-ticks dezelfde run tegelijk oppakken).
    const { rows } = await sql`
      SELECT id FROM page_doc_runs
      WHERE status = 'running'
        AND analyse_state <> 'running' AND blauwdruk_state <> 'running' AND copy_state <> 'running'
        AND (analyse_state = 'pending' OR blauwdruk_state = 'pending' OR copy_state = 'pending')
      ORDER BY id ASC LIMIT 1`;
    if (!rows.length) break;
    const id = Number(rows[0].id);
    if (seen.has(id)) break;
    seen.add(id);
    await processRun(id);
    processed++;
  }
  return { processed };
}

// Eén specifieke run nu draaien (aangeroepen via waitUntil bij het starten, zodat de
// run meteen server-side doorloopt zonder op de cron te wachten; de cron is vangnet).
export async function runNow(id: number): Promise<void> {
  try {
    await ensureSchema();
    await ensureRunTable();
    await processRun(id);
  } catch { /* de cron pikt hem later alsnog op */ }
}

// Een stap die te lang 'running' staat (worker gestopt) terugzetten op 'pending'.
async function recoverStale(): Promise<void> {
  // Een run met een fout-stap maar status 'running' (inconsistent, bijv. oude runs)
  // blokkeert de wachtrij voor eeuwig: de cron kiest altijd de oudste run, doet er
  // niets mee en komt nooit toe aan nieuwere runs. Daarom hier afronden als fout.
  await sql`UPDATE page_doc_runs SET status = 'error', updated_at = now() WHERE status = 'running' AND (analyse_state = 'error' OR blauwdruk_state = 'error' OR copy_state = 'error')`;
  await sql`UPDATE page_doc_runs SET analyse_state = 'pending', updated_at = now() WHERE status = 'running' AND analyse_state = 'running' AND updated_at < now() - interval '15 minutes'`;
  await sql`UPDATE page_doc_runs SET blauwdruk_state = 'pending', updated_at = now() WHERE status = 'running' AND blauwdruk_state = 'running' AND updated_at < now() - interval '15 minutes'`;
  await sql`UPDATE page_doc_runs SET copy_state = 'pending', updated_at = now() WHERE status = 'running' AND copy_state = 'running' AND updated_at < now() - interval '15 minutes'`;
}

async function processRun(id: number): Promise<void> {
  const { rows } = await sql`SELECT * FROM page_doc_runs WHERE id = ${id} LIMIT 1`;
  const r = rows[0];
  if (!r) return;
  const slug = r.client_slug as string, url = r.url as string;
  const extra = (r.extra as string) || "";
  const folderId = (r.folder_id as string) || "";
  const audience: "intern" | "klant" = (r.audience as string) === "intern" ? "intern" : "klant";
  const states: Record<DocKind, string> = { analyse: r.analyse_state, blauwdruk: r.blauwdruk_state, copy: r.copy_state };
  for (const kind of STEPS) {
    if (states[kind] === "done" || states[kind] === "skipped") continue;
    if (states[kind] === "error") return;
    const claimed = await claimStep(id, kind);
    if (!claimed) return; // andere worker pakte hem, of de status veranderde
    try {
      const link = await withHardTimeout(generateAndStoreDoc(slug, url, kind, extra, folderId, audience), 480000, "Genereren duurde te lang (>8 min) en is afgebroken. Probeer het opnieuw.");
      await finishStep(id, kind, link);
    } catch (e) {
      await failStep(id, kind, ((e as Error).message || "onbekende fout").slice(0, 500));
      return;
    }
  }
  // Alle gevraagde stappen klaar (we komen hier alleen zonder fout): run afronden.
  await sql`UPDATE page_doc_runs SET status = 'done', updated_at = now() WHERE id = ${id} AND status = 'running'`;
}

// Vaste kolomnamen (geen dynamische identifiers in getagde SQL), daarom per stap.
async function claimStep(id: number, kind: DocKind): Promise<boolean> {
  const q = kind === "analyse"
    ? sql`UPDATE page_doc_runs SET analyse_state = 'running', updated_at = now() WHERE id = ${id} AND analyse_state = 'pending' RETURNING id`
    : kind === "blauwdruk"
      ? sql`UPDATE page_doc_runs SET blauwdruk_state = 'running', updated_at = now() WHERE id = ${id} AND blauwdruk_state = 'pending' RETURNING id`
      : sql`UPDATE page_doc_runs SET copy_state = 'running', updated_at = now() WHERE id = ${id} AND copy_state = 'pending' RETURNING id`;
  const { rows } = await q;
  return rows.length > 0;
}
async function finishStep(id: number, kind: DocKind, link: string): Promise<void> {
  if (kind === "analyse") await sql`UPDATE page_doc_runs SET analyse_state = 'done', analyse_link = ${link || null}, updated_at = now() WHERE id = ${id}`;
  else if (kind === "blauwdruk") await sql`UPDATE page_doc_runs SET blauwdruk_state = 'done', blauwdruk_link = ${link || null}, updated_at = now() WHERE id = ${id}`;
  else await sql`UPDATE page_doc_runs SET copy_state = 'done', copy_link = ${link || null}, updated_at = now() WHERE id = ${id}`;
}
async function failStep(id: number, kind: DocKind, msg: string): Promise<void> {
  if (kind === "analyse") await sql`UPDATE page_doc_runs SET analyse_state = 'error', status = 'error', error = ${msg}, updated_at = now() WHERE id = ${id}`;
  else if (kind === "blauwdruk") await sql`UPDATE page_doc_runs SET blauwdruk_state = 'error', status = 'error', error = ${msg}, updated_at = now() WHERE id = ${id}`;
  else await sql`UPDATE page_doc_runs SET copy_state = 'error', status = 'error', error = ${msg}, updated_at = now() WHERE id = ${id}`;
}

// Genereert één document (analyse/blauwdruk/copy) server-side en levert het af in
// Drive (met klantversie + werkzaamheid), net als de synchrone route. Zonder Drive-map
// wordt het document gegenereerd en als werkzaamheid vastgelegd (zonder downloadlink,
// want er is geen browser om het bestand naartoe te sturen). Geeft de technische link terug.
async function generateAndStoreDoc(slug: string, url: string, kind: DocKind, extra: string, folderId: string, audience: "intern" | "klant" = "klant"): Promise<string> {
  // Standaard alleen de klantversie (direct uit de data): één generatie i.p.v. de dure
  // technische versie + een aparte klant-verkleining. Intern kan op verzoek.
  const { spec, title } = await generateDocSpec(slug, url, kind, extra || undefined, audience);
  const buffer = await buildPingwinDoc(spec);
  const suffix = audience === "intern" ? "-intern" : "";
  const filename = `${safeName(spec.klant)}-${kind}${suffix}-${safeName(title)}.docx`;
  const stepTitle = `${STEP_TITLE[kind]}${audience === "intern" ? " (interne versie)" : ""}: ${pagePath(url)}`;

  if (folderId) {
    const { link } = await uploadDocx(folderId, filename, buffer);
    await upsertStepTask(slug, {
      pageUrl: url, stepKind: STEP_KIND[kind], title: stepTitle,
      link, clientLink: audience === "klant" ? link : undefined, klantToelichting: STEP_KLANT[kind], wie: "SEO", fase: "Bouwen", klantZichtbaar: audience === "klant",
    }).catch(() => null);
    return link;
  }

  await upsertStepTask(slug, {
    pageUrl: url, stepKind: STEP_KIND[kind], title: stepTitle,
    klantToelichting: STEP_KLANT[kind], wie: "SEO", fase: "Bouwen", klantZichtbaar: audience === "klant",
  }).catch(() => null);
  return "";
}
