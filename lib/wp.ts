// WordPress-koppeling per klant: 301-redirects doorvoeren via de Redirection-plugin
// (REST API met een application password) en live verifiëren dat de redirect echt
// werkt. Het application password staat VERSLEUTELD in de database (AES-256-GCM met
// een sleutel afgeleid van SESSION_SECRET), nooit plat.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { sql, ensureSchema } from "./db";

// ── Versleuteling van het application password ──
function encKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET ontbreekt (nodig om het application password versleuteld op te slaan).");
  return scryptSync(secret, "pingwin-wp-app-pass", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function decryptSecret(enc: string): string {
  const [iv, tag, data] = enc.split(".");
  if (!iv || !tag || !data) throw new Error("Opgeslagen wachtwoord heeft een onbekend formaat.");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// ── Koppeling per klant lezen/schrijven ──
export type WpConn = { url: string; user: string; appPassword: string };

export async function getWpConn(slug: string): Promise<WpConn | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT wp_url, wp_user, wp_app_pass_enc FROM clients WHERE slug = ${slug}`;
  const r = rows[0];
  if (!r?.wp_url || !r?.wp_user || !r?.wp_app_pass_enc) return null;
  try { return { url: String(r.wp_url), user: String(r.wp_user), appPassword: decryptSecret(String(r.wp_app_pass_enc)) }; } catch { return null; }
}

export async function setWpConn(slug: string, url: string, user: string, appPassword: string): Promise<void> {
  await ensureSchema();
  const clean = url.trim().replace(/\/+$/, "");
  await sql`UPDATE clients SET wp_url = ${clean}, wp_user = ${user.trim()}, wp_app_pass_enc = ${encryptSecret(appPassword.trim())} WHERE slug = ${slug}`;
}

// ── Redirection-plugin REST API ──
function authHeader(conn: WpConn): string {
  return "Basic " + Buffer.from(`${conn.user}:${conn.appPassword}`).toString("base64");
}

async function redirectionFetch(conn: WpConn, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${conn.url}/wp-json/redirection/v1${path}`, {
    ...init,
    headers: { Authorization: authHeader(conn), "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("De Redirection-plugin is niet gevonden op de website. Installeer/activeer de gratis plugin 'Redirection' en probeer opnieuw.");
  if (res.status === 401 || res.status === 403) throw new Error("De website weigert de koppeling (gebruikersnaam of application password klopt niet, of de gebruiker mag geen redirects beheren).");
  return res;
}

// Vindt (of maakt) de Redirection-groep "Pingwin SEO dashboard", zodat alle
// redirects uit het dashboard herkenbaar bij elkaar staan in de plugin.
async function pingwinGroupId(conn: WpConn): Promise<number> {
  const GROUP = "Pingwin SEO dashboard";
  const res = await redirectionFetch(conn, "/group?per_page=100");
  if (!res.ok) throw new Error(`Groepen ophalen mislukte (${res.status}).`);
  const d = await res.json().catch(() => null) as { items?: { id: number; name: string }[] } | null;
  const found = d?.items?.find((g) => g.name === GROUP);
  if (found) return found.id;
  const mk = await redirectionFetch(conn, "/group", { method: "POST", body: JSON.stringify({ name: GROUP, moduleId: 1 }) });
  if (!mk.ok) throw new Error(`Groep aanmaken mislukte (${mk.status}).`);
  const md = await mk.json().catch(() => null) as { items?: { id: number; name: string }[]; id?: number } | null;
  const created = md?.items?.find((g) => g.name === GROUP)?.id ?? md?.id;
  if (!created) throw new Error("Groep aanmaken lukte, maar het id kwam niet terug.");
  return created;
}

// Zet één 301-redirect in de Redirection-plugin. Geeft het redirect-id terug.
export async function createWpRedirect(conn: WpConn, fromPath: string, toPath: string): Promise<number | null> {
  const groupId = await pingwinGroupId(conn);
  const res = await redirectionFetch(conn, "/redirect", {
    method: "POST",
    body: JSON.stringify({
      url: fromPath,
      match_type: "url",
      action_type: "url",
      action_code: 301,
      action_data: { url: toPath },
      group_id: groupId,
    }),
  });
  const d = await res.json().catch(() => null) as { id?: number; item?: { id?: number }; message?: string; error_description?: string } | null;
  if (!res.ok) {
    // "Duplicate" betekent: hij staat er al; dat is voor ons geen fout.
    const msg = String(d?.message || d?.error_description || "");
    if (/duplicate|already exists|bestaat al/i.test(msg)) return null;
    throw new Error(msg || `Redirect aanmaken mislukte (${res.status}).`);
  }
  return d?.id ?? d?.item?.id ?? null;
}

// ── Live verificatie: is het van-pad echt een 301 naar het juiste doel? ──
function normPath(p: string): string {
  return ("/" + (p || "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
}

export async function verifyRedirect(siteUrl: string, fromPath: string, toPath: string): Promise<{ ok: boolean; detail: string }> {
  const base = siteUrl.trim().replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}${fromPath}`, { redirect: "manual", cache: "no-store" });
    if (![301, 302, 307, 308].includes(res.status)) return { ok: false, detail: `Geen redirect: de oude URL gaf status ${res.status}.` };
    const loc = res.headers.get("location") || "";
    if (normPath(loc) !== normPath(toPath)) return { ok: false, detail: `Redirect wijst naar ${loc || "onbekend"} in plaats van ${toPath}.` };
    if (res.status !== 301) return { ok: true, detail: `Werkt, maar als ${res.status} in plaats van 301 (tijdelijk i.p.v. permanent).` };
    return { ok: true, detail: "301 naar het juiste doel." };
  } catch {
    return { ok: false, detail: "De oude URL kon niet worden opgevraagd." };
  }
}

// ── Doorgevoerde redirects per pagina bewaren/lezen ──
export type PageRedirect = { fromPath: string; toPath: string; verified: boolean; executedAt: string };

export async function getPageRedirects(slug: string, pageUrl: string): Promise<PageRedirect[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT from_path, to_path, verified, executed_at FROM page_redirects WHERE slug = ${slug} AND page_url = ${pageUrl}`;
  return rows.map((r) => ({ fromPath: String(r.from_path), toPath: String(r.to_path), verified: !!r.verified, executedAt: String(r.executed_at) }));
}

export async function savePageRedirect(slug: string, pageUrl: string, fromPath: string, toPath: string, verified: boolean, redirectionId: number | null): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO page_redirects (slug, page_url, from_path, to_path, verified, redirection_id)
    VALUES (${slug}, ${pageUrl}, ${fromPath}, ${toPath}, ${verified}, ${redirectionId})
    ON CONFLICT (slug, page_url, from_path)
    DO UPDATE SET to_path = ${toPath}, verified = ${verified}, redirection_id = COALESCE(${redirectionId}, page_redirects.redirection_id), executed_at = now()`;
}
