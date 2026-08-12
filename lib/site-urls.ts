import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
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
  hasClusterAdvice: boolean;  // kreeg cluster-advies mee vanuit de analyse van een andere pagina ("half plan")
  lastScanned: string | null;
  /** In welke bronnen deze pagina gevonden is: "sitemap", "gsc", "ahrefs",
      "links". Leeg bij pagina's van vóór de verenigde scan of handmatig
      toegevoegde pagina's. Een live pagina zónder "sitemap" is zelf een
      SEO-bevinding: hij bestaat, maar de site geeft hem niet op. */
  bronnen: string[];
};

// Draait de tabel-voorbereiding hooguit één keer per database, niet meer bij
// elke koude server. Zie lib/schema-stand.ts; het versienummer wordt bewaakt
// door proeven/schema-versie.proef.ts.
export const SITE_URLS_SCHEMA_VERSIE = "su1-0c70a85c";
async function ensureTables(): Promise<void> {
  return eenmalig("site-urls", SITE_URLS_SCHEMA_VERSIE, doEnsureTables);
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
  // Bestemmingsmap in Google Drive per pagina: waar de analyse/blauwdruk/copy
  // -documenten van deze landingspagina naartoe gaan.
  await sql`
    CREATE TABLE IF NOT EXISTS page_drive_folders (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      folder_id   TEXT NOT NULL,
      folder_name TEXT,
      folder_path TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
  // Tekst-uitkomst van elk gegenereerd document (analyse/blauwdruk/copy) per
  // pagina, zodat de volgende stap erop kan voortbouwen (de keten).
  await sql`
    CREATE TABLE IF NOT EXISTS page_doc_outputs (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      kind        TEXT NOT NULL,
      content     TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url, kind)
    )`;
  // Cluster-advies dat vanuit de analyse van één pagina wordt meegegeven aan een
  // ANDERE pagina in hetzelfde cluster (het vertrekpunt/"half plan" voor die pagina).
  await sql`
    CREATE TABLE IF NOT EXISTS page_cluster_advice (
      id              SERIAL PRIMARY KEY,
      client_slug     TEXT NOT NULL,
      url             TEXT NOT NULL,
      advice          TEXT NOT NULL,
      source_url      TEXT,
      source_analysis TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Additief voor bestaande tabellen: de volledige clusteranalyse (bronconclusie) erbij.
  await sql`ALTER TABLE page_cluster_advice ADD COLUMN IF NOT EXISTS source_analysis TEXT`;
  // De KORTE samenvatting per pagina: de "toplaag" die je meteen ziet als je een
  // pagina openklapt, boven de volledige (lange) vastgelegde strategie. Drie vaste
  // regels in gewone taal plus een optionele samenhang-regel. Wordt uit het plan
  // gedestilleerd (of met de hand bijgesteld), zodat je in één oogopslag weet wat
  // deze pagina nu doet en moet worden, zonder de hele analyse te lezen.
  await sql`
    CREATE TABLE IF NOT EXISTS page_summaries (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      nu          TEXT,
      doel        TEXT,
      zet         TEXT,
      related     TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url)
    )`;
  // In welke bronnen een pagina gevonden is (csv: sitemap,gsc,ahrefs,links). De
  // spiegel bouwt sindsdien op de vereniging van vier bronnen in plaats van
  // alleen de sitemap; zie verenigBronnen() hieronder.
  await sql`ALTER TABLE client_urls ADD COLUMN IF NOT EXISTS bronnen TEXT`;
}

function normUrl(u: string): string {
  return (u || "").trim();
}

/** De pad-sleutel waarop bronnen vergeleken worden: pad zonder slash aan het
    eind, kleine letters. Eén definitie, gebruikt door de verenigde scan én de
    sitemap-check, zodat die twee nooit tegen elkaar in praten. */
export function padSleutel(u: string): string {
  try { const p = new URL(u); return p.pathname.replace(/\/+$/, "").toLowerCase() || "/"; } catch { return normUrl(u); }
}

// Automatisch gegenereerde filter-/tagpagina's (webshopsystemen zoals Lightspeed
// zetten er duizenden in de sitemap). Geen pagina's waar SEO-werk op gebeurt;
// ze zouden de spiegel en de scan-limiet volproppen.
const EXCLUDED_PATHS = /\/(tags?|labels?)\//i;
export function isExcludedUrl(u: string): boolean {
  return EXCLUDED_PATHS.test(u);
}

// ── Sitemap ophalen (incl. sitemap-index), URL's verzamelen ──
async function fetchSitemapUrls(domain: string, max = 3000): Promise<string[]> {
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
        for (const u of locs) { if (found.size < max && !isExcludedUrl(u)) found.add(u); }
      }
    } catch { /* sitemap optioneel */ }
  }

  for (const c of candidates) { if (found.size < max) await loadSitemap(c, 0); }
  return [...found].slice(0, max);
}

// ── Live status + titel per URL (HEAD/GET), begrensde parallelliteit ──
// Geeft ook de interne links terug die op de pagina staan: de scan leest de HTML
// toch al, dus de vierde bron (welke pagina's zijn via links bereikbaar) is
// gratis en kost geen extra verzoek.
async function checkUrl(u: string): Promise<{ status: number | null; redirectTarget: string; title: string; links: string[] }> {
  try {
    const res = await fetch(u, { redirect: "manual" });
    const status = res.status;
    let redirectTarget = "";
    let title = "";
    const links: string[] = [];
    if (status >= 300 && status < 400) {
      redirectTarget = res.headers.get("location") || "";
    } else if (status >= 200 && status < 300) {
      const html = await res.text();
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
      for (const h of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
        const ruw = h[1].trim();
        if (!ruw || /^(mailto:|tel:|javascript:|data:)/i.test(ruw)) continue;
        try { links.push(new URL(ruw, u).toString()); } catch { /* geen bruikbare link */ }
      }
    }
    return { status, redirectTarget, title, links };
  } catch {
    return { status: null, redirectTarget: "", title: "", links: [] };
  }
}

// Bestanden en systeempaden die geen pagina zijn; die horen niet in de spiegel.
const GEEN_PAGINA = /\.(jpe?g|png|gif|webp|svg|ico|css|js|mjs|json|xml|txt|pdf|docx?|xlsx?|zip|rar|mp3|mp4|webm|woff2?|ttf|eot)(\?|$)/i;

/**
 * De vereniging van de vier bronnen tot één paginalijst met per pagina de
 * herkomst. Puur en testbaar (proeven/spiegel-bronnen.proef.ts): geen netwerk,
 * geen database. Alleen URL's van het eigen domein tellen mee; dubbelingen
 * (http/https, met/zonder slash, met/zonder www) worden één regel, waarbij de
 * vorm uit de vroegste bron wint (sitemap boven gsc boven ahrefs boven links).
 */
export function verenigBronnen(domain: string, bronnen: { sitemap: string[]; gsc: string[]; ahrefs: string[]; links: string[] }): { url: string; bronnen: string[] }[] {
  const eigenHost = (domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  const sleutel = (u: string): string | null => {
    try {
      const p = new URL(u);
      const host = p.hostname.replace(/^www\./, "").toLowerCase();
      if (host !== eigenHost) return null;
      if (GEEN_PAGINA.test(p.pathname) || isExcludedUrl(u)) return null;
      return p.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    } catch { return null; }
  };
  const perPad = new Map<string, { url: string; bronnen: string[] }>();
  const volgorde: (keyof typeof bronnen)[] = ["sitemap", "gsc", "ahrefs", "links"];
  for (const bron of volgorde) {
    for (const u of bronnen[bron]) {
      const k = sleutel(u);
      if (!k) continue;
      const bestaand = perPad.get(k);
      if (!bestaand) perPad.set(k, { url: normUrl(u), bronnen: [bron] });
      else if (!bestaand.bronnen.includes(bron)) bestaand.bronnen.push(bron);
    }
  }
  return [...perPad.values()];
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
//
// De spiegel bouwt sinds 12-08-2026 op VIER bronnen in plaats van alleen de
// sitemap: sitemap, Search Console, Ahrefs-toppagina's en de interne links die
// tijdens het scannen op de pagina's zelf gevonden worden. Waarom dat moest:
// /snelle-soa-test-amsterdam/ van One Day Clinic stond live, rankte op ruim
// twintig zoektermen, en bestond voor het dashboard niet, omdat hij niet in de
// sitemap zat. Een lijst die alleen de sitemap gelooft, mist precies de
// pagina's die aandacht nodig hebben. De herkomst wordt per pagina bewaard,
// zodat "live maar niet in de sitemap" een zichtbare bevinding is.
export async function scanClientUrls(slug: string, domain: string): Promise<{ scanned: number }> {
  await ensureSchema();
  await ensureTables();
  if (!domain) return { scanned: 0 };

  // Ruime grens: grote sites (webshops) hebben al snel duizenden pagina's in de
  // sitemap. Tag-/filterpagina's worden al bij het lezen uitgesloten.
  const sitemapUrls = await fetchSitemapUrls(domain, 3000);

  // Eerder ingelezen tag-/filterpagina's opruimen, maar NOOIT een pagina waar
  // al een plan op ligt (dan is er bewust werk op gedaan).
  await sql`
    DELETE FROM client_urls
    WHERE client_slug = ${slug} AND url ~* '/(tags?|labels?)/'
      AND url NOT IN (SELECT url FROM page_plans WHERE client_slug = ${slug})`;

  // Bron 2: Search Console (laatste 28 dagen), best effort. Levert de cijfers
  // per pagina én de pagina's die Google kent maar de sitemap niet noemt.
  const gscMap = new Map<string, { clicks: number; impressions: number }>();
  const gscPerPad = new Map<string, { clicks: number; impressions: number }>();
  try {
    const gsc = await getGscForClient(domain);
    if (gsc) for (const p of gsc.pages) {
      gscMap.set(normUrl(p.url), { clicks: p.clicks, impressions: p.impressions });
      gscPerPad.set(padSleutel(p.url), { clicks: p.clicks, impressions: p.impressions });
    }
  } catch { /* optioneel */ }

  // Bron 3: Ahrefs-toppagina's (30 dagen gecachet in lib/ahrefs.ts), best effort.
  let ahrefsUrls: string[] = [];
  try {
    const { ahrefsConfigured, getAhrefsTopPages } = await import("./ahrefs");
    if (ahrefsConfigured()) ahrefsUrls = (await getAhrefsTopPages(domain, 300)).map((p) => p.url);
  } catch { /* optioneel */ }

  // Eerste vereniging (zonder links; die vinden we pas tijdens het scannen).
  const eerste = verenigBronnen(domain, { sitemap: sitemapUrls, gsc: [...gscMap.keys()], ahrefs: ahrefsUrls, links: [] });
  const checks = await mapLimited(eerste, 10, (x) => checkUrl(x.url));

  // Bron 4: de interne links die op de gelezen pagina's staan. Doelen die nog in
  // geen enkele bron zaten worden alsnog gescand (begrensd), zodat ook een
  // pagina die alléén via een link bereikbaar is in de spiegel komt.
  const linkDoelen: string[] = [];
  for (const c of checks) linkDoelen.push(...c.links);
  const alles = verenigBronnen(domain, {
    sitemap: sitemapUrls, gsc: [...gscMap.keys()], ahrefs: ahrefsUrls, links: linkDoelen,
  });
  const bekend = new Set(eerste.map((x) => padSleutel(x.url)));
  const alleenViaLinks = alles.filter((x) => !bekend.has(padSleutel(x.url))).slice(0, 300);
  const extraChecks = await mapLimited(alleenViaLinks, 10, (x) => checkUrl(x.url));

  const bronnenPerPad = new Map(alles.map((x) => [padSleutel(x.url), x.bronnen]));
  const rijen = [
    ...eerste.map((x, i) => ({ url: x.url, check: checks[i] })),
    ...alleenViaLinks.map((x, i) => ({ url: x.url, check: extraChecks[i] })),
  ];

  for (const rij of rijen) {
    const u = normUrl(rij.url);
    if (!u) continue;
    const c = rij.check;
    const g = gscMap.get(u) || gscPerPad.get(padSleutel(u)) || { clicks: 0, impressions: 0 };
    const bron = (bronnenPerPad.get(padSleutel(u)) || []).join(",");
    await sql`
      INSERT INTO client_urls (client_slug, url, status, redirect_target, title, gsc_clicks, gsc_impressions, bronnen, last_scanned)
      VALUES (${slug}, ${u}, ${c.status}, ${c.redirectTarget || null}, ${c.title || null}, ${g.clicks}, ${g.impressions}, ${bron || null}, now())
      ON CONFLICT (client_slug, url) DO UPDATE SET
        status = ${c.status}, redirect_target = ${c.redirectTarget || null}, title = ${c.title || null},
        gsc_clicks = ${g.clicks}, gsc_impressions = ${g.impressions}, bronnen = ${bron || null}, last_scanned = now()`;
  }

  return { scanned: rijen.length };
}

// De URL-lijst met de plan-alinea erbij (spiegel + plan).
export async function getClientUrls(slug: string): Promise<ClientUrl[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`
    SELECT u.url, u.status, u.redirect_target, u.title, u.gsc_clicks, u.gsc_impressions, u.bronnen, u.last_scanned,
           p.plan,
           EXISTS (SELECT 1 FROM page_cluster_advice a WHERE a.client_slug = u.client_slug AND a.url = u.url) AS has_cluster_advice
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
    hasClusterAdvice: !!r.has_cluster_advice,
    lastScanned: r.last_scanned ? new Date(r.last_scanned as string).toISOString() : null,
    bronnen: r.bronnen ? String(r.bronnen).split(",").filter(Boolean) : [],
  }));
}

// Voegt een pagina handmatig toe aan de lijst: een NIEUWE pagina die nog niet bestaat
// en dus geen Search Console-data heeft. Zo kun je er tóch de vervolgstappen (plan,
// blauwdruk, copywriting) op doen. status NULL = nog niet live gecontroleerd. Bestaat
// de URL al, dan blijft de bestaande data staan en wordt alleen de titel bijgewerkt.
export async function addManualPage(slug: string, url: string, title: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  await ensureSchema();
  await ensureTables();
  const u = (url || "").trim();
  if (!u) return { ok: false, error: "Geef een URL of pad op voor de nieuwe pagina." };
  const t = (title || "").trim();
  await sql`
    INSERT INTO client_urls (client_slug, url, status, redirect_target, title, gsc_clicks, gsc_impressions, last_scanned)
    VALUES (${slug}, ${u}, NULL, '', ${t}, 0, 0, NULL)
    ON CONFLICT (client_slug, url) DO UPDATE SET title = COALESCE(NULLIF(${t}, ''), client_urls.title)`;
  return { ok: true, url: u };
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

// ── Korte samenvatting per pagina (de toplaag boven de volle strategie) ──
export type PageSummary = { nu: string; doel: string; zet: string; related: string };

export async function getPageSummary(slug: string, url: string): Promise<PageSummary | null> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT nu, doel, zet, related FROM page_summaries WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const s = { nu: (r.nu as string) || "", doel: (r.doel as string) || "", zet: (r.zet as string) || "", related: (r.related as string) || "" };
  // Leeg record telt als "nog geen samenvatting".
  if (!s.nu && !s.doel && !s.zet && !s.related) return null;
  return s;
}

export async function savePageSummary(slug: string, url: string, s: PageSummary): Promise<void> {
  await ensureSchema();
  await ensureTables();
  await sql`
    INSERT INTO page_summaries (client_slug, url, nu, doel, zet, related, updated_at)
    VALUES (${slug}, ${url}, ${s.nu || null}, ${s.doel || null}, ${s.zet || null}, ${s.related || null}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET nu = ${s.nu || null}, doel = ${s.doel || null}, zet = ${s.zet || null}, related = ${s.related || null}, updated_at = now()`;
}

// Uitkomst van een gegenereerd document opslaan/ophalen (voor de keten).
export async function savePageDocOutput(slug: string, url: string, kind: string, content: string): Promise<void> {
  await ensureSchema();
  await ensureTables();
  await sql`
    INSERT INTO page_doc_outputs (client_slug, url, kind, content, updated_at)
    VALUES (${slug}, ${url}, ${kind}, ${content || null}, now())
    ON CONFLICT (client_slug, url, kind) DO UPDATE SET content = ${content || null}, updated_at = now()`;
}

export async function getPageDocOutputs(slug: string, url: string): Promise<Record<string, string>> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT kind, content FROM page_doc_outputs WHERE client_slug = ${slug} AND url = ${url}`;
  const out: Record<string, string> = {};
  for (const r of rows) if (r.content) out[r.kind as string] = r.content as string;
  return out;
}

export type PageDriveFolder = { folderId: string; folderName: string; folderPath: string };

export async function getPageDriveFolder(slug: string, url: string): Promise<PageDriveFolder | null> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT folder_id, folder_name, folder_path FROM page_drive_folders WHERE client_slug = ${slug} AND url = ${url} LIMIT 1`;
  if (!rows[0]) return null;
  return { folderId: rows[0].folder_id as string, folderName: (rows[0].folder_name as string) || "", folderPath: (rows[0].folder_path as string) || "" };
}

export async function savePageDriveFolder(slug: string, url: string, folderId: string, folderName: string, folderPath: string): Promise<void> {
  await ensureSchema();
  await ensureTables();
  await sql`
    INSERT INTO page_drive_folders (client_slug, url, folder_id, folder_name, folder_path, updated_at)
    VALUES (${slug}, ${url}, ${folderId}, ${folderName || null}, ${folderPath || null}, now())
    ON CONFLICT (client_slug, url) DO UPDATE SET folder_id = ${folderId}, folder_name = ${folderName || null}, folder_path = ${folderPath || null}, updated_at = now()`;
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

export type ClusterAdvice = { advice: string; sourceUrl: string; sourceAnalysis: string; createdAt: string | null };

// Cluster-advies (vertrekpunt voor een andere pagina) opslaan, mét de volledige
// bronconclusie. Vervangt eerder advies van dezelfde bronpagina, zodat opnieuw
// doorgeven niet stapelt.
export async function savePageClusterAdvice(slug: string, url: string, advice: string, sourceUrl: string, sourceAnalysis: string): Promise<void> {
  await ensureSchema();
  await ensureTables();
  const u = normUrl(url);
  if (!u || !advice.trim()) return;
  await sql`DELETE FROM page_cluster_advice WHERE client_slug = ${slug} AND url = ${u} AND source_url IS NOT DISTINCT FROM ${sourceUrl || null}`;
  await sql`INSERT INTO page_cluster_advice (client_slug, url, advice, source_url, source_analysis) VALUES (${slug}, ${u}, ${advice.trim()}, ${sourceUrl || null}, ${sourceAnalysis || null})`;
}

// Cluster-advies van één bronpagina weer weghalen (bij "herstel" van een
// doorgezette tabel-rij).
export async function deletePageClusterAdvice(slug: string, url: string, sourceUrl: string): Promise<void> {
  await ensureSchema();
  await ensureTables();
  const u = normUrl(url);
  if (!u) return;
  await sql`DELETE FROM page_cluster_advice WHERE client_slug = ${slug} AND url = ${u} AND source_url IS NOT DISTINCT FROM ${sourceUrl || null}`;
}

// Uitgaand: welk advies is er VANUIT deze (bron)pagina doorgegeven aan andere
// pagina's? Voor het overzichtje met vinkjes in de "Doorgeven"-kaart.
export async function getOutgoingClusterAdvice(slug: string, sourceUrl: string): Promise<{ url: string; advice: string; createdAt: string | null }[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT url, advice, created_at FROM page_cluster_advice WHERE client_slug = ${slug} AND source_url = ${sourceUrl} ORDER BY url ASC`;
  return rows.map((r) => ({
    url: (r.url as string) || "",
    advice: (r.advice as string) || "",
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
  }));
}

export async function getPageClusterAdvice(slug: string, url: string): Promise<ClusterAdvice[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`SELECT advice, source_url, source_analysis, created_at FROM page_cluster_advice WHERE client_slug = ${slug} AND url = ${url} ORDER BY created_at DESC`;
  return rows.map((r) => ({
    advice: (r.advice as string) || "",
    sourceUrl: (r.source_url as string) || "",
    sourceAnalysis: (r.source_analysis as string) || "",
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
  }));
}

// ═══════════════════════════════════════════════════════════
// HET URL-BLOK VOOR DE CHAT: STATUS EN BESTEMMING GAAN MEE
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: de bird's eye kreeg alleen een kale rij paden mee. De
// status (200/301/404) en de redirect-bestemming stonden wél in client_urls,
// maar werden bij het opbouwen van de context weggegooid. Daardoor zag een al
// opgeruimde pagina er precies zo uit als een levende, en werden vier pagina's
// die al 301'den naar /soa-klinieken/soa-test-amsterdam/ voorgesteld als "leid
// deze om naar /soa-klinieken/soa-test-amsterdam/". De informatie was er, hij
// kwam alleen niet aan.
//
// Twee dingen zijn hier hard:
//   1. Status en bestemming gaan ALTIJD mee. Geen kale paden meer.
//   2. Er wordt nooit stil afgekapt. Past het niet, dan staat er hoeveel er
//      niet in past, zodat de chat weet dat hij niet alles ziet.
// ═══════════════════════════════════════════════════════════

/** De sitemap opnieuw ophalen, alleen de URL-lijst (snel: geen check per pagina). */
export async function currentSitemapUrls(domain: string, timeoutMs = 8000): Promise<string[] | null> {
  if (!domain) return null;
  try {
    return await Promise.race([
      fetchSitemapUrls(domain, 3000),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

const pathOfUrl = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };

/**
 * Het contextblok met alle bekende URL's, met status en bestemming.
 * De verse sitemap (als die op tijd binnen is) bepaalt wat er NU nog wordt
 * uitgeserveerd; de opgeslagen scan levert de status en de redirect-bestemming.
 */
export async function buildUrlContext(slug: string, domain: string, maxChars = 14000): Promise<string> {
  const opgeslagen = await getClientUrls(slug);
  if (!opgeslagen.length) return "";

  const vers = await currentSitemapUrls(domain);
  const inSitemap = vers ? new Set(vers.map((u) => normUrl(u))) : null;

  const nieuwste = opgeslagen.map((u) => u.lastScanned || "").filter(Boolean).sort().pop() || "";
  const datum = nieuwste ? new Date(nieuwste).toLocaleDateString("nl-NL") : "onbekend";
  const dagenOud = nieuwste ? Math.floor((Date.now() - new Date(nieuwste).getTime()) / 86400000) : null;

  const live: string[] = [];
  const omgeleid: string[] = [];
  const weg: string[] = [];
  for (const u of opgeslagen) {
    const pad = pathOfUrl(u.url);
    const s = u.status;
    if (s !== null && s >= 300 && s < 400) {
      omgeleid.push(`${pad} is een ${s} naar ${u.redirectTarget ? pathOfUrl(u.redirectTarget) : "onbekende bestemming"}`);
    } else if (s !== null && s >= 400) {
      weg.push(`${pad} geeft ${s}`);
    } else if (inSitemap && !inSitemap.has(normUrl(u.url))) {
      // Stond in de vorige scan, staat nu niet meer in de sitemap: waarschijnlijk
      // verwijderd of omgeleid sinds de laatste scan. Niet als live presenteren.
      omgeleid.push(`${pad} staat NIET MEER in de actuele sitemap (was ${s ?? "?"} bij de scan van ${datum}); controleer met controleer_url voordat je hier iets over zegt`);
    } else {
      live.push(pad);
    }
  }

  // Nieuw in de sitemap sinds de laatste scan: die kent de opgeslagen lijst nog niet.
  const bekend = new Set(opgeslagen.map((u) => normUrl(u.url)));
  const nieuw = vers ? vers.filter((u) => !bekend.has(normUrl(u))).map(pathOfUrl) : [];

  const kop = vers
    ? `=== ALLE BEKENDE URL'S VAN DE SITE (sitemap ZOJUIST vers opgehaald: ${vers.length} URL's; status per pagina uit de scan van ${datum}${dagenOud !== null && dagenOud > 7 ? `, dus ${dagenOud} dagen oud` : ""}) ===`
    : `=== ALLE BEKENDE URL'S VAN DE SITE (sitemap NIET bereikbaar; alles hieronder komt uit de scan van ${datum}${dagenOud !== null && dagenOud > 7 ? `, dus ${dagenOud} dagen oud` : ""}) ===`;

  const regels: string[] = [kop];
  regels.push(
    `LEES DIT EERST. Dit is de enige geldige bron voor welke pagina's bestaan. Vorm NOOIT zelf een pad.` +
    ` Een pagina onder OMGELEID is AL opgeruimd: stel die nooit voor als op te ruimen, en zeg nooit dat hij nog live is.` +
    (dagenOud !== null && dagenOud > 7 ? ` De statussen zijn ${dagenOud} dagen oud; controleer met controleer_url voordat je een uitspraak doet over de status van een pagina.` : ""),
  );

  const blok = (titel: string, items: string[], budget: number): void => {
    if (!items.length) return;
    const uit: string[] = [];
    let lengte = 0;
    for (const i of items) {
      if (lengte + i.length + 2 > budget) break;
      uit.push(i); lengte += i.length + 2;
    }
    const rest = items.length - uit.length;
    regels.push(`\n${titel} (${items.length}${rest ? `, hieronder staan er ${uit.length}` : ""}):\n${uit.join(", ")}`);
    // Nooit stil afkappen: als er iets niet past, staat dat er met zoveel woorden.
    if (rest) regels.push(`LET OP: ${rest} van deze ${items.length} passen hier niet in. Je ziet dus NIET de hele lijst. Staat een pad hier niet bij, dan betekent dat NIET dat het niet bestaat; controleer het met controleer_url.`);
  };

  // Omgeleid en weg krijgen ruim budget: juist die twee voorkwamen de grootste fout.
  blok("LIVE PAGINA'S", live, Math.max(3000, maxChars - 6000));
  blok("OMGELEID, AL OPGERUIMD, NIET MEER AANRADEN OM OP TE RUIMEN", omgeleid, 4000);
  blok("NIET BEREIKBAAR (404 of fout)", weg, 1500);
  if (nieuw.length) blok("NIEUW IN DE SITEMAP sinds de laatste scan (status nog niet gecontroleerd)", nieuw, 1500);

  return regels.join("\n");
}
