import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getChangeEvents, getChangeEvent, addManualChange } from "../../../../lib/content-tracking";

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

// Handmatig een bekende (verleden) wijziging vastleggen om de KPI-ontwikkeling te volgen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const date = String(body.date || "").trim();
  const note = String(body.note || "").trim();
  if (!slug || !url || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: "Klant, URL en een geldige datum (JJJJ-MM-DD) zijn verplicht." }, { status: 400 });
  const res = await addManualChange(slug, url, date, note);
  return NextResponse.json(res.ok ? { ok: true } : { ok: false, error: res.error || "Toevoegen mislukt." });
}
