import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { savePageOrder } from "../../../../../lib/kpi-prefs";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Bewaart de handmatige volgorde van Search Console-pagina's per klant.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const urls = Array.isArray(body.urls) ? (body.urls as string[]) : null;
  if (!slug || !urls) return NextResponse.json({ ok: false, error: "Klant en volgorde zijn verplicht." }, { status: 400 });
  const n = await savePageOrder(slug, urls);
  return NextResponse.json({ ok: true, saved: n });
}
