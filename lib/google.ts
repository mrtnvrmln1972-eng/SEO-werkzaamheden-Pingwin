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
