import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { weekplanFromAnswer } from "../../../../../lib/chat";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Zet de concrete taken uit een bird's eye-antwoord om in sleepbare kaarten in het
// weekplanning-bord (server-side geforceerde extractie). Door de knop getriggerd.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const answer = String(body.answer || "");
  const thread = String(body.thread || "overzicht");
  if (!slug || !answer.trim()) return NextResponse.json({ ok: false, error: "Klant en antwoord zijn verplicht." }, { status: 400 });

  try {
    const r = await weekplanFromAnswer(slug, answer, thread);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ ok: false, added: 0, error: "Taken maken mislukt: " + (e as Error).message }, { status: 500 });
  }
}
