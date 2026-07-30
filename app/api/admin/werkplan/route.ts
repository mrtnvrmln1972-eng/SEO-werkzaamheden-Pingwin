import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { buildWerkplan } from "../../../../lib/overview";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Het visuele werkplan per klant: pagina's gegroepeerd in bezig / gepland / gedaan,
// afgeleid uit de werkstatus + het laaghangend fruit (gecachte data).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const werkplan = await buildWerkplan(slug, { fresh });
    return NextResponse.json({ ok: true, ...werkplan });
  } catch {
    return NextResponse.json({ ok: false, error: "Werkplan kon niet worden opgebouwd." }, { status: 500 });
  }
}
