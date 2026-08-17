import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getOppakStand } from "../../../../lib/oppak-stand";

export const runtime = "nodejs";

// Leest alleen wat er al ligt: wanneer "Wat we nu oppakken" voor het laatst
// veranderde, en wat er daarna nog is vastgelegd. Geen motor, geen model.

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    return NextResponse.json({ ok: true, ...(await getOppakStand(slug)) });
  } catch {
    // Een ontbrekend seintje mag het blok nooit onbruikbaar maken.
    return NextResponse.json({ ok: true, bijgewerkt: null, nieuwer: [] });
  }
}
