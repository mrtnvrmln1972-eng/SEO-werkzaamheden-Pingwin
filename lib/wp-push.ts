// WordPress-koppeling per klant: meta title/description rechtstreeks doorvoeren
// op de site via de WordPress REST API met een applicatie-wachtwoord.
//
// - Het applicatie-wachtwoord wordt versleuteld opgeslagen (AES-256-GCM met een
//   sleutel afgeleid van SESSION_SECRET); nooit leesbaar terug te geven.
// - Doorvoeren schrijft de Yoast-velden (_yoast_wpseo_title/_yoast_wpseo_metadesc)
//   en leest ze daarna terug ter controle. Stelt de site die velden niet open
//   voor de REST API (dat vergt een klein snippet op de site), dan melden we dat
//   eerlijk in plaats van te doen alsof het gelukt is.

import crypto from "crypto";
import { sql, ensureSchema } from "./db";

function key(): Buffer {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("SESSION_SECRET ontbreekt.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export async function saveWpCredentials(slug: string, username: string, appPassword: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE clients SET wp_user = ${username.trim()}, wp_app_pass_enc = ${encryptSecret(appPassword.trim())} WHERE slug = ${slug}`;
}

export async function getWpStatus(slug: string): Promise<{ connected: boolean; username: string | null }> {
  await ensureSchema();
  const { rows } = await sql`SELECT wp_user, wp_app_pass_enc FROM clients WHERE slug = ${slug} LIMIT 1`;
  const r = rows[0];
  return { connected: !!(r?.wp_user && r?.wp_app_pass_enc), username: (r?.wp_user as string) || null };
}

type WpAuth = { origin: string; header: string };

async function authFor(slug: string, pageUrl: string): Promise<WpAuth> {
  await ensureSchema();
  const { rows } = await sql`SELECT wp_user, wp_app_pass_enc FROM clients WHERE slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r?.wp_user || !r?.wp_app_pass_enc) throw new Error("Deze site is nog niet gekoppeld. Klik op 'Site koppelen' en vul de WordPress-gebruikersnaam en het applicatie-wachtwoord in.");
  const pass = decryptSecret(r.wp_app_pass_enc as string);
  const origin = new URL(pageUrl).origin;
  return { origin, header: "Basic " + Buffer.from(`${r.wp_user}:${pass}`).toString("base64") };
}

async function wpFetch(auth: WpAuth, path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    return await fetch(`${auth.origin}/wp-json/wp/v2${path}`, {
      ...init,
      headers: { Authorization: auth.header, "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
}

// Zoek het WordPress-bericht (pagina of post) dat bij deze URL hoort, op slug.
async function findPost(auth: WpAuth, pageUrl: string): Promise<{ type: "pages" | "posts"; id: number }> {
  const path = new URL(pageUrl).pathname.replace(/\/+$/, "");
  const slug = path.split("/").filter(Boolean).pop() || "";
  if (!slug) throw new Error("De homepage heeft geen eigen slug; voer die meta handmatig door.");
  for (const type of ["pages", "posts"] as const) {
    const res = await wpFetch(auth, `/${type}?slug=${encodeURIComponent(slug)}&per_page=2`);
    if (res.status === 401 || res.status === 403) throw new Error("De site weigert de koppeling (verkeerde gebruikersnaam of applicatie-wachtwoord?).");
    if (!res.ok) continue;
    const list = (await res.json().catch(() => [])) as { id?: number; link?: string }[];
    // Bij meerdere resultaten: kies het bericht waarvan de volledige link past.
    const hit = list.find((p) => (p.link || "").replace(/\/+$/, "").endsWith(path)) || list[0];
    if (hit?.id) return { type, id: hit.id };
  }
  throw new Error("Kon deze pagina niet terugvinden in WordPress (geen pagina of bericht met deze slug).");
}

export type WpPushResult = { ok: boolean; detail: string };

// Voert de meta title en/of description door op de site en controleert of de
// site ze echt heeft opgeslagen.
export async function pushMetaToSite(slug: string, pageUrl: string, fields: { title?: string; desc?: string }): Promise<WpPushResult> {
  if (!fields.title && !fields.desc) return { ok: false, detail: "Niets om door te voeren: keur eerst een titel en/of beschrijving goed." };
  const auth = await authFor(slug, pageUrl);
  const post = await findPost(auth, pageUrl);

  const meta: Record<string, string> = {};
  if (fields.title) meta._yoast_wpseo_title = fields.title;
  if (fields.desc) meta._yoast_wpseo_metadesc = fields.desc;

  const res = await wpFetch(auth, `/${post.type}/${post.id}`, { method: "POST", body: JSON.stringify({ meta }) });
  if (res.status === 401 || res.status === 403) return { ok: false, detail: "De site weigert de wijziging: controleer gebruikersnaam en applicatie-wachtwoord (en of die gebruiker pagina's mag bewerken)." };
  if (!res.ok) {
    const t = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: false, detail: `De site gaf een fout terug (${res.status}). ${t}` };
  }

  // Terug-controle: staan de velden er nu echt in? Zo niet, dan stelt de site de
  // Yoast-velden niet open voor de REST API en is er een klein snippet nodig.
  const check = await wpFetch(auth, `/${post.type}/${post.id}?context=edit`);
  const j = (await check.json().catch(() => ({}))) as { meta?: Record<string, unknown> };
  const m = j.meta || {};
  const titleOk = !fields.title || m._yoast_wpseo_title === fields.title;
  const descOk = !fields.desc || m._yoast_wpseo_metadesc === fields.desc;
  if (titleOk && descOk && (fields.title ? "_yoast_wpseo_title" in m : true) && (fields.desc ? "_yoast_wpseo_metadesc" in m : true)) {
    return { ok: true, detail: "Doorgevoerd op de site." };
  }
  return {
    ok: false,
    detail: "De site heeft de wijziging niet opgeslagen: de Yoast-velden staan niet open voor de REST API. Laat het Pingwin-snippet op de site installeren (eenmalig, vraag Maarten/de sitebouwer) en probeer het opnieuw.",
  };
}
