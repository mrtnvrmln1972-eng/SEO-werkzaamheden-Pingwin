import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { answerFinanceChat, getFinanceChatHistory, FINANCE_SLUG } from "../../../../lib/finance-chat";
import { clearChatHistory, type ChatMessage } from "../../../../lib/chat";

export const runtime = "nodejs";
export const maxDuration = 120;

// Financiën-chat (Moneybird-cijfers). Uitsluitend voor de eigenaar; deze data
// mag nooit via de gewone klant-scope bereikbaar zijn.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const messages = await getFinanceChatHistory();
  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: { messages?: ChatMessage[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ ok: false, error: "Geen bericht meegegeven." }, { status: 400 });
  const result = await answerFinanceChat(messages);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await clearChatHistory(FINANCE_SLUG, "algemeen");
  return NextResponse.json({ ok: true });
}
