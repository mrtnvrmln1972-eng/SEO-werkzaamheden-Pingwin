import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { getChangeEvent } from "../../../../../lib/content-tracking";
import { getClientBySlug } from "../../../../../lib/clients";
import { getGscDailyForPage, getGscKeywordsBeforeAfter } from "../../../../../lib/google";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// KPI-impact van één wijziging: GSC-daglijnen (kliks/positie/vertoningen/CTR)
// en keyword-rankings, 60 dagen voor en na het wijzigingsmoment.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || "");
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en id verplicht." }, { status: 400 });

  const event = await getChangeEvent(slug, id);
  if (!event) return NextResponse.json({ ok: false, error: "Wijziging niet gevonden." }, { status: 404 });
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: true, changeDate: event.detectedAt.slice(0, 10), daily: [], keywords: [], note: "Geen domein bij deze klant." });

  const changeDate = event.detectedAt.slice(0, 10);
  const day = 86400000;
  const c = new Date(changeDate + "T00:00:00Z").getTime();
  const startDate = new Date(c - 60 * day).toISOString().slice(0, 10);
  const endDate = new Date(Math.min(c + 60 * day, Date.now() - 3 * day)).toISOString().slice(0, 10);

  const [daily, keywords] = await Promise.all([
    getGscDailyForPage(domain, event.url, startDate, endDate).catch(() => []),
    getGscKeywordsBeforeAfter(domain, event.url, changeDate, 60).catch(() => []),
  ]);

  return NextResponse.json({ ok: true, changeDate, daily, keywords });
}
