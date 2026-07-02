import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscComparison, getGa4Comparison } from "../../../../lib/google";
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
  const days = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get("days")) || 28));
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const domain = client.domain || "";
  const [gsc, ga4, pageOrder, keywordFocus] = await Promise.all([
    withTimeout(getGscComparison(domain, days), 9000, null),
    withTimeout(getGa4Comparison(slug, domain, days), 9000, null),
    getPageOrder(slug).catch(() => [] as string[]),
    getKeywordFocus(slug).catch(() => ({})),
  ]);

  return NextResponse.json({ ok: true, days, domain, gsc, ga4, pageOrder, keywordFocus });
}
