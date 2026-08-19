import { sql, ensureSchema } from "./db";
import { ahrefsConfigured, getKeywordsOverview } from "./ahrefs";
import { logBronGebeurtenis, type BronId } from "./bron-gezondheid";

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

// Twee LOSSE koppelingen (bewust gescheiden, elk een eigen rij in oauth_tokens):
// - data (provider 'google'): Search Console + Analytics, alleen-lezen. Wie de
//   cijfers levert (meestal Maarten) koppelt hier, ZONDER Drive-toestemming.
// - drive (provider 'google_drive'): documenten-opslag. Per wereld koppelt de
//   eigenaar hier het Drive-account waar documenten moeten landen. Zo kan de
//   data-koppeling nooit per ongeluk iemands Drive openzetten.
// - profiel (provider 'google_profiel'): het Google-bedrijfsprofiel van klanten
//   waar Pingwin beheerder van is. Bewust een derde, losse rij: deze toestemming
//   geeft schrijfrechten op de etalage van een klant, en die mag nooit meeliften
//   op de alleen-lezen datakoppeling. Zie lib/gbp.ts.
export type GooglePurpose = "data" | "drive" | "profiel";

const DATA_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "openid", "email",
].join(" ");

const PROFIEL_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid", "email",
].join(" ");

const DRIVE_SCOPES = [
  // Full drive want we tonen een eigen mappenkiezer die de bestaande mappenboom
  // moet uitlezen (drive.file kan alleen bij eigen/gepickte bestanden).
  "https://www.googleapis.com/auth/drive",
  "openid", "email",
].join(" ");

function providerFor(purpose: GooglePurpose): string {
  if (purpose === "drive") return "google_drive";
  if (purpose === "profiel") return "google_profiel";
  return "google";
}

function scopesFor(purpose: GooglePurpose): string {
  if (purpose === "drive") return DRIVE_SCOPES;
  if (purpose === "profiel") return PROFIEL_SCOPES;
  return DATA_SCOPES;
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string): string {
  return `${origin}/api/google/auth/callback`;
}

export function googleAuthUrl(origin: string, state: string, purpose: GooglePurpose = "data"): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: scopesFor(purpose),
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

export async function googleExchangeCode(origin: string, code: string, purpose: GooglePurpose = "data"): Promise<{ ok: boolean; error?: string }> {
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
    VALUES (${providerFor(purpose)}, ${data.refresh_token}, ${account || null}, now())
    ON CONFLICT (provider) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, account = EXCLUDED.account, updated_at = now()`;
  // Net (opnieuw) gekoppeld: het oude bewijs weg, anders blijft deze server tot
  // vijftig minuten met het bewijs van het vorige account werken.
  vergeetGoogleToken(providerFor(purpose));
  return { ok: true };
}

export async function googleStatus(): Promise<{ configured: boolean; connected: boolean; account: string | null }> {
  return statusFor("google");
}

// Status van de losse Drive-koppeling (Beheer → Instellingen).
export async function driveStatus(): Promise<{ configured: boolean; connected: boolean; account: string | null }> {
  return statusFor("google_drive");
}

async function statusFor(provider: string): Promise<{ configured: boolean; connected: boolean; account: string | null }> {
  const configured = googleConfigured();
  if (!configured) return { configured, connected: false, account: null };
  await ensureSchema();
  const { rows } = await sql`SELECT account, refresh_token FROM oauth_tokens WHERE provider = ${provider} LIMIT 1`;
  return { configured, connected: !!rows[0]?.refresh_token, account: (rows[0]?.account as string) || null };
}

// Drive-koppeling verwijderen (knop "Drive ontkoppelen" in Beheer).
export async function disconnectDrive(): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM oauth_tokens WHERE provider = 'google_drive'`;
  // Ook het bewaarde toegangsbewijs weggooien, anders blijft deze server nog tot
  // vijftig minuten doen alsof Drive gekoppeld is.
  vergeetGoogleToken("google_drive");
}

// Data-koppeling (Search Console + Analytics): access-token uit de 'google'-rij.
export async function getGoogleAccessToken(): Promise<string | null> {
  return accessTokenFor("google");
}

// De GA4-property van een klant, voor modules buiten dit bestand (zoals
// lib/ga4-pagina.ts). Bewust dezelfde weg als alles hierbinnen: eerst wat er
// opgeslagen staat, anders één keer zoeken op het domein en het antwoord
// bewaren. Zo bestaat er geen tweede manier om aan een property te komen.
export async function ga4PropertyVoor(slug: string, domainHint = ""): Promise<string | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();
  return ga4PropertyFor(token, slug, domainHint);
}

// Drive-koppeling: access-token uit de aparte 'google_drive'-rij. Bewust GEEN
// terugval op de data-rij: de data-koppeling mag nooit Drive-toegang geven.
export async function getDriveAccessToken(): Promise<string | null> {
  return accessTokenFor("google_drive");
}

// Bedrijfsprofiel-koppeling: eigen rij, eigen toestemming. Geen terugval op de
// andere twee; beheerrechten op een klantprofiel mogen nooit per ongeluk
// ontstaan uit een koppeling die iemand voor Search Console legde.
export async function getProfielAccessToken(): Promise<string | null> {
  return accessTokenFor("google_profiel");
}

// provider ("google"/"google_drive"/"google_profiel") -> bron-id voor R7.
function bronVoorProvider(provider: string): BronId {
  if (provider === "google_drive") return "google_drive";
  if (provider === "google_profiel") return "google_profiel";
  return "google_data";
}

// ── Het toegangsbewijs wordt hergebruikt zolang het geldig is ──────────
// Elke aanroep hieronder haalde eerst het bewaarde token uit de database en
// wisselde dat daarna bij Google in voor een vers toegangsbewijs. Dat gebeurde
// bij ELKE vraag aan Google, en dit bestand stelt er tweeëntwintig soorten.
// Eén schermlading van de KPI's deed dat drie keer (Search Console, Analytics,
// Ads), goed voor drie databasevragen, drie rondjes naar Google en drie regels
// in het bronnen-logboek, allemaal voor hetzelfde bewijs.
//
// Google geeft een bewijs dat een uur geldig is. We houden het vijftig minuten
// vast in het geheugen van deze server, met tien minuten marge. Meer dan een uur
// bewaren mag nooit; dan gebruik je een verlopen bewijs en lijkt de koppeling
// stuk terwijl er niets aan de hand is.
const tokenCache = new Map<string, { token: string; tot: number }>();
const TOKEN_GELDIG_MS = 50 * 60 * 1000;

async function accessTokenFor(provider: string): Promise<string | null> {
  if (!googleConfigured()) return null;
  const bewaard = tokenCache.get(provider);
  if (bewaard && Date.now() < bewaard.tot) return bewaard.token;
  await ensureSchema();
  const { rows } = await sql`SELECT refresh_token FROM oauth_tokens WHERE provider = ${provider} LIMIT 1`;
  const refresh = rows[0]?.refresh_token as string | undefined;
  // Nog niet gekoppeld is geen storing (dat zie je al aan "connected": false);
  // hier loggen we dus alleen een echte poging, niet de afwezigheid ervan.
  if (!refresh) return null;
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  const bron = bronVoorProvider(provider);
  if (!data.access_token) {
    await logBronGebeurtenis(bron, false, data.error_description || data.error || "Token vernieuwen mislukt.");
    return null;
  }
  await logBronGebeurtenis(bron, true);
  tokenCache.set(provider, { token: data.access_token, tot: Date.now() + TOKEN_GELDIG_MS });
  return data.access_token;
}

/** Het bewaarde toegangsbewijs weggooien, bijvoorbeeld na ontkoppelen. */
export function vergeetGoogleToken(provider?: string): void {
  if (provider) tokenCache.delete(provider); else tokenCache.clear();
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
// Niet-geverifieerde properties (permissionLevel "siteUnverifiedUser") staan wél in
// de lijst maar geven geen data terug, dus die slaan we over: anders kiest hij een
// lege domein-property terwijl er een werkende url-prefix naast staat.
export async function gscPickSite(token: string, domain: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = await res.json();
  const all: { siteUrl: string; permissionLevel?: string }[] = Array.isArray(j.siteEntry) ? j.siteEntry : [];
  const entries = all.filter((e) => e.permissionLevel !== "siteUnverifiedUser");
  const d = domain.replace(/^www\./, "").toLowerCase();
  const byDomain = entries.find((e) => e.siteUrl.toLowerCase() === `sc-domain:${d}`);
  if (byDomain) return byDomain.siteUrl;
  const byPrefix = entries.find((e) => e.siteUrl.toLowerCase().includes(d));
  return byPrefix ? byPrefix.siteUrl : null;
}

// Diagnose: met welk account is het dashboard verbonden, ziet dat account de property
// voor dit domein, en welke property kiest de matcher? Voor het opsporen van
// "GSC laadt niet"-problemen per klant.
export async function gscDebug(domain: string): Promise<{ connected: boolean; account: string | null; siteCount: number; matchedSite: string | null; candidates: { siteUrl: string; verified: boolean; permission: string; clicks: number | null; impressions: number | null }[] }> {
  const status = await googleStatus();
  const token = await accessTokenFor("google");
  if (!token) return { connected: false, account: status.account, siteCount: 0, matchedSite: null, candidates: [] };
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { connected: true, account: status.account, siteCount: -1, matchedSite: null, candidates: [] };
  const j = await res.json();
  const entries: { siteUrl: string; permissionLevel?: string }[] = Array.isArray(j.siteEntry) ? j.siteEntry : [];
  const root = (domain || "").replace(/^www\./, "").toLowerCase().split(".")[0]; // bv. "gardenswimm"
  const matches = entries.filter((e) => e.siteUrl.toLowerCase().includes(root));
  const candidates: { siteUrl: string; verified: boolean; permission: string; clicks: number | null; impressions: number | null }[] = [];
  for (const e of matches) {
    const perm = e.permissionLevel || "?";
    const rows = await gscQuery(token, e.siteUrl, { dimensions: [] }); // totalen ~28d; [] bij geen toegang/geen data
    const t = rows[0];
    candidates.push({ siteUrl: e.siteUrl, verified: perm !== "siteUnverifiedUser", permission: perm, clicks: t ? Math.round(t.clicks) : 0, impressions: t ? Math.round(t.impressions) : 0 });
  }
  const matchedSite = await gscPickSite(token, domain);
  return { connected: true, account: status.account, siteCount: entries.length, matchedSite, candidates };
}

// Per zoekwoord: welke URL was de top-rankende in opeenvolgende tijdvensters (~30d
// elk)? Twee of meer verschillende top-URL's = URL-flipping, het sterkste
// cannibalisatie-signaal (Google is onzeker welke pagina moet ranken).
export async function getGscKeywordUrlFlips(domain: string, windows = 3): Promise<{ keyword: string; topUrls: string[]; flips: number }[]> {
  const token = await accessTokenFor("google");
  if (!token || !domain) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const lag = 3, span = 30;
  const ranges: { start: string; end: string }[] = [];
  for (let i = 0; i < windows; i++) {
    const end = new Date(); end.setDate(end.getDate() - (lag + i * span));
    const start = new Date(end); start.setDate(start.getDate() - (span - 1));
    ranges.push({ start: iso(start), end: iso(end) });
  }
  const strip = (u: string) => (u || "").replace(/^https?:\/\/[^/]+/i, "").trim() || (u || "");
  const perWindow = await Promise.all(ranges.map((r) => gscQuery(token, site, { startDate: r.start, endDate: r.end, dimensions: ["query", "page"], rowLimit: 2000 })));
  const map = new Map<string, string[]>();
  for (const rows of perWindow) {
    const best = new Map<string, { url: string; clicks: number; impr: number }>();
    for (const row of rows) {
      const kw = row.keys?.[0]; const url = row.keys?.[1];
      if (!kw || !url) continue;
      const clicks = row.clicks || 0, impr = row.impressions || 0;
      const cur = best.get(kw);
      if (!cur || clicks > cur.clicks || (clicks === cur.clicks && impr > cur.impr)) best.set(kw, { url, clicks, impr });
    }
    for (const [kw, b] of best) { const arr = map.get(kw) || []; arr.push(strip(b.url)); map.set(kw, arr); }
  }
  const out: { keyword: string; topUrls: string[]; flips: number }[] = [];
  for (const [kw, urls] of map) {
    if (urls.length < 2) continue;
    const distinct = new Set(urls).size;
    if (distinct >= 2) out.push({ keyword: kw, topUrls: urls, flips: distinct - 1 });
  }
  return out.sort((a, b) => b.flips - a.flips).slice(0, 80);
}

export type GscData = {
  connected: boolean;
  site: string | null;
  metrics: { metric: string; value: number }[];
  keywords: { keyword: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { url: string; clicks: number; impressions: number }[];
};

export async function getGscForClient(domain: string): Promise<GscData | null> {
  const token = await accessTokenFor("google");
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
function periodRanges(days: number, compare: "prev" | "yoy" = "prev") {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const lag = 2;
  const curEnd = new Date(); curEnd.setDate(curEnd.getDate() - lag);
  const curStart = new Date(curEnd); curStart.setDate(curStart.getDate() - (days - 1));
  let prevStart: Date, prevEnd: Date;
  if (compare === "yoy") {
    // Dezelfde periode precies één jaar eerder.
    prevStart = new Date(curStart); prevStart.setFullYear(prevStart.getFullYear() - 1);
    prevEnd = new Date(curEnd); prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  } else {
    prevEnd = new Date(curStart); prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
  }
  return { curStart: iso(curStart), curEnd: iso(curEnd), prevStart: iso(prevStart), prevEnd: iso(prevEnd) };
}

// Appels-met-appels voor→na-vergelijking rond een wijzigingsmoment. Vaste regel:
// (1) voor-periode exact even lang als de na-periode; (2) de laatste ~3 dagen
// afgeknipt wegens GSC-datavertraging (na-periode compleet, niet half leeg);
// (3) waar mogelijk op hele weken (ma t/m zo) om weekdag-effecten te vermijden.
// Terugval bij < 1 volledige week ná de wijziging: even lange dag-periodes.
export type BeforeAfterRange = { beforeStart: string; beforeEnd: string; afterStart: string; afterEnd: string; days: number; weekAligned: boolean };
export function equalBeforeAfter(changeDate: string, maxDays = 60, trimDays = 3): BeforeAfterRange {
  const day = 86400000;
  const isoD = (t: number) => new Date(t).toISOString().slice(0, 10);
  const dowMon = (t: number) => (new Date(t).getUTCDay() + 6) % 7; // ma=0 .. zo=6
  const mondayOnOrAfter = (t: number) => { const d = dowMon(t); return d === 0 ? t : t + (7 - d) * day; };
  const sundayOnOrBefore = (t: number) => t - dowMon(t) * day;

  const c = new Date(changeDate + "T00:00:00Z").getTime();
  const hardEnd = Date.now() - trimDays * day;                 // GSC-vertraging afknippen
  const afterCap = Math.min(c + maxDays * day, hardEnd);

  // Hele-weken-pad: na begint op de eerste maandag ná de wijziging, eindigt op een zondag.
  const wkStart = mondayOnOrAfter(c);
  const wkEnd = sundayOnOrBefore(afterCap);
  let weeks = Math.floor(((wkEnd - wkStart) / day + 1) / 7);
  weeks = Math.min(weeks, Math.floor(maxDays / 7));
  if (weeks >= 1) {
    const aStart = wkStart, aEnd = wkStart + (weeks * 7 - 1) * day;
    return {
      beforeStart: isoD(wkStart - weeks * 7 * day), beforeEnd: isoD(wkStart - day),
      afterStart: isoD(aStart), afterEnd: isoD(aEnd), days: weeks * 7, weekAligned: true,
    };
  }
  // Terugval: even lange dag-periodes (nog geen volle week aan na-data).
  const aEnd = Math.max(afterCap, c);
  const n = Math.max(1, Math.floor((aEnd - c) / day) + 1);
  return {
    beforeStart: isoD(c - n * day), beforeEnd: isoD(c - day),
    afterStart: isoD(c), afterEnd: isoD(aEnd), days: n, weekAligned: false,
  };
}

export type MetricPair = { cur: number; prev: number };
export type GscSeries = { dates: string[]; clicks: number[]; impressions: number[]; ctr: number[]; position: number[]; prevClicks?: number[]; prevImpressions?: number[]; prevCtr?: number[]; prevPosition?: number[] };
// Sitebrede zoekwoord→pagina-matrix: welk zoekwoord op welke pagina rankt.
// Dit is de kern voor cannibalisatie-detectie (bv. homepage die op "hovenier
// [plaats]" rankt terwijl er een aparte plaatspagina bestaat).
export async function getGscQueryPageMatrix(domain: string, days = 90, limit = 150): Promise<{ keyword: string; page: string; clicks: number; impressions: number; position: number }[]> {
  const token = await accessTokenFor("google");
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
  const token = await accessTokenFor("google");
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

// Zoekwoorden van één pagina MET vergelijking (vorige periode of vorig jaar), voor
// de uitklap in de Pagina's-lijst van de KPI-tab: per zoekwoord ook de deltas.
export type GscPageKeyword = { keyword: string; clicks: number; impressions: number; position: number; prevClicks: number; prevImpressions: number; prevPosition: number | null };
export async function getGscForPageCompare(domain: string, pageUrl: string, days = 28, compare: "prev" | "yoy" = "prev"): Promise<GscPageKeyword[]> {
  const token = await accessTokenFor("google");
  if (!token || !domain || !pageUrl) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days, compare);
  const filter = { dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }] };
  const [cur, prev] = await Promise.all([
    gscQuery(token, site, { startDate: r.curStart, endDate: r.curEnd, dimensions: ["query"], rowLimit: 100, ...filter }),
    gscQuery(token, site, { startDate: r.prevStart, endDate: r.prevEnd, dimensions: ["query"], rowLimit: 100, ...filter }),
  ]);
  const prevBy = new Map(prev.map((x) => [x.keys?.[0] || "", x]));
  return cur.map((x) => {
    const p = prevBy.get(x.keys?.[0] || "");
    return {
      keyword: x.keys?.[0] || "",
      clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: Math.round(x.position * 10) / 10,
      prevClicks: Math.round(p?.clicks || 0), prevImpressions: Math.round(p?.impressions || 0),
      prevPosition: p ? Math.round(p.position * 10) / 10 : null,
    };
  });
}

// Daglijnen (clicks/impressies/CTR/positie) voor één pagina over een datumbereik.
// Voor de KPI-impact-grafiek rond een wijziging (60 dagen voor/na).
export type GscDay = { date: string; clicks: number; impressions: number; ctr: number; position: number };
export async function getGscDailyForPage(domain: string, pageUrl: string, startDate: string, endDate: string): Promise<GscDay[]> {
  const token = await accessTokenFor("google");
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
export type GscKeywordBA = { keyword: string; positionBefore: number | null; positionAfter: number | null; clicksBefore: number; clicksAfter: number; impressionsBefore: number; impressionsAfter: number; ctrBefore: number | null; ctrAfter: number | null };
export async function getGscKeywordsBeforeAfter(domain: string, pageUrl: string, changeDate: string, days = 60): Promise<GscKeywordBA[]> {
  const token = await accessTokenFor("google");
  if (!token || !domain || !pageUrl) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  // Appels-met-appels: even lange voor/na-periodes, 3 dagen afgeknipt, hele weken.
  const r = equalBeforeAfter(changeDate, days);
  const q = (s: string, e: string) => gscQuery(token, site, {
    startDate: s, endDate: e, dimensions: ["query"], rowLimit: 50,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
  });
  const [before, after] = await Promise.all([q(r.beforeStart, r.beforeEnd), q(r.afterStart, r.afterEnd)]);
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
        impressionsBefore: b ? Math.round(b.impressions) : 0,
        impressionsAfter: a ? Math.round(a.impressions) : 0,
        // CTR als % (kliks/impressies), voor het AI-Overviews-signaal.
        ctrBefore: b ? Math.round((b.ctr || 0) * 1000) / 10 : null,
        ctrAfter: a ? Math.round((a.ctr || 0) * 1000) / 10 : null,
      };
    })
    .sort((x, y) => (y.clicksAfter + y.clicksBefore) - (x.clicksAfter + x.clicksBefore))
    .slice(0, 20);
}

// Kans-data per pagina: vertoningen, kliks, CTR, gemiddelde positie en het beste
// zoekwoord (meeste vertoningen) met zijn positie. Voor het spotten van laaghangend
// fruit in het pagina-overzicht (veel vraag + net buiten de top 10).
// `impressions` is de hele PAGINA, `bestImpressions` alleen het beste zoekwoord.
// Dat onderscheid is er niet voor niets: wie de paginatotalen aan één zoekwoord
// hangt, komt uit op fantasiegetallen (een pagina met 200.000 vertoningen op
// twintig zoekwoorden werd zo één zoekwoord van 200.000). Meta-werk raakt de hele
// pagina, dus daar hoort `impressions`; één zoekwoord omhoog duwen hoort bij
// `bestImpressions`.
export type PageOpportunity = { url: string; clicks: number; impressions: number; ctr: number; position: number; bestKeyword: string; bestImpressions: number; bestPosition: number | null; bestVolume: number | null };
export async function getGscPageOpportunities(domain: string, days = 90): Promise<PageOpportunity[]> {
  const token = await accessTokenFor("google");
  if (!token || !domain) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days);
  const [pageRows, qpRows] = await Promise.all([
    gscQuery(token, site, { startDate: r.curStart, endDate: r.curEnd, dimensions: ["page"], rowLimit: 500 }),
    gscQuery(token, site, { startDate: r.curStart, endDate: r.curEnd, dimensions: ["page", "query"], rowLimit: 5000 }),
  ]);
  // Beste zoekwoord per pagina (meeste vertoningen).
  const best = new Map<string, { keyword: string; impressions: number; position: number }>();
  for (const x of qpRows) {
    const page = x.keys?.[0] || "", kw = x.keys?.[1] || "";
    if (!page) continue;
    const cur = best.get(page);
    if (!cur || x.impressions > cur.impressions) best.set(page, { keyword: kw, impressions: x.impressions, position: x.position });
  }
  const out = pageRows.map((x) => {
    const url = x.keys?.[0] || "";
    const b = best.get(url);
    return {
      url,
      clicks: Math.round(x.clicks), impressions: Math.round(x.impressions),
      ctr: Math.round(x.ctr * 1000) / 10, position: Math.round(x.position * 10) / 10,
      bestKeyword: b?.keyword || "", bestImpressions: Math.round(b?.impressions || 0),
      bestPosition: b ? Math.round(b.position * 10) / 10 : null,
      bestVolume: null as number | null,
    };
  });

  // Zoekvolume van het beste zoekwoord (Ahrefs), gebundeld in ÉÉN call en begrensd
  // (top 80 op vertoningen) om credits te sparen; alleen als Ahrefs gekoppeld is.
  if (ahrefsConfigured()) {
    const withKw = out.filter((p) => p.bestKeyword && p.impressions > 0).sort((a, b) => b.impressions - a.impressions).slice(0, 80);
    const keywords = [...new Set(withKw.map((p) => p.bestKeyword))];
    if (keywords.length) {
      const ov = await getKeywordsOverview(keywords, "nl").catch(() => []);
      const volMap = new Map(ov.map((o) => [o.keyword.toLowerCase(), o.volume]));
      for (const p of out) {
        const v = volMap.get(p.bestKeyword.toLowerCase());
        if (v != null) p.bestVolume = v;
      }
    }
  }
  return out;
}

// GA4-gedragssignalen voor één pagina, voor en na een wijzigingsmoment.
export type Ga4PageStat = { views: number; timeOnPage: number; bounceRate: number; engagementRate: number; pagesPerSession: number; sessionDuration: number };
export type Ga4PageSignals = { available: boolean; before: Ga4PageStat; after: Ga4PageStat };
export async function getGa4PageSignalsBeforeAfter(slug: string, pageUrl: string, changeDate: string, days = 60): Promise<Ga4PageSignals | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();
  const propertyId = await ga4PropertyFor(token, slug);
  if (!propertyId) return null;

  let path = ""; try { path = new URL(pageUrl).pathname; } catch { path = pageUrl; }
  // Zelfde appels-met-appels-regel als GSC: even lange voor/na, 3 dagen trim, hele weken.
  const r = equalBeforeAfter(changeDate, days);
  const dateRanges = [
    { startDate: r.beforeStart, endDate: r.beforeEnd },
    { startDate: r.afterStart, endDate: r.afterEnd },
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
  keywords: { keyword: string; clicks: number; impressions: number; ctr: number; position: number; prevClicks: number; prevImpressions: number; prevCtr: number; prevPosition: number | null; page: string | null }[];
  pages: { url: string; clicks: number; impressions: number; prevClicks: number; prevImpressions: number }[];
  range: { curStart: string; curEnd: string; prevStart: string; prevEnd: string };
};

export async function getGscComparison(domain: string, days: number, compare: "prev" | "yoy" = "prev"): Promise<GscComparison | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  const range = periodRanges(days, compare);
  const emptySeries: GscSeries = { dates: [], clicks: [], impressions: [], ctr: [], position: [] };
  const empty: GscComparison = { connected: true, site: null, totals: null, series: emptySeries, keywords: [], pages: [], range };
  if (!domain) return empty;
  const site = await gscPickSite(token, domain);
  if (!site) return empty;

  const [curTot, prevTot, curKw, prevKw, curPg, prevPg, byDate, byDatePrev, curKwPage] = await Promise.all([
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["query"], rowLimit: 100 }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd, dimensions: ["query"], rowLimit: 100 }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["page"], rowLimit: 50 }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd, dimensions: ["page"], rowLimit: 50 }),
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["date"], rowLimit: 500 }),
    gscQuery(token, site, { startDate: range.prevStart, endDate: range.prevEnd, dimensions: ["date"], rowLimit: 500 }),
    // Aparte query+pagina-combinatie, alleen om per zoekwoord de best rankende
    // pagina te tonen; de bestaande per-query-cijfers blijven onaangeroerd.
    gscQuery(token, site, { startDate: range.curStart, endDate: range.curEnd, dimensions: ["query", "page"], rowLimit: 1000 }),
  ]);

  // Dagreeksen (op datum gesorteerd) voor de grafiekjes; ook de vorige periode
  // (uitgelijnd op dezelfde dag-offset) voor de stippellijn ter vergelijking.
  const dated = [...byDate].sort((a, b) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || ""));
  const datedPrev = [...byDatePrev].sort((a, b) => (a.keys?.[0] || "").localeCompare(b.keys?.[0] || ""));
  const series: GscSeries = {
    dates: dated.map((r) => r.keys?.[0] || ""),
    clicks: dated.map((r) => Math.round(r.clicks)),
    impressions: dated.map((r) => Math.round(r.impressions)),
    ctr: dated.map((r) => Math.round(r.ctr * 1000) / 10),
    position: dated.map((r) => Math.round(r.position * 10) / 10),
    prevClicks: datedPrev.map((r) => Math.round(r.clicks)),
    prevImpressions: datedPrev.map((r) => Math.round(r.impressions)),
    prevCtr: datedPrev.map((r) => Math.round(r.ctr * 1000) / 10),
    prevPosition: datedPrev.map((r) => Math.round(r.position * 10) / 10),
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
  // Beste pagina per zoekwoord (meeste klikken, dan meeste vertoningen).
  const bestPage = new Map<string, { page: string; clicks: number; impressions: number }>();
  for (const r of curKwPage) {
    const kw = r.keys?.[0]; const pg = r.keys?.[1];
    if (!kw || !pg) continue;
    const cur = bestPage.get(kw);
    if (!cur || r.clicks > cur.clicks || (r.clicks === cur.clicks && r.impressions > cur.impressions)) {
      bestPage.set(kw, { page: pg, clicks: r.clicks, impressions: r.impressions });
    }
  }
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
      page: bestPage.get(kw)?.page || null,
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

export type Ga4Metric = { metric: string; cur: number; prev: number; series: number[]; prevSeries: number[] };
export type Ga4Channel = { name: string; sessions: number; prevSessions: number; users: number; prevUsers: number; conversions: number; prevConversions: number };
// Bekende AI-bronnen (LLM's en AI-zoek): sessionSource-patronen in GA4.
const AI_SOURCES: { match: string; label: string }[] = [
  { match: "chatgpt", label: "ChatGPT" },
  { match: "openai", label: "ChatGPT (OpenAI)" },
  { match: "perplexity", label: "Perplexity" },
  { match: "gemini", label: "Google Gemini" },
  { match: "bard", label: "Google Gemini (Bard)" },
  { match: "copilot", label: "Microsoft Copilot" },
  { match: "claude", label: "Claude" },
  { match: "anthropic", label: "Claude (Anthropic)" },
  { match: "deepseek", label: "DeepSeek" },
  { match: "mistral", label: "Mistral (Le Chat)" },
  { match: "meta.ai", label: "Meta AI" },
  { match: "grok", label: "Grok" },
  { match: "x.ai", label: "Grok (xAI)" },
  { match: "poe.com", label: "Poe" },
];
export type Ga4Comparison = {
  connected: boolean; propertyId: string | null;
  dates: string[];            // dagen van de huidige periode (voor de grafiek-as)
  totals: Ga4Metric[];        // per KPI: totaal nu/vorig + dagreeks nu/vorig
  channels: Ga4Channel[];     // waar de bezoekers vandaan komen (kanalen)
  aiSources: Ga4Channel[];    // AI-verkeer per bron (ChatGPT, Perplexity, Gemini, ...)
};

// Volledige GA4-vergelijking voor het KPI-dashboard: 10 kern-KPI's met dagreeksen
// (huidige én vergelijkingsperiode, ook t.o.v. vorig jaar) plus de herkomst-kanalen.
// "avgTimeOnPage" is afgeleid (engagement-duur / paginaweergaven).
export async function getGa4Comparison(slug: string, domain: string, days: number, compare: "prev" | "yoy" = "prev"): Promise<Ga4Comparison | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();
  const propertyId = await ga4PropertyFor(token, slug, domain);
  if (!propertyId) return { connected: true, propertyId: null, dates: [], totals: [], channels: [], aiSources: [] };

  const range = periodRanges(days, compare);
  const dateRanges = [
    { startDate: range.curStart, endDate: range.curEnd },
    { startDate: range.prevStart, endDate: range.prevEnd },
  ];
  async function run(body: Record<string, unknown>) {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  }
  type ApiRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

  // Kern-KPI's; "conversions" kan op sommige properties ontbreken, dan zonder.
  const FULL = ["totalUsers", "newUsers", "sessions", "screenPageViews", "conversions", "engagementRate", "bounceRate", "averageSessionDuration", "screenPageViewsPerSession", "userEngagementDuration"];
  let names = FULL;
  let tj = await run({ dateRanges, metrics: names.map((name) => ({ name })) });
  if (!tj) { names = FULL.filter((n) => n !== "conversions"); tj = await run({ dateRanges, metrics: names.map((name) => ({ name })) }); }
  if (!tj) return { connected: true, propertyId, dates: [], totals: [], channels: [], aiSources: [] };
  const trows: ApiRow[] = tj.rows || [];
  const tCur = trows.find((r) => r.dimensionValues?.[0]?.value === "date_range_0") || trows[0];
  const tPrev = trows.find((r) => r.dimensionValues?.[0]?.value === "date_range_1") || trows[1];
  const num = (r: ApiRow | undefined, i: number) => Number(r?.metricValues?.[i]?.value || 0);

  // Dagreeksen voor beide periodes in één aanvraag (dimensies: datum + dateRange).
  const dates: string[] = [];
  const seriesCur: Record<string, number[]> = {};
  const seriesPrev: Record<string, number[]> = {};
  const dj = await run({
    dateRanges,
    dimensions: [{ name: "date" }],
    metrics: names.map((name) => ({ name })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 1000,
  });
  if (dj) {
    const drows: ApiRow[] = dj.rows || [];
    const isCur = (r: ApiRow) => (r.dimensionValues?.[1]?.value || "date_range_0") === "date_range_0";
    const curRows = drows.filter(isCur);
    const prevRows = drows.filter((r) => !isCur(r));
    for (const r of curRows) {
      const d = r.dimensionValues?.[0]?.value || "";
      dates.push(d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "");
    }
    names.forEach((name, i) => {
      seriesCur[name] = curRows.map((r) => Number(r.metricValues?.[i]?.value || 0));
      seriesPrev[name] = prevRows.map((r) => Number(r.metricValues?.[i]?.value || 0));
    });
  }

  const totals: Ga4Metric[] = names.map((name, i) => ({
    metric: name,
    cur: num(tCur, i),
    prev: num(tPrev, i),
    series: seriesCur[name] || [],
    prevSeries: seriesPrev[name] || [],
  }));

  // Afgeleide KPI: gemiddelde tijd op pagina = engagement-duur / paginaweergaven.
  const idxDur = names.indexOf("userEngagementDuration"), idxViews = names.indexOf("screenPageViews");
  if (idxDur >= 0 && idxViews >= 0) {
    const per = (dur: number, views: number) => (views > 0 ? dur / views : 0);
    const dCur = seriesCur.userEngagementDuration || [], vCur = seriesCur.screenPageViews || [];
    const dPrev = seriesPrev.userEngagementDuration || [], vPrev = seriesPrev.screenPageViews || [];
    totals.push({
      metric: "avgTimeOnPage",
      cur: per(num(tCur, idxDur), num(tCur, idxViews)),
      prev: per(num(tPrev, idxDur), num(tPrev, idxViews)),
      series: dCur.map((d, i) => per(d, vCur[i] || 0)),
      prevSeries: dPrev.map((d, i) => per(d, vPrev[i] || 0)),
    });
  }

  // Waar de bezoekers vandaan komen: standaard kanaalgroepen, nu vs. vorige periode.
  const channels: Ga4Channel[] = [];
  const chMetrics = names.includes("conversions") ? ["sessions", "totalUsers", "conversions"] : ["sessions", "totalUsers"];
  const cj = await run({
    dateRanges,
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: chMetrics.map((name) => ({ name })),
    limit: 50,
  });
  if (cj) {
    const byName = new Map<string, Ga4Channel>();
    for (const r of (cj.rows || []) as ApiRow[]) {
      const name = r.dimensionValues?.[0]?.value || "Onbekend";
      const isCur = (r.dimensionValues?.[1]?.value || "date_range_0") === "date_range_0";
      const c = byName.get(name) || { name, sessions: 0, prevSessions: 0, users: 0, prevUsers: 0, conversions: 0, prevConversions: 0 };
      const v = (i: number) => Number(r.metricValues?.[i]?.value || 0);
      if (isCur) { c.sessions = v(0); c.users = v(1); c.conversions = chMetrics.length > 2 ? v(2) : 0; }
      else { c.prevSessions = v(0); c.prevUsers = v(1); c.prevConversions = chMetrics.length > 2 ? v(2) : 0; }
      byName.set(name, c);
    }
    channels.push(...Array.from(byName.values()).sort((a, b) => b.sessions - a.sessions));
  }

  // AI-verkeer: sessies vanuit LLM's en AI-zoek (herkenning op sessionSource).
  const aiSources: Ga4Channel[] = [];
  const aj = await run({
    dateRanges,
    dimensions: [{ name: "sessionSource" }],
    metrics: chMetrics.map((name) => ({ name })),
    dimensionFilter: { orGroup: { expressions: AI_SOURCES.map((a) => ({ filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: a.match, caseSensitive: false } } })) } },
    limit: 100,
  });
  if (aj) {
    // Bronnen met hetzelfde label samenvoegen (bijv. chat.openai.com + chatgpt.com).
    const byLabel = new Map<string, Ga4Channel>();
    for (const r of (aj.rows || []) as ApiRow[]) {
      const src = (r.dimensionValues?.[0]?.value || "").toLowerCase();
      const label = AI_SOURCES.find((a) => src.includes(a.match))?.label || src || "Overig AI";
      const isCur = (r.dimensionValues?.[1]?.value || "date_range_0") === "date_range_0";
      const c = byLabel.get(label) || { name: label, sessions: 0, prevSessions: 0, users: 0, prevUsers: 0, conversions: 0, prevConversions: 0 };
      const v = (i: number) => Number(r.metricValues?.[i]?.value || 0);
      if (isCur) { c.sessions += v(0); c.users += v(1); c.conversions += chMetrics.length > 2 ? v(2) : 0; }
      else { c.prevSessions += v(0); c.prevUsers += v(1); c.prevConversions += chMetrics.length > 2 ? v(2) : 0; }
      byLabel.set(label, c);
    }
    aiSources.push(...Array.from(byLabel.values()).sort((a, b) => b.sessions - a.sessions));
  }

  return { connected: true, propertyId, dates, totals, channels, aiSources };
}

// Conversies per pagina (R2: prioriteren op aanvragen in plaats van op klikken).
// Basis om "verwacht extra bezoek" om te rekenen naar "verwachte aanvragen": per
// pad hoeveel sessies er waren en hoeveel daarvan een GA4-conversie deden. Geen
// voor/na-vergelijking (dat doet getGa4PageSignalsBeforeAfter al), maar een
// site-brede momentopname voor de rekenkern in lib/aanvragen.ts.
export type Ga4PageConversion = { path: string; sessions: number; conversions: number; ratio: number };

export async function getGa4ConversionsByPage(slug: string, domain: string, days = 90): Promise<Ga4PageConversion[] | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();
  const propertyId = await ga4PropertyFor(token, slug, domain);
  if (!propertyId) return null;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: iso(start), endDate: iso(end) }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "sessions" }, { name: "conversions" }],
      limit: 1000,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  type ApiRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
  return ((j.rows || []) as ApiRow[]).map((r) => {
    const sessions = Number(r.metricValues?.[0]?.value || 0);
    const conversions = Number(r.metricValues?.[1]?.value || 0);
    return { path: r.dimensionValues?.[0]?.value || "", sessions, conversions, ratio: sessions > 0 ? conversions / sessions : 0 };
  });
}

// Gemiddelde positie van de top-zoekwoorden per maand over de laatste 4 maanden.
export type GscTrend = { months: string[]; rows: { keyword: string; positions: (number | null)[] }[] };

export async function getGscKeywordTrend(domain: string): Promise<GscTrend | null> {
  const token = await accessTokenFor("google");
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

  // Acht tegelijk in plaats van één voor één. Dit liep als een gewone lus met een
  // `await` erin, dus veertig properties werden veertig keer wachten achter
  // elkaar. Bij een account met veel properties was dat in z'n eentje al goed
  // voor tien tot dertig seconden.
  const lijst = propertyNames.slice(0, 40);
  for (let i = 0; i < lijst.length; i += 8) {
    const groep = lijst.slice(i, i + 8);
    const uitkomsten = await Promise.all(groep.map(async (prop) => {
      const sres = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${prop}/dataStreams`, { headers: { Authorization: `Bearer ${token}` } });
      if (!sres.ok) return null;
      const sj = await sres.json().catch(() => null);
      const streams: { webStreamData?: { defaultUri?: string } }[] = sj?.dataStreams || [];
      for (const s of streams) {
        const uri = (s.webStreamData?.defaultUri || "").toLowerCase();
        if (uri && uri.includes(d)) return prop.replace("properties/", "");
      }
      return null;
    }));
    const gevonden = uitkomsten.find((x) => x);
    if (gevonden) return gevonden;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// DE ENIGE PLEK DIE DE ANALYTICS-PROPERTY VAN EEN KLANT OPZOEKT
// ═══════════════════════════════════════════════════════════
// Dit blok stond vijf keer woordelijk uitgeschreven in dit bestand (bij de
// KPI's, bij Ads, bij de conversies per pagina, bij de voor/na-signalen en bij
// de losse klantcijfers). Dat is precies de vaste les uit het brein: dezelfde
// regel op meerdere plekken loopt uit elkaar zonder dat iemand het merkt. Nu
// één poort, de rest roept die aan.
//
// Wat er misging, en waarom het zo traag was: als een klant geen Analytics
// heeft (of de koppeling ziet de property niet), dan vond het zoeken niets,
// werd er niets opgeslagen, en gebeurde precies hetzelfde bij het volgende
// verzoek. Elke keer dat je Resultaten opende zocht hij opnieuw het hele
// account af. Twee keer zelfs, want de KPI's en Ads vroegen het los van elkaar.
// Gemeten op 17-08-2026: 10 seconden bij One Day Clinic, 31 bij Kamsteeg.
//
// De oplossing is een datum. Vinden we niets, dan zetten we `ga4_gezocht_op`,
// en de komende week zoeken we niet opnieuw. Koppelt Maarten daarna alsnog
// Analytics, dan vindt de volgende wekelijkse poging het vanzelf; hij hoeft
// niets te resetten. Vinden we wél iets, dan wordt het opgeslagen zoals altijd
// en komt het zoeken nooit meer aan de beurt.
// ═══════════════════════════════════════════════════════════

const GA4_HERZOEK_DAGEN = 7;

// Binnen één serverproces kortstondig onthouden, zodat de KPI's en Ads in
// hetzelfde verzoek samen één keer zoeken in plaats van allebei apart.
const ga4PropCache = new Map<string, { id: string | null; tijd: number }>();
const GA4_PROP_TTL = 60 * 1000;

async function ga4PropertyFor(token: string, slug: string, domainHint = ""): Promise<string | null> {
  const cached = ga4PropCache.get(slug);
  if (cached && Date.now() - cached.tijd < GA4_PROP_TTL) return cached.id;

  const { rows } = await sql`SELECT ga4_property_id, domain, ga4_gezocht_op FROM clients WHERE slug = ${slug} LIMIT 1`;
  const opgeslagen = (rows[0]?.ga4_property_id as string) || "";
  if (opgeslagen) {
    ga4PropCache.set(slug, { id: opgeslagen, tijd: Date.now() });
    return opgeslagen;
  }

  const domain = domainHint || (rows[0]?.domain as string) || "";
  if (!domain) return null;

  // Recent al gezocht en niets gevonden: niet opnieuw het hele account aflopen.
  const gezocht = rows[0]?.ga4_gezocht_op ? new Date(rows[0].ga4_gezocht_op as string).getTime() : 0;
  if (gezocht && Date.now() - gezocht < GA4_HERZOEK_DAGEN * 24 * 3600 * 1000) {
    ga4PropCache.set(slug, { id: null, tijd: Date.now() });
    return null;
  }

  const found = await ga4DiscoverProperty(token, domain).catch(() => null);
  if (found) {
    await sql`UPDATE clients SET ga4_property_id = ${found}, ga4_gezocht_op = now() WHERE slug = ${slug}`;
  } else {
    await sql`UPDATE clients SET ga4_gezocht_op = now() WHERE slug = ${slug}`;
  }
  ga4PropCache.set(slug, { id: found, tijd: Date.now() });
  return found;
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
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();

  const propertyId = await ga4PropertyFor(token, slug, domain);
  if (!propertyId) return { connected: true, propertyId: null, metrics: [] };

  const metrics = await ga4RunReport(token, propertyId);
  return { connected: true, propertyId, metrics: metrics || [] };
}

// ── Google Ads via GA4 (gekoppelde advertentiedata, geen aparte Ads-API nodig) ──
// Kosten, klikken en vertoningen van Google Ads-campagnes zoals GA4 ze binnenkrijgt
// via de Ads-koppeling. Genoeg om prestaties én activiteit (nieuwe/gestopte
// campagnes, budgetverschuivingen) per campagne te volgen.
export type AdsCampaign = { name: string; cost: number; prevCost: number; clicks: number; prevClicks: number; impressions: number; prevImpressions: number; conversions: number; prevConversions: number; sessions: number; prevSessions: number };
export type AdsComparison = {
  linked: boolean;            // false = geen Ads-data in deze GA4-property
  dates: string[];
  totals: { metric: string; cur: number; prev: number; series: number[]; prevSeries: number[] }[]; // cost, clicks, impressions, conversions
  campaigns: AdsCampaign[];
};

export async function getAdsComparison(slug: string, domain: string, days: number, compare: "prev" | "yoy" = "prev"): Promise<AdsComparison | null> {
  const token = await accessTokenFor("google");
  if (!token) return null;
  await ensureSchema();
  const propertyId = await ga4PropertyFor(token, slug, domain);
  if (!propertyId) return { linked: false, dates: [], totals: [], campaigns: [] };

  const range = periodRanges(days, compare);
  const dateRanges = [
    { startDate: range.curStart, endDate: range.curEnd },
    { startDate: range.prevStart, endDate: range.prevEnd },
  ];
  async function run(body: Record<string, unknown>) {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  }
  type ApiRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
  const M = ["advertiserAdCost", "advertiserAdClicks", "advertiserAdImpressions", "conversions", "sessions"];

  // Per campagne (beide periodes). sessionGoogleAdsCampaignName pakt alleen Ads-verkeer.
  const cj = await run({
    dateRanges,
    dimensions: [{ name: "sessionGoogleAdsCampaignName" }],
    metrics: M.map((name) => ({ name })),
    limit: 100,
  });
  if (!cj) return { linked: false, dates: [], totals: [], campaigns: [] };
  const byName = new Map<string, AdsCampaign>();
  for (const r of (cj.rows || []) as ApiRow[]) {
    const name = r.dimensionValues?.[0]?.value || "";
    if (!name || name === "(not set)") continue;
    const isCur = (r.dimensionValues?.[1]?.value || "date_range_0") === "date_range_0";
    const c = byName.get(name) || { name, cost: 0, prevCost: 0, clicks: 0, prevClicks: 0, impressions: 0, prevImpressions: 0, conversions: 0, prevConversions: 0, sessions: 0, prevSessions: 0 };
    const v = (i: number) => Number(r.metricValues?.[i]?.value || 0);
    if (isCur) { c.cost += v(0); c.clicks += v(1); c.impressions += v(2); c.conversions += v(3); c.sessions += v(4); }
    else { c.prevCost += v(0); c.prevClicks += v(1); c.prevImpressions += v(2); c.prevConversions += v(3); c.prevSessions += v(4); }
    byName.set(name, c);
  }
  const campaigns = Array.from(byName.values()).sort((a, b) => b.cost - a.cost);
  const linked = campaigns.length > 0;

  // Dagreeksen (beide periodes) voor de kaarten met grafiek.
  const dates: string[] = [];
  const seriesCur: Record<string, number[]> = {};
  const seriesPrev: Record<string, number[]> = {};
  const dj = await run({
    dateRanges,
    dimensions: [{ name: "date" }],
    metrics: ["advertiserAdCost", "advertiserAdClicks", "advertiserAdImpressions", "conversions"].map((name) => ({ name })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 1000,
  });
  const DAY_METRICS = ["advertiserAdCost", "advertiserAdClicks", "advertiserAdImpressions", "conversions"];
  if (dj) {
    const drows: ApiRow[] = dj.rows || [];
    const isCur = (r: ApiRow) => (r.dimensionValues?.[1]?.value || "date_range_0") === "date_range_0";
    const curRows = drows.filter(isCur), prevRows = drows.filter((r) => !isCur(r));
    for (const r of curRows) { const d = r.dimensionValues?.[0]?.value || ""; dates.push(d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ""); }
    DAY_METRICS.forEach((name, i) => {
      seriesCur[name] = curRows.map((r) => Number(r.metricValues?.[i]?.value || 0));
      seriesPrev[name] = prevRows.map((r) => Number(r.metricValues?.[i]?.value || 0));
    });
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  // Totalen uit de campagnetabel (kosten/klikken/vertoningen) en de dagreeks (conversies
  // uit de dagreeks zijn site-breed; daarom nemen we conversies uit de campagnes).
  const tot = (get: (c: AdsCampaign) => number) => campaigns.reduce((x, c) => x + get(c), 0);
  const totals = [
    { metric: "cost", cur: tot((c) => c.cost), prev: tot((c) => c.prevCost), series: seriesCur.advertiserAdCost || [], prevSeries: seriesPrev.advertiserAdCost || [] },
    { metric: "clicks", cur: tot((c) => c.clicks), prev: tot((c) => c.prevClicks), series: seriesCur.advertiserAdClicks || [], prevSeries: seriesPrev.advertiserAdClicks || [] },
    { metric: "impressions", cur: tot((c) => c.impressions), prev: tot((c) => c.prevImpressions), series: seriesCur.advertiserAdImpressions || [], prevSeries: seriesPrev.advertiserAdImpressions || [] },
    { metric: "conversions", cur: tot((c) => c.conversions), prev: tot((c) => c.prevConversions), series: [], prevSeries: [] },
  ];
  return { linked, dates, totals, campaigns };
}


// Alle (zoekwoord, pagina)-combinaties in één keer. Nodig om te bepalen WELKE
// pagina's elkaar in de weg zitten: dat is geen inschatting maar een overlap in
// de data. Eén aanroep, want per pagina vragen zou tientallen calls kosten.
export type GscPaar = { keyword: string; page: string; clicks: number; impressions: number; position: number };
// Kort geheugen per serverinstantie. Zonder dit haalt één vraag over zes
// pagina's zes keer dezelfde tienduizenden rijen op; dan loopt de beurt uit de
// tijd en komt de opruimlijst er helemaal niet meer bij. Vijf minuten is ruim
// genoeg voor één gesprek en kort genoeg om nooit oude cijfers te tonen.
const paarCache = new Map<string, { tijd: number; data: GscPaar[] }>();
const PAAR_TTL = 5 * 60 * 1000;

/**
 * Zelfde paren, maar met de positie van de vórige even lange periode ernaast.
 * Hiermee kun je wegzakkers vinden zonder Ahrefs, en dat is precies waar het
 * misging: Ahrefs kent van een kleine lokale site soms maar een handvol
 * zoekwoorden, terwijl Search Console de volledige werkelijkheid heeft.
 * `positieVorig` is null als het zoekwoord er toen nog niet was.
 */
export type GscPaarVergelijk = GscPaar & { positieVorig: number | null; vertoningenVorig: number };
export async function getGscQueryPagePairsCompare(domain: string, days = 90, limit = 25000): Promise<GscPaarVergelijk[]> {
  const token = await accessTokenFor("google");
  if (!token || !domain) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days);
  const [nu, toen] = await Promise.all([
    gscQuery(token, site, { startDate: r.curStart, endDate: r.curEnd, dimensions: ["query", "page"], rowLimit: limit }),
    gscQuery(token, site, { startDate: r.prevStart, endDate: r.prevEnd, dimensions: ["query", "page"], rowLimit: limit }),
  ]);
  const vorig = new Map<string, { position: number; impressions: number }>();
  for (const x of toen) {
    const k = `${x.keys?.[0] || ""}|${x.keys?.[1] || ""}`;
    vorig.set(k, { position: x.position, impressions: Math.round(x.impressions) });
  }
  return nu.map((x) => {
    const keyword = x.keys?.[0] || "", page = x.keys?.[1] || "";
    const v = vorig.get(`${keyword}|${page}`);
    return {
      keyword, page,
      clicks: Math.round(x.clicks), impressions: Math.round(x.impressions),
      position: Math.round(x.position * 10) / 10,
      positieVorig: v ? Math.round(v.position * 10) / 10 : null,
      vertoningenVorig: v ? v.impressions : 0,
    };
  }).filter((x) => x.keyword && x.page);
}

export async function getGscQueryPagePairs(domain: string, days = 90, maxRijen = 50000): Promise<GscPaar[]> {
  const sleutel = `${domain}|${days}|${maxRijen}`;
  const c = paarCache.get(sleutel);
  if (c && Date.now() - c.tijd < PAAR_TTL) return c.data;
  const token = await accessTokenFor("google");
  if (!token || !domain) return [];
  const site = await gscPickSite(token, domain);
  if (!site) return [];
  const r = periodRanges(days);
  // BLADEREN IS HIER ESSENTIEEL, niet netjes-doen. Google sorteert op klikken van
  // hoog naar laag, en juist de pagina's die we zoeken (dunne locatiepagina's met
  // nul klikken) staan helemaal onderaan. Met één ophaal van 5000 rijen vielen
  // ze buiten de boot en zag de analyse ze nooit, hoe goed de logica ook was.
  const perKeer = 25000;                                  // maximum van de API
  const rows: Awaited<ReturnType<typeof gscQuery>> = [];
  for (let start = 0; start < maxRijen; start += perKeer) {
    const batch = await gscQuery(token, site, {
      startDate: r.curStart, endDate: r.curEnd,
      dimensions: ["query", "page"], rowLimit: Math.min(perKeer, maxRijen - start), startRow: start,
    });
    rows.push(...batch);
    if (batch.length < perKeer) break;                    // laatste bladzijde
  }
  const uit = rows.map((x) => ({
    keyword: x.keys?.[0] || "", page: x.keys?.[1] || "",
    clicks: Math.round(x.clicks), impressions: Math.round(x.impressions), position: Math.round(x.position * 10) / 10,
  })).filter((x) => x.keyword && x.page);
  paarCache.set(sleutel, { tijd: Date.now(), data: uit });
  return uit;
}
