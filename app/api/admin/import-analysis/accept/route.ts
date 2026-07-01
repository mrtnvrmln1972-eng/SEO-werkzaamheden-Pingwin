import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { acceptItems, type ImportItem } from "../../../../../lib/analysis-import";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Accepteert de geselecteerde voorstellen: plan-alinea's + taken aanmaken en
// de analyse bevriezen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const cluster = String(body.cluster || "").trim();
  const source = String(body.source || "").trim();
  const items = Array.isArray(body.items) ? (body.items as ImportItem[]) : null;
  const snapshot = body.snapshot ?? items;
  if (!slug || !items) return NextResponse.json({ ok: false, error: "Klant en items zijn verplicht." }, { status: 400 });
  const res = await acceptItems(slug, cluster, items, source, snapshot);
  return NextResponse.json({ ok: true, ...res });
}
