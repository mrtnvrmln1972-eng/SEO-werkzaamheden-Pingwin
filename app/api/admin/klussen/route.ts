import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { lopendeKlussen, getKlussen } from "../../../../lib/klussen";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug=... : wat er nu draait voor deze klant (voor het klusje in de kop).
// GET ?slug=...&alles=1 : ook de afgeronde klussen, voor een scherm dat de
// uitkomst van de laatste keer wil tonen.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const alles = req.nextUrl.searchParams.get("alles") === "1";
  const klussen = alles ? await getKlussen(slug) : await lopendeKlussen(slug);
  return NextResponse.json({ ok: true, klussen });
}
