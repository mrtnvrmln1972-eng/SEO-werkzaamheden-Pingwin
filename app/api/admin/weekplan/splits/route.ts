import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { splitsTaak } from "../../../../../lib/taak-splitsen";

export const runtime = "nodejs";

// Eén kaart in tweeën knippen: er komt een tweede kaart naast, en de documenten
// die je aanwijst verhuizen mee. Zie lib/taak-splitsen.ts voor het waarom.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const uit = await splitsTaak({
    slug,
    taakId: Number(body.taakId || 0),
    titel: String(body.titel || ""),
    versieIds: Array.isArray(body.versieIds) ? body.versieIds.map((n) => Number(n)) : [],
  });
  if (!uit.ok) return NextResponse.json(uit, { status: 400 });
  return NextResponse.json(uit);
}
