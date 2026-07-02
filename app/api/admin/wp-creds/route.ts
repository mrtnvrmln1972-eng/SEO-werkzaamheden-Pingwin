import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { getWpCreds, saveWpCreds, deleteWpCreds } from "../../../../lib/wp-creds";
import { testWordpressAuth } from "../../../../lib/wordpress";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Of er inloggegevens zijn ingesteld (nooit het wachtwoord zelf teruggeven).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const creds = await getWpCreds(slug);
  return NextResponse.json({ ok: true, set: !!creds, user: creds?.user || "" });
}

// Opslaan (met test) of verwijderen van de WordPress-inloggegevens.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });

  if (body.action === "delete") {
    await deleteWpCreds(slug);
    return NextResponse.json({ ok: true, set: false });
  }

  const user = String(body.user || "").trim();
  const appPassword = String(body.appPassword || "").trim();
  if (!user || !appPassword) return NextResponse.json({ ok: false, error: "Vul gebruikersnaam en applicatiewachtwoord in." }, { status: 400 });
  const client = await getClientBySlug(slug);
  if (!client?.domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });

  const test = await testWordpressAuth(client.domain, { user, appPassword });
  if (!test.ok) return NextResponse.json({ ok: false, error: test.error || "Inloggegevens werken niet." }, { status: 400 });
  await saveWpCreds(slug, user, appPassword);
  return NextResponse.json({ ok: true, set: true });
}
