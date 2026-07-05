import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getMonthBudget, setMonthBudget, type MonthOverride } from "../../../../lib/month-linkbuilding";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Budget-overrides (maandbudget + linkbuilding) per maand van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, months: await getMonthBudget(slug) });
}

// Eén maand bijwerken: alleen de meegestuurde velden (maandbudget en/of linkbuilding).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;
  const month = String(body.month || "").trim();
  if (!slug || !month) return NextResponse.json({ ok: false, error: "Klant en maand verplicht." }, { status: 400 });
  const fields: Partial<MonthOverride> = {};
  if ("maandbudget" in body) fields.maandbudget = Number(body.maandbudget) || 0;
  if ("linkbuilding" in body) fields.linkbuilding = Number(body.linkbuilding) || 0;
  await setMonthBudget(slug, month, fields);
  return NextResponse.json({ ok: true });
}
