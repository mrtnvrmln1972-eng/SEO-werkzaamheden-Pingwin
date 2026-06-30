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

// Inhoudssleutel van een taak: twee rijen met exact dezelfde inhoud (taak,
// toelichting, uren, status, maand, link, wie) zijn duplicaten. Gebruikt om
// per ongeluk verdubbelde rijen te ontdubbelen bij inlezen en opslaan.
function taskKey(t: TaskRow): string {
  return [
    (t.taak || "").trim(),
    (t.toelichting || "").trim(),
    t.uren ?? "",
    (t.status || "").trim().toLowerCase(),
    (t.maand || "").trim().toLowerCase(),
    (t.link || "").trim(),
    (t.wie || "").trim().toLowerCase(),
  ].join("");
}

// Houdt de eerste van elke set inhoudelijk identieke rijen; gooit de rest weg.
function dedupeTasks(tasks: TaskRow[]): TaskRow[] {
  const seen = new Set<string>();
  const out: TaskRow[] = [];
  for (const t of tasks) {
    const k = taskKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export async function getTasks(slug: string): Promise<TaskRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, categorie, taak, toelichting, uren, status, maand, link, wie, klant_zichtbaar, gemaild
    FROM client_tasks WHERE client_slug = ${slug} ORDER BY sort_order ASC, id ASC`;
  const mapped = rows.map((r) => ({
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
  return dedupeTasks(mapped);
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
  const clean = dedupeTasks(tasks);
  let n = 0;
  for (let i = 0; i < clean.length; i++) {
    const t = clean[i];
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
