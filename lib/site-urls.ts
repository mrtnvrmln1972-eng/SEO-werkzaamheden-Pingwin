import { sql, ensureSchema } from "./db";
import { getGscForClient } from "./google";

// ═══════════════════════════════════════════════════════════
// PAGINA'S-LAAG: de URL-lijst als SPIEGEL van de live site
// ═══════════════════════════════════════════════════════════
// De URL-lijst weerspiegelt de werkelijkheid (welke pagina's bestaan echt,
// hun live HTTP-status, titel en GSC-cijfers). Je bewerkt hem nooit; hij
// ververst zichzelf door de site opnieuw te scannen. Het "toekomstige adres"
// (redirect, nieuwe pagina) leeft NIET hier, maar in de plan-alinea + taken.
//
// page_plans: per pagina één plan-alinea (vrije tekst). De conclusie van een
// analyse, niet een gemodelleerde mapping.
// ═══════════════════════════════════════════════════════════

export type ClientUrl = {
  url: string;
  status: number | null;      // live HTTP-status (200/301/404...)
  redirectTarget: string;
  title: string;
  gscClicks: number;
  gscImpressions: number;
  plan: string;               // plan-alinea (leeg als nog niet aangeraakt)
  lastScanned: string | null;
};

// Draait de tabel-voorbereiding maar één keer per serverinstantie (gecachet),
// zodat elk verzoek niet opnieuw CREATE TABLE-rondjes naar de database doet.
let tablesReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (!tablesReady) tablesReady = doEnsureTables().catch((e) => { tablesReady = null; throw e; });
  return tablesReady;
}
async function doEnsureTables(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_urls (
      client_slug     TEXT NOT NULL,
      url             TEXT NOT NULL,
      status          INTEGER,
      redirect_target TEXT,
      title           TEXT,
      gsc_clicks      INTEGER NOT NULL DEFAULT 0,
      gsc_impressions INTEGER NOT NULL DEFAULT 0,
      last_scanned    TIMESTAMPTZ,
      PRIMARY KEY (client_slug, url)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS page_plans (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      plan        TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
}

function normUrl(u: string): string {
  return (u || "").trim();
}

// ── Sitemap ophalen (incl. sitemap-index), URL's verzamelen ──
async function fetchSitemapUrls(domain: string, max = 500): Promise<string[]> {
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/^www\./, "").replace(/\/$/, "")}`;
  const candidates = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`];
  const found = new Set<string>();
  const seenSitemaps = new Set<string>();

  async function loadSitemap(sm: string, depth: number): Promise<void> {
    if (depth > 3 || seenSitemaps.has(sm) || found.size >= max) return;
    seenSitemaps.add(sm);
    try {
      const res = await fetch(sm, { redirect: "follow" });
      if (!res.ok) return;
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
      const isIndex = /<sitemapindex/i.test(xml);
      if (isIndex) {
        for (const child of locs) { if (found.size < max) await loadSitemap(child, depth + 1); }
      } else {
        for (const u of locs) { if (found.size < max) found.add(u); }
      }
    } catch { /* sitemap optioneel */ }
  }

  for (const c of candidates) { if (found.size < max) await loadSitemap(c, 0); }
  return [...found].slice(0, max);
}

// ── Live status + titel per URL (HEAD/GET), begrensde parallelliteit ──
async function checkUrl(u: string): Promise<{ status: number | null; redirectTarget: string; title: string }> {
  try {
    const res = await fetch(u, { redirect: "manual" });
    const status = res.status;
    let redirectTarget = "";
    let title = "";
    if (status >= 300 && status < 400) {
      redirectTarget = res.headers.get("location") || "";
    } else if (status >= 200 && status < 300) {
      const html = await res.text();
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
    }
    return { status, redirectTarget, title };
  } catch {
    return { status: null, redirectTarget: "", title: "" };
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Scant de live site en werkt de spiegel bij. Idempotent (upsert per URL).
export async function scanClientUrls(slug: string, domain: string): Promise<{ scanned: number }> {
  await ensureSchema();
  await ensureTables();
  if (!domain) return { scanned: 0 };

  const urls = await fetchSitemapUrls(domain, 500);

  // GSC-cijfers per pagina erbij (laatste 28 dagen), best effort.
  const gscMap = new Map<string, { clicks: number; impressions: number }>();
  try {
    const gsc = await getGscForClient(domain);
    if (gsc) for (const p of gsc.pages) gscMap.set(normUrl(p.url), { clicks: p.clicks, impressions: p.impressions });
  } catch { /* optioneel */ }

  // Als de sitemap leeg is, val terug op de GSC-pagina's (die bestaan sowieso live).
  const targetUrls = urls.length > 0 ? urls : [...gscMap.keys()];

  const checks = await mapLimited(targetUrls, 10, checkUrl);

  for (let k = 0; k < targetUrls.length; k++) {
    const u = normUrl(targetUrls[k]);
    if (!u) continue;
    const c = checks[k];
    const g = gscMap.get(u) || { clicks: 0, impressions: 0 };
    await sql`
      INSERT INTO client_urls (client_slug, url, status, redirect_target, title, gsc_clicks, gsc_impressions, last_scanned)
      VALUES (${slug}, ${u}, ${c.status}, ${c.redirectTarget || null}, ${c.title || null}, ${g.clicks}, ${g.impressions}, now())
      ON CONFLICT (client_slug, url) DO UPDATE SET
        status = ${c.status}, redirect_target = ${c.redirectTarget || null}, title = ${c.title || null},
        gsc_clicks = ${g.clicks}, gsc_impressions = ${g.impressions}, last_scanned = now()`;
  }

  return { scanned: targetUrls.length };
}

// De URL-lijst met de plan-alinea erbij (spiegel + plan).
export async function getClientUrls(slug: string): Promise<ClientUrl[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`
    SELECT u.url, u.status, u.redirect_target, u.title, u.gsc_clicks, u.gsc_impressions, u.last_scanned,
           p.plan
    FROM client_urls u
    LEFT JOIN page_plans p ON p.client_slug = u.client_slug AND p.url = u.url
    WHERE u.client_slug = ${slug}
    ORDER BY u.gsc_clicks DESC, u.url ASC`;
  return rows.map((r) => ({
    url: r.url as string,
    status: r.status === null ? null : Number(r.status),
    redirectTarget: (r.redirect_target as string) || "",
    title: (r.title as string) || "",
    gscClicks: Number(r.gsc_clicks) || 0,
    gscImpressions: Number(r.gsc_impressions) || 0,
    plan: (r.plan as string) || "",
    lastScanned: r.last_scanned ? new Date(r.last_scanned as string).toISOString() : null,
  }));
}

export async function getPagePlan(slug: string, url: string): Promise<string> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT plan FROM page_plans WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  return (rows[0]?.plan as string) || "";
}

export async function savePagePlan(slug: string, url: string, plan: string): Promise<void> {
  await ensureSchema();
  await ensureTables();
  await sql`
    INSERT INTO page_plans (client_slug, url, plan, updated_at)
    VALUES (${slug}, ${url}, ${plan || null}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET plan = ${plan || null}, updated_at = now()`;
}

// Voegt een pagina handmatig toe aan de spiegel (bijv. een nieuw-te-bouwen
// pagina die nog niet live is, of een pagina die niet in de sitemap staat).
export async function upsertUrl(slug: string, url: string, fields: Partial<{ status: number | null; title: string }> = {}): Promise<void> {
  await ensureSchema();
  await ensureTables();
  const u = normUrl(url);
  if (!u) return;
  await sql`
    INSERT INTO client_urls (client_slug, url, status, title, last_scanned)
    VALUES (${slug}, ${u}, ${fields.status ?? null}, ${fields.title ?? null}, now())
    ON CONFLICT (client_slug, url) DO NOTHING`;
}
