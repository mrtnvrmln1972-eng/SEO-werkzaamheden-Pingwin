import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// DATA-BRUG: snapshots per klant lezen en inladen
// ═══════════════════════════════════════════════════════════
// De echte data (mails uit Outlook, KPI's uit GSC/GA4/Ahrefs) wordt
// opgehaald via de connectoren in Claude en hier ingeladen met POST
// /api/admin/ingest. Het dashboard leest deze tabellen, los van Claude.
// ═══════════════════════════════════════════════════════════

export type EmailSnapshot = {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  preview: string | null;
  webLink: string | null;
  superhumanLink: string | null;
  bodyHtml: string | null;
  direction: string | null;
};

// Actuele stand van zaken = een gesprek klant ↔ wij, plus losse taken.
// Eén punt uit de correspondentie (vraag/antwoord), links de klant of rechts wij.
export type StatusExchange = {
  side: "client" | "us";          // links = client, rechts = us
  text: string;                    // korte samenvatting in één regel
  date?: string | null;            // ISO-datum van de mail
  status?: "open" | "done";        // open = rood, done = groen
  mailLink?: string | null;        // directe link naar de mail (Superhuman)
};

// Eén lopende werkzaamheid (aparte kolom), linkt naar de Google Sheet/werkdoc.
export type StatusTask = {
  text: string;
  sheetLink?: string | null;
};

export type ClientStatus = {
  exchanges: StatusExchange[];
  tasks: StatusTask[];
};

export type MetricSnapshot = {
  source: string;
  metric: string;
  period: string;
  value: number | null;
};

export type KeywordSnapshot = {
  keyword: string;
  position: number | null;
  prevPosition: number | null;
  volume: number | null;
  url: string | null;
};

export type PageSnapshot = {
  url: string;
  clicks: number | null;
  impressions: number | null;
  traffic: number | null;
};

// ── Lezen (voor het dashboard) ──────────────────────────────

export async function getEmails(slug: string, limit = 50): Promise<EmailSnapshot[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, subject, from_name, from_address, received_at, preview, web_link, superhuman_link, body_html, direction
    FROM client_emails WHERE client_slug = ${slug}
    ORDER BY received_at DESC NULLS LAST LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    fromName: r.from_name,
    fromAddress: r.from_address,
    receivedAt: r.received_at ? new Date(r.received_at as string).toISOString() : null,
    preview: r.preview,
    webLink: r.web_link,
    superhumanLink: r.superhuman_link ?? null,
    bodyHtml: r.body_html ?? null,
    direction: r.direction,
  }));
}

export async function deleteEmails(slug: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_emails WHERE client_slug = ${slug}`;
}

const EMPTY_STATUS: ClientStatus = { exchanges: [], tasks: [] };

export async function getStatus(slug: string): Promise<{ status: ClientStatus; updatedAt: string | null }> {
  await ensureSchema();
  const { rows } = await sql`SELECT content, updated_at FROM client_status WHERE client_slug = ${slug} LIMIT 1`;
  if (!rows[0] || !rows[0].content) return { status: EMPTY_STATUS, updatedAt: null };
  let status: ClientStatus = EMPTY_STATUS;
  try {
    const parsed = JSON.parse(rows[0].content as string);
    status = {
      exchanges: Array.isArray(parsed?.exchanges) ? parsed.exchanges : [],
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [],
    };
  } catch {
    status = EMPTY_STATUS;
  }
  const t = rows[0].updated_at as string | null;
  return { status, updatedAt: t ? new Date(t).toISOString() : null };
}

export async function getMetrics(slug: string): Promise<MetricSnapshot[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT source, metric, period, value FROM client_metrics
    WHERE client_slug = ${slug} ORDER BY source, metric, period`;
  return rows.map((r) => ({
    source: r.source,
    metric: r.metric,
    period: r.period,
    value: r.value === null ? null : Number(r.value),
  }));
}

export async function getKeywords(slug: string, limit = 100): Promise<KeywordSnapshot[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT keyword, position, prev_position, volume, url FROM client_keywords
    WHERE client_slug = ${slug}
    ORDER BY position ASC NULLS LAST LIMIT ${limit}`;
  return rows.map((r) => ({
    keyword: r.keyword,
    position: r.position === null ? null : Number(r.position),
    prevPosition: r.prev_position === null ? null : Number(r.prev_position),
    volume: r.volume === null ? null : Number(r.volume),
    url: r.url,
  }));
}

export async function getPages(slug: string, limit = 50): Promise<PageSnapshot[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT url, clicks, impressions, traffic FROM client_pages
    WHERE client_slug = ${slug}
    ORDER BY clicks DESC NULLS LAST LIMIT ${limit}`;
  return rows.map((r) => ({
    url: r.url,
    clicks: r.clicks === null ? null : Number(r.clicks),
    impressions: r.impressions === null ? null : Number(r.impressions),
    traffic: r.traffic === null ? null : Number(r.traffic),
  }));
}

export async function getLastIngest(slug: string): Promise<string | null> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT MAX(ingested_at) AS t FROM client_emails WHERE client_slug = ${slug}`;
  const t = rows[0]?.t as string | null;
  return t ? new Date(t).toISOString() : null;
}

export async function setClientMapping(
  slug: string,
  domain: string | null,
  ahrefsProjectId: string | null,
): Promise<void> {
  await ensureSchema();
  if (domain) await sql`UPDATE clients SET domain = ${domain} WHERE slug = ${slug}`;
  if (ahrefsProjectId) await sql`UPDATE clients SET ahrefs_project_id = ${ahrefsProjectId} WHERE slug = ${slug}`;
}

// ── Inladen (vanuit de brug, via de ingest-route) ───────────

export async function ingestEmails(slug: string, emails: EmailSnapshot[]): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const e of emails) {
    if (!e.id) continue;
    await sql`
      INSERT INTO client_emails (id, client_slug, subject, from_name, from_address, received_at, preview, web_link, superhuman_link, body_html, direction, ingested_at)
      VALUES (${e.id}, ${slug}, ${e.subject ?? null}, ${e.fromName ?? null}, ${e.fromAddress ?? null},
              ${e.receivedAt ?? null}, ${e.preview ?? null}, ${e.webLink ?? null}, ${e.superhumanLink ?? null}, ${e.bodyHtml ?? null}, ${e.direction ?? null}, now())
      ON CONFLICT (id) DO UPDATE SET
        subject = EXCLUDED.subject, from_name = EXCLUDED.from_name, from_address = EXCLUDED.from_address,
        received_at = EXCLUDED.received_at, preview = EXCLUDED.preview, web_link = EXCLUDED.web_link,
        superhuman_link = EXCLUDED.superhuman_link, body_html = EXCLUDED.body_html, direction = EXCLUDED.direction, ingested_at = now()`;
    n++;
  }
  return n;
}

export async function ingestMetrics(slug: string, metrics: MetricSnapshot[]): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const m of metrics) {
    if (!m.source || !m.metric || !m.period) continue;
    await sql`
      INSERT INTO client_metrics (client_slug, source, metric, period, value, captured_at)
      VALUES (${slug}, ${m.source}, ${m.metric}, ${m.period}, ${m.value ?? null}, now())
      ON CONFLICT (client_slug, source, metric, period) DO UPDATE SET
        value = EXCLUDED.value, captured_at = now()`;
    n++;
  }
  return n;
}

export async function ingestKeywords(slug: string, keywords: KeywordSnapshot[]): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const k of keywords) {
    if (!k.keyword) continue;
    await sql`
      INSERT INTO client_keywords (client_slug, keyword, position, prev_position, volume, url, captured_at)
      VALUES (${slug}, ${k.keyword}, ${k.position ?? null}, ${k.prevPosition ?? null}, ${k.volume ?? null}, ${k.url ?? null}, now())
      ON CONFLICT (client_slug, keyword) DO UPDATE SET
        position = EXCLUDED.position, prev_position = EXCLUDED.prev_position,
        volume = EXCLUDED.volume, url = EXCLUDED.url, captured_at = now()`;
    n++;
  }
  return n;
}

export async function ingestStatus(slug: string, status: ClientStatus): Promise<number> {
  await ensureSchema();
  const clean: ClientStatus = {
    exchanges: Array.isArray(status?.exchanges) ? status.exchanges : [],
    tasks: Array.isArray(status?.tasks) ? status.tasks : [],
  };
  const content = JSON.stringify(clean);
  await sql`
    INSERT INTO client_status (client_slug, content, updated_at)
    VALUES (${slug}, ${content}, now())
    ON CONFLICT (client_slug) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`;
  return clean.exchanges.length + clean.tasks.length;
}

export async function ingestPages(slug: string, pages: PageSnapshot[]): Promise<number> {
  await ensureSchema();
  let n = 0;
  for (const p of pages) {
    if (!p.url) continue;
    await sql`
      INSERT INTO client_pages (client_slug, url, clicks, impressions, traffic, captured_at)
      VALUES (${slug}, ${p.url}, ${p.clicks ?? null}, ${p.impressions ?? null}, ${p.traffic ?? null}, now())
      ON CONFLICT (client_slug, url) DO UPDATE SET
        clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
        traffic = EXCLUDED.traffic, captured_at = now()`;
    n++;
  }
  return n;
}
