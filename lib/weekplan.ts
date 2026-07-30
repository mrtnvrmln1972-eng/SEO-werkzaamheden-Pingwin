// ═══════════════════════════════════════════════════════════
// WEEKPLANNING: taken uit een bird's eye-onderwerp, verdeeld over weken
// ═══════════════════════════════════════════════════════════
// Los van de maand-takenlijst (client_tasks). Elke taak hangt aan een week
// (ISO-weeknummer + jaar) en aan het onderwerp (thread) waar hij uit rolde.
// Slepen = de week bijwerken. Uitvoeren/mailen komt via de kaart in de UI.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";

export type WeekplanTask = {
  id: number; thread: string; taak: string; toelichting: string; wie: string; url: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
};

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

export async function getWeekplan(slug: string): Promise<WeekplanTask[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, thread, taak, toelichting, wie, url, week_year, week_no, status, sort_order
    FROM client_weekplan WHERE client_slug = ${slug}
    ORDER BY week_year, week_no, sort_order, id`;
  return rows.map((r) => ({
    id: r.id as number, thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    wie: (r.wie as string) || "SEO", url: (r.url as string) || "",
    weekYear: r.week_year as number, weekNo: r.week_no as number,
    status: (r.status as string) || "gepland", sortOrder: r.sort_order as number,
  }));
}

// Voegt taken toe in een bepaalde week (standaard de huidige week).
export async function addWeekplanTasks(slug: string, thread: string, tasks: { taak: string; toelichting?: string; wie?: string; url?: string }[], week: { year: number; week: number }): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const t of tasks) {
    const taak = (t.taak || "").trim();
    if (!taak) continue;
    const wie = /dev/i.test(t.wie || "") ? "Dev" : "SEO";
    const url = (t.url || "").trim().slice(0, 400) || null;
    const toel = (t.toelichting || "").trim().slice(0, 4000) || null;
    await sql`
      INSERT INTO client_weekplan (client_slug, thread, taak, toelichting, wie, url, week_year, week_no, status, sort_order, updated_at)
      VALUES (${slug}, ${thread || null}, ${taak.slice(0, 400)}, ${toel}, ${wie}, ${url}, ${week.year}, ${week.week}, 'gepland', ${n}, now())`;
    n++;
  }
  return n;
}

export async function updateWeekplanTask(slug: string, id: number, patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number }): Promise<void> {
  await ensureSchema();
  const weekYear = patch.weekYear ?? null;
  const weekNo = patch.weekNo ?? null;
  const status = patch.status ?? null;
  const sortOrder = patch.sortOrder ?? null;
  await sql`
    UPDATE client_weekplan SET
      week_year  = COALESCE(${weekYear}, week_year),
      week_no    = COALESCE(${weekNo}, week_no),
      status     = COALESCE(${status}, status),
      sort_order = COALESCE(${sortOrder}, sort_order),
      updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

export async function deleteWeekplanTask(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id}`;
}
