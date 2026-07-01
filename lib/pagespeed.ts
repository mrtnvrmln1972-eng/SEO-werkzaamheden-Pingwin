// Core Web Vitals + Lighthouse SEO via Google PageSpeed Insights API.
// Zelfde bron als de Pingwin-skill: veld-data (CrUX) waar beschikbaar, anders lab.
// Werkt zonder key (lage quota); met PAGESPEED_API_KEY (of GOOGLE_API_KEY) ruimer.

export type CwvMetric = { value: number | null; unit: string; rating: string | null };
export type PageSpeedResult = {
  ok: boolean;
  strategy: string;
  source: "veld" | "lab" | "geen";
  lcp: CwvMetric;   // Largest Contentful Paint
  inp: CwvMetric;   // Interaction to Next Paint
  cls: CwvMetric;   // Cumulative Layout Shift
  ttfb: CwvMetric;  // Time To First Byte
  fcp: CwvMetric;   // First Contentful Paint
  tbt: CwvMetric;   // Total Blocking Time (alleen lab)
  seoScore: number | null;         // Lighthouse SEO 0-100
  perfScore: number | null;        // Lighthouse Performance 0-100
  failedSeoAudits: string[];       // titels van gefaalde/waarschuwende SEO-audits
  error?: string;
};

function empty(unit: string): CwvMetric { return { value: null, unit, rating: null }; }

function ratingFromCategory(cat: string | undefined): string | null {
  if (cat === "FAST") return "goed";
  if (cat === "AVERAGE") return "matig";
  if (cat === "SLOW") return "slecht";
  return null;
}

export async function getPageSpeed(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PageSpeedResult> {
  const base: PageSpeedResult = {
    ok: false, strategy, source: "geen",
    lcp: empty("ms"), inp: empty("ms"), cls: empty(""), ttfb: empty("ms"), fcp: empty("ms"), tbt: empty("ms"),
    seoScore: null, perfScore: null, failedSeoAudits: [],
  };
  const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || "";
  const p = new URLSearchParams({ url, strategy });
  p.append("category", "performance");
  p.append("category", "seo");
  if (key) p.append("key", key);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  let j: Record<string, unknown>;
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${p.toString()}`, { signal: ctrl.signal });
    if (!res.ok) return { ...base, error: `PageSpeed gaf status ${res.status}` };
    j = await res.json();
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "PageSpeed niet bereikbaar" };
  } finally { clearTimeout(t); }

  const out: PageSpeedResult = { ...base, ok: true };

  // Veld-data (CrUX) heeft de voorkeur.
  const field = (j.loadingExperience as { metrics?: Record<string, { percentile?: number; category?: string }> } | undefined)?.metrics;
  if (field && Object.keys(field).length) {
    out.source = "veld";
    const m = (k: string, unit: string): CwvMetric => {
      const x = field[k];
      return x ? { value: typeof x.percentile === "number" ? x.percentile : null, unit, rating: ratingFromCategory(x.category) } : empty(unit);
    };
    out.lcp = m("LARGEST_CONTENTFUL_PAINT_MS", "ms");
    out.inp = m("INTERACTION_TO_NEXT_PAINT", "ms");
    out.cls = m("CUMULATIVE_LAYOUT_SHIFT_SCORE", "");
    if (out.cls.value !== null) out.cls.value = out.cls.value / 100; // CrUX geeft CLS ×100
    out.ttfb = m("EXPERIMENTAL_TIME_TO_FIRST_BYTE", "ms");
    out.fcp = m("FIRST_CONTENTFUL_PAINT_MS", "ms");
  }

  // Lab (Lighthouse) vult aan / valt in.
  const lh = j.lighthouseResult as { categories?: Record<string, { score?: number }>; audits?: Record<string, { numericValue?: number; score?: number | null; title?: string }> } | undefined;
  if (lh?.audits) {
    const a = lh.audits;
    const lab = (k: string, unit: string): CwvMetric => {
      const x = a[k];
      if (!x || typeof x.numericValue !== "number") return empty(unit);
      const rating = typeof x.score === "number" ? (x.score >= 0.9 ? "goed" : x.score >= 0.5 ? "matig" : "slecht") : null;
      return { value: x.numericValue, unit, rating };
    };
    if (out.source !== "veld") out.source = "lab";
    if (out.lcp.value === null) out.lcp = lab("largest-contentful-paint", "ms");
    if (out.cls.value === null) out.cls = lab("cumulative-layout-shift", "");
    if (out.ttfb.value === null) out.ttfb = lab("server-response-time", "ms");
    if (out.fcp.value === null) out.fcp = lab("first-contentful-paint", "ms");
    out.tbt = lab("total-blocking-time", "ms"); // INP-proxy; INP zelf bestaat alleen als veld-data

    // Gefaalde/waarschuwende SEO-audits verzamelen (score < 0.9, met titel).
    const seoAuditRefs = (lh.categories?.seo as { auditRefs?: { id: string }[] } | undefined)?.auditRefs || [];
    for (const ref of seoAuditRefs) {
      const au = a[ref.id];
      if (au && typeof au.score === "number" && au.score < 0.9 && au.title) out.failedSeoAudits.push(au.title);
    }
  }
  if (lh?.categories) {
    if (typeof lh.categories.seo?.score === "number") out.seoScore = Math.round(lh.categories.seo.score * 100);
    if (typeof lh.categories.performance?.score === "number") out.perfScore = Math.round(lh.categories.performance.score * 100);
  }
  return out;
}

// Compacte, mensleesbare samenvatting voor in de grounding-prompt.
export function pageSpeedToText(r: PageSpeedResult): string {
  if (!r.ok) return `Core Web Vitals: niet gemeten (${r.error || "geen data"}).`;
  const fmtMs = (m: CwvMetric) => m.value === null ? "n/b" : `${Math.round(m.value)}${m.unit}${m.rating ? ` (${m.rating})` : ""}`;
  const fmtN = (m: CwvMetric) => m.value === null ? "n/b" : `${m.value.toFixed(2)}${m.rating ? ` (${m.rating})` : ""}`;
  const lines = [
    `Core Web Vitals (${r.source}-data, ${r.strategy}):`,
    `- LCP: ${fmtMs(r.lcp)} (norm <=2500ms)`,
    `- INP: ${fmtMs(r.inp)} (norm <=200ms${r.inp.value === null ? "; alleen als veld-data beschikbaar" : ""})`,
    `- CLS: ${fmtN(r.cls)} (norm <=0.1)`,
    `- TTFB: ${fmtMs(r.ttfb)} (norm <=600ms)`,
    `- FCP: ${fmtMs(r.fcp)}`,
    `- TBT: ${fmtMs(r.tbt)} (INP-proxy uit lab)`,
    r.perfScore !== null ? `- Lighthouse performance-score: ${r.perfScore}/100` : "",
    r.seoScore !== null ? `- Lighthouse SEO-score: ${r.seoScore}/100` : "",
    r.failedSeoAudits.length ? `- Aandachtspunten SEO-audit: ${r.failedSeoAudits.slice(0, 12).join("; ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
