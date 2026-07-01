import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// AHREFS API v3 (REST) — zoekvolume + top-10 SERP
// ═══════════════════════════════════════════════════════════
// Vereist AHREFS_API_TOKEN in Vercel. Calls kosten credits; daarom cachen we
// resultaten in ahrefs_cache (zoekvolume ~30 dagen, SERP ~90 dagen), zodat een
// herhaalde vraag geen nieuwe credits kost. Land standaard "nl".
// ═══════════════════════════════════════════════════════════

const BASE = "https://api.ahrefs.com/v3";

export function ahrefsConfigured(): boolean {
  return !!process.env.AHREFS_API_TOKEN;
}

async function ahrefsFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const token = process.env.AHREFS_API_TOKEN;
  if (!token) throw new Error("AHREFS_API_TOKEN ontbreekt.");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ahrefs ${path}: ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function ensureCache(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ahrefs_cache (
      kind    TEXT NOT NULL,
      k       TEXT NOT NULL,
      country TEXT NOT NULL,
      data    JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, k, country)
    )`;
}
async function cacheGet<T>(kind: string, key: string, country: string, maxAgeDays: number): Promise<T | null> {
  await ensureSchema(); await ensureCache();
  const { rows } = await sql`SELECT data, fetched_at FROM ahrefs_cache WHERE kind = ${kind} AND k = ${key} AND country = ${country} LIMIT 1`;
  if (!rows[0]) return null;
  const ageMs = Date.now() - new Date(rows[0].fetched_at as string).getTime();
  if (ageMs > maxAgeDays * 86400000) return null;
  return rows[0].data as T;
}
async function cacheSet(kind: string, key: string, country: string, data: unknown): Promise<void> {
  await ensureSchema(); await ensureCache();
  await sql`
    INSERT INTO ahrefs_cache (kind, k, country, data, fetched_at) VALUES (${kind}, ${key}, ${country}, ${JSON.stringify(data)}, now())
    ON CONFLICT (kind, k, country) DO UPDATE SET data = ${JSON.stringify(data)}, fetched_at = now()`;
}

export type KeywordOverview = { keyword: string; volume: number | null; difficulty: number | null; cpc: number | null };

// Echt maandelijks zoekvolume + difficulty + cpc per zoekwoord (met cache).
export async function getKeywordsOverview(keywords: string[], country = "nl"): Promise<KeywordOverview[]> {
  const cleaned = Array.from(new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)));
  if (cleaned.length === 0) return [];

  const out: KeywordOverview[] = [];
  const misses: string[] = [];
  for (const kw of cleaned) {
    const cached = await cacheGet<KeywordOverview>("kw", kw, country, 30);
    if (cached) out.push(cached); else misses.push(kw);
  }

  for (let i = 0; i < misses.length; i += 100) {
    const slice = misses.slice(i, i + 100);
    const data = (await ahrefsFetch("/keywords-explorer/overview", {
      keywords: slice.join(","), country, select: "keyword,volume,difficulty,cpc",
    })) as { keywords?: { keyword: string; volume?: number; difficulty?: number; cpc?: number }[] };
    const map = new Map((data.keywords || []).map((r) => [r.keyword.toLowerCase(), r]));
    for (const kw of slice) {
      const r = map.get(kw);
      const row: KeywordOverview = { keyword: kw, volume: r?.volume ?? null, difficulty: r?.difficulty ?? null, cpc: r?.cpc ?? null };
      await cacheSet("kw", kw, country, row);
      out.push(row);
    }
  }
  return out;
}

export type SerpRow = { position: number; url: string; title: string; domainRating: number | null; type: string };

// Top-10 organische zoekresultaten voor één zoekwoord (met cache).
export async function getSerpOverview(keyword: string, country = "nl"): Promise<SerpRow[]> {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  const cached = await cacheGet<SerpRow[]>("serp", kw, country, 90);
  if (cached) return cached;

  const data = (await ahrefsFetch("/serp-overview/serp-overview", {
    keyword: kw, country, top_positions: "10", select: "position,url,title,type,domain_rating",
  })) as { positions?: { position?: number; url?: string; title?: string; type?: string; domain_rating?: number }[]; serp?: unknown[] };
  const rows = (data.positions || []) as { position?: number; url?: string; title?: string; type?: string; domain_rating?: number }[];
  const result: SerpRow[] = rows
    .filter((r) => r.url)
    .slice(0, 10)
    .map((r) => ({ position: r.position ?? 0, url: r.url || "", title: r.title || "", domainRating: r.domain_rating ?? null, type: r.type || "" }));
  await cacheSet("serp", kw, country, result);
  return result;
}
