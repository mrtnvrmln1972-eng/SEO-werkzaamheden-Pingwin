import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getChangeEvents, getChangeEvent } from "../../../../lib/content-tracking";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Lijst met gedetecteerde wijzigingen, of één wijziging (?id=) met de volledige diff.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = req.nextUrl.searchParams.get("id");
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  if (id) {
    const event = await getChangeEvent(slug, Number(id));
    if (!event) return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true, event });
  }
  const events = await getChangeEvents(slug);
  return NextResponse.json({ ok: true, events });
}
