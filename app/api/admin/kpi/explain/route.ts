import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { anthropicConfigured, callClaude, LIGHT_MODEL } from "../../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

type Page = { url: string; clicks: number; prevClicks: number; impressions: number; prevImpressions: number };
type Kw = { keyword: string; clicks: number; prevClicks: number; impressions: number; prevImpressions: number; ctr: number; prevCtr: number; position: number; prevPosition: number | null };

const LABEL: Record<string, string> = { clicks: "klikken", impressions: "vertoningen", ctr: "click-through rate (CTR)", position: "gemiddelde positie" };
const nl = (n: number) => Math.round(n).toLocaleString("nl-NL");

// Bouwt een compacte databeschrijving: totalen + de grootste stijgers/dalers per
// pagina en per zoekwoord voor de gevraagde metric, zodat Claude de verklaring
// baseert op echte cijfers en niets verzint.
function buildData(metric: string, totals: { cur: number; prev: number }, pages: Page[], kws: Kw[]): string {
  const pageDelta = (p: Page) => metric === "impressions" ? p.impressions - p.prevImpressions : p.clicks - p.prevClicks;
  const kwDelta = (k: Kw) => {
    if (metric === "impressions") return k.impressions - k.prevImpressions;
    if (metric === "ctr") return k.ctr - k.prevCtr;
    if (metric === "position") return (k.prevPosition ?? k.position) - k.position; // + = verbeterd
    return k.clicks - k.prevClicks;
  };
  const topPages = [...pages].sort((a, b) => pageDelta(b) - pageDelta(a));
  const risePages = topPages.filter((p) => pageDelta(p) > 0).slice(0, 6);
  const fallPages = topPages.filter((p) => pageDelta(p) < 0).slice(-6).reverse();
  const topKw = [...kws].sort((a, b) => kwDelta(b) - kwDelta(a));
  const riseKw = topKw.filter((k) => kwDelta(k) > 0).slice(0, 8);
  const fallKw = topKw.filter((k) => kwDelta(k) < 0).slice(-8).reverse();

  const pgLine = (p: Page) => `${p.url} | klikken ${nl(p.prevClicks)}→${nl(p.clicks)} | vertoningen ${nl(p.prevImpressions)}→${nl(p.impressions)}`;
  const kwLine = (k: Kw) => `${k.keyword} | klikken ${nl(k.prevClicks)}→${nl(k.clicks)} | vertoningen ${nl(k.prevImpressions)}→${nl(k.impressions)} | CTR ${k.prevCtr.toFixed(1)}%→${k.ctr.toFixed(1)}% | positie ${k.prevPosition ?? "?"}→${k.position}`;

  return [
    `METRIC: ${LABEL[metric] || metric}`,
    `TOTAAL deze periode vs vorige: ${metric === "ctr" ? `${totals.prev.toFixed(1)}% → ${totals.cur.toFixed(1)}%` : metric === "position" ? `${totals.prev} → ${totals.cur}` : `${nl(totals.prev)} → ${nl(totals.cur)}`}`,
    ``,
    `PAGINA'S DIE STEGEN:`, ...(risePages.length ? risePages.map(pgLine) : ["(geen)"]),
    ``,
    `PAGINA'S DIE DAALDEN:`, ...(fallPages.length ? fallPages.map(pgLine) : ["(geen)"]),
    ``,
    `ZOEKWOORDEN DIE STEGEN:`, ...(riseKw.length ? riseKw.map(kwLine) : ["(geen)"]),
    ``,
    `ZOEKWOORDEN DIE DAALDEN:`, ...(fallKw.length ? fallKw.map(kwLine) : ["(geen)"]),
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
    if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug || "").trim();
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;
    const metric = String(body.metric || "").trim();
    if (!slug || !LABEL[metric]) return NextResponse.json({ ok: false, error: "Klant en geldige metric verplicht." }, { status: 400 });
    const days = Number(body.days) || 28;
    const totals = { cur: Number(body.totals?.cur) || 0, prev: Number(body.totals?.prev) || 0 };
    const pages: Page[] = Array.isArray(body.pages) ? body.pages.slice(0, 50) : [];
    const kws: Kw[] = Array.isArray(body.keywords) ? body.keywords.slice(0, 80) : [];

    const richting = metric === "position"
      ? (totals.cur < totals.prev ? "verbeterd (lager = beter)" : totals.cur > totals.prev ? "verslechterd (hoger = slechter)" : "gelijk gebleven")
      : (totals.cur > totals.prev ? "gestegen" : totals.cur < totals.prev ? "gedaald" : "gelijk gebleven");

    const system = `Je bent een SEO-analist bij bureau Pingwin. Verklaar KORT en concreet, in gewone taal (geen jargon), waarom de ${LABEL[metric]} over de laatste ${days} dagen is ${richting} ten opzichte van de vorige periode. Baseer je UITSLUITEND op de meegegeven data; verzin niets.
Benoem de 2 tot 4 pagina's of zoekwoorden die het meest bijdragen aan de verandering, met hun cijfers. Wijs waar mogelijk op laaghangend fruit (veel vertoningen maar weinig klikken of net buiten de top-10) en op pagina's/zoekwoorden die het juist goed doen.
Sluit af met 1 korte, praktische aanbeveling.
OPMAAK: schoon en compact. Gebruik korte bulletpunten en hooguit een enkel vetgedrukt kopje. Geen tabellen, geen emoji, geen ruwe opsomming van alle data. Maximaal ~150 woorden.`;
    const user = `Hier is de data (alleen cijfers, geen conclusies):\n\n${buildData(metric, totals, pages, kws)}`;

    const markdown = await callClaude(system, [{ role: "user", content: user }], 900, { slug, action: "kpi_toelichting" }, LIGHT_MODEL);
    return NextResponse.json({ ok: true, markdown: markdown.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon de toelichting niet maken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }
}
