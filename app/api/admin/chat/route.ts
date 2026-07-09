import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { answerChat, clearChatHistory, getChatHistory, listChatThreads } from "../../../../lib/chat";

export const runtime = "nodejs";
export const maxDuration = 300;

// De gesprekken (threads) van een klant, en optioneel de historie van één thread.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = req.nextUrl.searchParams.get("thread") || "";
  const threads = await listChatThreads(slug);
  const messages = thread ? await getChatHistory(slug, thread) : [];
  return NextResponse.json({ ok: true, threads, messages });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;
  const thread = String(body.thread || "algemeen").trim() || "algemeen";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!slug || messages.length === 0) {
    return NextResponse.json({ ok: false, error: "Klant en vraag zijn verplicht." }, { status: 400 });
  }
  const result = await answerChat(slug, messages as { role: "user" | "assistant"; content: string }[], thread);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, answer: result.answer });
}

// Wist één gesprek (thread) van deze klant.
export async function DELETE(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g3 = await guardSlug(req, slug); if (!g3.ok) return g3.res;
  const thread = req.nextUrl.searchParams.get("thread") || "algemeen";
  await clearChatHistory(slug, thread);
  return NextResponse.json({ ok: true });
}
