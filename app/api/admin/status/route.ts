import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { updateStatusItem } from "../../../../lib/snapshots";

export const runtime = "nodejs";

// Eén punt in de stand van zaken op afgehandeld/open zetten.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const index = Number(body.index);
  const status = body.status === "done" ? "done" : "open";
  if (!slug || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ ok: false, error: "Ongeldige gegevens." }, { status: 400 });
  }
  const ok = await updateStatusItem(slug, index, status);
  return NextResponse.json({ ok });
}
