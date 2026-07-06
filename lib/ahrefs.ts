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
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ahrefs ${path}: ${res.status} ${body.slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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

export type KeywordOverview = { keyword: string; volume: number | null; difficulty: number | null; cpc: number | null; intents: unknown };

// Echt maandelijks zoekvolume + difficulty + cpc + zoekintentie per zoekwoord (met cache).
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
      keywords: slice.join(","), country, select: "keyword,volume,difficulty,cpc,intents",
    })) as { keywords?: { keyword: string; volume?: number; difficulty?: number; cpc?: number; intents?: unknown }[] };
    const map = new Map((data.keywords || []).map((r) => [r.keyword.toLowerCase(), r]));
    for (const kw of slice) {
      const r = map.get(kw);
      const row: KeywordOverview = { keyword: kw, volume: r?.volume ?? null, difficulty: r?.difficulty ?? null, cpc: r?.cpc ?? null, intents: r?.intents ?? null };
      await cacheSet("kw", kw, country, row);
      out.push(row);
    }
  }
  return out;
}

export type KeywordIdea = { keyword: string; volume: number | null; difficulty: number | null };

// Zoekwoord-ideeën (passende termen) rond een zaad-zoekwoord: vind termen waar
// je nog niet op rankt en de beste primaire term uit een bredere set.
export async function getKeywordIdeas(seed: string, country = "nl", limit = 40): Promise<KeywordIdea[]> {
  const s = seed.trim().toLowerCase();
  if (!s) return [];
  const cached = await cacheGet<KeywordIdea[]>("ideas", s, country, 30);
  if (cached) return cached;
  const data = (await ahrefsFetch("/keywords-explorer/matching-terms", {
    keywords: s, country, match_mode: "terms", limit: String(limit), select: "keyword,volume,difficulty",
  })) as { keywords?: { keyword: string; volume?: number; difficulty?: number }[]; terms?: { keyword: string; volume?: number; difficulty?: number }[] };
  const rows = (data.keywords || data.terms || []).map((r) => ({ keyword: r.keyword, volume: r.volume ?? null, difficulty: r.difficulty ?? null }));
  rows.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const top = rows.slice(0, limit);
  await cacheSet("ideas", s, country, top);
  return top;
}

export type UrlKeyword = { keyword: string; position: number | null; volume: number | null; traffic: number | null };

// Zoekwoorden waarop een specifieke URL organisch rankt (eigen pagina of een
// concurrent uit de top-10) — voor content-gap-analyse.
export async function getUrlOrganicKeywords(targetUrl: string, country = "nl", limit = 50): Promise<UrlKeyword[]> {
  const u = targetUrl.trim();
  if (!u) return [];
  const cached = await cacheGet<UrlKeyword[]>("urlkw", u, country, 30);
  if (cached) return cached;
  const today = new Date().toISOString().slice(0, 10);
  const data = (await ahrefsFetch("/site-explorer/organic-keywords", {
    target: u, mode: "exact", country, date: today, limit: String(limit), select: "keyword,best_position,volume,sum_traffic",
  })) as { keywords?: { keyword: string; best_position?: number; volume?: number; sum_traffic?: number }[] };
  const rows = (data.keywords || []).map((r) => ({ keyword: r.keyword, position: r.best_position ?? null, volume: r.volume ?? null, traffic: r.sum_traffic ?? null }));
  rows.sort((a, b) => (b.traffic || 0) - (a.traffic || 0));
  const top = rows.slice(0, limit);
  await cacheSet("urlkw", u, country, top);
  return top;
}

export type SiteKeyword = {
  keyword: string; position: number | null; volume: number | null; cpc: number | null;
  traffic: number | null; intent: string; branded: boolean;
};

function intentFromFlags(r: { is_transactional?: boolean; is_commercial?: boolean; is_informational?: boolean; is_navigational?: boolean }): string {
  if (r.is_transactional) return "transactioneel";
  if (r.is_commercial) return "commercieel";
  if (r.is_informational) return "informatief";
  if (r.is_navigational) return "navigatie";
  return "";
}

// Alle organische zoekwoorden van een heel DOMEIN (incl. subdomeinen) met volume,
// positie, CPC, verkeer, zoekintentie en of het een merk-zoekwoord is. De basis
// voor de laaghangend-fruit-scan. Eén call voor het hele domein (credit-bewust).
export async function getSiteOrganicKeywords(domain: string, country = "nl", limit = 800): Promise<SiteKeyword[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d) return [];
  const today = new Date().toISOString().slice(0, 10);
  const data = (await ahrefsFetch("/site-explorer/organic-keywords", {
    target: d, mode: "subdomains", country, date: today, limit: String(limit),
    select: "keyword,best_position,volume,cpc,sum_traffic,is_branded,is_commercial,is_informational,is_navigational,is_transactional",
  })) as { keywords?: Record<string, unknown>[] };
  const rows = (data.keywords || []).map((r) => ({
    keyword: String(r.keyword || ""),
    position: r.best_position == null ? null : Number(r.best_position),
    volume: r.volume == null ? null : Number(r.volume),
    cpc: r.cpc == null ? null : Number(r.cpc),
    traffic: r.sum_traffic == null ? null : Number(r.sum_traffic),
    intent: intentFromFlags(r as { is_transactional?: boolean }),
    branded: !!r.is_branded,
  })).filter((r) => r.keyword);
  rows.sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || (b.volume || 0) - (a.volume || 0));
  return rows;
}

// Top-pagina's van een heel DOMEIN in ÉÉN call: per pagina het top-zoekwoord +
// positie, organisch verkeer, aantal zoekwoorden en verwijzende domeinen. Dit is
// de motor achter de cannibalisatie-analyse (welke pagina rankt op welk merk+geo-
// zoekwoord, hoe sterk is de pagina). mode=subdomains vangt www + non-www; anders
// mist Ahrefs pagina's. 30 dagen gecachet, dus herhaalde runs kosten geen credits.
export type AhrefsTopPage = { url: string; topKeyword: string; position: number | null; traffic: number | null; keywords: number | null; refDomains: number | null };
export async function getAhrefsTopPages(domain: string, limit = 300): Promise<AhrefsTopPage[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d) return [];
  const cached = await cacheGet<AhrefsTopPage[]>("toppages", d, "nl", 30);
  if (cached) return cached;
  const today = new Date().toISOString().slice(0, 10);
  const data = (await ahrefsFetch("/site-explorer/top-pages", {
    target: d, mode: "subdomains", country: "nl", date: today, limit: String(limit),
    order_by: "sum_traffic:desc",
    select: "url,top_keyword,top_keyword_best_position,sum_traffic,keywords,referring_domains",
  })) as { pages?: Record<string, unknown>[] };
  const rows = (data.pages || []).map((r) => ({
    url: String(r.url || ""),
    topKeyword: String(r.top_keyword || ""),
    position: r.top_keyword_best_position == null ? null : Number(r.top_keyword_best_position),
    traffic: r.sum_traffic == null ? null : Number(r.sum_traffic),
    keywords: r.keywords == null ? null : Number(r.keywords),
    refDomains: r.referring_domains == null ? null : Number(r.referring_domains),
  })).filter((r) => r.url);
  await cacheSet("toppages", d, "nl", rows);
  return rows;
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
