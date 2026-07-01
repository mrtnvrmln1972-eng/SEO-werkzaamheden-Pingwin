import { sql, ensureSchema } from "./db";
import { getClientUrls, savePagePlan } from "./site-urls";
import { appendTasks } from "./tasks";

// ═══════════════════════════════════════════════════════════
// IMPORTEER-ANALYSE-TRECHTER
// ═══════════════════════════════════════════════════════════
// Een externe cluster-analyse (bv. een Cowork-sheet met per URL een actie:
// 301 / behouden / de-optimaliseren + target + reden) wordt ingelezen als een
// lijst voorstellen. Per rij: een plan-alinea voor de pagina + een taak, met
// een live-vlag (groen = live data is het eens, oranje = check dit). Jij
// accepteert per rij; de rest wordt weggegooid. De hele analyse blijft als
// bevroren momentopname bewaard.
// ═══════════════════════════════════════════════════════════

export type ImportItem = {
  url: string;
  stad: string;
  rol: string;
  actie: string;
  target: string;
  reden: string;
  sheetClicks: number | null;
  plan: string;
  task: { taak: string; fase: string; wie: string; geblokkeerd: boolean; blokkadeReden: string };
  flag: "green" | "amber";
  flagReason: string;
  accept: boolean;
};

function norm(s: unknown): string { return (s === null || s === undefined) ? "" : String(s).trim(); }
function normUrl(u: string): string { return norm(u).replace(/^https?:\/\/[^/]+/i, "").trim() || norm(u); }

function findCol(headers: string[], ...needles: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (needles.every((n) => h.includes(n))) return i;
  }
  return -1;
}

function faseFor(actie: string): string {
  const a = actie.toLowerCase();
  if (/301|redirect|samenvoeg|merge|opschon|verwijder/.test(a)) return "Opschonen";
  if (/de-?optimal|herbedrad|intern link|ompunt/.test(a)) return "Herbedraden";
  if (/behoud|optimal|bouw|nieuw|winnaar|upgrade/.test(a)) return "Bouwen";
  return "";
}
function wieFor(actie: string): string {
  const a = actie.toLowerCase();
  if (/301|redirect|technical|intern link|ompunt|samenvoeg/.test(a)) return "Dev";
  return "SEO";
}
function taakFor(actie: string, url: string, target: string): string {
  const a = actie.toLowerCase();
  if (/301|redirect/.test(a)) return `Redirect ${url}${target ? ` → ${target}` : ""}`;
  if (/samenvoeg|merge/.test(a)) return `Samenvoegen ${url}${target ? ` → ${target}` : ""}`;
  if (/de-?optimal/.test(a)) return `De-optimaliseer ${url}`;
  if (/behoud.*optimal|optimal/.test(a)) return `Optimaliseer ${url}`;
  if (/behoud/.test(a)) return `Behouden (geen actie): ${url}`;
  if (/nieuw|bouw/.test(a)) return `Bouw pagina ${url}`;
  return `${actie}: ${url}${target ? ` → ${target}` : ""}`;
}

// Bouwt voorstellen uit een 2D-array (kop + rijen).
export function buildItemsFromRows(rows: string[][], cluster: string): ImportItem[] {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => norm(h));
  const cUrl = findCol(headers, "url") >= 0 ? findCol(headers, "url") : findCol(headers, "pad");
  const cStad = findCol(headers, "stad") >= 0 ? findCol(headers, "stad") : findCol(headers, "blok");
  const cRol = findCol(headers, "rol");
  const cActie = findCol(headers, "actie");
  const cTarget = findCol(headers, "target") >= 0 ? findCol(headers, "target") : findCol(headers, "doel");
  const cReden = findCol(headers, "reden");
  const cClicks = findCol(headers, "gsc", "click");

  const data = rows.slice(1).filter((r) => cUrl >= 0 && norm(r[cUrl]) && norm(r[cUrl]) !== "-");

  // Bestemmingen die worden behouden/geoptimaliseerd (waar een redirect op wacht).
  const destinations = new Set<string>();
  for (const r of data) {
    const actie = cActie >= 0 ? norm(r[cActie]) : "";
    if (/behoud|optimal|winnaar|bouw|nieuw|upgrade/i.test(actie)) destinations.add(normUrl(norm(r[cUrl])));
  }

  return data.map((r) => {
    const url = normUrl(norm(r[cUrl]));
    const stad = cStad >= 0 ? norm(r[cStad]) : "";
    const rol = cRol >= 0 ? norm(r[cRol]) : "";
    const actie = cActie >= 0 ? norm(r[cActie]) : "";
    const target = cTarget >= 0 ? normUrl(norm(r[cTarget])) : "";
    const reden = cReden >= 0 ? norm(r[cReden]) : "";
    const sheetClicksRaw = cClicks >= 0 ? norm(r[cClicks]).replace(/[^\d]/g, "") : "";
    const sheetClicks = sheetClicksRaw ? Number(sheetClicksRaw) : null;

    const plan = [
      rol ? `Rol: ${rol}.` : "",
      actie && actie !== "-" ? `Actie: ${actie}.` : "",
      target && target !== "-" ? `Doel-URL: ${target}.` : "",
      reden ? `Reden: ${reden}.` : "",
    ].filter(Boolean).join(" ");

    const fase = faseFor(actie);
    const isRedirect = /301|redirect|samenvoeg|merge/i.test(actie);
    const targetKept = target && destinations.has(target);
    const geblokkeerd = isRedirect && !!targetKept;

    const ambiguous = /\/|(\bof\b)/i.test(actie);
    let flag: "green" | "amber" = "green";
    let flagReason = "duidelijk";
    if (ambiguous) { flag = "amber"; flagReason = "analyse twijfelt tussen opties"; }
    else if (isRedirect && sheetClicks !== null && sheetClicks > 5) { flag = "amber"; flagReason = "pagina heeft nog verkeer, check"; }

    return {
      url, stad, rol, actie, target, reden, sheetClicks, plan,
      task: {
        taak: taakFor(actie, url, target),
        fase,
        wie: wieFor(actie),
        geblokkeerd,
        blokkadeReden: geblokkeerd ? `wacht tot ${target} geoptimaliseerd is` : "",
      },
      flag, flagReason,
      accept: flag === "green" && !/behoud(?!.*optimal)/i.test(actie) && actie !== "-",
    };
  });
}

// Verrijkt de vlaggen met LIVE data uit de spiegel (client_urls): een redirect
// van een pagina die live nog verkeer heeft wordt oranje; een pagina die live
// al 404/301 is, is groen (klaar).
export async function computeLiveFlags(slug: string, items: ImportItem[]): Promise<ImportItem[]> {
  const urls = await getClientUrls(slug);
  const byUrl = new Map(urls.map((u) => [normUrl(u.url), u]));
  return items.map((it) => {
    const live = byUrl.get(it.url);
    if (!live) return it;
    const isRedirect = /301|redirect|samenvoeg|merge/i.test(it.actie);
    if (isRedirect && live.gscClicks > 10) {
      return { ...it, flag: "amber", flagReason: `live nog ${live.gscClicks} klikken, check`, accept: false };
    }
    if (isRedirect && live.status !== null && live.status >= 300) {
      return { ...it, flag: "green", flagReason: "live al geen 200 meer" };
    }
    return it;
  });
}

async function ensureAnalysesTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS analyses (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      name        TEXT,
      source      TEXT,
      raw         JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

// Accepteert de geselecteerde voorstellen: plan-alinea's opslaan, taken
// aanmaken (met fase/cluster/blokkade) en de hele analyse bevriezen.
export async function acceptItems(slug: string, cluster: string, items: ImportItem[], source: string, snapshot: unknown): Promise<{ plans: number; tasks: number; analysisId: number }> {
  await ensureSchema();
  await ensureAnalysesTable();

  const ins = await sql`INSERT INTO analyses (client_slug, name, source, raw) VALUES (${slug}, ${cluster || null}, ${source || null}, ${JSON.stringify(snapshot ?? items)}) RETURNING id`;
  const analysisId = Number(ins.rows[0]?.id || 0);

  let plans = 0;
  for (const it of items) {
    if (it.plan && it.url) { await savePagePlan(slug, it.url, it.plan); plans++; }
  }

  const tasksToAdd = items.map((it) => ({
    taak: it.task.taak,
    toelichting: it.reden || "",
    status: "Gepland",
    wie: it.task.wie,
    fase: it.task.fase,
    cluster: cluster || "",
    geblokkeerd: it.task.geblokkeerd,
    blokkadeReden: it.task.blokkadeReden,
    pageUrl: it.url,
    klantZichtbaar: true,
  }));
  const tasks = await appendTasks(slug, tasksToAdd);

  return { plans, tasks, analysisId };
}
