import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getSiteOrganicKeywords, getKeywordsOverview, ahrefsConfigured, type SiteKeyword } from "./ahrefs";

// ═══════════════════════════════════════════════════════════
// AHREFS-ZOEKWOORDEN PER KLANT (domein-brede pool + laaghangend fruit)
// ═══════════════════════════════════════════════════════════
// In één keer alle organische zoekwoorden van het domein ophalen en opslaan,
// zodat de laaghangend-fruit-scan er lokaal op draait (geen losse per-keyword
// -calls). Verversen via een knop (credit-bewust). Multi-tenant per client_slug.
// ═══════════════════════════════════════════════════════════

export type AhrefsKeyword = {
  keyword: string; volume: number | null; position: number | null;
  cpc: number | null; traffic: number | null; intent: string; branded: boolean;
  organic: boolean; // false = alleen-volume (uit Search Console, domein rankt er niet op)
};

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_ahrefs_keywords (
      client_slug TEXT NOT NULL,
      keyword     TEXT NOT NULL,
      volume      INTEGER,
      position    NUMERIC,
      cpc         NUMERIC,
      traffic     INTEGER,
      intent      TEXT,
      branded     BOOLEAN NOT NULL DEFAULT false,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, keyword)
    )`;
  // organic=false = alleen-volume-zoekwoord (uit Search Console, waar het domein niet
  // op rankt); die verschijnen niet in de Ahrefs-tabel maar vullen wel de Volume-kolom.
  await sql`ALTER TABLE client_ahrefs_keywords ADD COLUMN IF NOT EXISTS organic BOOLEAN NOT NULL DEFAULT true`;
}

export async function getAhrefsKeywords(slug: string): Promise<AhrefsKeyword[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT keyword, volume, position, cpc, traffic, intent, branded, organic
    FROM client_ahrefs_keywords WHERE client_slug = ${slug}
    ORDER BY traffic DESC NULLS LAST, volume DESC NULLS LAST`;
  return rows.map((r) => ({
    keyword: r.keyword as string,
    volume: r.volume == null ? null : Number(r.volume),
    position: r.position == null ? null : Number(r.position),
    cpc: r.cpc == null ? null : Number(r.cpc),
    traffic: r.traffic == null ? null : Number(r.traffic),
    intent: (r.intent as string) || "",
    branded: !!r.branded,
    organic: r.organic == null ? true : !!r.organic,
  }));
}

// Haalt de domein-brede zoekwoorden op en slaat ze op (vervangt de vorige set,
// zodat verdwenen zoekwoorden ook echt weggaan). Geeft aantallen terug.
export async function syncAhrefsKeywords(slug: string, gscKeywords: string[] = []): Promise<{ ok: boolean; error?: string; total?: number }> {
  if (!ahrefsConfigured()) return { ok: false, error: "Ahrefs is niet gekoppeld (AHREFS_API_TOKEN ontbreekt in Vercel)." };
  const client = await getClientBySlug(slug);
  if (!client?.domain) return { ok: false, error: "Deze klant heeft nog geen domein ingevuld." };

  let rows: SiteKeyword[];
  try {
    rows = await getSiteOrganicKeywords(client.domain, "nl", 800);
  } catch (e) {
    return { ok: false, error: `Ahrefs-fout: ${e instanceof Error ? e.message : "onbekend"}` };
  }

  // Zoekvolume erbij voor de Search Console-zoekwoorden die niet in de organische set
  // zitten (Keywords Explorer, met cache). Zo vult de Volume-kolom in de Search Console
  // -lijst ook voor termen waarop het domein (nog) niet organisch rankt.
  const norm = (k: string) => k.trim().toLowerCase();
  const have = new Set(rows.map((r) => norm(r.keyword)));
  const missing = Array.from(new Set(gscKeywords.map(norm).filter((k) => k && !have.has(k)))).slice(0, 300);
  let volRows: { keyword: string; volume: number }[] = [];
  if (missing.length) {
    try {
      const ov = await getKeywordsOverview(missing, "nl");
      volRows = ov.filter((o) => o.volume != null).map((o) => ({ keyword: o.keyword, volume: o.volume as number }));
    } catch { /* volume-aanvulling is niet kritisch */ }
  }

  if (rows.length === 0 && volRows.length === 0) return { ok: true, total: 0 };

  await ensureSchema();
  await ensureTable();
  await sql`DELETE FROM client_ahrefs_keywords WHERE client_slug = ${slug}`;
  for (const r of rows) {
    await sql`
      INSERT INTO client_ahrefs_keywords (client_slug, keyword, volume, position, cpc, traffic, intent, branded, organic, updated_at)
      VALUES (${slug}, ${r.keyword}, ${r.volume}, ${r.position}, ${r.cpc}, ${r.traffic}, ${r.intent || null}, ${r.branded}, true, now())
      ON CONFLICT (client_slug, keyword) DO UPDATE SET
        volume = ${r.volume}, position = ${r.position}, cpc = ${r.cpc}, traffic = ${r.traffic},
        intent = ${r.intent || null}, branded = ${r.branded}, organic = true, updated_at = now()`;
  }
  for (const v of volRows) {
    await sql`
      INSERT INTO client_ahrefs_keywords (client_slug, keyword, volume, position, cpc, traffic, intent, branded, organic, updated_at)
      VALUES (${slug}, ${v.keyword}, ${v.volume}, NULL, NULL, NULL, NULL, false, false, now())
      ON CONFLICT (client_slug, keyword) DO UPDATE SET volume = ${v.volume}, updated_at = now()`;
  }
  return { ok: true, total: rows.length };
}
