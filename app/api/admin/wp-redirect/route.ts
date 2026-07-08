import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpConnForClient, createWpRedirect, verifyRedirect, getPageRedirects, savePageRedirect } from "../../../../lib/wp";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: welke redirects zijn voor deze pagina al doorgevoerd (+ geverifieerd)?
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Geen klant of pagina opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const done = await getPageRedirects(slug, url);
    return NextResponse.json({ ok: true, done });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 500 });
  }
}

// POST: één redirect doorvoeren in de website (Redirection-plugin) en direct
// live verifiëren dat het van-pad echt met een 301 naar het doel gaat.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const pageUrl = String(body.pageUrl || "").trim();
  const from = String(body.from || "").trim();
  const to = String(body.to || "").trim();
  if (!slug || !pageUrl || !from || !to) return NextResponse.json({ ok: false, error: "Redirect onvolledig (van/naar ontbreekt)." }, { status: 400 });
  if (!from.startsWith("/") || !to.startsWith("/")) return NextResponse.json({ ok: false, error: "Van- en naar-pad moeten met / beginnen." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const conn = await getWpConnForClient(slug);
    if (!conn) return NextResponse.json({ ok: false, error: "Er is nog geen WordPress-koppeling voor deze klant. Stel de gebruikersnaam en het application password in (knop in het redirect-blok), en zorg dat het klant-domein is ingevuld." }, { status: 400 });
    const redirectionId = await createWpRedirect(conn, from, to);
    const check = await verifyRedirect(conn.url, from, to);
    await savePageRedirect(slug, pageUrl, from, to, check.ok, redirectionId);
    return NextResponse.json({ ok: true, verified: check.ok, detail: check.detail });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Doorvoeren mislukt." }, { status: 500 });
  }
}
