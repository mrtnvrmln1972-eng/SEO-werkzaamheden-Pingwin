// ═══════════════════════════════════════════════════════════
// WORDPRESS REST API: laatst-gewijzigd per pagina ophalen
// ═══════════════════════════════════════════════════════════
// De publieke WordPress REST API (/wp-json/wp/v2/pages en /posts) geeft per
// pagina de permalink en de "modified"-datum: wanneer de pagina voor het laatst
// is aangepast. Geen inloggegevens nodig voor gepubliceerde content. Zo weten we
// welke pagina's we al hebben aangepast en wanneer, en kunnen we dat als
// date-stamped wijziging in de Wijzigingen-tab zetten (met KPI-effect eromheen).
//
// LET OP: de standaard REST API geeft alleen de LAATSTE wijzigingsdatum per
// pagina, niet de volledige historie. Voor de volledige "wat is wanneer
// veranderd" zijn revisions nodig, en die vereisen authenticatie (application
// password). Dat is een latere uitbreiding.
// ═══════════════════════════════════════════════════════════

export type WpModified = { url: string; modified: string; title: string };

function baseFromDomain(domain: string): string {
  const d = (domain || "").trim();
  if (!d) return "";
  return d.startsWith("http") ? d.replace(/\/$/, "") : `https://${d.replace(/^www\./, "").replace(/\/$/, "")}`;
}

async function fetchType(base: string, type: "pages" | "posts", maxPages: number): Promise<WpModified[]> {
  const out: WpModified[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=link,modified,modified_gmt,title`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 PingwinBot", Accept: "application/json" } });
      if (!res.ok) break; // 400 op te hoge page = einde; 404 = geen REST API
      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      for (const item of data as Record<string, unknown>[]) {
        const link = typeof item.link === "string" ? item.link : "";
        const modGmt = typeof item.modified_gmt === "string" ? item.modified_gmt : (typeof item.modified === "string" ? item.modified : "");
        const titleObj = item.title as { rendered?: string } | undefined;
        const title = titleObj?.rendered ? titleObj.rendered.replace(/<[^>]*>/g, "").trim() : "";
        if (!link || !modGmt) continue;
        // modified_gmt heeft geen tijdzone-suffix; als UTC markeren.
        const iso = modGmt.endsWith("Z") || /[+-]\d\d:\d\d$/.test(modGmt) ? modGmt : modGmt + "Z";
        out.push({ url: link, modified: iso, title });
      }
      const totalPages = Number(res.headers.get("X-WP-TotalPages") || "0");
      if (totalPages && page >= totalPages) break;
      if ((data as unknown[]).length < 100) break;
    } catch {
      break; // niet bereikbaar / geen WordPress / timeout
    } finally {
      clearTimeout(t);
    }
  }
  return out;
}

// Haalt pagina's + posts op met hun laatste wijzigingsdatum. Geeft [] terug als
// de site geen (open) WordPress REST API heeft.
export async function fetchWordpressModified(domain: string): Promise<WpModified[]> {
  const base = baseFromDomain(domain);
  if (!base) return [];
  const [pages, posts] = await Promise.all([
    fetchType(base, "pages", 5),
    fetchType(base, "posts", 3),
  ]);
  const byUrl = new Map<string, WpModified>();
  for (const w of [...pages, ...posts]) {
    const key = w.url.replace(/\/$/, "");
    const cur = byUrl.get(key);
    if (!cur || w.modified > cur.modified) byUrl.set(key, w);
  }
  return [...byUrl.values()];
}
