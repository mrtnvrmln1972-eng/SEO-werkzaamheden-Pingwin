import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getOpruimToken, getOrCreateOpruimToken, regenerateOpruimToken, trekOpruimTokenIn } from "../../../../lib/opruim-deel";

export const runtime = "nodejs";

// De deellink van het opruimscherm: aanmaken, opnieuw maken, intrekken.
function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}
const url = (req: NextRequest, token: string) => `${req.nextUrl.origin}/share/opruim/${token}`;

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const t = await getOpruimToken(slug);
  return NextResponse.json({ ok: true, url: t ? url(req, t) : "" });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string; actie?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (body.actie === "intrekken") { await trekOpruimTokenIn(slug); return NextResponse.json({ ok: true, url: "" }); }
  const t = body.actie === "vernieuwen" ? await regenerateOpruimToken(slug) : await getOrCreateOpruimToken(slug);
  return NextResponse.json({ ok: true, url: url(req, t) });
}
