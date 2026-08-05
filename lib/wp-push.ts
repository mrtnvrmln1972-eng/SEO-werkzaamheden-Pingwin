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

export type WpAuth = { origin: string; header: string };

export async function authFor(slug: string, pageUrl: string): Promise<WpAuth> {
  await ensureSchema();
  const { rows } = await sql`SELECT wp_user, wp_app_pass_enc FROM clients WHERE slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r?.wp_user || !r?.wp_app_pass_enc) throw new Error("Deze site is nog niet gekoppeld. Klik op 'Site koppelen' en vul de WordPress-gebruikersnaam en het applicatie-wachtwoord in.");
  const pass = decryptSecret(r.wp_app_pass_enc as string).replace(/\s+/g, "");
  // WordPress toont het applicatie-wachtwoord met spaties; die horen er niet in.
  const origin = new URL(pageUrl).origin;
  return { origin, header: "Basic " + Buffer.from(`${r.wp_user}:${pass}`).toString("base64") };
}

export async function wpFetch(auth: WpAuth, path: string, init?: RequestInit): Promise<Response> {
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
export async function findPost(auth: WpAuth, pageUrl: string): Promise<{ type: "pages" | "posts"; id: number }> {
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

  // Welke SEO-plugin draait er? Yoast en RankMath gebruiken andere velden, dus
  // eerst kijken wat de pagina zelf teruggeeft en anders allebei proberen. Zonder
  // dit schreef de knop op een RankMath-site stilzwijgend in het niets.
  const plugins = await detectSeoPlugin(auth, post);
  let laatste = "";
  for (const plugin of plugins) {
    const velden = META_VELDEN[plugin];
    const meta: Record<string, string> = {};
    if (fields.title) meta[velden.title] = fields.title;
    if (fields.desc) meta[velden.desc] = fields.desc;

    const res = await wpFetch(auth, `/${post.type}/${post.id}`, { method: "POST", body: JSON.stringify({ meta }) });
    if (res.status === 401 || res.status === 403) return { ok: false, detail: "De site weigert de wijziging: controleer gebruikersnaam en applicatie-wachtwoord (en of die gebruiker pagina's mag bewerken)." };
    if (!res.ok) {
      const t = (await res.text().catch(() => "")).slice(0, 200);
      laatste = `De site gaf een fout terug (${res.status}). ${t}`;
      continue;
    }

    // Terug-controle: staan de velden er nu echt in? Zo niet, dan stelt de site
    // die velden niet open voor de REST API en is er een klein snippet nodig.
    const check = await wpFetch(auth, `/${post.type}/${post.id}?context=edit`);
    const j = (await check.json().catch(() => ({}))) as { meta?: Record<string, unknown> };
    const m = j.meta || {};
    const titleOk = !fields.title || (velden.title in m && m[velden.title] === fields.title);
    const descOk = !fields.desc || (velden.desc in m && m[velden.desc] === fields.desc);
    if (titleOk && descOk) return { ok: true, detail: `Doorgevoerd op de site (${PLUGIN_NAAM[plugin]}).` };
    laatste = `De site heeft de wijziging niet opgeslagen: de ${PLUGIN_NAAM[plugin]}-velden staan niet open voor de REST API. Laat het Pingwin-snippet op de site installeren (eenmalig, vraag Maarten of de sitebouwer) en probeer het opnieuw.`;
  }
  return { ok: false, detail: laatste || "De site heeft de wijziging niet opgeslagen." };
}

type SeoPlugin = "yoast" | "rankmath";
const META_VELDEN: Record<SeoPlugin, { title: string; desc: string }> = {
  yoast: { title: "_yoast_wpseo_title", desc: "_yoast_wpseo_metadesc" },
  rankmath: { title: "rank_math_title", desc: "rank_math_description" },
};
const PLUGIN_NAAM: Record<SeoPlugin, string> = { yoast: "Yoast", rankmath: "RankMath" };

// Kijkt in de bewerk-weergave van de pagina welke SEO-velden de site kent en
// zet die vooraan. Herkent hij niets, dan proberen we ze allebei op volgorde.
async function detectSeoPlugin(auth: WpAuth, post: { type: string; id: number }): Promise<SeoPlugin[]> {
  try {
    const res = await wpFetch(auth, `/${post.type}/${post.id}?context=edit`);
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { meta?: Record<string, unknown> };
      const m = j.meta || {};
      if (META_VELDEN.rankmath.title in m && !(META_VELDEN.yoast.title in m)) return ["rankmath", "yoast"];
      if (META_VELDEN.yoast.title in m) return ["yoast", "rankmath"];
    }
  } catch { /* val terug op allebei proberen */ }
  return ["yoast", "rankmath"];
}

// ── Alt-teksten via de mediabibliotheek ──────────────────────
// De alt-tekst hangt in WordPress aan de afbeelding zelf (wp/v2/media), dus dit
// werkt goed voor UNIEKE afbeeldingen; dubbel gebruikte krijgen sitebreed
// dezelfde alt en horen hier niet in (die markeert de werklijst voor de
// sitebouwer). Per bestand: media zoeken op naam, alt zetten, terug-controleren.

function baseName(file: string): string {
  return (file || "").toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "").replace(/\.[a-z0-9]+$/i, "");
}

export async function pushAltTexts(slug: string, pageUrl: string, alts: { file: string; alt: string }[]): Promise<{ ok: boolean; gezet: number; mislukt: string[]; redenen: Record<string, string>; detail: string }> {
  const auth = await authFor(slug, pageUrl);
  let gezet = 0;
  const mislukt: string[] = [];
  const redenen: Record<string, string> = {};
  const faal = (file: string, reden: string) => { mislukt.push(file); redenen[file] = reden; };
  for (const a of alts.slice(0, 60)) {
    const naam = baseName(a.file);
    const alt = (a.alt || "").trim();
    if (!naam || !alt) { if (a.file) faal(a.file, "geen alt-tekst om door te voeren"); continue; }
    try {
      const zoek = await wpFetch(auth, `/media?search=${encodeURIComponent(naam)}&per_page=20`);
      if (!zoek.ok) { faal(a.file, `de mediabibliotheek gaf een fout (${zoek.status})`); continue; }
      const kandidaten = (await zoek.json()) as { id: number; source_url?: string }[];
      // Alleen een EXACTE match op bestandsnaam. Eerder pakte de code bij twijfel
      // de eerste de beste die erop leek; dan belandde de alt-tekst op een andere
      // foto en stond het vinkje toch groen. Liever niets doen en dat melden.
      const match = kandidaten.find((k) => baseName((k.source_url || "").split("/").pop() || "") === naam);
      if (!match?.id) { faal(a.file, "niet gevonden in de mediabibliotheek"); continue; }
      const zet = await wpFetch(auth, `/media/${match.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: alt }) });
      if (!zet.ok) { faal(a.file, `de site weigerde de wijziging (${zet.status})`); continue; }
      // Terug-controle: heeft WordPress de alt echt opgeslagen?
      const terug = (await zet.json()) as { alt_text?: string };
      if ((terug.alt_text || "").trim() === alt) gezet++;
      else faal(a.file, "de site sloeg de alt-tekst niet op");
    } catch { faal(a.file, "de site was niet bereikbaar"); }
  }
  const detail = mislukt.length
    ? `${gezet} alt-teksten gezet; ${mislukt.length} niet doorgevoerd (${mislukt.slice(0, 3).map((f) => `${f}: ${redenen[f]}`).join("; ")}${mislukt.length > 3 ? "; ..." : ""}).`
    : `${gezet} alt-teksten gezet en gecontroleerd.`;
  return { ok: gezet > 0 || mislukt.length === 0, gezet, mislukt, redenen, detail };
}
