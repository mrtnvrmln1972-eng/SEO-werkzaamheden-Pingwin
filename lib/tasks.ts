import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// WERKZAAMHEDEN PER KLANT (in het dashboard, niet in Google Sheets)
// ═══════════════════════════════════════════════════════════
// SEO- en Dev-taken samen. Bewerkbaar in de cockpit; het klant-dashboard
// toont alleen rijen met klant_zichtbaar = true.
// ═══════════════════════════════════════════════════════════

export type TaskRow = {
  id?: number;
  categorie: string;
  taak: string;
  toelichting: string;
  uren: number | null;
  status: string;
  maand: string;
  link: string;
  wie: string;            // "SEO" | "Dev"
  klantZichtbaar: boolean;
  gemaild?: boolean;      // naar developer gemaild → blijft oranje tot 'Klaar'
};

export async function getTasks(slug: string): Promise<TaskRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, categorie, taak, toelichting, uren, status, maand, link, wie, klant_zichtbaar, gemaild
    FROM client_tasks WHERE client_slug = ${slug} ORDER BY sort_order ASC, id ASC`;
  return rows.map((r) => ({
    id: r.id as number,
    categorie: r.categorie ?? "",
    taak: r.taak ?? "",
    toelichting: r.toelichting ?? "",
    uren: r.uren === null ? null : Number(r.uren),
    status: r.status ?? "",
    maand: r.maand ?? "",
    link: r.link ?? "",
    wie: r.wie ?? "",
    klantZichtbaar: !!r.klant_zichtbaar,
    gemaild: !!r.gemaild,
  }));
}

export async function hasTasks(slug: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await sql`SELECT 1 FROM client_tasks WHERE client_slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

// Vervangt alle werkzaamheden van een klant door de meegegeven lijst.
// De volgorde in de array bepaalt sort_order (slepen/sorteren).
export async function replaceTasks(slug: string, tasks: TaskRow[]): Promise<number> {
  await ensureSchema();
  await sql`DELETE FROM client_tasks WHERE client_slug = ${slug}`;
  let n = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t.taak || !t.taak.trim()) continue;
    const uren = t.uren === null || t.uren === undefined || Number.isNaN(Number(t.uren)) ? null : Number(t.uren);
    await sql`
      INSERT INTO client_tasks (client_slug, sort_order, categorie, taak, toelichting, uren, status, maand, link, wie, klant_zichtbaar, gemaild, updated_at)
      VALUES (${slug}, ${i}, ${t.categorie || null}, ${t.taak.trim()}, ${t.toelichting || null}, ${uren},
              ${t.status || null}, ${(t.maand || "").toLowerCase() || null}, ${t.link || null}, ${t.wie || null}, ${!!t.klantZichtbaar}, ${!!t.gemaild}, now())`;
    n++;
  }
  return n;
}
