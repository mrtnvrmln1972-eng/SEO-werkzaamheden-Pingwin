import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// FOCUS-ZOEKWOORDEN: per klant een zoekwoord markeren als prio/secundair
// ═══════════════════════════════════════════════════════════
// Maarten kan in de KPI-tab een zoekwoord uit Search Console markeren als
// "prio" of "secundair". Die verschijnen als een apart lijstje bovenaan en
// worden op dezelfde cijfers gevolgd (positie, klikken, vertoningen, CTR).
// Multi-tenant (client_slug). Eén rij per (klant, zoekwoord).
// ═══════════════════════════════════════════════════════════

export type FocusTier = "prio" | "secundair";
export type KeywordFocus = Record<string, FocusTier>;

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_keyword_focus (
      client_slug TEXT NOT NULL,
      keyword     TEXT NOT NULL,
      tier        TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, keyword)
    )`;
}

export async function getKeywordFocus(slug: string): Promise<KeywordFocus> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT keyword, tier FROM client_keyword_focus WHERE client_slug = ${slug}`;
  const out: KeywordFocus = {};
  for (const r of rows) {
    const t = r.tier as string;
    if (t === "prio" || t === "secundair") out[r.keyword as string] = t;
  }
  return out;
}

// Zet of wist de markering van één zoekwoord. tier = null wist de markering.
export async function setKeywordFocus(slug: string, keyword: string, tier: FocusTier | null): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const kw = (keyword || "").trim();
  if (!kw) return;
  if (tier === null) {
    await sql`DELETE FROM client_keyword_focus WHERE client_slug = ${slug} AND keyword = ${kw}`;
    return;
  }
  await sql`
    INSERT INTO client_keyword_focus (client_slug, keyword, tier, updated_at)
    VALUES (${slug}, ${kw}, ${tier}, now())
    ON CONFLICT (client_slug, keyword) DO UPDATE SET tier = ${tier}, updated_at = now()`;
}
