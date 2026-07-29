import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPageSummary, savePageSummary, type PageSummary } from "../../../../lib/site-urls";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Haalt de korte samenvatting (toplaag) van één pagina op.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = String(req.nextUrl.searchParams.get("slug") || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(req.nextUrl.searchParams.get("url") || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  const summary = await getPageSummary(slug, url);
  return NextResponse.json({ ok: true, summary });
}

// Slaat een (met de hand bijgestelde) samenvatting op.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  const s = (body.summary || {}) as Record<string, unknown>;
  const summary: PageSummary = {
    nu: String(s.nu ?? "").trim(),
    doel: String(s.doel ?? "").trim(),
    zet: String(s.zet ?? "").trim(),
    related: String(s.related ?? "").trim(),
  };
  await savePageSummary(slug, url, summary);
  return NextResponse.json({ ok: true });
}
