import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// GOOGLE-KOPPELING (Search Console + Analytics, read-only)
// ═══════════════════════════════════════════════════════════
// Eenmalige login. Refresh-token in oauth_tokens (provider='google').
// Daarmee haalt het dashboard zelf GSC- en GA4-data per klant op.
//
// Env-vars (Vercel): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
// Redirect-URI in Google Cloud: <site>/api/google/auth/callback
// Scopes: webmasters.readonly + analytics.readonly
// ═══════════════════════════════════════════════════════════

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  // Drive: mappen kunnen browsen + documenten wegschrijven en delen. Full drive
  // want we tonen een eigen mappenkiezer die de bestaande mappenboom moet uitlezen
  // (drive.file kan alleen bij eigen/gepickte bestanden, niet de mappen listen).
  "https://www.googleapis.com/auth/drive",
  "openid", "email",
].join(" ");

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/google/auth/callback`;
}

export function googleAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; error?: string; error_description?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return (await res.json()) as TokenResponse;
}

export async function googleExchangeCode(origin: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code,
    redirect_uri: googleRedirectUri(origin),
  });
  if (!data.refresh_token) {
    return { ok: false, error: data.error_description || data.error || "Geen refresh-token ontvangen (probeer opnieuw met toestemming)." };
  }
  await ensureSchema();
  let account = "";
  if (data.id_token) {
    try { account = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString()).email || ""; } catch { /* optioneel */ }
  }
  await sql`
    INSERT INTO oauth_tokens (provider, refresh_token, account, updated_at)
    VALUES ('google', ${data.refresh_token}, ${account || null}, now())
    ON CONFLICT (provider) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, account = EXCLUDED.account, updated_at = now()`;
  return { ok: true };
}

export async function googleStatus(): Promise<{ configured: boolean; connected: boolean; account: string | null }> {
  const configured = googleConfigured();
  if (!configured) return { configured, connected: false, account: null };
  await ensureSchema();
  const { rows } = await sql`SELECT account, refresh_token FROM oauth_tokens WHERE provider = 'google' LIMIT 1`;
  return { configured, connected: !!rows[0]?.refresh_token, account: (rows[0]?.account as string) || null };
}

// Beschikbaar voor de Drive-laag (lib/drive.ts). Levert een verse access-token
// uit de opgeslagen refresh-token; null als Google niet gekoppeld is.
export async function getGoogleAccessToken(): Promise<string | null> {
  return googleAccessToken();
}

async function googleAccessToken(): Promise<string | null> {
  if (!googleConfigured()) return null;
  await ensureSchema();
  const { rows } = await sql`SELECT refresh_token FROM oauth_tokens WHERE provider = 'google' LIMIT 1`;
  const refresh = rows[0]?.refresh_token as string | undefined;
  if (!refresh) return null;
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  return data.access_token || null;
}

// ── Search Console ──────────────────────────────────────────

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function gscQuery(token: string, siteUrl: string, body: Record<string, unknown>): Promise<GscRow[]> {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: isoDaysAgo(31), endDate: isoDaysAgo(3), ...body }),
  });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j.rows) ? j.rows : [];
}

// Zoekt de juiste GSC-property voor een domein (domein-property of url-prefix).
async function gscPickSite(token: string, domain: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = await res.json();
  const entries: { siteUrl: string }[] = Array.isArray(j.siteEntry) ? j.siteEntry : [];
  const d = domain.replace(/^www\./, "").toLowerCase();
  const byDomain = entries.find((e) => e.siteUrl.toLowerCase() === `sc-domain:${d}`);
  if (byDomain) return byDomain.siteUrl;
  const byPrefix = entries.find((e) => e.siteUrl.toLowerCase().includes(d));
  return byPrefix ? byPrefix.siteUrl : null;
}

export type GscData = {
  connected: boolean;
  site: string | null;
  metrics: { metric: string; value: number }[];
  keywords: { keyword: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { url: string; clicks: number; impressions: number }[];
};

export async function getGscForClient(domain: string): Promise<GscData | null> {
  const token = await googleAccessToken();
  if (!token) return null;
  if (!domain) return { connected: true, site: null, metrics: [], keywords: [], pages: [] };
  const site = await gscPickSite(token, domain);
  if (!site) return { connected: true, site: null, metrics: [], keywords: [], pages: [] };

  const [totals, kw, pg] = await Promise.all([
    gscQuery(token, site, {}),
    gscQuery(token, site, { dimensions: ["query"], rowLimit: 25 }),
    gscQuery(token, site, { dimensions: ["page"], rowLimit: 15 }),
  ]);

  const t = totals[0];
  const metrics = t
    ? [
        { metric: "clicks", value: Math.round(t.clicks) },
        { metric: "impressions", value: Math.round(t.impressions) },
        { metric: "ctr", value: Math.round(t.ctr * 1000) / 10 },
        { metric: "position", value: Math.round(t.position * 10) / 10 },
      ]
    : [];

  return {
    connected: true,
    site,
    metrics,
    keywords: kw.map((r) => ({
      keyword: r.keys?.[0] || "",
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      ctr: Math.round(r.ctr * 1000) / 10,
      position: Math.round(r.position * 10) / 10,
    })),
    pages: pg.map((r) => ({ url: r.keys?.[0] || "", clicks: Math.round(r.clicks), impressions: Math.round(r.impressions) })),
  };
}

// ── Periode-vergelijking (huidige vs vorige periode) ────────
// De GSC-data loopt ~2 dagen achter; daarom eindigt de huidige periode 2 dagen
// geleden. De vorige periode is exact even lang en ligt er direct voor.
function periodRanges(days: number) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const lag = 2;
  const curEnd = new Date(); curEnd.setDate(curEnd.getDate() - lag);
  const curStart = new Date(curEnd); curStart.setDate(curStart.getDate() - (days - 1));
  const prevEnd = new Date(curStart); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
  return { curStart: iso(curStart), curEnd: iso(curEnd), prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
}

export type MetricPair = { cur: number; prev: number };
export type GscSeries = { clicks: number[]; impressions: number[]; ctr: number[]; position: number[] };
// Sitebrede zoekwoord→pagina-matrix: welk zoekwoord op welke pagina rankt.
// Dit is de kern voor cannibalisatie-detectie (bv. homepage die op "hovenier
// [plaats]" rankt terwijl er een aparte plaatspagina bestaat).
export async function getGscQueryPageMatrix(domain: string, days = 90, limit = 150): Promise<{ keyword: string; page: string; clicks: number; impressions: number; position: number }[]> {
  const token = await googleAccessToken();
  if (!token || !domain) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days);
  const rows = await gscQuery(token, site, {
    startDate: r.curStart, endDate: r.curEnd,
    dimensions: ["query", "page"], rowLimit: limit,
  });
  return rows.map((x) => ({
    keyword: x.keys?.[0] || "",
    page: x.keys?.[1] || "",
    clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: Math.round(x.position * 10) / 10,
  }));
}

// Zoekwoorden waarop één specifieke pagina rankt (voor grounding in de chat).
export async function getGscForPage(domain: string, pageUrl: string, days = 90): Promise<{ keyword: string; clicks: number; impressions: number; position: number }[]> {
  const token = await googleAccessToken();
  if (!token || !domain || !pageUrl) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days);
  const rows = await gscQuery(token, site, {
    startDate: r.curStart, endDate: r.curEnd,
    dimensions: ["query"], rowLimit: 25,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
  });
  return rows.map((x) => ({
    keyword: x.keys?.[0] || "",
    clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: Math.round(x.position * 10) / 10,
  }));
}

// Daglijnen (clicks/impressies/CTR/positie) voor één pagina over een datumbereik.
// Voor de KPI-impact-grafiek rond een wijziging (60 dagen voor/na).
export type GscDay = { date: string; clicks: number; impressions: number; ctr: number; position: number };
export async function getGscDailyForPage(domain: string, pageUrl: string, startDate: string, endDate: string): Promise<GscDay[]> {
  const token = await googleAccessToken();
  if (!token || !domain || !pageUrl) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const rows = await gscQuery(token, site, {
    startDate, endDate, dimensions: ["date"], rowLimit: 500,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
  });
  return rows
    .map((x) => ({ date: x.keys?.[0] || "", clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), ctr: x.ctr, position: Math.round(x.position * 10) / 10 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Keyword-rankings voor en na een wijzigingsmoment (positie + kliks per zoekwoord).
export type GscKeywordBA = { keyword: string; positionBefore: number | null; positionAfter: number | null; clicksBefore: number; clicksAfter: number };
export async function getGscKeywordsBeforeAfter(domain: string, pageUrl: string, changeDate: string, days = 60): Promise<GscKeywordBA[]> {
  const token = await googleAccessToken();
  if (!token || !domain || !pageUrl) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const c = new Date(changeDate + "T00:00:00Z").getTime();
  const day = 86400000;
  const beforeStart = iso(new Date(c - days * day)), beforeEnd = iso(new Date(c - day));
  const afterStart = iso(new Date(c)), afterEnd = iso(new Date(Math.min(c + days * day, Date.now() - 3 * day)));
  const q = (s: string, e: string) => gscQuery(token, site, {
    startDate: s, endDate: e, dimensions: ["query"], rowLimit: 50,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
  });
  const [before, after] = await Promise.all([q(beforeStart, beforeEnd), q(afterStart, afterEnd)]);
  const bm = new Map(before.map((r) => [r.keys?.[0] || "", r]));
  const am = new Map(after.map((r) => [r.keys?.[0] || "", r]));
  const keys = new Set([...bm.keys(), ...am.keys()].filter(Boolean));
  return [...keys]
    .map((k) => {
      const b = bm.get(k), a = am.get(k);
      return {
        keyword: k,
        positionBefore: b ? Math.round(b.position * 10) / 10 : null,
        positionAfter: a ? Math.round(a.position * 10) / 10 : null,
        clicksBefore: b ? Math.round(b.clicks) : 0,
        clicksAfter: a ? Math.round(a.clicks) : 0,
      };
    })
    .sort((x, y) => (y.clicksAfter + y.clicksBefore) - (x.clicksAfter + x.clicksBefore))
    .slice(0, 20);
}

// GA4-gedragssignalen voor één pagina, voor en na een wijzigingsmoment.
export type Ga4PageStat = { views: number; timeOnPage: number; bounceRate: number; engagementRate: number; pagesPerSession: number; sessionDuration: number };
export type Ga4PageSignals = { available: boolean; before: Ga4PageStat; after: Ga4PageStat };
export async function getGa4PageSignalsBeforeAfter(slug: string, pageUrl: string, changeDate: string, days = 60): Promise<Ga4PageSignals | null> {
  const token = await googleAccessToken();
  if (!token) return null;
  await ensureSchema();
  const { rows } = await sql`SELECT ga4_property_id, domain FROM clients WHERE slug = ${slug} LIMIT 1`;
  let propertyId = (rows[0]?.ga4_property_id as string) || "";
  const domain = (rows[0]?.domain as string) || "";
  if (!propertyId && domain) {
    const found = await ga4DiscoverProperty(token, domain);
    if (found) { propertyId = found; await sql`UPDATE clients SET ga4_property_id = ${found} WHERE slug = ${slug}`; }
  }
  if (!propertyId) return null;

  let path = ""; try { path = new URL(pageUrl).pathname; } catch { path = pageUrl; }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const c = new Date(changeDate + "T00:00:00Z").getTime();
  const day = 86400000;
  const dateRanges = [
    { startDate: iso(new Date(c - days * day)), endDate: iso(new Date(c - day)) },
    { startDate: iso(new Date(c)), endDate: iso(new Date(Math.min(c + days * day, Date.now() - day))) },
  ];
  async function report(field: string, metrics: string[]): Promise<Record<string, number[]> | null> {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges, dimensionFilter: { filter: { fieldName: field, stringFilter: { matchType: "EXACT", value: path } } }, metrics: metrics.map((name) => ({ name })) }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const out: Record<string, number[]> = {};
    for (const r of (j.rows || []) as { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[]) {
      const idx = r.dimensionValues?.[0]?.value || "";
      out[idx] = (r.metricValues || []).map((m) => Number(m.value) || 0);
    }
    return out;
  }
  const pageR = await report("pagePath", ["screenPageViews", "userEngagementDuration", "bounceRate", "engagementRate"]).catch(() => null);
  const landR = await report("landingPage", ["screenPageViewsPerSession", "averageSessionDuration"]).catch(() => null);
  const build = (i: number): Ga4PageStat => {
    const p = (pageR && pageR[`date_range_${i}`]) || [];
    const l = (landR && landR[`date_range_${i}`]) || [];
    const views = p[0] || 0, engDur = p[1] || 0;
    return {
      views,
      timeOnPage: views ? Math.round(engDur / views) : 0,
      bounceRate: Math.round((p[2] || 0) * 1000) / 10,
      engagementRate: Math.round((p[3] || 0) * 1000) / 10,
      pagesPerSession: Math.round((l[0] || 0) * 100) / 100,
      sessionDuration: Math.round(l[1] || 0),
    };
  };
  return { available: !!pageR, before: build(0), after: build(1) };
}

export type GscComparison = {
  connected: boolean;
  site: string | null;
  totals: { clicks: MetricPair; impressions: MetricPair; ctr: MetricPair; position: MetricPair } | null;
  series: GscSeries;
  keywords: { keyword: string; clicks: number; impressions: number; ctr: number; position: number; prevClicks: number; prevImpressions: number; prevCtr: number; prevPosition: number | null }[];
  pages: { url: string; clicks: number; impressions: number; prevClicks: number; prevImpressions: number }[];
  range: { curStart: string; curEnd: string; prevStart: string; prevEnd: string };
};

export async function getGscComparison(domain: string, days: number): Promise<GscComparison | null> {
  const token = await googleAccessToken();
  if (!token) return null;
  const range = periodRanges(days);
  const emptySeries: GscSeries = { clicks: [], impressions: [], ctr: [], position: [] };
  const empty: GscComparison = { connected: true, site: null, totals: null, series: emptySeries, keywords: [], pages: [], range };
  if (!domain) return empty;
  const site = await gscPickSite(token, domain);
  if (!site) return empty;

  const [curTot, prevTot, curKw, prevKw, curPg, prevPg, byDate] = await Promise.all([
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["query"], rowLimit: 100 }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd, dimensions: ["query"], rowLimit: 100 }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["page"], rowLimit: 50 }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd, dimensions: ["page"], rowLimit: 50 }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["date"], rowLimit: 500 }),
  ]);

  // Dagreeksen (op datum gesorteerd) voor de grafiekjes.
  const dated = [...byDate].sort((a, b) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || ""));
  const series: GscSeries = {
    clicks: dated.map((r) => Math.round(r.clicks)),
    impressions: dated.map((r) => Math.round(r.impressions)),
    ctr: dated.map((r) => Math.round(r.ctr * 1000) / 10),
    position: dated.map((r) => Math.round(r.position * 10) / 10),
  };

  const c = curTot[0]; const p = prevTot[0];
  const totals = c ? {
    clicks: { cur: Math.round(c.clicks), prev: Math.round(p?.clicks || 0) },
    impressions: { cur: Math.round(c.impressions), prev: Math.round(p?.impressions || 0) },
    ctr: { cur: Math.round(c.ctr * 1000) / 10, prev: Math.round((p?.ctr || 0) * 1000) / 10 },
    position: { cur: Math.round(c.position * 10) / 10, prev: p ? Math.round(p.position * 10) / 10 : 0 },
  } : null;

  const prevKwMap = new Map<string, GscRow>();
  for (const r of prevKw) { const k = r.keys?.[0]; if (k) prevKwMap.set(k, r); }
  const keywords = curKw.map((r) => {
    const kw = r.keys?.[0] || "";
    const pr = prevKwMap.get(kw);
    return {
      keyword: kw,
      clicks: Math.round(r.clicks), impressions: Math.round(r.impressions),
      ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10,
      prevClicks: pr ? Math.round(pr.clicks) : 0,
      prevImpressions: pr ? Math.round(pr.impressions) : 0,
      prevCtr: pr ? Math.round(pr.ctr * 1000) / 10 : 0,
      prevPosition: pr ? Math.round(pr.position * 10) / 10 : null,
    };
  });

  const prevPgMap = new Map<string, GscRow>();
  for (const r of prevPg) { const u = r.keys?.[0]; if (u) prevPgMap.set(u, r); }
  const pages = curPg.map((r) => {
    const url = r.keys?.[0] || "";
    const pr = prevPgMap.get(url);
    return {
      url, clicks: Math.round(r.clicks), impressions: Math.round(r.impressions),
      prevClicks: pr ? Math.round(pr.clicks) : 0,
      prevImpressions: pr ? Math.round(pr.impressions) : 0,
    };
  });

  return { connected: true, site, totals, series, keywords, pages, range };
}

export type Ga4Comparison = { connected: boolean; propertyId: string | null; totals: { metric: string; cur: number; prev: number; series: number[] }[] };

export async function getGa4Comparison(slug: string, domain: string, days: number): Promise<Ga4Comparison | null> {
  const token = await googleAccessToken();
  if (!token) return null;
  await ensureSchema();
  const { rows } = await sql`SELECT ga4_property_id FROM clients WHERE slug = ${slug} LIMIT 1`;
  let propertyId = (rows[0]?.ga4_property_id as string) || "";
  if (!propertyId && domain) {
    const found = await ga4DiscoverProperty(token, domain);
    if (found) { propertyId = found; await sql`UPDATE clients SET ga4_property_id = ${found} WHERE slug = ${slug}`; }
  }
  if (!propertyId) return { connected: true, propertyId: null, totals: [] };

  const range = periodRanges(days);
  async function run(metricNames: string[]) {
    return fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [
          { startDate: range.curStart, endDate: range.curEnd },
          { startDate: range.prevStart, endDate: range.prevEnd },
        ],
        metrics: metricNames.map((name) => ({ name })),
      }),
    });
  }
  let names = ["totalUsers", "sessions", "conversions"];
  let res = await run(names);
  if (!res.ok) { names = ["totalUsers", "sessions"]; res = await run(names); }
  if (!res.ok) return { connected: true, propertyId, totals: [] };
  const j = await res.json();
  const rowsArr: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] = j.rows || [];
  const cur = rowsArr.find((r) => r.dimensionValues?.[0]?.value === "date_range_0") || rowsArr[0];
  const prev = rowsArr.find((r) => r.dimensionValues?.[0]?.value === "date_range_1") || rowsArr[1];

  // Dagreeksen (huidige periode) voor de grafiekjes.
  const seriesByMetric: Record<string, number[]> = {};
  try {
    const dres = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: range.curStart, endDate: range.curEnd }],
        dimensions: [{ name: "date" }],
        metrics: names.map((name) => ({ name })),
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    });
    if (dres.ok) {
      const dj = await dres.json();
      const drows: { metricValues?: { value: string }[] }[] = dj.rows || [];
      names.forEach((name, i) => { seriesByMetric[name] = drows.map((r) => Math.round(Number(r.metricValues?.[i]?.value || 0))); });
    }
  } catch { /* grafiekje is optioneel */ }

  const totals = names.map((name, i) => ({
    metric: name,
    cur: Math.round(Number(cur?.metricValues?.[i]?.value || 0)),
    prev: Math.round(Number(prev?.metricValues?.[i]?.value || 0)),
    series: seriesByMetric[name] || [],
  }));
  return { connected: true, propertyId, totals };
}

// Gemiddelde positie van de top-zoekwoorden per maand over de laatste 4 maanden.
export type GscTrend = { months: string[]; rows: { keyword: string; positions: (number | null)[] }[] };

export async function getGscKeywordTrend(domain: string): Promise<GscTrend | null> {
  const token = await googleAccessToken();
  if (!token || !domain) return null;
  const site = await gscPickSite(token, domain);
  if (!site) return null;

  const SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
  const ranges: { startDate: string; endDate: string; label: string }[] = [];
  for (let off = 3; off >= 0; off--) {
    const now = new Date();
    const m = now.getMonth() - off;
    const start = new Date(now.getFullYear(), m, 1);
    let end = new Date(now.getFullYear(), m + 1, 0);
    if (end > cutoff) end = cutoff;
    ranges.push({ startDate: iso(start), endDate: iso(end), label: SHORT[((m % 12) + 12) % 12] });
  }

  const perMonth = await Promise.all(ranges.map((r) =>
    gscQuery(token, site, { startDate: r.startDate, endDate: r.endDate, dimensions: ["query"], rowLimit: 25 }),
  ));
  const map = new Map<string, (number | null)[]>();
  ranges.forEach((_, idx) => {
    for (const row of perMonth[idx]) {
      const kw = row.keys?.[0];
      if (!kw) continue;
      if (!map.has(kw)) map.set(kw, [null, null, null, null]);
      map.get(kw)![idx] = Math.round(row.position * 10) / 10;
    }
  });
  const recent = new Set((perMonth[3] || []).slice(0, 12).map((r) => r.keys?.[0]).filter(Boolean) as string[]);
  const rows = Array.from(map.entries())
    .filter(([kw]) => recent.has(kw))
    .map(([keyword, positions]) => ({ keyword, positions }));
  return { months: ranges.map((r) => r.label), rows };
}

// ── Google Analytics (GA4) ──────────────────────────────────

// Zoekt de GA4-property waarvan een datastream-URL bij het domein past.
async function ga4DiscoverProperty(token: string, domain: string): Promise<string | null> {
  const d = domain.replace(/^www\./, "").toLowerCase();
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = await res.json();
  const summaries: { propertySummaries?: { property?: string }[] }[] = j.accountSummaries || [];
  const propertyNames: string[] = [];
  for (const acc of summaries) for (const p of acc.propertySummaries || []) if (p.property) propertyNames.push(p.property);

  for (const prop of propertyNames.slice(0, 40)) {
    const sres = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${prop}/dataStreams`, { headers: { Authorization: `Bearer ${token}` } });
    if (!sres.ok) continue;
    const sj = await sres.json();
    const streams: { webStreamData?: { defaultUri?: string } }[] = sj.dataStreams || [];
    for (const s of streams) {
      const uri = (s.webStreamData?.defaultUri || "").toLowerCase();
      if (uri && uri.includes(d)) return prop.replace("properties/", "");
    }
  }
  return null;
}

async function ga4RunReport(token: string, propertyId: string): Promise<{ metric: string; value: number }[] | null> {
  async function run(metricNames: string[]) {
    return fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], metrics: metricNames.map((name) => ({ name })) }),
    });
  }
  let names = ["totalUsers", "sessions", "conversions"];
  let res = await run(names);
  if (!res.ok) { names = ["totalUsers", "sessions"]; res = await run(names); }
  if (!res.ok) return null;
  const j = await res.json();
  const values: string[] = j.rows?.[0]?.metricValues?.map((m: { value?: string }) => m.value || "0") || names.map(() => "0");
  return names.map((name, i) => ({ metric: name, value: Math.round(Number(values[i] || 0)) }));
}

export type Ga4Data = { connected: boolean; propertyId: string | null; metrics: { metric: string; value: number }[] };

export async function getGa4ForClient(slug: string, domain: string): Promise<Ga4Data | null> {
  const token = await googleAccessToken();
  if (!token) return null;
  await ensureSchema();

  // Property-id uit cache, anders opzoeken en bewaren.
  const { rows } = await sql`SELECT ga4_property_id FROM clients WHERE slug = ${slug} LIMIT 1`;
  let propertyId = (rows[0]?.ga4_property_id as string) || "";
  if (!propertyId && domain) {
    const found = await ga4DiscoverProperty(token, domain);
    if (found) { propertyId = found; await sql`UPDATE clients SET ga4_property_id = ${found} WHERE slug = ${slug}`; }
  }
  if (!propertyId) return { connected: true, propertyId: null, metrics: [] };

  const metrics = await ga4RunReport(token, propertyId);
  return { connected: true, propertyId, metrics: metrics || [] };
}
