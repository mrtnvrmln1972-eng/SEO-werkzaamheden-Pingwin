import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getOpruimRegels, zetOpruimRegel } from "../../../../lib/opruim-regels";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De besluiten van Maarten per regel in de opruimlijst: houden, ander doel,
// negeren, of afgevinkt als doorgevoerd. Ze worden bewaard en gaan mee als
// harde regel naar de volgende analyse.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  return NextResponse.json({ ok: true, regels: await getOpruimRegels(slug) });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const van = String(body.van || "").trim();
  if (!slug || !van) return NextResponse.json({ ok: false, error: "Klant en pad zijn verplicht." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof body.besluit === "string") patch.besluit = body.besluit;
  if (typeof body.naar === "string") patch.naar = body.naar;
  if (typeof body.notitie === "string") patch.notitie = body.notitie;
  if (typeof body.doorgevoerd === "boolean") patch.doorgevoerd = body.doorgevoerd;
  await zetOpruimRegel(slug, van, patch as never);
  return NextResponse.json({ ok: true });
}
