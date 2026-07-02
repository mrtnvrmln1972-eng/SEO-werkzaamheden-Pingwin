import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getMonthLinkbuilding, setMonthLinkbuilding } from "../../../../lib/month-linkbuilding";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Linkbuilding-overrides per maand van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  return NextResponse.json({ ok: true, months: await getMonthLinkbuilding(slug) });
}

// Linkbuilding voor één maand zetten (euro's).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const month = String(body.month || "").trim();
  if (!slug || !month) return NextResponse.json({ ok: false, error: "Klant en maand verplicht." }, { status: 400 });
  await setMonthLinkbuilding(slug, month, Number(body.linkbuilding) || 0);
  return NextResponse.json({ ok: true });
}
