import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { setWeekplanEstimate } from "../../../../../lib/weekplan";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST: de geschatte duur (in minuten) van één taak in de werkplanning-proef
// bijstellen. Los van updateWeekplanTask omdat het geen week/status/volgorde
// raakt, alleen de inschatting waarop de weekprojectie rekent.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(body.id);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en taak-id zijn verplicht." }, { status: 400 });
  const min = body.min === null ? null : Number(body.min);
  if (min !== null && (!Number.isFinite(min) || min < 0)) {
    return NextResponse.json({ ok: false, error: "Duur moet een getal in minuten zijn." }, { status: 400 });
  }
  await setWeekplanEstimate(slug, id, min);
  return NextResponse.json({ ok: true });
}
