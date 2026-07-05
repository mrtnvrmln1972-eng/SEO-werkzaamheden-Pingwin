import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getMailAllowlist, setMailAllowlist } from "../../../../lib/clients";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de witte lijst (toegestane afzenders) van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, allowlist: await getMailAllowlist(slug) });
}

// POST: de witte lijst bijwerken.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const allowlist = String(body.allowlist || "").slice(0, 4000);
  await setMailAllowlist(slug, allowlist);
  return NextResponse.json({ ok: true });
}
