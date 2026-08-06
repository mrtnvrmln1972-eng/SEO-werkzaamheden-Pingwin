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

const SCOPES = "offline_access Mail.ReadWrite Mail.Send User.Read People.Read";

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
  hasAttachments?: boolean | null;
  isDraft?: boolean | null;
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
  // Optioneel: alleen gevuld door msSearchMail. Bestaande aanroepers die deze
  // velden niet kennen blijven gewoon werken.
  conversationId?: string | null;
  hasAttachments?: boolean;
};

const SUPERHUMAN_ACCOUNT_FALLBACK = "Maarten@pingwin.nl";

function superhumanThreadLink(account: string, query: string, conversationId: string): string {
  const acc = account || SUPERHUMAN_ACCOUNT_FALLBACK;
  return `https://mail.superhuman.com/${acc}/search/${encodeURIComponent(query)}/thread/${encodeURIComponent(conversationId)}`;
}

export type Person = { name: string; email: string };

// Zoekt contactpersonen uit Maartens M365-account (mensen met wie hij mailt),
// voor de autocomplete in het mail-adresveld. Gebruikt de People-API van Graph
// (gerangschikt op relevantie). Vereist de People.Read-scope.
export async function msSearchPeople(query: string, limit = 8): Promise<Person[] | null> {
  const q = (query || "").trim();
  if (!q) return [];
  const token = await msAccessToken();
  if (!token) return null;
  const top = Math.min(20, Math.max(1, limit));
  const url = `https://graph.microsoft.com/v1.0/me/people?$search=${encodeURIComponent('"' + q + '"')}&$top=${top}&$select=displayName,scoredEmailAddresses`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({})) as { value?: { displayName?: string; scoredEmailAddresses?: { address?: string }[] }[] };
  const out: Person[] = [];
  const seen = new Set<string>();
  for (const p of data.value || []) {
    const email = (p.scoredEmailAddresses?.[0]?.address || "").trim();
    if (!email) continue;
    const low = email.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push({ name: (p.displayName || "").trim() || email, email });
    if (out.length >= limit) break;
  }
  return out;
}

// Zoekt in de eigen mailbox met een vrije zoekopdracht (Graph $search, KQL).
// Losgetrokken uit msSearchClientEmails zodat er óók op ONDERWERP gezocht kan
// worden ("alles over CRP binnen deze klant") en niet alleen op het klantdomein.
// searchQuery = een COMPLETE, al gequote KQL-uitdrukking; de aanroeper bepaalt de
// aanhalingstekens. Dat is bewust: er werd hier eerst een extra paar quotes
// omheen gezet, waardoor een samengestelde zoekopdracht ('adres AND "crp"')
// geneste aanhalingstekens kreeg en Graph er stil niets mee deed. Het zoeken op
// onderwerp leek dus te werken maar leverde nooit iets op.
// superhumanQuery = wat in de Superhuman-zoeklink terechtkomt (blijft het
// klantdomein, anders opent Superhuman een zoekopdracht die daar niets oplevert).
export async function msSearchMail(searchQuery: string, account: string, limit = 15, superhumanQuery?: string): Promise<LiveEmail[] | null> {
  const token = await msAccessToken();
  if (!token) return null;
  const url =
    `https://graph.microsoft.com/v1.0/me/messages?$search=${encodeURIComponent(searchQuery)}` +
    `&$top=${limit}` +
    `&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,conversationId,webLink,hasAttachments,isDraft`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: "eventual" } });
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: GraphMessage[] };
  // Concepten horen hier nooit in. Superhuman schreef een tijdlang automatisch
  // AI-concepten bij binnenkomende mail; die stonden als losse berichten in de
  // mailbox en dus ook in "Laatste mails". Een concept is per definitie niet
  // verstuurd en dus geen correspondentie: filteren bij de bron, zodat het in
  // het hele dashboard weg is (mails, chat, stand van zaken, pagina-dossiers).
  const items: GraphMessage[] = (Array.isArray(j.value) ? j.value : []).filter((m) => !m.isDraft);
  const shQuery = superhumanQuery || searchQuery;
  const mails: LiveEmail[] = items.map((m) => graphNaarMail(m, account, shQuery));
  mails.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
  return mails;
}

// Eén Graph-bericht naar ons eigen mailtype. Stond twee keer in deze module;
// nu op één plek, zodat zoeken en een thread ophalen hetzelfde opleveren.
function graphNaarMail(m: GraphMessage, account: string, superhumanQuery: string): LiveEmail {
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
    superhumanLink: m.conversationId ? superhumanThreadLink(account, superhumanQuery, m.conversationId) : null,
    bodyHtml,
    direction: out ? "out" : "in",
    toAddresses: (m.toRecipients || []).map((r) => r.emailAddress?.address || "").filter(Boolean),
    conversationId: m.conversationId ?? null,
    hasAttachments: !!m.hasAttachments,
  };
}

// Haalt de recente mails met een klant op (zoekt op het e-maildomein/-adres).
export async function msSearchClientEmails(query: string, account: string, limit = 15): Promise<LiveEmail[] | null> {
  return msSearchMail(`"${query}"`, account, limit, query);
}

// Alle berichten van één gesprek, exact opgehaald op conversationId.
//
// Dit is bewust GEEN zoekopdracht: zoeken geeft de nieuwste zoveel mails terug,
// en juist de oudste mail van een thread (waarin het verzoek staat, met het pad
// en de documentlinks) viel daar telkens buiten. Een gesprek hoort in zijn
// geheel opgehaald te worden, niet steekproefsgewijs.
export async function msGetThread(conversationId: string, account: string, limit = 40, superhumanQuery = ""): Promise<LiveEmail[] | null> {
  const token = await msAccessToken();
  if (!token || !conversationId) return null;
  const filter = `conversationId eq '${conversationId.replace(/'/g, "''")}'`;
  const url =
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}` +
    `&$top=${limit}` +
    `&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,conversationId,webLink,hasAttachments,isDraft`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: GraphMessage[] };
  const items: GraphMessage[] = (Array.isArray(j.value) ? j.value : []).filter((m) => !m.isDraft);  // concepten horen niet in een gesprek
  const mails = items.map((m) => graphNaarMail(m, account, superhumanQuery || conversationId));
  mails.sort((a, b) => (a.receivedAt || "").localeCompare(b.receivedAt || ""));  // oudste eerst: het verhaal op volgorde
  return mails;
}

// ── Bijlagen bij een mail ──
// Klanten sturen hun geredigeerde teksten als bijlage terug. Die gingen tot nu
// toe volledig verloren: de chat kreeg ze niet te zien en het versie-archief
// evenmin. Hiermee kan een tekstbijlage als klantversie bij de pagina belanden.
export type MailBijlage = { id: string; naam: string; type: string; grootte: number };

export async function msListAttachments(messageId: string): Promise<MailBijlage[] | null> {
  const token = await msAccessToken();
  if (!token) return null;
  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size,isInline`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = (await res.json()) as { value?: { id?: string; name?: string; contentType?: string; size?: number; isInline?: boolean }[] };
  return (j.value || [])
    .filter((a) => !a.isInline && a.name)
    .map((a) => ({ id: a.id || "", naam: a.name || "", type: a.contentType || "", grootte: Number(a.size || 0) }));
}

export async function msGetAttachment(messageId: string, attachmentId: string): Promise<{ naam: string; buffer: Buffer } | null> {
  const token = await msAccessToken();
  if (!token) return null;
  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const j = (await res.json()) as { name?: string; contentBytes?: string };
  if (!j.contentBytes) return null;
  return { naam: j.name || "bijlage", buffer: Buffer.from(j.contentBytes, "base64") };
}

// Antwoordt ÉCHT in de bestaande thread, met een deterministische ontvanger.
//
// Waarom naast msReplyHtml: die verstuurt bewust een nieuwe mail met "RE: " ervoor
// (zie de uitleg daar), en dat werkt prima, maar het bericht komt daardoor los in
// de mailbox van de ontvanger te staan; het gesprek valt uit elkaar. Voor een
// controle-antwoord is dat vervelend, want dat hoort juist onder het verzoek te
// hangen waar het over gaat.
//
// createReply levert een concept mét de juiste conversationId en antwoord-headers.
// Het bezwaar tegen createReply (de ontvanger blijft op jezelf plakken bij je eigen
// verzonden mail) lossen we op door in dezelfde stap toRecipients hard te
// overschrijven, vóór het versturen. Zo krijgen we allebei: echte threading én een
// ontvanger die niet kan verspringen.
export async function msReplyInThread(messageId: string, html: string, toOverride?: string[]): Promise<{ ok: boolean; error?: string; sentTo?: string[] }> {
  const token = await msAccessToken();
  if (!token) return { ok: false, error: "Niet gekoppeld met Microsoft." };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  let recipients = (toOverride || []).map((a) => a.trim()).filter(Boolean);
  if (recipients.length === 0) {
    recipients = (await replyRecipients(token, messageId)).map((r) => r.emailAddress?.address || "").filter(Boolean);
  }
  if (recipients.length === 0) return { ok: false, error: "Geen ontvanger gevonden. Vul het Aan-veld in." };

  // 1. Concept-antwoord laten maken door Graph (met citaat, headers en thread-id).
  const maak = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/createReply`, { method: "POST", headers });
  if (!maak.ok) {
    // Lukt dit niet, dan is een losse mail beter dan helemaal geen antwoord.
    return msReplyHtml(messageId, html, recipients);
  }
  const concept = (await maak.json()) as { id?: string; body?: { content?: string } };
  if (!concept.id) return msReplyHtml(messageId, html, recipients);

  // 2. Onze tekst bovenaan zetten, en de ontvanger hard vastzetten.
  const bestaand = concept.body?.content || "";
  const patch = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(concept.id)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      body: { contentType: "HTML", content: `${sanitizeOutgoing(html)}<br><br>${bestaand}` },
      toRecipients: recipients.map((a) => ({ emailAddress: { address: a } })),
      ccRecipients: [],
    }),
  });
  if (!patch.ok) {
    // Concept opruimen zodat er geen half bericht blijft rondslingeren.
    await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(concept.id)}`, { method: "DELETE", headers }).catch(() => null);
    return msReplyHtml(messageId, html, recipients);
  }

  // 3. Versturen.
  const send = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(concept.id)}/send`, { method: "POST", headers });
  if (send.status === 202 || send.ok) return { ok: true, sentTo: recipients };
  let msg = `Versturen mislukt (${send.status}).`;
  try { const j = await send.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
  return { ok: false, error: msg };
}

function sanitizeOutgoing(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

// Verstuurt een nieuwe mail (bijv. werkzaamheden naar de developer).
export async function msSendMail(to: string[], subject: string, html: string): Promise<{ ok: boolean; error?: string; sentTo?: string[] }> {
  const token = await msAccessToken();
  if (!token) return { ok: false, error: "Niet gekoppeld met Microsoft." };
  const recipients = (to || []).map((a) => a.trim()).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: "Geen ontvanger opgegeven." };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { subject: subject || "(geen onderwerp)", body: { contentType: "HTML", content: sanitizeOutgoing(html) }, toRecipients: recipients.map((a) => ({ emailAddress: { address: a } })) },
      saveToSentItems: true,
    }),
  });
  if (res.status === 202 || res.ok) return { ok: true, sentTo: recipients };
  let msg = `Versturen mislukt (${res.status}).`;
  try { const j = await res.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
  return { ok: false, error: msg };
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

// Verstuurt een opgemaakt antwoord DETERMINISTISCH naar een expliciet adres.
// Bewust GEEN createReply (dat blijft op de afzender = jezelf plakken bij een
// eigen verzonden mail). We bouwen een nieuwe mail "RE: <onderwerp>" met het
// geciteerde origineel eronder en zetten de ontvanger hard op het opgegeven adres.
export async function msReplyHtml(messageId: string, html: string, toOverride?: string[]): Promise<{ ok: boolean; error?: string; sentTo?: string[] }> {
  const token = await msAccessToken();
  if (!token) return { ok: false, error: "Niet gekoppeld met Microsoft." };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Ontvangers bepalen: expliciet opgegeven adres heeft voorrang.
  let recipients = (toOverride || []).map((a) => a.trim()).filter(Boolean);
  if (recipients.length === 0) {
    recipients = (await replyRecipients(token, messageId)).map((r) => r.emailAddress?.address || "").filter(Boolean);
  }
  if (recipients.length === 0) return { ok: false, error: "Geen ontvanger gevonden. Vul het Aan-veld in." };

  // 2. Onderwerp + geciteerd origineel ophalen.
  let subject = "";
  let quote = "";
  const oRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=subject,body`, { headers: { Authorization: `Bearer ${token}` } });
  if (oRes.ok) {
    const o = (await oRes.json()) as { subject?: string; body?: { content?: string } };
    subject = o.subject || "";
    quote = o.body?.content || "";
  }
  if (!/^\s*re:/i.test(subject)) subject = `RE: ${subject}`.trim();

  // 3. Nieuwe mail versturen naar het expliciete adres, met citaat eronder.
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: `${sanitizeOutgoing(html)}<br><br>${quote}` },
      toRecipients: recipients.map((a) => ({ emailAddress: { address: a } })),
    },
    saveToSentItems: true,
  };
  const send = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers, body: JSON.stringify(payload) });
  if (send.status === 202 || send.ok) return { ok: true, sentTo: recipients };
  let msg = `Versturen mislukt (${send.status}).`;
  try { const j = await send.json(); msg = j.error?.message || msg; } catch { /* ignore */ }
  return { ok: false, error: msg };
}
