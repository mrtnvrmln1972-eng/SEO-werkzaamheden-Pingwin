import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { paginaStructuur } from "../../../../lib/opruim-structuur";

export const runtime = "nodejs";
export const maxDuration = 300;

// Het structuuroverzicht. De berekening zelf staat in lib/opruim-structuur.ts,
// zodat de publieke deelpagina exact hetzelfde toont.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });

  const client = await getClientBySlug(slug);
  return NextResponse.json({ ok: true, ...(await paginaStructuur(slug, client?.domain || "")) });
}
