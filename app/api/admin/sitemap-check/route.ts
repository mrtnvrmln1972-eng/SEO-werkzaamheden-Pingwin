import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sitemapCheck } from "../../../../lib/sitemap-check";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// GET: de sitemap van de klant vers ophalen en naast de spiegel leggen.
// Bewust een GET zonder bijwerkingen: de meekijk-sessie (alleen-lezen) kan de
// controle dus ook gewoon zien draaien.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;
  const uitkomst = await sitemapCheck(slug);
  return NextResponse.json(uitkomst, { status: uitkomst.ok ? 200 : 400 });
}
