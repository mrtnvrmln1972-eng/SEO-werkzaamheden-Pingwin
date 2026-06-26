import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { msStatus, msSearchClientEmails, msReplyHtml } from "../../../../lib/ms-graph";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Live mails met een klant ophalen uit Microsoft 365.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const status = await msStatus();
  if (!status.connected) return NextResponse.json({ ok: true, connected: false, emails: [] });

  const query = (client.email || client.domain || "").trim();
  if (!query) return NextResponse.json({ ok: true, connected: true, emails: [] });

  const emails = await msSearchClientEmails(query, status.account || "", 15);
  if (emails === null) return NextResponse.json({ ok: false, error: "Ophalen mislukt. Mogelijk opnieuw koppelen." }, { status: 502 });
  return NextResponse.json({ ok: true, connected: true, emails });
}

// Een mail beantwoorden vanuit het dashboard.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const id = String(body.id || "").trim();
  const html = String(body.html || "").trim();
  const to = String(body.to || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!id || !html) return NextResponse.json({ ok: false, error: "Mail-id en bericht zijn verplicht." }, { status: 400 });
  const result = await msReplyHtml(id, html, to);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
