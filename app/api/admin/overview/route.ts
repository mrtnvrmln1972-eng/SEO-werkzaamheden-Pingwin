import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { buildOverview } from "../../../../lib/overview";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Site-breed overzicht per klant: werkstatus-telling + laaghangend fruit.
// Leunt op de bestaande 12u-cache (gsc_opps); ?fresh=1 forceert verse GSC-data.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const overview = await buildOverview(slug, { fresh });
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ ok: false, error: "Overzicht kon niet worden opgebouwd." }, { status: 500 });
  }
}
