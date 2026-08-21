// WordPress-koppeling per klant: meta title/description en (sinds R6) de
// volledige copy rechtstreeks doorvoeren op de site via de WordPress REST API
// met een applicatie-wachtwoord.
//
// - Het applicatie-wachtwoord wordt versleuteld opgeslagen (AES-256-GCM met een
//   sleutel afgeleid van SESSION_SECRET); nooit leesbaar terug te geven.
// - Meta doorvoeren schrijft de Yoast-velden (_yoast_wpseo_title/_yoast_wpseo_metadesc)
//   en leest ze daarna terug ter controle. Stelt de site die velden niet open
//   voor de REST API (dat vergt een klein snippet op de site), dan melden we dat
//   eerlijk in plaats van te doen alsof het gelukt is.
// - Copy doorvoeren zet NOOIT de bestaande, live pagina om naar concept (dat zou
//   de pagina van de klant offline halen). In plaats daarvan maakt pushCopyDraft
//   een NIEUWE pagina/bericht aan met status "draft", met dezelfde titel plus
//   "— concept (Pingwin)". Dat concept staat nergens publiek, en publiceren (of
//   overzetten naar de bestaande pagina) blijft een bewuste mensenklik in
//   WordPress zelf. Dit is het WordPress-koppelstuk achter lib/site-connector.ts.

import { sql, ensureSchema } from "./db";
import { getWpCreds, wpKoppelingStand } from "./wp-creds";

// De opslag van de koppeling zelf staat in `lib/wp-creds.ts`; dit bestand
// gebruikt hem alleen. Dat was tot 21-08-2026 niet zo: hier stond een tweede
// opslag naast die van het tabblad Wijzigingen, en die twee liepen uit elkaar
// (zie de uitleg bovenaan wp-creds.ts). Schrijf hier dus nooit weer zelf naar
// clients.wp_user of clients.wp_app_pass_enc.
export { encryptSecret, decryptSecret } from "./wp-geheim";
export const getWpStatus = wpKoppelingStand;

export type WpAuth = { origin: string; header: string };

export async function authFor(slug: string, pageUrl: string): Promise<WpAuth> {
  await ensureSchema();
  const creds = await getWpCreds(slug);
  if (!creds) throw new Error("Deze site is nog niet gekoppeld. Klik op 'Site koppelen' en vul de WordPress-gebruikersnaam en het applicatie-wachtwoord in.");
  // WordPress toont het applicatie-wachtwoord met spaties; die horen er niet in.
  const pass = creds.appPassword.replace(/\s+/g, "");
  const origin = new URL(pageUrl).origin;
  return { origin, header: "Basic " + Buffer.from(`${creds.user}:${pass}`).toString("base64") };
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

export type WpAltPushResult = Awaited<ReturnType<typeof pushAltTexts>>;

// ── Copy als concept doorvoeren (R6) ─────────────────────────
// Het opgeslagen copydocument is platte tekst met een vaste sectie "Volledige
// copy" (zie specToText/COPY_SYSTEM in lib/page-doc.ts): daarin staat de H1
// (het label "H1 — ..."), elke H2/H3 met hetzelfde label, en de lopende tekst/
// bullets eronder. De andere secties (scorecard, meta-tabel, behoud-overzicht)
// zijn werkdocumentatie voor Pingwin zelf en horen niet op de site.

function copyEscHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function copyInlineHtml(s: string): string {
  return copyEscHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** Pakt alleen de tekst tussen "## Volledige copy" en de volgende "## "-kop. */
export function volledigeCopyTekst(content: string): string {
  const lines = (content || "").split("\n");
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (start === -1) { if (/^##\s+Volledige copy\s*$/i.test(line)) start = i + 1; continue; }
    if (/^##\s+/.test(line)) { end = i; break; }
  }
  return start === -1 ? "" : lines.slice(start, end).join("\n").trim();
}

/**
 * Zet de "Volledige copy"-tekst om in nette HTML voor het WordPress content-veld.
 * De H1-regel wordt bewust NIET meegenomen: dat is de bestaande paginatitel, en
 * die opnieuw als kop in de inhoud zetten geeft een dubbele H1 op de pagina.
 */
export function copyContentToHtml(tekst: string): string {
  const lines = tekst.split("\n");
  const out: string[] = [];
  let inList = false;
  const sluitLijst = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { sluitLijst(); continue; }
    const kop = /^#{1,3}\s+(.*)$/.exec(line);
    if (kop) {
      sluitLijst();
      const label = /^H([123])\s*[—–-]\s*(.+)$/i.exec(kop[1].trim());
      if (label) {
        if (label[1] !== "1") out.push(`<h${label[1]}>${copyInlineHtml(label[2].trim())}</h${label[1]}>`);
      } else {
        out.push(`<h2>${copyInlineHtml(kop[1].trim())}</h2>`);
      }
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${copyInlineHtml(bullet[1])}</li>`);
      continue;
    }
    sluitLijst();
    out.push(`<p>${copyInlineHtml(line)}</p>`);
  }
  sluitLijst();
  return out.join("\n");
}

export type CopyPushResult = { ok: boolean; detail: string; previewUrl?: string | null };

/**
 * Zet het goedgekeurde copydocument als CONCEPT in WordPress: een nieuwe
 * pagina/bericht (status "draft"), nooit een wijziging van de bestaande, live
 * pagina. Geeft de wp-admin-bewerklink terug als voorbeeldlink; publiceren (of
 * de tekst overzetten naar de bestaande pagina) is en blijft een mensenklik.
 */
export async function pushCopyDraft(slug: string, pageUrl: string, copyContent: string): Promise<CopyPushResult> {
  const tekst = volledigeCopyTekst(copyContent);
  if (!tekst) return { ok: false, detail: "Dit copydocument heeft geen sectie 'Volledige copy' om door te voeren; genereer eerst de copy voor deze pagina." };
  const html = copyContentToHtml(tekst);
  if (!html.trim()) return { ok: false, detail: "Er is geen copytekst gevonden om als concept te plaatsen." };

  const auth = await authFor(slug, pageUrl);
  const post = await findPost(auth, pageUrl);

  const orig = await wpFetch(auth, `/${post.type}/${post.id}?context=edit&_fields=id,title,slug`);
  if (!orig.ok) return { ok: false, detail: `Kon de bestaande pagina niet uitlezen (${orig.status}).` };
  const origData = (await orig.json().catch(() => ({}))) as { title?: { raw?: string; rendered?: string }; slug?: string };
  const titel = (origData.title?.raw || origData.title?.rendered || "").replace(/<[^>]+>/g, "").trim() || "Concept";
  const conceptSlug = `${(origData.slug || "concept").slice(0, 60)}-concept-pingwin-${Date.now().toString(36)}`;

  const maak = await wpFetch(auth, `/${post.type}`, {
    method: "POST",
    body: JSON.stringify({ title: `${titel} — concept (Pingwin)`, slug: conceptSlug, status: "draft", content: html }),
  });
  if (maak.status === 401 || maak.status === 403) return { ok: false, detail: "De site weigert de wijziging: controleer gebruikersnaam en applicatie-wachtwoord (en of die gebruiker nieuwe pagina's mag aanmaken)." };
  if (!maak.ok) {
    const t = (await maak.text().catch(() => "")).slice(0, 200);
    return { ok: false, detail: `De site gaf een fout terug (${maak.status}). ${t}` };
  }
  const created = (await maak.json().catch(() => ({}))) as { id?: number };
  if (!created.id) return { ok: false, detail: "De site gaf geen bevestiging terug; controleer handmatig of het concept is aangemaakt." };

  // Terug-controle: staat het concept er echt, en nog steeds als concept (niet
  // per ongeluk meteen gepubliceerd)?
  const check = await wpFetch(auth, `/${post.type}/${created.id}?context=edit&_fields=id,status`);
  const checkData = (await check.json().catch(() => ({}))) as { status?: string };
  const editUrl = `${auth.origin}/wp-admin/post.php?post=${created.id}&action=edit`;
  if (checkData.status !== "draft") {
    return { ok: false, detail: "Het concept is aangemaakt maar de status kon niet bevestigd worden als 'concept'; controleer het handmatig in WordPress voordat je verdergaat.", previewUrl: editUrl };
  }
  return {
    ok: true,
    detail: "De copy staat als concept (nog niet live) in WordPress. Open de link, bekijk het en publiceer het pas als je tevreden bent.",
    previewUrl: editUrl,
  };
}

// ── Het WordPress-koppelstuk achter de generieke doorvoerlaag (lib/site-connector.ts) ──
export const wordpressConnector = {
  id: "wordpress" as const,
  naam: "WordPress",
  pushMeta: pushMetaToSite,
  pushAltTexts,
  pushCopyDraft,
};
