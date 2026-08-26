import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { getGscDailyForSite, getGscKeywordsBeforeAfterSite, equalBeforeAfter, googleStatus } from "../../../../../lib/google";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Sitebreed effect van een taak zonder eigen pagina (bijv. "startdata toevoegen"):
// zelfde vorm als /api/admin/changes/kpi, maar zonder paginafilter. "sinds" is de
// datum die aan de taak hangt, niet een opgeslagen wijzigingsmoment: GSC bewaart
// zelf de geschiedenis, dus dit hoeft nergens vastgelegd te worden.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const sinds = req.nextUrl.searchParams.get("sinds") || "";
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(sinds)) {
    return NextResponse.json({ ok: false, error: "Klant en een geldige datum (JJJJ-MM-DD) zijn verplicht." }, { status: 400 });
  }
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: true, changeDate: sinds, daily: [], keywords: [], note: "Geen domein bij deze klant." });

  const day = 86400000;
  const winDays = Math.max(7, Math.min(120, Number(req.nextUrl.searchParams.get("days")) || 28));
  const floor = Date.now() - 480 * day;
  const startDate = new Date(Math.max(new Date(sinds + "T00:00:00Z").getTime() - winDays * day, floor)).toISOString().slice(0, 10);
  const endDate = new Date(Math.min(new Date(sinds + "T00:00:00Z").getTime() + winDays * day, Date.now() - 3 * day)).toISOString().slice(0, 10);

  const [daily, keywordsRaw, gStatus] = await Promise.all([
    getGscDailyForSite(domain, startDate, endDate).catch(() => []),
    getGscKeywordsBeforeAfterSite(domain, sinds, winDays).catch(() => []),
    googleStatus().catch(() => null),
  ]);

  const compare = equalBeforeAfter(sinds, winDays);
  const gscConnected = gStatus ? gStatus.connected : true;
  return NextResponse.json({ ok: true, changeDate: sinds, daily, keywords: keywordsRaw, ga4: null, moments: [{ id: 0, date: sinds }], compare, gscConnected });
}
