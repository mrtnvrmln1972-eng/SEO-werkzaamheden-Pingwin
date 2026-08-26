import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWerkplanBudget, zetWerkplanBudget } from "../../../../lib/werkplan-budget";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: het ingestelde urenbudget per week voor de werkplanning-proef.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, budget: await getWerkplanBudget(slug) });
}

// POST: het urenbudget per week wijzigen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const urenPerWeek = Number(body.urenPerWeek);
  if (!slug || !Number.isFinite(urenPerWeek)) {
    return NextResponse.json({ ok: false, error: "Klant en een geldig aantal uren zijn verplicht." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, budget: await zetWerkplanBudget(slug, urenPerWeek) });
}
