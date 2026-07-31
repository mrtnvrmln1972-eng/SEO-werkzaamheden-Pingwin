import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { setPhaseMark, PHASE_KEYS, type PhaseKey } from "../../../../../lib/phase-marks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Handmatig fase-vinkje op een projectkaart: zet (of herstel) de stand van één
// fase van één pagina. Wint van de afgeleide stand.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const fase = String(body.fase || "").trim() as PhaseKey;
  const done = body.done === true;
  if (!slug || !url || !PHASE_KEYS.includes(fase)) return NextResponse.json({ ok: false, error: "Klant, pagina en fase zijn verplicht." }, { status: 400 });
  await setPhaseMark(slug, url, fase, done);
  return NextResponse.json({ ok: true });
}
