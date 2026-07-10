import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscPageOpportunities } from "../../../../lib/google";
import { cacheGet, cacheSet } from "../../../../lib/ahrefs";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Kansscore per pagina: veel vertoningen + positie net buiten de top 10 = grote kans
// (striking distance). Positie 4-10 = quick win (top 10, CTR/positie verbeteren).
function opportunity(impressions: number, position: number | null): { score: number; label: string; level: "high" | "mid" | "low" | "none" } {
  if (!impressions || position == null) return { score: 0, label: "", level: "none" };
  if (position >= 11 && position <= 20) return { score: impressions * (21 - position), label: "Grote kans", level: "high" };
  if (position >= 4 && position <= 10) return { score: impressions * 4, label: "Quick win", level: "mid" };
  if (position > 20 && position <= 40) return { score: impressions * 0.15, label: "Op termijn", level: "low" };
  return { score: 0, label: "", level: "none" };
}

const norm = (u: string) => (u || "").trim().replace(/\/+$/, "");

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: true, pages: {} });

  // Zware berekening (twee GSC-rapporten + Ahrefs-volumes) 12 uur cachen:
  // Search Console ververst toch maar één keer per dag, en zonder cache wacht
  // de Pagina's-tab bij elk bezoek seconden op deze data. ?fresh=1 forceert.
  type Rows = Awaited<ReturnType<typeof getGscPageOpportunities>>;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  let rows: Rows | null = fresh ? null : await cacheGet<Rows>("gsc_opps", domain, "-", 0.5).catch(() => null);
  if (!rows) {
    rows = await getGscPageOpportunities(domain, 90).catch(() => []);
    if (rows.length) await cacheSet("gsc_opps", domain, "-", rows).catch(() => {});
  }
  const pages: Record<string, { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string }> = {};
  for (const p of rows) {
    const o = opportunity(p.impressions, p.position);
    pages[norm(p.url)] = { impressions: p.impressions, clicks: p.clicks, ctr: p.ctr, position: p.position, bestKeyword: p.bestKeyword, bestPosition: p.bestPosition, bestVolume: p.bestVolume, score: Math.round(o.score), label: o.label, level: o.level };
  }
  return NextResponse.json({ ok: true, pages });
}
