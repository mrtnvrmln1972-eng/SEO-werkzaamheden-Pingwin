import crypto from "crypto";
import { sql, ensureSchema } from "./db";
import { diffSnapshots, diffSummary, isDiffEmpty, type SnapshotForDiff, type ContentDiff } from "./content-diff";
import { fetchWordpressModified, fetchWordpressPages, fetchWordpressRevisions, fetchWordpressUsers, revisionDiffSummary, headingsFromHtml, type WpAuth, type WpRevision } from "./wordpress";

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

// Alleen wijzigingen die WIJ hebben gedaan (op auteur-e-mail/naam). Aanpassingen
// door de klant of anderen blijven uit het overzicht.
const OUR_TEAM_EMAILS = new Set(["pingwinonline@gmail.com", "toni@pingwin.nl", "maarten@pingwin.nl"]);
const OUR_TEAM_RE = /pingwin|toni|maarten/i;

// Volledige bewerkingshistorie uit WordPress (revisions, geauthenticeerd), maar
// GEGROEPEERD en GEFILTERD: revisies van ons team binnen ~2 dagen worden tot één
// wijziging gebundeld (dat is het moment dat een pagina opnieuw geïndexeerd wordt,
// vanaf daar volgen we de KPI's). Wijzigingen door anderen blijven weg. Herbouwt
// de WordPress-events schoon bij elke sync.
function wordCount(s?: string): number { return s ? s.split(/\s+/).filter(Boolean).length : 0; }

// Vergelijkt de LIVE pagina met de laatst vastgelegde snapshot en geeft de volledige
// (meta + content) diff terug: meta-titel, meta-description, H1, koppen, woordenaantal,
// alt-teksten, interne links, schema. Legt meteen een verse snapshot vast als basislijn
// voor de volgende sync. hadPrevious=false bij een gloednieuwe pagina (nog geen basislijn).
async function snapshotDiffAndStore(slug: string, url: string): Promise<{ diff: ContentDiff; hadPrevious: boolean; snap: Snapshot | null }> {
  const snap = await extractSnapshot(url);
  if (!snap) return { diff: {}, hadPrevious: false, snap: null };
  const { rows: prev } = await sql`
    SELECT * FROM page_content_snapshots WHERE client_slug = ${slug} AND url = ${url} ORDER BY captured_at DESC LIMIT 1`;
  const previous = prev[0];
  if (!previous || previous.content_hash !== snap.contentHash) {
    await sql`
      INSERT INTO page_content_snapshots
        (client_slug, url, meta_title, meta_description, h1, h2s, h3s, alt_tags, internal_links, word_count, schema_types, content_hash)
      VALUES (${slug}, ${url}, ${snap.meta_title}, ${snap.meta_description}, ${snap.h1},
              ${JSON.stringify(snap.h2s)}, ${JSON.stringify(snap.h3s)}, ${JSON.stringify(snap.alt_tags)},
              ${JSON.stringify(snap.internal_links)}, ${snap.word_count}, ${JSON.stringify(snap.schema_types)}, ${snap.contentHash})`;
  }
  if (!previous) return { diff: {}, hadPrevious: false, snap };
  return { diff: diffSnapshots(toForDiff(previous), toForDiff(snap)), hadPrevious: true, snap };
}

// Volledige "nieuwe pagina"-diff uit een snapshot: alles als toegevoegd (+).
function newPageDiff(snap: Snapshot): ContentDiff {
  const diff: ContentDiff = {};
  if (snap.meta_title) diff.meta_title = { before: "", after: snap.meta_title };
  if (snap.meta_description) diff.meta_description = { before: "", after: snap.meta_description };
  if (snap.h1) diff.h1 = { before: "", after: snap.h1 };
  if (snap.h2s.length) diff.h2s = { added: snap.h2s, removed: [] };
  if (snap.h3s.length) diff.h3s = { added: snap.h3s, removed: [] };
  if (snap.word_count) diff.word_count = { before: 0, after: snap.word_count, delta: snap.word_count };
  return diff;
}

// Terugval als er (nog) geen snapshot is: leidt uit de revisies zelf af wat er
// veranderde (titel/H1, koppen erbij of eraf uit de content-HTML, woordenaantal).
function wpRevisionDiff(before: WpRevision | null, cur: WpRevision): { diff: ContentDiff; isNew: boolean } {
  const isNew = !before || wordCount(before.text) === 0;
  const diff: ContentDiff = {};
  const bt = before?.title || "";
  if (bt !== (cur.title || "")) diff.h1 = { before: bt, after: cur.title || "" };
  const bh = headingsFromHtml(before?.html || "");
  const ch = headingsFromHtml(cur.html || "");
  const added = ch.filter((h) => !bh.some((x) => x.toLowerCase() === h.toLowerCase()));
  const removed = bh.filter((h) => !ch.some((x) => x.toLowerCase() === h.toLowerCase()));
  if (added.length || removed.length) diff.h2s = { added, removed };
  const pw = wordCount(before?.text), cw = wordCount(cur.text);
  if (pw !== cw) diff.word_count = { before: pw, after: cw, delta: cw - pw };
  return { diff, isNew };
}

export async function addWordpressRevisions(slug: string, domain: string, auth: WpAuth): Promise<{ scanned: number; added: number; hasApi: boolean; newest: string | null }> {
  await ensureSchema();
  await ensureTables();
  if (!auth) return { scanned: 0, added: 0, hasApi: false, newest: null };
  const [pages, users] = await Promise.all([fetchWordpressPages(domain, auth), fetchWordpressUsers(domain, auth)]);
  if (pages.length === 0) return { scanned: 0, added: 0, hasApi: false, newest: null };

  const canIdentify = users.size > 0;
  const isOurs = (authorId: number): boolean => {
    if (!canIdentify) return true; // auteurs niet te bepalen -> niet filteren
    const u = users.get(authorId);
    if (!u) return false;
    if (u.email && OUR_TEAM_EMAILS.has(u.email.toLowerCase())) return true;
    return OUR_TEAM_RE.test(u.name) || OUR_TEAM_RE.test(u.slug) || OUR_TEAM_RE.test(u.email);
  };

  // Schone herbouw: verwijder de vorige WordPress-events (handmatige/andere blijven).
  await sql`DELETE FROM page_change_events WHERE client_slug = ${slug} AND source = 'wordpress'`;

  const managed = [...pages].sort((a, b) => (b.modified || "").localeCompare(a.modified || "")).slice(0, 60);
  const TWO_DAYS = 2 * 86400000;
  const seen = new Set<string>();
  let scanned = 0, added = 0, newest: string | null = null;

  for (const p of managed) {
    scanned++;
    const allRevs = await fetchWordpressRevisions(domain, p.type, p.id, auth); // oplopend op datum
    const team = allRevs.map((r, i) => ({ r, i })).filter((x) => isOurs(x.r.author));
    if (team.length === 0) continue;

    // Groepeer opeenvolgende team-revisies met <=2 dagen ertussen tot één wijziging.
    const clusters: { r: WpRevision; i: number }[][] = [];
    let cur: { r: WpRevision; i: number }[] = [];
    for (const x of team) {
      if (cur.length === 0) { cur.push(x); continue; }
      const gap = new Date(x.r.modified).getTime() - new Date(cur[cur.length - 1].r.modified).getTime();
      if (gap <= TWO_DAYS) cur.push(x); else { clusters.push(cur); cur = [x]; }
    }
    if (cur.length) clusters.push(cur);

    // De nieuwste wijziging vergelijken we met de laatste snapshot (voor meta-titel/
    // description en alle content), en we leggen meteen een verse basislijn vast.
    const snapshot = await snapshotDiffAndStore(slug, p.url).catch(() => ({ diff: {} as ContentDiff, hadPrevious: false, snap: null as Snapshot | null }));

    for (let ci = 0; ci < clusters.length; ci++) {
      const cl = clusters[ci];
      const isLatest = ci === clusters.length - 1;
      const first = cl[0], last = cl[cl.length - 1];
      if (!newest || last.r.modified > newest) newest = last.r.modified;
      const day = new Date(last.r.modified).toISOString().slice(0, 10);
      const dedupKey = `${p.url.replace(/\/$/, "")}|${day}`;
      if (seen.has(dedupKey)) continue;
      const before = first.i > 0 ? allRevs[first.i - 1] : null;
      const rev = wpRevisionDiff(before, last.r);
      // Nieuwste cluster: gebruik het rijke snapshot-beeld. Nieuwe pagina zonder
      // basislijn -> toon de hele opzet; met basislijn -> het echte verschil sinds
      // vorige keer (incl. meta's). Oudere clusters: uit de revisies zelf.
      let diff: ContentDiff = rev.diff;
      let what = rev.isNew ? "nieuwe pagina gepubliceerd" : revisionDiffSummary(before, last.r);
      if (isLatest) {
        if (rev.isNew && snapshot.snap) { diff = newPageDiff(snapshot.snap); what = "nieuwe pagina gepubliceerd"; }
        else if (snapshot.hadPrevious && !isDiffEmpty(snapshot.diff)) { diff = snapshot.diff; what = diffSummary(snapshot.diff); }
      }
      const who = users.get(last.r.author)?.name || "";
      const summary = `WordPress${who ? ` (${who})` : ""}: ${what}${cl.length > 1 ? ` (${cl.length} bewerkingen gebundeld)` : ""}`;
      await sql`
        INSERT INTO page_change_events (client_slug, url, detected_at, current_snapshot_id, diff, change_summary, is_manual, source)
        VALUES (${slug}, ${p.url}, ${last.r.modified}, ${null}, ${JSON.stringify(diff)}, ${summary}, true, 'wordpress')`;
      added++; seen.add(dedupKey);
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

// Alle wijzigingen van één pagina (nieuwste eerst): voor de tijdlijn met meerdere
// verandermomenten op de KPI-grafieken.
export async function getChangeEventsForUrl(slug: string, url: string): Promise<ChangeEvent[]> {
  await ensureSchema();
  await ensureTables();
  const { rows } = await sql`
    SELECT id, url, detected_at, change_summary, diff, is_manual FROM page_change_events
    WHERE client_slug = ${slug} AND url = ${url} ORDER BY detected_at DESC LIMIT 100`;
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
