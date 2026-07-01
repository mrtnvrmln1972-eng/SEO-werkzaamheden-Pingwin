import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// KPI-VOORKEUREN: handmatige volgorde van Search Console-pagina's
// ═══════════════════════════════════════════════════════════
// Maarten kan pagina's in de KPI-tab omhoog/omlaag slepen om de pagina's die
// hij in de gaten houdt bovenaan vast te zetten. De volgorde (een lijst URL's)
// bewaren we hier per klant. Pagina's die (nog) niet in de lijst staan komen
// er onderaan achter, in hun eigen (klikken-)volgorde.
// ═══════════════════════════════════════════════════════════

async function ensureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS kpi_page_order (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      position    INTEGER NOT NULL,
      PRIMARY KEY (client_slug, url)
    )`;
}

export async function getPageOrder(slug: string): Promise<string[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url FROM kpi_page_order WHERE client_slug = ${slug} ORDER BY position ASC`;
  return rows.map((r) => r.url as string);
}

export async function savePageOrder(slug: string, urls: string[]): Promise<number> {
  await ensureSchema();
  await ensureTable();
  await sql`DELETE FROM kpi_page_order WHERE client_slug = ${slug}`;
  let n = 0;
  for (let i = 0; i < urls.length; i++) {
    const u = (urls[i] || "").trim();
    if (!u) continue;
    await sql`INSERT INTO kpi_page_order (client_slug, url, position) VALUES (${slug}, ${u}, ${i})
              ON CONFLICT (client_slug, url) DO UPDATE SET position = ${i}`;
    n++;
  }
  return n;
}
