// 301-redirects doorvoeren in de WordPress-website van de klant via de
// Redirection-plugin (REST API), plus live verificatie dat de redirect echt
// werkt. Gebruikt de BESTAANDE WordPress-koppeling per klant: het application
// password uit client_wp_creds (lib/wp-creds.ts, ook gebruikt voor de
// bewerkingshistorie) en de site-URL uit het klant-domein.
import { sql, ensureSchema } from "./db";
import { logActiviteit } from "./activiteit";
import { getClientBySlug } from "./clients";
import { getWpCreds } from "./wp-creds";
import { baseFromDomain } from "./wordpress";

export type WpConn = { url: string; user: string; appPassword: string };

// De koppeling voor deze klant: domein + opgeslagen inloggegevens. Null als
// een van beide ontbreekt (de UI legt dan uit wat er nog ingesteld moet worden).
export async function getWpConnForClient(slug: string): Promise<WpConn | null> {
  const client = await getClientBySlug(slug);
  const url = baseFromDomain(client?.domain || "");
  if (!url) return null;
  const creds = await getWpCreds(slug);
  if (!creds) return null;
  return { url, user: creds.user, appPassword: creds.appPassword };
}

// ── Redirection-plugin REST API ──
function authHeader(conn: WpConn): string {
  // Application passwords mogen zonder spaties; Basic auth = base64(user:pass).
  return "Basic " + Buffer.from(`${conn.user}:${conn.appPassword.replace(/\s+/g, "")}`).toString("base64");
}

async function redirectionFetch(conn: WpConn, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${conn.url}/wp-json/redirection/v1${path}`, {
    ...init,
    headers: { Authorization: authHeader(conn), "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 PingwinBot", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("De Redirection-plugin is niet gevonden op de website. Installeer/activeer de gratis plugin 'Redirection' en probeer opnieuw.");
  if (res.status === 401 || res.status === 403) throw new Error("De website weigert de koppeling (application password klopt niet meer, of de gebruiker mag geen redirects beheren).");
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
  const lichaam = {
    url: fromPath,
    match_type: "url",
    action_type: "url",
    action_code: 301,
    action_data: { url: toPath },
    group_id: groupId,
  };
  // Staat er al een regel voor dit pad, dan die bijwerken. Anders komt een
  // gecorrigeerd doel er nooit in en blijft de oude omleiding staan.
  const bestaand = await bestaandeRegel(conn, fromPath).catch(() => null);
  if (bestaand) {
    if (normPath(bestaand.naar) === normPath(toPath)) return bestaand.id;
    const bij = await redirectionFetch(conn, `/redirect/${bestaand.id}`, { method: "POST", body: JSON.stringify(lichaam) });
    if (!bij.ok) throw new Error(`De bestaande omleiding voor ${fromPath} bijwerken mislukte (${bij.status}).`);
    return bestaand.id;
  }
  const res = await redirectionFetch(conn, "/redirect", { method: "POST", body: JSON.stringify(lichaam) });
  const d = await res.json().catch(() => null) as { id?: number; item?: { id?: number }; message?: string; error_description?: string } | null;
  if (!res.ok) {
    // "Duplicate" betekent: hij staat er al; dat is voor ons geen fout.
    const msg = String(d?.message || d?.error_description || "");
    if (/duplicate|already exists|bestaat al/i.test(msg)) return null;
    throw new Error(msg || `Redirect aanmaken mislukte (${res.status}).`);
  }
  return d?.id ?? d?.item?.id ?? null;
}

// Bestaat er al een regel voor dit bronpad? Dan moet die worden bijgewerkt en
// niet nog een keer aangemaakt: de plugin weigert een duplicaat, en dan zou een
// gecorrigeerd doel er stilzwijgend niet in komen. Precies dat gebeurde toen het
// doel van het locatie-overzicht naar de dichtstbijzijnde vestiging verschoof.
async function bestaandeRegel(conn: WpConn, fromPath: string): Promise<{ id: number; naar: string } | null> {
  const p = normPath(fromPath);
  const res = await redirectionFetch(conn, `/redirect?filterBy[url]=${encodeURIComponent(p)}&per_page=25`);
  if (!res.ok) return null;
  const d = await res.json().catch(() => null) as { items?: { id: number; url: string; action_data?: { url?: string } | string }[] } | null;
  const hit = (d?.items || []).find((it) => normPath(String(it.url || "")) === p);
  if (!hit) return null;
  const naar = typeof hit.action_data === "string" ? hit.action_data : (hit.action_data?.url || "");
  return { id: hit.id, naar };
}

// Zet een pad op 410 ("bewust weg") in de Redirection-plugin. Dat is geen
// omleiding maar een antwoord: deze pagina komt niet terug. De keuzeladder zet
// dit bewust vóór een omleiding naar de homepage, want massaal naar de homepage
// omleiden doet functioneel hetzelfde zonder het duidelijke signaal aan Google.
export async function createWpGone(conn: WpConn, fromPath: string): Promise<number | null> {
  const groupId = await pingwinGroupId(conn);
  const lichaam = { url: fromPath, match_type: "url", action_type: "error", action_code: 410, group_id: groupId };
  const bestaand = await bestaandeRegel(conn, fromPath).catch(() => null);
  if (bestaand) {
    const bij = await redirectionFetch(conn, `/redirect/${bestaand.id}`, { method: "POST", body: JSON.stringify(lichaam) });
    if (!bij.ok) throw new Error(`De bestaande regel voor ${fromPath} op 410 zetten mislukte (${bij.status}).`);
    return bestaand.id;
  }
  const res = await redirectionFetch(conn, "/redirect", { method: "POST", body: JSON.stringify(lichaam) });
  const d = await res.json().catch(() => null) as { id?: number; item?: { id?: number }; message?: string; error_description?: string } | null;
  if (!res.ok) {
    const msg = String(d?.message || d?.error_description || "");
    if (/duplicate|already exists|bestaat al/i.test(msg)) return null;
    throw new Error(msg || `410 instellen mislukte (${res.status}).`);
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
    const res = await fetch(`${base}${fromPath}`, { redirect: "manual", cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 PingwinBot" } });
    if (![301, 302, 307, 308].includes(res.status)) return { ok: false, detail: `Geen redirect: de oude URL gaf status ${res.status}.` };
    const loc = res.headers.get("location") || "";
    if (normPath(loc) !== normPath(toPath)) return { ok: false, detail: `Redirect wijst naar ${loc || "onbekend"} in plaats van ${toPath}.` };
    if (res.status !== 301) return { ok: true, detail: `Werkt, maar als ${res.status} in plaats van 301 (tijdelijk i.p.v. permanent).` };
    return { ok: true, detail: "301 naar het juiste doel." };
  } catch {
    return { ok: false, detail: "De oude URL kon niet worden opgevraagd." };
  }
}

// ── Bewerk-link in de WordPress-backend voor een pagina-pad ──
// Zoekt het post/pagina-id op via de WP REST API (op slug, het laatste
// pad-deel) en geeft de wp-admin-bewerk-URL terug.
export async function findWpEditUrl(conn: WpConn, path: string): Promise<string | null> {
  const seg = (path || "").replace(/\/+$/, "").split("/").pop() || "";
  if (!seg) {
    // De homepage heeft geen slug; open dan het pagina-overzicht.
    return `${conn.url}/wp-admin/edit.php?post_type=page`;
  }
  for (const type of ["pages", "posts"]) {
    try {
      const res = await fetch(`${conn.url}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(seg)}&_fields=id,link&per_page=10`, {
        headers: { Authorization: authHeader(conn), "User-Agent": "Mozilla/5.0 PingwinBot" }, cache: "no-store",
      });
      if (!res.ok) continue;
      const items = await res.json().catch(() => []) as { id: number; link?: string }[];
      // Bij meerdere treffers op dezelfde slug: die waarvan de link het hele pad bevat.
      const hit = items.find((it) => (it.link || "").includes(path.replace(/\/+$/, ""))) || items[0];
      if (hit?.id) return `${conn.url}/wp-admin/post.php?post=${hit.id}&action=edit`;
    } catch { /* probeer het volgende type */ }
  }
  return null;
}

// ── Status per tabel-rij (uitgevoerd/afgewezen/doorgezet/als taak ingepland) ──
export type CanniRowStatus = "uitgevoerd" | "afgewezen" | "doorgezet" | "taak";

export type CanniRowInfo = { status: CanniRowStatus; reason: string };

export async function getCanniRowStatuses(slug: string, pageUrl: string): Promise<Record<string, CanniRowInfo>> {
  await ensureSchema();
  const { rows } = await sql`SELECT row_path, status, reason FROM page_canni_rows WHERE slug = ${slug} AND page_url = ${pageUrl}`;
  const out: Record<string, CanniRowInfo> = {};
  for (const r of rows) if (r.status === "uitgevoerd" || r.status === "afgewezen" || r.status === "doorgezet" || r.status === "taak") out[String(r.row_path)] = { status: r.status, reason: String(r.reason || "") };
  return out;
}

export async function setCanniRowStatus(slug: string, pageUrl: string, rowPath: string, status: CanniRowStatus | null, reason = ""): Promise<void> {
  await ensureSchema();
  if (!status) { await sql`DELETE FROM page_canni_rows WHERE slug = ${slug} AND page_url = ${pageUrl} AND row_path = ${rowPath}`; return; }
  await sql`
    INSERT INTO page_canni_rows (slug, page_url, row_path, status, reason)
    VALUES (${slug}, ${pageUrl}, ${rowPath}, ${status}, ${reason || null})
    ON CONFLICT (slug, page_url, row_path)
    DO UPDATE SET status = ${status}, reason = ${reason || null}, updated_at = now()`;
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
  // Een gezette redirect is uitgevoerd werk voor de klant: oude adressen blijven
  // werken en er gaan geen bezoekers verloren.
  await logActiviteit({
    slug, soort: "redirect", bron: "page_redirects", bronId: `${pageUrl}|${fromPath}`,
    url: pageUrl, intern: `Redirect ${fromPath} → ${toPath}`,
  });
}
