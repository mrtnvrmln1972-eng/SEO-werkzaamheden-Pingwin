import { AsyncLocalStorage } from "node:async_hooks";
import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { logUsage } from "./usage";
import { logBronGebeurtenis } from "./bron-gezondheid";

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

// ── Klant-context voor de verbruik-meting ──
// De Ahrefs-helpers worden diep in de lib aangeroepen zonder slug-parameter.
// Daarom zetten we de klant-context één keer per request (guardSlug) of per
// achtergrond-run (doc-runs) in een AsyncLocalStorage; elke Ahrefs-call binnen
// die async-keten weet dan bij welke klant het verbruik hoort. Een gewone
// module-variabele zou hier fout zijn: parallelle requests in dezelfde
// serverless-instance zouden elkaars slug overschrijven.
const ahrefsAls = new AsyncLocalStorage<{ slug?: string }>();

export function setAhrefsContext(ctx: { slug?: string }): void {
  ahrefsAls.enterWith(ctx);
}

export function runWithAhrefsContext<T>(ctx: { slug?: string }, fn: () => Promise<T>): Promise<T> {
  return ahrefsAls.run(ctx, fn);
}

// Ahrefs geeft (afhankelijk van endpoint/abonnement) het aantal verbruikte
// API-units terug in een response-header. Defensief lezen: eerste header die
// numeriek parsed telt; anders null en telt de regel alleen als call.
function readUnitsHeader(headers: Headers): number | null {
  for (const name of ["x-api-units-cost-total-actual", "x-api-units-cost-total", "x-api-units-cost-row", "x-api-units-cost", "x-api-cost"]) {
    const raw = headers.get(name);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
  }
  return null;
}

// ── Eigen Ahrefs-sleutel per klant (via een label, nooit de sleutel zelf) ──
// clients.ahrefs_key_ref bevat een label (bv. 'COLLEGA1'); de echte sleutel
// staat in Vercel als AHREFS_API_TOKEN_<LABEL>. Korte cache zodat dit geen
// extra database-query per Ahrefs-call kost. Geen label of geen env-var
// gevonden = het hoofdaccount (huidig gedrag).
const keyRefCache = new Map<string, { ref: string | null; at: number }>();

async function tokenForSlug(slug: string | undefined): Promise<string | undefined> {
  if (!slug) return undefined;
  let entry = keyRefCache.get(slug);
  if (!entry || Date.now() - entry.at > 60000) {
    let ref: string | null = null;
    try {
      await ensureSchema();
      const { rows } = await sql`SELECT ahrefs_key_ref FROM clients WHERE slug = ${slug} LIMIT 1`;
      ref = (rows[0]?.ahrefs_key_ref as string | null) || null;
    } catch {
      ref = null;
    }
    entry = { ref, at: Date.now() };
    keyRefCache.set(slug, entry);
  }
  if (!entry.ref) return undefined;
  const envName = "AHREFS_API_TOKEN_" + entry.ref.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return process.env[envName] || undefined;
}

// De meeste endpoints zijn GET met query-parameters. Een enkele (batch-analysis)
// is POST met een JSON-body, omdat je er honderd doelen tegelijk in stopt; geef
// dan `body` mee en de parameters gaan de body in in plaats van de URL.
async function ahrefsFetch(path: string, params: Record<string, string>, body?: unknown): Promise<unknown> {
  const slug = ahrefsAls.getStore()?.slug ?? null;
  const token = (await tokenForSlug(slug ?? undefined)) || process.env.AHREFS_API_TOKEN;
  if (!token) {
    await logBronGebeurtenis("ahrefs", false, "Geen API-sleutel ingesteld (AHREFS_API_TOKEN ontbreekt).", slug);
    throw new Error("AHREFS_API_TOKEN ontbreekt.");
  }
  const url = new URL(BASE + path);
  if (!body) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Ahrefs ${path}: ${res.status} ${errText.slice(0, 300)}`);
    }
    // Verbruik-meting: één regel per echte API-call (cache-hits komen hier nooit).
    // tokens_in hergebruiken we als "units"; mag de echte taak nooit breken.
    // Meta-aanvragen (abonnement-tegoed opvragen) tellen zelf niet als verbruik.
    if (!path.startsWith("/subscription-info")) {
      logUsage({
        slug,
        service: "ahrefs",
        action: path,
        tokensIn: readUnitsHeader(res.headers) ?? 0,
      }).catch(() => {});
    }
    await logBronGebeurtenis("ahrefs", true, "", slug);
    return await res.json();
  } catch (e) {
    await logBronGebeurtenis("ahrefs", false, (e as Error).message?.slice(0, 400) || "Onbekende fout.", slug);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verse controle voor het bronnen-gezondheidsscherm, buiten de uurcache van
 * getAhrefsSubscriptionUsage() om: die mag daar best oud zijn, hier moet hij
 * vers zijn zodat een losgetrokken koppeling meteen zichtbaar is.
 */
export async function ahrefsHealthCheck(): Promise<{ ok: boolean; melding: string }> {
  if (!ahrefsConfigured()) return { ok: false, melding: "Geen API-sleutel ingesteld." };
  try {
    await ahrefsFetch("/subscription-info/limits-and-usage", {});
    return { ok: true, melding: "Werkt." };
  } catch (e) {
    return { ok: false, melding: (e as Error).message || "Onbekende fout." };
  }
}

// ── Abonnement-tegoed (voor de teller in de kopbalk en de verbruik-pagina) ──
// Vraagt bij Ahrefs op hoeveel API-units er deze abonnementsmaand zijn gebruikt
// van het totaal. Defensief: velden kunnen per abonnement verschillen, en bij
// een fout geven we null terug (de teller verbergt zich dan gewoon).
// Uurcache in het geheugen zodat de kopbalk snel blijft; deze meta-aanvraag is
// bij Ahrefs zelf gratis en telt dus niet mee in het verbruik dat hij toont.
//
// Let op het verschil tussen de twee tellers die Ahrefs teruggeeft:
//  - workspace: het hele Ahrefs-account, dus ook wat er buiten dit dashboard om
//    gebeurt. Dat is de teller die op kan raken, dus die staat in de kopbalk.
//  - api key: alleen de sleutel waarmee dit dashboard praat. Zegt wat óns aandeel
//    is; staat in het uitklappaneel als tweede regel.
export type AhrefsSubscriptionUsage = {
  used: number | null;
  limit: number | null;
  /** Verbruik van alléén de sleutel van dit dashboard (deel van `used`). */
  usedKey: number | null;
  /** Wanneer de teller weer op nul gaat (ISO-datum), of null als Ahrefs het niet meldt. */
  resetIso: string | null;
  /** Naam van het abonnement, zoals Ahrefs hem noemt. */
  abonnement: string | null;
};
let subUsageCache: { data: AhrefsSubscriptionUsage | null; at: number } | null = null;

export async function getAhrefsSubscriptionUsage(): Promise<AhrefsSubscriptionUsage | null> {
  if (!ahrefsConfigured()) return null;
  if (subUsageCache && Date.now() - subUsageCache.at < 3600000) return subUsageCache.data;
  let data: AhrefsSubscriptionUsage | null = null;
  try {
    const raw = (await ahrefsFetch("/subscription-info/limits-and-usage", {})) as Record<string, unknown>;
    const src = (raw?.limits_and_usage ?? raw) as Record<string, unknown>;
    const pick = (...keys: string[]): number | null => {
      for (const k of keys) {
        const n = Number(src?.[k]);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return null;
    };
    const tekst = (k: string): string | null => {
      const v = src?.[k];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    data = {
      used: pick("units_usage_workspace", "units_usage_api_key", "units_used", "usage"),
      limit: pick("units_limit_workspace", "units_limit_api_key", "units_limit", "limit"),
      usedKey: pick("units_usage_api_key"),
      resetIso: tekst("usage_reset_date"),
      abonnement: tekst("subscription"),
    };
    if (data.used === null && data.limit === null) data = null;
  } catch {
    data = null;
  }
  subUsageCache = { data, at: Date.now() };
  return data;
}

// De tabel wordt één keer gebouwd per database, niet bij elke aanroep
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan bouwEnsureCache(), hoog
// dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const AHREFS_CACHE_VERSIE = "ahrefs-cache-4d573a50";

function ensureCache(): Promise<void> {
  return eenmalig("ahrefs-cache", AHREFS_CACHE_VERSIE, bouwEnsureCache);
}

async function bouwEnsureCache(): Promise<void> {
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
export async function cacheGet<T>(kind: string, key: string, country: string, maxAgeDays: number): Promise<T | null> {
  await ensureSchema(); await ensureCache();
  const { rows } = await sql`SELECT data, fetched_at FROM ahrefs_cache WHERE kind = ${kind} AND k = ${key} AND country = ${country} LIMIT 1`;
  if (!rows[0]) return null;
  const ageMs = Date.now() - new Date(rows[0].fetched_at as string).getTime();
  if (ageMs > maxAgeDays * 86400000) return null;
  return rows[0].data as T;
}
export async function cacheSet(kind: string, key: string, country: string, data: unknown): Promise<void> {
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
  keyword: string; position: number | null; positionPrev: number | null; volume: number | null; cpc: number | null;
  traffic: number | null; intent: string; branded: boolean;
  url: string; // de pagina die op dit zoekwoord rankt (best_position_url)
};

function intentFromFlags(r: { is_transactional?: boolean; is_commercial?: boolean; is_informational?: boolean; is_navigational?: boolean }): string {
  if (r.is_transactional) return "transactioneel";
  if (r.is_commercial) return "commercieel";
  if (r.is_informational) return "informatief";
  if (r.is_navigational) return "navigatie";
  return "";
}

/**
 * Backlinks die naar een pagina wijzen die niet meer bestaat. Dat is verdiende
 * autoriteit die in een 404 valt: één omleiding en je hebt hem terug, zonder dat
 * er iemand gemaild hoeft te worden. Gesorteerd op de sterkte van het verwijzende
 * domein, want daar zit de waarde.
 */
export type KapotteBacklink = { naar: string; van: string; domainRating: number | null; anchor: string };
export async function getBrokenBacklinks(domain: string, limit = 100): Promise<KapotteBacklink[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d) return [];
  const cached = await cacheGet<KapotteBacklink[]>("brokenbl", d, "-", 7);
  if (cached) return cached;
  const data = (await ahrefsFetch("/site-explorer/broken-backlinks", {
    target: d, mode: "subdomains", limit: String(limit),
    select: "url_to,url_from,domain_rating_source,anchor",
    order_by: "domain_rating_source:desc",
  })) as { backlinks?: Record<string, unknown>[] };
  const rows = (data.backlinks || []).map((r) => ({
    naar: String(r.url_to || ""),
    van: String(r.url_from || ""),
    domainRating: r.domain_rating_source == null ? null : Number(r.domain_rating_source),
    anchor: String(r.anchor || ""),
  })).filter((r) => r.naar && r.van);
  await cacheSet("brokenbl", d, "-", rows).catch(() => {});
  return rows;
}

// Alle organische zoekwoorden van een heel DOMEIN (incl. subdomeinen) met volume,
// positie, CPC, verkeer, zoekintentie en of het een merk-zoekwoord is. De basis
// voor de laaghangend-fruit-scan. Eén call voor het hele domein (credit-bewust).
// dateCompared (YYYY-MM-DD, optioneel): vergelijk de huidige stand met die datum.
// Dan komt best_position_prev mee zodat we per zoekwoord de positieverandering
// (pijltjes) kunnen tonen. Bij vergelijken houden we alleen de zoekwoorden waar het
// domein NU op rankt (verdwenen zoekwoorden laten we weg, net als de gewone lijst).
export async function getSiteOrganicKeywords(domain: string, country = "nl", limit = 800, dateCompared?: string): Promise<SiteKeyword[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d) return [];
  const today = new Date().toISOString().slice(0, 10);
  const params: Record<string, string> = {
    target: d, mode: "subdomains", country, date: today, limit: String(limit),
    select: "keyword,best_position,best_position_url,volume,cpc,sum_traffic,is_branded,is_commercial,is_informational,is_navigational,is_transactional" + (dateCompared ? ",best_position_prev" : ""),
  };
  if (dateCompared) params.date_compared = dateCompared;
  const data = (await ahrefsFetch("/site-explorer/organic-keywords", params)) as { keywords?: Record<string, unknown>[] };
  const rows = (data.keywords || []).map((r) => ({
    keyword: String(r.keyword || ""),
    position: r.best_position == null ? null : Number(r.best_position),
    positionPrev: r.best_position_prev == null ? null : Number(r.best_position_prev),
    volume: r.volume == null ? null : Number(r.volume),
    cpc: r.cpc == null ? null : Number(r.cpc),
    traffic: r.sum_traffic == null ? null : Number(r.sum_traffic),
    intent: intentFromFlags(r as { is_transactional?: boolean }),
    branded: !!r.is_branded,
    url: String(r.best_position_url || ""),
  })).filter((r) => r.keyword && (!dateCompared || r.position != null));
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

// Alle zoekwoorden van een DOMEIN die een term bevatten (bv. "amsterdam"), met per
// zoekwoord de best-rankende URL + positie + volume + intentie. Zo zie je welke
// pagina's op een plaats/thema-term ranken: de basis voor de per-pagina-cannibalisatie
// (winnaar + concurrenten). Let op: dit toont per zoekwoord alleen de BESTE URL; een
// lager-rankende kaper op dezelfde term zie je pas via getUrlOrganicKeywords per pagina.
export type DomainKeyword = { keyword: string; position: number | null; url: string; volume: number | null; traffic: number | null; transactional: boolean; informational: boolean; branded: boolean; local: boolean };
export async function getDomainKeywordsMatching(domain: string, term: string, limit = 100): Promise<DomainKeyword[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const t = (term || "").trim().toLowerCase();
  if (!d || !t) return [];
  const cached = await cacheGet<DomainKeyword[]>("domkw", `${d}|${t}`, "nl", 30);
  if (cached) return cached;
  const today = new Date().toISOString().slice(0, 10);
  const data = (await ahrefsFetch("/site-explorer/organic-keywords", {
    target: d, mode: "subdomains", country: "nl", date: today, limit: String(limit),
    order_by: "sum_traffic:desc",
    where: JSON.stringify({ field: "keyword", is: ["isubstring", t] }),
    select: "keyword,best_position,best_position_url,volume,sum_traffic,is_transactional,is_informational,is_branded,is_local",
  })) as { keywords?: Record<string, unknown>[] };
  const rows = (data.keywords || []).map((r) => ({
    keyword: String(r.keyword || ""),
    position: r.best_position == null ? null : Number(r.best_position),
    url: String(r.best_position_url || ""),
    volume: r.volume == null ? null : Number(r.volume),
    traffic: r.sum_traffic == null ? null : Number(r.sum_traffic),
    transactional: !!r.is_transactional, informational: !!r.is_informational, branded: !!r.is_branded, local: !!r.is_local,
  })).filter((r) => r.keyword && r.url);
  await cacheSet("domkw", `${d}|${t}`, "nl", rows);
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

// ── Autoriteit: Domain Rating + verwijzende domeinen/backlinks van een doel ──
// Voor de autoriteits-vergelijking in de chat (kan deze site realistisch winnen
// van de top-10?). Werkt op eigen domein én concurrent-URL's. 7 dagen gecachet.
export type SiteAuthority = { target: string; domainRating: number | null; refDomains: number | null; backlinks: number | null };

export async function getSiteAuthority(target: string): Promise<SiteAuthority> {
  const t = (target || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const empty: SiteAuthority = { target: t, domainRating: null, refDomains: null, backlinks: null };
  if (!t) return empty;
  const cached = await cacheGet<SiteAuthority>("authority", t, "-", 7);
  if (cached) return cached;
  const today = new Date().toISOString().slice(0, 10);
  const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);
  const out: SiteAuthority = { ...empty };
  // Een doel MET pad (bv. pingwin.nl/seo-bureau/) = die ene pagina: backlinks
  // exact op die URL meten. Alleen een domein = de hele site (subdomains).
  const isPage = t.includes("/");
  const domainOnly = t.split("/")[0];
  try {
    // Domain Rating bestaat alleen op domein-niveau; voor een pagina meten we
    // de DR van het domein erachter (en de backlinks wél van de pagina zelf).
    const d = (await ahrefsFetch("/site-explorer/domain-rating", { target: domainOnly, date: today })) as { domain_rating?: { domain_rating?: number } };
    out.domainRating = num(d?.domain_rating?.domain_rating);
  } catch { /* DR optioneel */ }
  try {
    const b = (await ahrefsFetch("/site-explorer/backlinks-stats", { target: t, date: today, mode: isPage ? "exact" : "subdomains" })) as { metrics?: { live?: number; live_refdomains?: number } };
    out.backlinks = num(b?.metrics?.live);
    out.refDomains = num(b?.metrics?.live_refdomains);
  } catch { /* backlinks optioneel */ }
  if (out.domainRating !== null || out.refDomains !== null) await cacheSet("authority", t, "-", out);
  return out;
}

// ── Autoriteit per PAGINA (URL Rating) ──
// De interne-link-motor moet weten hoeveel waarde een bronpagina kán doorgeven.
// Dat is URL Rating: de kracht van het linkprofiel van díe ene pagina, op een
// logaritmische schaal van 0 tot 100 (interne links tellen mee, niet alleen
// externe). Tot 6 augustus 2026 leunde de motor op een benadering uit de eigen
// linkgraaf; dit is de echte waarde.
//
// Credit-bewust, en dat is hier geen bijzaak: één call dekt 100 URL's (het
// maximum van het batch-endpoint) en kost 2 units per regel met een bodem van
// 50 per call. Daarom bundelen we, en cachen we 30 dagen per URL, net als de
// andere Ahrefs-data. Een tweede analyse binnen die maand kost dus niets.
export type UrlAutoriteit = { url: string; urlRating: number | null; opgehaald: string };

// Sleutel voor cache én terugkoppeling: host + pad, zonder protocol en zonder
// www, want Ahrefs geeft de URL zelf ook zo terug.
function urKey(url: string): string {
  return (url || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
}

// De slash aan het eind is hier geen detail maar het verschil tussen een cijfer
// en een nul. Ahrefs kent /hovenier-den-bosch/ met autoriteit 6, en
// /hovenier-den-bosch (zonder slash) helemaal niet: die geeft 0,0 terug, zonder
// foutmelding. Onze eigen paden staan zonder slash opgeslagen, dus zonder deze
// stap zou élke pagina van élke klant "geen autoriteit" heten en zou niemand het
// merken. Daarom vragen we beide vormen op en houden we de hoogste.
export function varianten(url: string): string[] {
  const k = urKey(url);
  if (k.endsWith("/")) return [k, k.replace(/\/+$/, "")].filter((x) => x.includes("/"));
  return [k, k + "/"];
}

export async function getUrlRatings(urls: string[], maxAgeDays = 30): Promise<Map<string, UrlAutoriteit>> {
  const out = new Map<string, UrlAutoriteit>();
  const schoon = Array.from(new Set((urls || []).map((u) => (u || "").trim()).filter(Boolean)));
  if (!schoon.length || !ahrefsConfigured()) return out;

  // Per aan te vragen variant onthouden wat we al weten.
  const perVariant = new Map<string, UrlAutoriteit>();
  const missers: string[] = [];
  for (const u of schoon) {
    for (const v of varianten(u)) {
      if (perVariant.has(v) || missers.includes(v)) continue;
      const cached = await cacheGet<UrlAutoriteit>("ur", v, "-", maxAgeDays).catch(() => null);
      if (cached) perVariant.set(v, cached); else missers.push(v);
    }
  }

  const klaar = () => {
    for (const u of schoon) {
      const beste = varianten(u)
        .map((v) => perVariant.get(v))
        .filter((x): x is UrlAutoriteit => !!x)
        .sort((a, b) => (b.urlRating ?? -1) - (a.urlRating ?? -1))[0];
      if (beste) out.set(urKey(u), { ...beste, url: urKey(u) });
    }
    return out;
  };

  for (let i = 0; i < missers.length; i += 100) {
    const slice = missers.slice(i, i + 100).map((v) => `https://${v}`);
    let rijen: { url?: string; url_rating?: number }[] = [];
    try {
      const data = (await ahrefsFetch("/batch-analysis/batch-analysis", {}, {
        select: ["url", "url_rating"],
        targets: slice.map((u) => ({ url: u, mode: "exact", protocol: "both" })),
      })) as { targets?: { url?: string; url_rating?: number }[] };
      rijen = data.targets || [];
    } catch {
      // Autoriteit is een verrijking, geen voorwaarde: valt Ahrefs weg, dan
      // draait de analyse door op de benadering (en zegt dat ook).
      return klaar();
    }
    const perUrl = new Map(rijen.map((r) => [urKey(String(r.url || "")), r]));
    const nu = new Date().toISOString();
    for (const u of slice) {
      const k = urKey(u);
      const r = perUrl.get(k);
      const rij: UrlAutoriteit = {
        url: k,
        urlRating: r && Number.isFinite(Number(r.url_rating)) ? Number(r.url_rating) : null,
        opgehaald: nu,
      };
      await cacheSet("ur", k, "-", rij).catch(() => { /* cache is aanvulling */ });
      perVariant.set(k, rij);
    }
  }
  return klaar();
}

/** Zoek de autoriteit van één URL op in het resultaat van getUrlRatings. */
export function autoriteitVan(map: Map<string, UrlAutoriteit>, url: string): UrlAutoriteit | null {
  return map.get(urKey(url)) || null;
}

// ── AI-vindbaarheid: citaties van het domein in AI-antwoorden (Ahrefs) ──
// Per AI-platform het aantal keer dat het domein wordt aangehaald in gegenereerde
// antwoorden (citations) en hoeveel verschillende pagina's geciteerd worden. Met
// een snapshot van ~30 dagen terug voor de ontwikkeling. 1 dag gecachet.
export type AiPlatformCount = { key: string; label: string; citations: number; pages: number; prevCitations: number | null; prevPages: number | null };
const AI_PLATFORMS: { key: string; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "perplexity", label: "Perplexity" },
  { key: "gemini", label: "Google Gemini" },
  { key: "copilot", label: "Microsoft Copilot" },
  { key: "grok", label: "Grok" },
  { key: "google_ai_mode", label: "Google AI-modus" },
  { key: "google_ai_overviews", label: "Google AI Overviews" },
];
export async function getAiResponsesCount(domain: string): Promise<AiPlatformCount[]> {
  const d = (domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!d) return [];
  const cached = await cacheGet<AiPlatformCount[]>("aicount", d, "nl", 1);
  if (cached) return cached;
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const select = AI_PLATFORMS.map((p) => p.key).join(",");
  const fetchAt = async (date: string) => {
    const data = (await ahrefsFetch("/site-explorer/ai-responses-count", { target: d, mode: "subdomains", select, date })) as { ai_responses_count?: Record<string, { citations?: number; pages?: number }> };
    return data.ai_responses_count || {};
  };
  const cur = await fetchAt(iso(today));
  let prev: Record<string, { citations?: number; pages?: number }> = {};
  try { prev = await fetchAt(iso(monthAgo)); } catch { /* ontwikkeling is aanvulling */ }
  const out = AI_PLATFORMS.map((p) => ({
    key: p.key, label: p.label,
    citations: Number(cur[p.key]?.citations || 0), pages: Number(cur[p.key]?.pages || 0),
    prevCitations: prev[p.key] ? Number(prev[p.key]?.citations || 0) : null,
    prevPages: prev[p.key] ? Number(prev[p.key]?.pages || 0) : null,
  }));
  await cacheSet("aicount", d, "nl", out).catch(() => { /* cache is aanvulling */ });
  return out;
}
