import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { listChats, getChat, saveChat, deleteChat, type ChatMsg } from "../../../../lib/page-chats";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug&url → lijst chats; GET ?id → één chat met berichten.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (id) return NextResponse.json({ ok: true, chat: await getChat(Number(id)) });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "slug en url verplicht." }, { status: 400 });
  return NextResponse.json({ ok: true, chats: await listChats(slug, url) });
}

// POST: chat opslaan (nieuw of bijwerken).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const id = body.id ? Number(body.id) : null;
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMsg[]) : [];
  if (!slug || !url) return NextResponse.json({ ok: false, error: "slug en url verplicht." }, { status: 400 });
  const savedId = await saveChat(slug, url, id, messages);
  return NextResponse.json({ ok: true, id: savedId });
}

// DELETE ?id → chat verwijderen.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id verplicht." }, { status: 400 });
  await deleteChat(Number(id));
  return NextResponse.json({ ok: true });
}
