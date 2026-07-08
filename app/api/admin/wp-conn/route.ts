import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpConn, setWpConn } from "../../../../lib/wp";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// WordPress-koppeling per klant (voor het doorvoeren van redirects).
// GET geeft alleen de status terug (url + gebruiker), NOOIT het wachtwoord.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const conn = await getWpConn(slug);
    return NextResponse.json({ ok: true, configured: !!conn, url: conn?.url || "", user: conn?.user || "" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const user = String(body.user || "").trim();
  const appPassword = String(body.appPassword || "").trim();
  if (!slug || !url || !user || !appPassword) return NextResponse.json({ ok: false, error: "Vul website-URL, gebruikersnaam en application password in." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ ok: false, error: "De website-URL moet met https:// beginnen." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    await setWpConn(slug, url, user, appPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." }, { status: 500 });
  }
}
