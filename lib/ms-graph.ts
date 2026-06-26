import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// MICROSOFT 365 / GRAPH-KOPPELING
// ═══════════════════════════════════════════════════════════
// Eenmalige login (delegated OAuth) van Maartens mailbox. De refresh-token
// wordt bewaard in oauth_tokens; daarmee vernieuwt de app zelf access-tokens.
// Hiermee leest het dashboard de volledige mails per klant en kan het mails
// beantwoorden, zonder dat er per mail iets gesynct hoeft te worden.
//
// Vereiste env-vars (in Vercel): MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID.
// Redirect-URI in Azure: <site>/api/ms/auth/callback
// Delegated permissions: Mail.Read, Mail.Send, offline_access, User.Read
// ═══════════════════════════════════════════════════════════

const SCOPES = "offline_access Mail.ReadWrite Mail.Send User.Read";

export function msConfigured(): boolean {
  return !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MS_TENANT_ID);
}

function tenant(): string {
  return process.env.MS_TENANT_ID || "common";
}

function authBase(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0`;
}

export function msRedirectUri(origin: string): string {
  return `${origin}/api/ms/auth/callback`;
}

export function msAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: msRedirectUri(origin),
    response_mode: "query",
    scope: SCOPES,
    state,
  });
  return `${authBase()}/authorize?${p.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${authBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  return (await res.json()) as TokenResponse;
}

// Stap na de login: code inwisselen voor tokens en de refresh-token bewaren.
export async function msExchangeCode(origin: string, code: string): Promise<{ ok: boolean; account?: string; error?: string }> {
  const data = await tokenRequest({
    client_id: process.env.MS_CLIENT_ID || "",
    client_secret: process.env.MS_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code,
    redirect_uri: msRedirectUri(origin),
    scope: SCOPES,
  });
  if (!data.refresh_token) return { ok: false, error: data.error_description || data.error || "Geen refresh-token ontvangen." };

  let account = "";
  if (data.access_token) {
    try {
      const me = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const j = await me.json();
      account = j.mail || j.userPrincipalName || "";
    } catch { /* account-naam is optioneel */ }
  }
  await saveRefreshToken("microsoft", data.refresh_token, account);
  return { ok: true, account };
}

async function saveRefreshToken(provider: string, token: string, account: string): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO oauth_tokens (provider, refresh_token, account, updated_at)
    VALUES (${provider}, ${token}, ${account || null}, now())
    ON CONFLICT (provider) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, account = EXCLUDED.account, updated_at = now()`;
}

export async function msStatus(): Promise<{ configured: boolean; connected: boolean; account: string | null }> {
  const configured = msConfigured();
  if (!configured) return { configured, connected: false, account: null };
  await ensureSchema();
  const { rows } = await sql`SELECT account, refresh_token FROM oauth_tokens WHERE provider = 'microsoft' LIMIT 1`;
  const connected = !!rows[0]?.refresh_token;
  return { configured, connected, account: (rows[0]?.account as string) || null };
}

export async function msDisconnect(): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM oauth_tokens WHERE provider = 'microsoft'`;
}

// Geeft een geldige access-token (vernieuwt via de bewaarde refresh-token).
async function msAccessToken(): Promise<string | null> {
  if (!msConfigured()) return null;
  await ensureSchema();
  const { rows } = await sql`SELECT refresh_token FROM oauth_tokens WHERE provider = 'microsoft' LIMIT 1`;
  const refresh = rows[0]?.refresh_token as string | undefined;
  if (!refresh) return null;
  const data = await tokenRequest({
    client_id: process.env.MS_CLIENT_ID || "",
    client_secret: process.env.MS_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: refresh,
    scope: SCOPES,
  });
  if (!data.access_token) return null;
  // Microsoft rouleert de refresh-token: bewaar de nieuwe als die er is.
  if (data.refresh_token && data.refresh_token !== refresh) {
    await sql`UPDATE oauth_tokens SET refresh_token = ${data.refresh_token}, updated_at = now() WHERE provider = 'microsoft'`;
  }
  return data.access_token;
}

type GraphMessage = {
  id: string;
  subject?: string | null;
  from?: { emailAddress?: { name?: string | null; address?: string | null } };
  toRecipients?: { emailAddress?: { address?: string | null } }[];
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  body?: { contentType?: string; content?: string | null };
  conversationId?: string | null;
  webLink?: string | null;
};

export type LiveEmail = {
  id: string;
  subject: string | null;
  fromName: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  preview: string | null;
  webLink: string | null;
  superhumanLink: string | null;
  bodyHtml: string | null;
  direction: string | null;
  toAddresses: string[];
};

const SUPERHUMAN_ACCOUNT_FALLBACK = "Maarten@pingwin.nl";

function superhumanThreadLink(account: string, query: string, conversationId: string): string {
  const acc = account || SUPERHUMAN_ACCOUNT_FALLBACK;
  return `https://mail.superhuman.com/${acc}/search/${encodeURIComponent(query)}/thread/${encodeURIComponent(conversationId)}`;
}

// Haalt de recente mails met een klant op (zoekt op het e-maildomein/-adres).
export async function msSearchClientEmails(query: string, account: string, limit = 15): Promise<LiveEmail[] | null> {
  const token = await msAccessToken();
  if (!token) return null;
  const url =
    `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"` +
    `&$top=${limit}` +
    `&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,conversationId,webLink`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: "eventual" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: GraphMessage[] };
  const items: GraphMessage[] = Array.isArray(j.value) ? j.value : [];
  const mails: LiveEmail[] = items.map((m) => {
    const fromAddr = m.from?.emailAddress?.address || null;
    const out = !!(fromAddr && account && fromAddr.toLowerCase() === account.toLowerCase());
    const body = m.body;
    const bodyHtml = body
      ? (body.contentType === "html" ? (body.content ?? null) : (body.content ? `<pre>${body.content}</pre>` : null))
      : null;
    return {
      id: m.id,
      subject: m.subject ?? null,
      fromName: m.from?.emailAddress?.name ?? null,
      fromAddress: fromAddr,
      receivedAt: m.receivedDateTime ?? null,
      preview: m.bodyPreview ?? null,
      webLink: m.webLink ?? null,
      superhumanLink: m.conversationId ? superhumanThreadLink(account, query, m.conversationId) : null,
      bodyHtml,
      direction: out ? "out" : "in",
      toAddresses: (m.toRecipients || []).map((r) => r.emailAddress?.address || "").filter(Boolean),
    };
  });
  mails.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
  return mails;
}

function sanitizeOutgoing(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

type Recipient = { emailAddress?: { address?: string } };

// Bepaalt naar wie het antwoord moet: alle deelnemers (afzender + to + cc) van
// de originele mail, behalve jezelf. Zo gaat een antwoord op je eigen verzonden
// mail toch naar de klant in plaats van naar jezelf ("note to self").
async function replyRecipients(token: string, messageId: string): Promise<Recipient[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT account FROM oauth_tokens WHERE provider = 'microsoft' LIMIT 1`;
  const me = ((rows[0]?.account as string) || "").toLowerCase();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=from,toRecipients,ccRecipients`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const o = (await res.json()) as { from?: Recipient; toRecipients?: Recipient[]; ccRecipients?: Recipient[] };
  const all: Recipient[] = [o.from || {}, ...(o.toRecipients || []), ...(o.ccRecipients || [])];
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of all) {
    const a = r.emailAddress?.address;
    if (!a) continue;
    const low = a.toLowerCase();
    if (low === me || seen.has(low)) continue;
    seen.add(low);
    out.push({ emailAddress: { address: a } });
  }
  return out;
}

// Beantwoordt een mail met OPGEMAAKTE HTML (vet, bullets, links). Behoudt het
// geciteerde origineel en stuurt naar de juiste partij (de klant, niet jezelf).
export async function msReplyHtml(messageId: string, html: string, toOverride?: string[]): Promise<{ ok: boolean; error?: string }> {
  const token = await msAccessToken();
  if (!token) return { ok: false, error: "Niet gekoppeld met Microsoft." };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Ontvangers: expliciet meegegeven adres(sen) hebben voorrang; anders
  // de deelnemers van de mail minus jezelf.
  const clean = (toOverride || []).map((a) => a.trim()).filter(Boolean);
  const recipients: Recipient[] = clean.length > 0
    ? clean.map((a) => ({ emailAddress: { address: a } }))
    : await replyRecipients(token, messageId);

  // 2. Concept-antwoord aanmaken (bevat al het geciteerde origineel).
  const cr = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/createReply`, { method: "POST", headers });
  if (!cr.ok) return { ok: false, error: `Concept aanmaken mislukt (${cr.status}).` };
  const draft = (await cr.json()) as { id: string; body?: { content?: string } };
  const quote = draft.body?.content || "";

  // 3. Body vervangen (opgemaakte HTML + citaat) en de juiste ontvangers zetten.
  const patchPayload: Record<string, unknown> = { body: { contentType: "HTML", content: `${sanitizeOutgoing(html)}<br>${quote}` } };
  if (recipients.length > 0) patchPayload.toRecipients = recipients;
  const patch = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draft.id)}`, {
    method: "PATCH", headers, body: JSON.stringify(patchPayload),
  });
  if (!patch.ok) return { ok: false, error: `Opmaken mislukt (${patch.status}).` };

  // 4. Versturen.
  const send = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST", headers });
  if (send.status === 202 || send.ok) return { ok: true };
  let msg = `Versturen mislukt (${send.status}).`;
  try { const j = await send.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
  return { ok: false, error: msg };
}
