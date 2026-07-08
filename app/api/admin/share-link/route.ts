import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getOrCreateShareToken, regenerateShareToken } from "../../../../lib/clients";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function toUrl(req: NextRequest, token: string): string {
  return `${req.nextUrl.origin}/k/${token}`;
}

// GET: de loginvrije deel-link van een klant (wordt aangemaakt als hij nog niet bestaat).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const token = await getOrCreateShareToken(slug);
  if (!token) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true, url: toUrl(req, token) });
}

// POST: nieuwe deel-link maken (de oude stopt meteen met werken).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const token = await regenerateShareToken(slug);
  if (!token) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true, url: toUrl(req, token) });
}
