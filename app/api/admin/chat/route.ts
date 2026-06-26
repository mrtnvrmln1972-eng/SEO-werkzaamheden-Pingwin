import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { answerChat } from "../../../../lib/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!slug || messages.length === 0) {
    return NextResponse.json({ ok: false, error: "Klant en vraag zijn verplicht." }, { status: 400 });
  }
  const result = await answerChat(slug, messages as { role: "user" | "assistant"; content: string }[]);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, answer: result.answer });
}
