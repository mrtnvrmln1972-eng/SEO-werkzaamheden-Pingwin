import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscComparison, getGa4Comparison, getAdsComparison } from "../../../../lib/google";
import { getPageOrder } from "../../../../lib/kpi-prefs";
import { getKeywordFocus } from "../../../../lib/keyword-focus";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

// Live Search Console + Analytics voor een gekozen periode, met de vorige
// periode erbij zodat de KPI-tab de ontwikkeling (deltas) kan tonen.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const days = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get("days")) || 28));
  const compare = req.nextUrl.searchParams.get("compare") === "yoy" ? "yoy" : "prev";
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const domain = client.domain || "";

  // Per-sectie verversen: met ?section=gsc|ga4|ads komt alleen dat deel terug,
  // zodat een periode-wissel in één sectiekop niet de hele tab herlaadt.
  const section = req.nextUrl.searchParams.get("section") || "";
  if (section === "gsc") {
    const gsc = await withTimeout(getGscComparison(domain, days, compare), 9000, null);
    return NextResponse.json({ ok: true, days, gsc });
  }
  if (section === "ga4") {
    const ga4 = await withTimeout(getGa4Comparison(slug, domain, days, compare), 12000, null);
    return NextResponse.json({ ok: true, days, ga4 });
  }
  if (section === "ads") {
    const ads = await withTimeout(getAdsComparison(slug, domain, days, compare), 12000, null);
    return NextResponse.json({ ok: true, days, ads });
  }

  const [gsc, ga4, ads, pageOrder, keywordFocus] = await Promise.all([
    withTimeout(getGscComparison(domain, days, compare), 9000, null),
    withTimeout(getGa4Comparison(slug, domain, days, compare), 12000, null),
    withTimeout(getAdsComparison(slug, domain, days, compare), 12000, null),
    getPageOrder(slug).catch(() => [] as string[]),
    getKeywordFocus(slug).catch(() => ({})),
  ]);

  return NextResponse.json({ ok: true, days, domain, gsc, ga4, ads, pageOrder, keywordFocus });
}
