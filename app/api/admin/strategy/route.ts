import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { createStrategySession, getStrategySessions, deleteStrategySession, markActionDone } from "../../../../lib/strategy";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: alle strategie-sessies van een klant (voor het Taken-tabblad).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const sessions = await getStrategySessions(slug).catch(() => []);
  return NextResponse.json({ ok: true, sessions });
}

// POST: legt een chatgesprek vast als strategie-sessie (titel + conclusie + acties via AI).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: { slug?: string; messages?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string" && m.content.trim()) : [];
  if (!slug || messages.length < 2) return NextResponse.json({ ok: false, error: "Voer eerst een gesprek in de SEO-assistent." }, { status: 400 });
  const client = await getClientBySlug(slug);
  try {
    const session = await createStrategySession(slug, messages, client?.name || slug);
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Vastleggen mislukt." }, { status: 500 });
  }
}

// PATCH: markeert een actiepunt als verwerkt (of draait dat terug).
export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string; sessionId?: number; actionIndex?: number; done?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const sessionId = Number(body.sessionId || 0);
  const actionIndex = Number(body.actionIndex ?? -1);
  if (!slug || !sessionId || actionIndex < 0) return NextResponse.json({ ok: false, error: "Sessie en actiepunt zijn verplicht." }, { status: 400 });
  await markActionDone(slug, sessionId, actionIndex, body.done !== false).catch(() => { /* status is hulpinfo */ });
  return NextResponse.json({ ok: true });
}

// DELETE: verwijdert een strategie-sessie.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id") || "");
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en id verplicht." }, { status: 400 });
  const done = await deleteStrategySession(slug, id).catch(() => false);
  return NextResponse.json({ ok: done });
}
