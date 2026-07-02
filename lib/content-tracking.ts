import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { diffSnapshots, diffSummary, isDiffEmpty, type SnapshotForDiff, type ContentDiff } from "./content-diff";
import { fetchWordpressModified, fetchWordpressPages, fetchWordpressRevisions, revisionDiffSummary, type WpAuth } from "./wordpress";

// ═══════════════════════════════════════════════════════════
// PAGINA-WIJZIGINGEN: snapshots + change-detectie
// ═══════════════════════════════════════════════════════════
// Per pagina wordt de volledige inhoud (meta, H1, H2/H3, alt-teksten,
// interne links, woordtelling, schema) opgeslagen als snapshot met een
// hash. Verschilt de hash met de vorige scan, dan komt er een change
// event met een gestructureerde diff ("wat veranderde"). Per klant
// (client_slug), multi-tenant.
// ═══════════════════════════════════════════════════════════

export type Snapshot = SnapshotForDiff & { url: string; contentHash: string; status: number | null };

let tablesReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (!tablesReady) tablesReady = doEnsure().catch((e) => { tablesReady = null; throw e; });
  return tablesReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_content_snapshots (
      id               SERIAL PRIMARY KEY,
      client_slug      TEXT NOT NULL,
      url              TEXT NOT NULL,
      captured_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      meta_title       TEXT,
      meta_description TEXT,
      h1               TEXT,
      h2s              JSONB NOT NULL DEFAULT '[]',
      h3s              JSONB NOT NULL DEFAULT '[]',
      alt_tags         JSONB NOT NULL DEFAULT '[]',
      internal_links   JSONB NOT NULL DEFAULT '[]',
      word_count       INTEGER,
      schema_types     JSONB NOT NULL DEFAULT '[]',
      content_hash     TEXT NOT NULL
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pcs_slug_url ON page_content_snapshots(client_slug, url)`;
  await sql`
    CREATE TABLE IF NOT EXISTS page_change_events (
      id                   SERIAL PRIMARY KEY,
      client_slug          TEXT NOT NULL,
      url                  TEXT NOT NULL,
      detected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      previous_snapshot_id INTEGER,
      current_snapshot_id  INTEGER NOT NULL,
      diff                 JSONB NOT NULL,
      change_summary       TEXT
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pce_slug_detected ON page_change_events(client_slug, detected_at DESC)`;
  // Handmatig toegevoegde wijziging (bekende aanpassing in het verleden zonder
  // "voor"-snapshot): current_snapshot_id mag dan leeg zijn, is_manual = true.
  await sql`ALTER TABLE page_change_events ALTER COLUMN current_snapshot_id DROP NOT NULL`.catch(() => null);
  await sql`ALTER TABLE page_change_events ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false`;
  // Herkomst van de wijziging: 'wordpress' voor uit WordPress opgehaalde datums.
  await sql`ALTER TABLE page_change_events ADD COLUMN IF NOT EXISTS source TEXT`;
}

// ── Content-extractie (regex-gebaseerd, geen browser) ────────
const decode = (s: string) => (s || "")
  .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

function tagTexts(html: string, tag: string, limit: number): string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((m) => decode(m[1])).filter(Boolean).slice(0, limit);
}

function attr(imgTag: string, name: string): string {
  const m = imgTag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : "";
}

export async function extractSnapshot(url: string): Promise<Snapshot | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  let html = "", status: number | null = null;
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 PingwinBot" } });
    status = res.status;
    if (!res.ok) return null;
    html = await res.text();
  } catch { return null; } finally { clearTimeout(t); }

  const meta_title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]).slice(0, 300);
  const meta_description = decode((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || ["", ""])[1]).slice(0, 400);
  const h1 = (tagTexts(html, "h1", 1)[0] || "").slice(0, 300);
  const h2s = tagTexts(html, "h2", 40);
  const h3s = tagTexts(html, "h3", 60);

  // Alt-teksten van img-tags (src genormaliseerd tot bestandsnaam-achtig sleuteltje).
  const alt_tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const src = attr(m[0], "src");
    const key = (src.split("?")[0].split("/").pop() || src).slice(0, 120);
    return { src: key, alt: decode(attr(m[0], "alt")).slice(0, 200) };
  }).filter((a) => a.src).slice(0, 120);

  // Interne links: relatief of zelfde host.
  let host = "";
  try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* */ }
  const internal_links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1].split("#")[0], text: decode(m[2]).slice(0, 120) }))
    .filter((l) => {
      const h = l.href;
      if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:")) return false;
      if (h.startsWith("/")) return true;
      try { return new URL(h).host.replace(/^www\./, "") === host; } catch { return false; }
    })
    .slice(0, 200);

  const bodyText = decode((html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i) || ["", html])[1]
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  const word_count = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  // Schema.org @type uit JSON-LD blokken.
  const schemaSet = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      const walk = (o: unknown) => {
        if (Array.isArray(o)) o.forEach(walk);
        else if (o && typeof o === "object") {
          const t = (o as Record<string, unknown>)["@type"];
          if (typeof t === "string") schemaSet.add(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaSet.add(x));
          Object.values(o as Record<string, unknown>).forEach(walk);
        }
      };
      walk(j);
    } catch { /* ongeldige JSON-LD overslaan */ }
  }
  const schema_types = [...schemaSet].sort();

  const snap: Omit<Snapshot, "contentHash"> = { url, status, meta_title, meta_description, h1, h2s, h3s, alt_tags, internal_links, word_count, schema_types };
  const contentHash = hashSnapshot(snap);
  return { ...snap, contentHash };
}

function hashSnapshot(s: Omit<Snapshot, "contentHash" | "status">): string {
  const payload = JSON.stringify([
    s.meta_title, s.meta_description, s.h1, s.h2s, s.h3s,
    s.alt_tags.map((a) => `${a.src}|${a.alt}`).sort(),
    s.internal_links.map((l) => `${l.href}|${l.text}`).sort(),
    s.word_count, s.schema_types,
  ]);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function toForDiff(s: Snapshot | Record<string, unknown>): SnapshotForDiff {
  return {
    meta_title: (s.meta_title as string) || "",
    meta_description: (s.meta_description as string) || "",
    h1: (s.h1 as string) || "",
    h2s: (s.h2s as string[]) || [],
    h3s: (s.h3s as string[]) || [],
    alt_tags: (s.alt_tags as { src: string; alt: string }[]) || [],
    internal_links: (s.internal_links as { href: string; text: string }[]) || [],
    word_count: (s.word_count as number) || 0,
    schema_types: (s.schema_types as string[]) || [],
  };
}

// Scant één URL: nieuwe snapshot maken, en bij verschil met de vorige een
// change event met diff wegschrijven. Geeft terug of er iets veranderd is.
export async function captureAndDetect(slug: string, url: string): Promise<{ changed: boolean; summary?: string }> {
  await ensureSchema();
  await ensureTables();
  const snap = await extractSnapshot(url);
  if (!snap) return { changed: false };

  const { rows: prev } = await sql`
    SELECT * FROM page_content_snapshots WHERE client_slug = ${slug} AND url = ${url} ORDER BY captured_at DESC LIMIT 1`;
  const previous = prev[0];

  // Ongewijzigd: zelfde hash → niets doen (geen nieuwe snapshot).
  if (previous && previous.content_hash === snap.contentHash) return { changed: false };

  const { rows: ins } = await sql`
    INSERT INTO page_content_snapshots
      (client_slug, url, meta_title, meta_description, h1, h2s, h3s, alt_tags, internal_links, word_count, schema_types, content_hash)
    VALUES (${slug}, ${url}, ${snap.meta_title}, ${snap.meta_description}, ${snap.h1},
            ${JSON.stringify(snap.h2s)}, ${JSON.stringify(snap.h3s)}, ${JSON.stringify(snap.alt_tags)},
            ${JSON.stringify(snap.internal_links)}, ${snap.word_count}, ${JSON.stringify(snap.schema_types)}, ${snap.contentHash})
    RETURNING id`;
  const currentId = Number(ins[0].id);

  // Geen vorige snapshot: dit is de basislijn, geen change event.
  if (!previous) return { changed: false };

  const diff: ContentDiff = diffSnapshots(toForDiff(previous), toForDiff(snap));
  if (isDiffEmpty(diff)) return { changed: false };
  const summary = diffSummary(diff);
  await sql`
    INSERT INTO page_change_events (client_slug, url, previous_snapshot_id, current_snapshot_id, diff, change_summary)
    VALUES (${slug}, ${url}, ${Number(previous.id)}, ${currentId}, ${JSON.stringify(diff)}, ${summary})`;
  return { changed: true, summary };
}

// Voegt een BEKENDE wijziging uit het verleden handmatig toe (datum + notitie),
// zodat je de KPI-ontwikkeling eromheen kunt volgen ook zonder "voor"-snapshot.
// Legt meteen een snapshot van nu vast als basislijn voor toekomstige detectie.
export async function addManualChange(slug: string, url: string, date: string, note: string): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema();
  await ensureTables();
  let snapId: number | null = null;
  const snap = await extractSnapshot(url);
  if (snap) {
    const { rows } = await sql`
      INSERT INTO page_content_snapshots
        (client_slug, url, meta_title, meta_description, h1, h2s, h3s, alt_tags, internal_links, word_count, schema_types, content_hash)
      VALUES (${slug}, ${url}, ${snap.meta_title}, ${snap.meta_description}, ${snap.h1},
              ${JSON.stringify(snap.h2s)}, ${JSON.stringify(snap.h3s)}, ${JSON.stringify(snap.alt_tags)},
              ${JSON.stringify(snap.internal_links)}, ${snap.word_count}, ${JSON.stringify(snap.schema_types)}, ${snap.contentHash})
      RETURNING id`;
    snapId = Number(rows[0].id);
  }
  await sql`
    INSERT INTO page_change_events (client_slug, url, detected_at, current_snapshot_id, diff, change_summary, is_manual)
    VALUES (${slug}, ${url}, ${date + "T12:00:00Z"}, ${snapId}, ${"{}"}, ${note || "Handmatig toegevoegde wijziging"}, true)`;
  return { ok: true };
}

// Haalt uit WordPress (publieke REST API) per pagina de laatste wijzigingsdatum
// en zet die als date-stamped wijziging in de Wijzigingen-tab. Idempotent:
// dedupe op (url, dag). Filtert op de pagina's die we beheren (client_urls) als
// die lijst er is. hasApi=false als de site geen open WordPress REST API heeft.
export async function addWordpressChanges(slug: string, domain: string): Promise<{ scanned: number; added: number; hasApi: boolean; newest: string | null }> {
  await ensureSchema();
  await ensureTables();
  const items = await fetchWordpressModified(domain);
  if (items.length === 0) return { scanned: 0, added: 0, hasApi: false, newest: null };

  // GEEN filter op client_urls: WordPress is hier de bron van waarheid. Filteren
  // verborg juist recent aangepaste pagina's die (nog) niet in de ingelezen lijst
  // stonden. We tonen dus elke WordPress-pagina met zijn laatste wijzigingsdatum.
  const { rows: existing } = await sql`SELECT url, detected_at FROM page_change_events WHERE client_slug = ${slug} AND source = 'wordpress'`;
  const seen = new Set(existing.map((r) => `${(r.url as string).replace(/\/$/, "")}|${new Date(r.detected_at as string).toISOString().slice(0, 10)}`));

  let scanned = 0, added = 0, newest: string | null = null;
  for (const it of items) {
    const key = it.url.replace(/\/$/, "");
    scanned++;
    if (!newest || it.modified > newest) newest = it.modified;
    const day = new Date(it.modified).toISOString().slice(0, 10);
    if (seen.has(`${key}|${day}`)) continue;
    const summary = `WordPress: pagina aangepast op ${new Date(it.modified).toLocaleDateString("nl-NL")}`;
    await sql`
      INSERT INTO page_change_events (client_slug, url, detected_at, current_snapshot_id, diff, change_summary, is_manual, source)
      VALUES (${slug}, ${it.url}, ${it.modified}, ${null}, ${"{}"}, ${summary}, true, 'wordpress')`;
    added++; seen.add(`${key}|${day}`);
  }
  return { scanned, added, hasApi: true, newest };
}

// Volledige bewerkingshistorie uit WordPress (revisions, geauthenticeerd). Per
// pagina alle revisies met datum en een licht "wat veranderde"-oordeel (titel/
// woorden). Idempotent: dedupe op (url, revisie-tijdstip tot op de minuut).
// Filtert op de beheerde pagina's (client_urls) als die lijst er is.
export async function addWordpressRevisions(slug: string, domain: string, auth: WpAuth): Promise<{ scanned: number; added: number; hasApi: boolean; newest: string | null }> {
  await ensureSchema();
  await ensureTables();
  if (!auth) return { scanned: 0, added: 0, hasApi: false, newest: null };
  const pages = await fetchWordpressPages(domain, auth);
  if (pages.length === 0) return { scanned: 0, added: 0, hasApi: false, newest: null };

  const { rows: existing } = await sql`SELECT url, detected_at FROM page_change_events WHERE client_slug = ${slug} AND source = 'wordpress'`;
  const minute = (iso: string) => new Date(iso).toISOString().slice(0, 16);
  const seen = new Set(existing.map((r) => `${(r.url as string).replace(/\/$/, "")}|${minute(r.detected_at as string)}`));

  // GEEN filter op client_urls (dat verborg recent aangepaste pagina's). We pakken
  // de 60 meest recent gewijzigde pagina's, zodat revisies ophalen begrensd blijft
  // maar juist de laatst bewerkte pagina's meepakt.
  const managed = [...pages].sort((a, b) => (b.modified || "").localeCompare(a.modified || "")).slice(0, 60);
  let scanned = 0, added = 0, newest: string | null = null;
  for (const p of managed) {
    scanned++;
    const revs = await fetchWordpressRevisions(domain, p.type, p.id, auth);
    for (let i = 0; i < revs.length; i++) {
      const cur = revs[i];
      if (!newest || cur.modified > newest) newest = cur.modified;
      const key = `${p.url.replace(/\/$/, "")}|${minute(cur.modified)}`;
      if (seen.has(key)) continue;
      const what = revisionDiffSummary(i > 0 ? revs[i - 1] : null, cur);
      const summary = `WordPress-revisie (${new Date(cur.modified).toLocaleDateString("nl-NL")}): ${what}`;
      await sql`
        INSERT INTO page_change_events (client_slug, url, detected_at, current_snapshot_id, diff, change_summary, is_manual, source)
        VALUES (${slug}, ${p.url}, ${cur.modified}, ${null}, ${"{}"}, ${summary}, true, 'wordpress')`;
      added++; seen.add(key);
    }
  }
  return { scanned, added, hasApi: true, newest };
}

export type ChangeEvent = { id: number; url: string; detectedAt: string; summary: string; diff: ContentDiff; isManual: boolean };

export async function getChangeEvents(slug: string, limit = 100): Promise<ChangeEvent[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`
    SELECT id, url, detected_at, change_summary, diff, is_manual FROM page_change_events
    WHERE client_slug = ${slug} ORDER BY detected_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), url: r.url as string, detectedAt: new Date(r.detected_at as string).toISOString(), summary: (r.change_summary as string) || "", diff: r.diff as ContentDiff, isManual: !!r.is_manual }));
}

export async function getChangeEvent(slug: string, id: number): Promise<ChangeEvent | null> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`
    SELECT id, url, detected_at, change_summary, diff, is_manual FROM page_change_events
    WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  const r = rows[0];
  return { id: Number(r.id), url: r.url as string, detectedAt: new Date(r.detected_at as string).toISOString(), summary: (r.change_summary as string) || "", diff: r.diff as ContentDiff, isManual: !!r.is_manual };
}
