import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscPageOpportunities } from "../../../../lib/google";

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
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: true, pages: {} });

  const rows = await getGscPageOpportunities(domain, 90).catch(() => []);
  const pages: Record<string, { impressions: number; clicks: number; ctr: number; position: number; bestKeyword: string; bestPosition: number | null; bestVolume: number | null; score: number; label: string; level: string }> = {};
  for (const p of rows) {
    const o = opportunity(p.impressions, p.position);
    pages[norm(p.url)] = { impressions: p.impressions, clicks: p.clicks, ctr: p.ctr, position: p.position, bestKeyword: p.bestKeyword, bestPosition: p.bestPosition, bestVolume: p.bestVolume, score: Math.round(o.score), label: o.label, level: o.level };
  }
  return NextResponse.json({ ok: true, pages });
}
