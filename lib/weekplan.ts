// ═══════════════════════════════════════════════════════════
// WEEKPLANNING: taken uit een bird's eye-onderwerp, verdeeld over weken
// ═══════════════════════════════════════════════════════════
// Sinds de samenvoeging leven deze taken in de gedeelde takenlijst (client_tasks):
// één lijst, twee weergaven ("week voor jou, maand voor klant"). De weekplanning-
// kaarten zijn de client_tasks-rijen met step_kind LIKE 'weekplan%'. Ze hangen aan
// een ISO-week (week_year + week_no); de maand (klant-rollup) leiden we af uit de
// week. Slepen = de week bijwerken (en de maand schuift mee). Los van de pijplijn-
// staptaken. De oude losse client_weekplan-tabel blijft staan (audit) en wordt
// eenmalig, idempotent overgenomen.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";

export type WeekplanTask = {
  id: number; thread: string; taak: string; toelichting: string; wie: string; url: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
};

// Nederlandse maandnamen (lowercase), gelijk aan MAAND_VOLGORDE in lib/sheet.ts.
// Bewust hier lokaal, zodat weekplan.ts niets uit sheet.ts hoeft te importeren
// (voorkomt een import-cirkel met tasks.ts).
const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

// ISO-8601-weeknummer (maandag als eerste dag). Server en client berekenen dit
// los, dus geen afhankelijkheid nodig.
export function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;                 // maandag=0 … zondag=6
  date.setUTCDate(date.getUTCDate() - dayNr + 3);           // donderdag van deze week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNr + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: date.getUTCFullYear(), week };
}

// De maand (voor de klant-rollup) die bij een ISO-week hoort: we nemen de maand
// van de DONDERDAG van die week (de canonieke ISO-dag), zodat een week die over
// een maandgrens valt niet naar de verkeerde maand schuift. Geeft een lowercase
// Nederlandse maandnaam terug (of "" bij een ongeplande week 0).
export function monthFromISOWeek(year: number, week: number): string {
  if (!week || week < 1) return "";
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const thursday = new Date(week1Monday);
  thursday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7 + 3);
  return MAANDEN[thursday.getUTCMonth()] || "";
}

// Statusvertaling tussen het weekbord (gepland/bezig/klaar) en de canonieke status
// in client_tasks (Gepland/Bezig/Klaar/…), zodat beide weergaven het eens zijn.
function toBoardStatus(s: string): string {
  const t = (s || "").toLowerCase();
  if (t.startsWith("bezig") || t.includes("dev")) return "bezig";
  if (t.startsWith("klaar") || t.startsWith("verwerkt") || t.startsWith("gedaan") || t.startsWith("af")) return "klaar";
  return "gepland";
}
function toCanonStatus(s: string): string {
  const b = toBoardStatus(s);
  return b === "bezig" ? "Bezig" : b === "klaar" ? "Klaar" : "Gepland";
}

// Eenmalige, idempotente overname van de oude losse client_weekplan-tabel naar de
// gedeelde takenlijst. Bewaart client_weekplan ongemoeid (audit). Draait hooguit
// één keer per klant (app_settings-vlag). Idempotent op step_kind = 'weekplan:<oud-id>'.
export async function backfillWeekplan(slug: string): Promise<void> {
  const flagKey = `weekplan_migrated_${slug}`;
  const { rows: flag } = await sql`SELECT value FROM app_settings WHERE key = ${flagKey} LIMIT 1`;
  if (flag[0]?.value === "true") return;
  const { rows } = await sql`
    SELECT id, thread, taak, toelichting, wie, url, week_year, week_no, status, sort_order
    FROM client_weekplan WHERE client_slug = ${slug} ORDER BY id`;
  const { rows: ord } = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM client_tasks WHERE client_slug = ${slug}`;
  let order = Number(ord[0]?.m ?? -1) + 1;
  for (const r of rows) {
    const taak = String(r.taak || "").trim();
    if (!taak) continue;
    const stepKind = `weekplan:${r.id}`;
    const { rows: ex } = await sql`SELECT 1 FROM client_tasks WHERE client_slug = ${slug} AND step_kind = ${stepKind} LIMIT 1`;
    if (ex.length) continue;
    const wy = Number(r.week_year) || 0;
    const wn = Number(r.week_no) || 0;
    const maand = wn > 0 ? monthFromISOWeek(wy, wn) : null;
    await sql`
      INSERT INTO client_tasks (client_slug, sort_order, taak, toelichting, status, wie, klant_zichtbaar, page_url, step_kind, thread, week_year, week_no, maand, updated_at)
      VALUES (${slug}, ${order}, ${taak}, ${r.toelichting || null}, ${toCanonStatus(String(r.status || "gepland"))}, ${r.wie || "SEO"}, false, ${r.url || null}, ${stepKind}, ${r.thread || null}, ${wy}, ${wn}, ${maand}, now())`;
    order++;
  }
  await sql`INSERT INTO app_settings (key, value) VALUES (${flagKey}, 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`;
}

// De weekplanning-kaarten van een klant: de client_tasks-rijen die uit het weekbord
// komen (step_kind LIKE 'weekplan%'). Status wordt naar het bord-vocabulaire vertaald.
export async function getWeekplan(slug: string): Promise<WeekplanTask[]> {
  await ensureSchema();
  await backfillWeekplan(slug).catch(() => { /* niet kritisch */ });
  const { rows } = await sql`
    SELECT id, thread, taak, toelichting, wie, page_url, link, week_year, week_no, status, sort_order
    FROM client_tasks
    WHERE client_slug = ${slug} AND step_kind LIKE 'weekplan%'
    ORDER BY week_year, week_no, sort_order, id`;
  return rows.map((r) => ({
    id: r.id as number, thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    wie: (r.wie as string) || "SEO", url: (r.page_url as string) || (r.link as string) || "",
    weekYear: Number(r.week_year) || 0, weekNo: Number(r.week_no) || 0,
    status: toBoardStatus((r.status as string) || "gepland"), sortOrder: Number(r.sort_order) || 0,
  }));
}

// Voegt weekplanning-taken toe aan de gedeelde takenlijst, elk in hun eigen week.
// Ze zijn intern (klant_zichtbaar = false); de maand leiden we af uit de week.
export async function addWeekplanTasks(slug: string, thread: string, tasks: { taak: string; toelichting?: string; wie?: string; url?: string; week: { year: number; week: number } }[]): Promise<number> {
  await ensureSchema();
  const { rows: ord } = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM client_tasks WHERE client_slug = ${slug}`;
  let order = Number(ord[0]?.m ?? -1) + 1;
  let n = 0;
  for (const t of tasks) {
    const taak = (t.taak || "").trim();
    if (!taak) continue;
    const wie = /dev/i.test(t.wie || "") ? "Dev" : "SEO";
    const url = (t.url || "").trim().slice(0, 400) || null;
    const toel = (t.toelichting || "").trim().slice(0, 4000) || null;
    const wy = Number(t.week?.year) || 0;
    const wn = Number(t.week?.week) || 0;
    const maand = wn > 0 ? monthFromISOWeek(wy, wn) : null;
    await sql`
      INSERT INTO client_tasks (client_slug, sort_order, taak, toelichting, status, wie, klant_zichtbaar, page_url, step_kind, thread, week_year, week_no, maand, updated_at)
      VALUES (${slug}, ${order}, ${taak.slice(0, 400)}, ${toel}, 'Gepland', ${wie}, false, ${url}, 'weekplan', ${thread || null}, ${wy}, ${wn}, ${maand}, now())`;
    order++; n++;
  }
  return n;
}

// Werkt één weekplanning-taak bij (week/status/volgorde) in de gedeelde takenlijst.
// Verandert de week, dan schuift de maand (klant-rollup) mee.
export async function updateWeekplanTask(slug: string, id: number, patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number }): Promise<void> {
  await ensureSchema();
  if (patch.weekYear != null && patch.weekNo != null) {
    const wy = Number(patch.weekYear) || 0;
    const wn = Number(patch.weekNo) || 0;
    const maand = wn > 0 ? monthFromISOWeek(wy, wn) : null;
    await sql`
      UPDATE client_tasks SET week_year = ${wy}, week_no = ${wn}, maand = ${maand}, updated_at = now()
      WHERE client_slug = ${slug} AND id = ${id} AND step_kind LIKE 'weekplan%'`;
  }
  if (typeof patch.status === "string") {
    await sql`
      UPDATE client_tasks SET status = ${toCanonStatus(patch.status)}, updated_at = now()
      WHERE client_slug = ${slug} AND id = ${id} AND step_kind LIKE 'weekplan%'`;
  }
  if (typeof patch.sortOrder === "number") {
    await sql`
      UPDATE client_tasks SET sort_order = ${patch.sortOrder}, updated_at = now()
      WHERE client_slug = ${slug} AND id = ${id} AND step_kind LIKE 'weekplan%'`;
  }
}

// Verwijdert één weekplanning-taak uit de gedeelde takenlijst.
export async function deleteWeekplanTask(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_tasks WHERE client_slug = ${slug} AND id = ${id} AND step_kind LIKE 'weekplan%'`;
}
