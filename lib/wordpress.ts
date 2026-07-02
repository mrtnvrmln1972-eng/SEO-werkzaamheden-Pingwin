// ═══════════════════════════════════════════════════════════
// WORDPRESS REST API: wijzigingen per pagina ophalen
// ═══════════════════════════════════════════════════════════
// Twee niveaus:
// 1. PUBLIEK (geen inlog): /wp-json/wp/v2/pages + /posts geeft per pagina de
//    permalink en "modified"-datum (de LAATSTE wijziging, wanneer).
// 2. GEAUTHENTICEERD (application password): per pagina de revisions
//    (/wp-json/wp/v2/<type>/<id>/revisions), de volledige historie van
//    bewerkingen met datum, auteur en inhoud, zodat we "wat is wanneer
//    veranderd" kunnen tonen.
// Een application password maak je in WordPress-beheer aan (Gebruikers → je
// profiel → Wachtwoorden voor applicaties). We sturen het alleen server-side mee.
// ═══════════════════════════════════════════════════════════

export type WpAuth = { user: string; appPassword: string } | null;
export type WpPage = { id: number; type: "pages" | "posts"; url: string; modified: string; title: string };
export type WpModified = { url: string; modified: string; title: string };
export type WpRevision = { modified: string; title: string; text: string; author: number };

export function baseFromDomain(domain: string): string {
  const d = (domain || "").trim();
  if (!d) return "";
  return d.startsWith("http") ? d.replace(/\/$/, "") : `https://${d.replace(/^www\./, "").replace(/\/$/, "")}`;
}

function authHeaders(auth: WpAuth): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "Mozilla/5.0 PingwinBot", Accept: "application/json" };
  if (auth && auth.user && auth.appPassword) {
    // Application passwords mogen zonder spaties; Basic auth = base64(user:pass).
    const token = Buffer.from(`${auth.user}:${auth.appPassword.replace(/\s+/g, "")}`).toString("base64");
    h.Authorization = `Basic ${token}`;
  }
  return h;
}

const stripTags = (s: string) => (s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function toIso(mod: string): string { return mod.endsWith("Z") || /[+-]\d\d:\d\d$/.test(mod) ? mod : mod + "Z"; }

// Lijst pagina's of posts (met id), gepagineerd. Auth optioneel (niet nodig voor
// gepubliceerde content, maar schaadt niet).
async function fetchType(base: string, type: "pages" | "posts", maxPages: number, auth: WpAuth): Promise<WpPage[]> {
  const out: WpPage[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=id,link,modified,modified_gmt,title`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: authHeaders(auth) });
      if (!res.ok) break;
      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      for (const item of data as Record<string, unknown>[]) {
        const link = typeof item.link === "string" ? item.link : "";
        const id = Number(item.id);
        const modGmt = typeof item.modified_gmt === "string" ? item.modified_gmt : (typeof item.modified === "string" ? item.modified : "");
        const titleObj = item.title as { rendered?: string } | undefined;
        const title = titleObj?.rendered ? stripTags(titleObj.rendered) : "";
        if (!link || !modGmt || !id) continue;
        out.push({ id, type, url: link, modified: toIso(modGmt), title });
      }
      const totalPages = Number(res.headers.get("X-WP-TotalPages") || "0");
      if (totalPages && page >= totalPages) break;
      if ((data as unknown[]).length < 100) break;
    } catch { break; } finally { clearTimeout(t); }
  }
  return out;
}

// Alle pagina's + posts met id (voor de revisions-stap).
export async function fetchWordpressPages(domain: string, auth: WpAuth): Promise<WpPage[]> {
  const base = baseFromDomain(domain);
  if (!base) return [];
  const [pages, posts] = await Promise.all([fetchType(base, "pages", 6, auth), fetchType(base, "posts", 4, auth)]);
  return [...pages, ...posts];
}

// Alleen de laatste wijzigingsdatum per URL (publiek pad, ontdubbeld).
export async function fetchWordpressModified(domain: string): Promise<WpModified[]> {
  const all = await fetchWordpressPages(domain, null);
  const byUrl = new Map<string, WpModified>();
  for (const w of all) {
    const key = w.url.replace(/\/$/, "");
    const cur = byUrl.get(key);
    if (!cur || w.modified > cur.modified) byUrl.set(key, { url: w.url, modified: w.modified, title: w.title });
  }
  return [...byUrl.values()];
}

// De revisions (bewerkingshistorie) van één pagina, oplopend op datum.
export async function fetchWordpressRevisions(domain: string, type: "pages" | "posts", id: number, auth: WpAuth): Promise<WpRevision[]> {
  const base = baseFromDomain(domain);
  if (!base || !auth) return [];
  const url = `${base}/wp-json/wp/v2/${type}/${id}/revisions?per_page=50&_fields=modified_gmt,modified,title,content,author`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: authHeaders(auth) });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    const revs = (data as Record<string, unknown>[]).map((r) => {
      const modGmt = typeof r.modified_gmt === "string" ? r.modified_gmt : (typeof r.modified === "string" ? r.modified : "");
      const titleObj = r.title as { rendered?: string } | undefined;
      const contentObj = r.content as { rendered?: string } | undefined;
      return { modified: modGmt ? toIso(modGmt) : "", title: titleObj?.rendered ? stripTags(titleObj.rendered) : "", text: contentObj?.rendered ? stripTags(contentObj.rendered) : "", author: Number(r.author) || 0 };
    }).filter((r) => r.modified);
    revs.sort((a, b) => a.modified.localeCompare(b.modified));
    return revs;
  } catch { return []; } finally { clearTimeout(t); }
}

// Test of de opgegeven inloggegevens werken (haalt 1 pagina op met auth).
export async function testWordpressAuth(domain: string, auth: WpAuth): Promise<{ ok: boolean; error?: string }> {
  const base = baseFromDomain(domain);
  if (!base) return { ok: false, error: "Geen domein." };
  if (!auth) return { ok: false, error: "Geen inloggegevens." };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/users/me?_fields=id,name`, { headers: authHeaders(auth) });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Inloggegevens afgewezen (controleer gebruikersnaam en applicatiewachtwoord)." };
    return { ok: false, error: `WordPress gaf status ${res.status}.` };
  } catch { return { ok: false, error: "WordPress niet bereikbaar." }; } finally { clearTimeout(t); }
}

// Licht verschil tussen twee revisie-versies (voor "wat veranderde").
export function revisionDiffSummary(prev: WpRevision | null, cur: WpRevision): string {
  if (!prev) return "Eerste vastgelegde versie";
  const parts: string[] = [];
  if (prev.title !== cur.title) parts.push(`titel gewijzigd`);
  const pw = prev.text ? prev.text.split(/\s+/).filter(Boolean).length : 0;
  const cw = cur.text ? cur.text.split(/\s+/).filter(Boolean).length : 0;
  const delta = cw - pw;
  if (delta !== 0) parts.push(`${delta > 0 ? "+" : ""}${delta} woorden`);
  else if (prev.text !== cur.text) parts.push("tekst aangepast");
  return parts.length ? parts.join(", ") : "kleine aanpassing";
}
