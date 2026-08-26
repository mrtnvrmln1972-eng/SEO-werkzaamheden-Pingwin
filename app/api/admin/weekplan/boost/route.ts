import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { boostThread } from "../../../../../lib/weekplan";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST: alle open taken van één cluster (thread) vooraan zetten in de
// werkplanning-proef, zodat de weekprojectie zich eromheen herschikt.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = String(body.thread || "").trim();
  if (!slug || !thread) return NextResponse.json({ ok: false, error: "Klant en cluster zijn verplicht." }, { status: 400 });
  await boostThread(slug, thread);
  return NextResponse.json({ ok: true });
}
