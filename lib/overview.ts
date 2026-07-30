// ═══════════════════════════════════════════════════════════
// OVERZICHT-LAAG: de site-brede "bird's eye" per klant
// ═══════════════════════════════════════════════════════════
// Bundelt bestaande signalen tot één compact beeld: waar staan we (hoeveel
// pagina's hebben een plan, hoeveel zijn nog leeg), en waar zit het laaghangend
// fruit (striking distance + CTR-onderkans + keyword-gaten). Geen nieuwe zware
// berekening: leunt op dezelfde 12u-cache als de Pagina's- en Meta-tab.
// Dit bestand is de ENE bron voor zowel het overzicht-endpoint als de
// bird's eye-chatcontext (DRY).

import { sql } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { getGscPageOpportunities } from "./google";
import { cacheGet, cacheSet } from "./ahrefs";
import { getMetaKansen } from "./meta-ctr";
import { getOpportunities } from "./keyword-opportunities";

const norm = (u: string) => (u || "").trim().replace(/\/+$/, "");

// Zelfde kansscore als de Pagina's-tab (app/api/admin/page-opportunities/route.ts),
// hier hergebruikt zodat "laaghangend fruit" overal consistent is.
function opportunity(impressions: number, position: number | null): { score: number; label: string; level: "high" | "mid" | "low" | "none" } {
  if (!impressions || position == null) return { score: 0, label: "", level: "none" };
  if (position >= 11 && position <= 20) return { score: impressions * (21 - position), label: "Grote kans", level: "high" };
  if (position >= 4 && position <= 10) return { score: impressions * 4, label: "Quick win", level: "mid" };
  if (position > 20 && position <= 40) return { score: impressions * 0.15, label: "Op termijn", level: "low" };
  return { score: 0, label: "", level: "none" };
}

export type OverviewStatus = {
  totaal: number;        // aantal pagina's in de spiegel
  leeg: number;          // geen plan, geen cluster-advies (onbewerkt)
  halfPlan: number;      // kreeg cluster-advies mee (vertrekpunt)
  heeftPlan: number;     // vastgelegde strategie aanwezig
  docsAnalyse: number;   // pagina's met een analyse-document
  docsBlauwdruk: number; // pagina's met een blauwdruk-document
  docsCopy: number;      // pagina's met copy-document
  kapot: number;         // pagina's met een 4xx/5xx-status
  klikken: number;       // som GSC-klikken over alle pagina's
  vertoningen: number;   // som GSC-vertoningen over alle pagina's
};
export type OverviewFruit = { url: string; bestKeyword: string; position: number; impressions: number; clicks: number; volume: number | null; score: number; label: string; level: string };
export type OverviewCtr = { url: string; keyword: string; extraClicks: number; ctr: number; position: number };
export type OverviewGat = { keyword: string; volume: number | null; difficulty: number | null; reason: string };

export type Overview = {
  ok: true;
  hasDomain: boolean;
  status: OverviewStatus;
  fruit: OverviewFruit[];
  ctr: OverviewCtr[];
  gaten: OverviewGat[];
  updatedAt: string;
};

// Telt per keten-stap hoeveel pagina's al een document hebben (één query i.p.v.
// per pagina). Faalt stil naar nullen: het overzicht mag hier nooit op klappen.
async function docCounts(slug: string): Promise<{ analyse: number; blauwdruk: number; copy: number }> {
  try {
    const { rows } = await sql`SELECT kind, COUNT(DISTINCT url) AS n FROM page_doc_outputs WHERE client_slug = ${slug} GROUP BY kind`;
    const m: Record<string, number> = {};
    for (const r of rows) m[String(r.kind)] = Number(r.n) || 0;
    return { analyse: m.analyse || 0, blauwdruk: m.blauwdruk || 0, copy: m.copy || 0 };
  } catch { return { analyse: 0, blauwdruk: 0, copy: 0 }; }
}

// Haalt de (gecachte) GSC-pagina-kansen op; zelfde sleutel en fallback als de
// bestaande Pagina's-tab, zodat we nooit een extra Ahrefs-storm veroorzaken.
async function gscOpps(domain: string, fresh: boolean) {
  type Rows = Awaited<ReturnType<typeof getGscPageOpportunities>>;
  let rows: Rows | null = fresh ? null : await cacheGet<Rows>("gsc_opps", domain, "-", 0.5).catch(() => null);
  if (!rows) {
    rows = domain ? await getGscPageOpportunities(domain, 90).catch(() => []) : [];
    if (rows.length) await cacheSet("gsc_opps", domain, "-", rows).catch(() => {});
  }
  return rows;
}

export async function buildOverview(slug: string, opts: { fresh?: boolean } = {}): Promise<Overview> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";

  const [urls, oppRows, ctrRows, gaten, docs] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    gscOpps(domain, !!opts.fresh),
    getMetaKansen(slug).catch(() => []),
    getOpportunities(slug).catch(() => []),
    docCounts(slug),
  ]);

  // ── Werkstatus-telling ──
  let leeg = 0, halfPlan = 0, heeftPlan = 0, kapot = 0, klikken = 0, vertoningen = 0;
  for (const u of urls) {
    if ((u.plan || "").trim()) heeftPlan++;
    else if (u.hasClusterAdvice) halfPlan++;
    else leeg++;
    if (u.status != null && u.status >= 400) kapot++;
    klikken += u.gscClicks || 0;
    vertoningen += u.gscImpressions || 0;
  }
  const status: OverviewStatus = {
    totaal: urls.length, leeg, halfPlan, heeftPlan,
    docsAnalyse: docs.analyse, docsBlauwdruk: docs.blauwdruk, docsCopy: docs.copy,
    kapot, klikken, vertoningen,
  };

  // ── Laaghangend fruit (striking distance / quick win) ──
  const fruit: OverviewFruit[] = oppRows
    .map((p) => {
      const o = opportunity(p.impressions, p.position);
      return { url: p.url, bestKeyword: p.bestKeyword, position: p.position, impressions: p.impressions, clicks: p.clicks, volume: p.bestVolume, score: Math.round(o.score), label: o.label, level: o.level };
    })
    .filter((f) => f.level !== "none")
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // ── CTR-onderkans (veel vertoningen, te weinig klikken) ──
  const ctr: OverviewCtr[] = [...ctrRows]
    .sort((a, b) => b.extraClicks - a.extraClicks)
    .slice(0, 5)
    .map((r) => ({ url: r.url, keyword: r.keyword, extraClicks: r.extraClicks, ctr: r.ctr, position: r.position }));

  // ── Keyword-gaten (site rankt hier nog niet op) ──
  const gatenTop: OverviewGat[] = gaten.slice(0, 5).map((g) => ({ keyword: g.keyword, volume: g.volume, difficulty: g.difficulty, reason: g.reason }));

  return { ok: true, hasDomain: !!domain, status, fruit, ctr, gaten: gatenTop, updatedAt: new Date().toISOString() };
}

// Compacte tekstsamenvatting van het overzicht voor de bird's eye-chatcontext.
// (Gebruikt in Fase B; hier alvast zodat er één bron blijft.)
export function overviewToText(o: Overview): string {
  const s = o.status;
  const lines: string[] = [];
  lines.push(`Werkstatus: ${s.totaal} pagina's, waarvan ${s.heeftPlan} met vastgelegde strategie, ${s.halfPlan} met een vertrekpunt (half plan) en ${s.leeg} nog onbewerkt. Documenten gemaakt: ${s.docsAnalyse} analyses, ${s.docsBlauwdruk} blauwdrukken, ${s.docsCopy} copy.${s.kapot ? ` Let op: ${s.kapot} pagina's geven een foutstatus.` : ""}`);
  if (o.fruit.length) {
    lines.push("Laaghangend fruit (striking distance / quick win):");
    for (const f of o.fruit) lines.push(`- ${f.url} · "${f.bestKeyword}" positie ${f.position}, ${f.impressions} vertoningen (${f.label})`);
  }
  if (o.ctr.length) {
    lines.push("CTR-onderkans (veel vertoningen, weinig klikken):");
    for (const c of o.ctr) lines.push(`- ${c.url} · "${c.keyword}" positie ${c.position}, ~${c.extraClicks} gemiste klikken`);
  }
  if (o.gaten.length) {
    lines.push("Keyword-gaten (nog geen ranking):");
    for (const g of o.gaten) lines.push(`- "${g.keyword}"${g.volume != null ? ` (volume ${g.volume})` : ""}`);
  }
  return lines.join("\n");
}
