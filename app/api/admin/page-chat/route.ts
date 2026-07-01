import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { callClaudeAgentic, anthropicConfigured, type ChatMsg } from "../../../../lib/anthropic";
import { buildSystemPrompt, parseProposal } from "../../../../lib/page-chat-ground";
import { CHAT_TOOLS, runChatTool } from "../../../../lib/chat-tools";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Gegronde pagina-chat: laadt live feiten voor de pagina en beantwoordt de vraag.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "De chat heeft een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMsg[]) : [];
  if (!slug || !url || messages.length === 0) return NextResponse.json({ ok: false, error: "Klant, URL en bericht zijn verplicht." }, { status: 400 });

  try {
    const system = await buildSystemPrompt(slug, url);
    const raw = await callClaudeAgentic(system, messages.slice(-12), CHAT_TOOLS, runChatTool);
    const { reply, proposal } = parseProposal(raw);
    return NextResponse.json({ ok: true, reply, proposal });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
