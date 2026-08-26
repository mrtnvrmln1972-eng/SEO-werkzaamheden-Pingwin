import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { setWeekplanGenegeerd } from "../../../../../lib/weekplan";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST: een taak negeren (blijft bestaan, doorgestreept, telt niet mee in de
// weekprojectie) of terugzetten. Los van "klaar": genegeerd is niet gedaan,
// maar bewust laten staan.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(body.id);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en taak-id zijn verplicht." }, { status: 400 });
  await setWeekplanGenegeerd(slug, id, body.genegeerd !== false);
  return NextResponse.json({ ok: true });
}
