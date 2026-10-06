import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { bewaarKoppeling, deleteWpCreds, hertestKoppeling, wpKoppelDetail } from "../../../../lib/wp-creds";

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
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const d = await wpKoppelDetail(slug);
  return NextResponse.json({ ok: true, set: d.gekoppeld, user: d.gebruiker, getestOp: d.getestOp, testOk: d.testOk, fout: d.fout, rol: d.rol });
}

// Opslaan (met test) of verwijderen van de WordPress-inloggegevens.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;

  if (body.action === "delete") {
    await deleteWpCreds(slug);
    return NextResponse.json({ ok: true, set: false });
  }

  // De opgeslagen koppeling opnieuw testen, zonder het wachtwoord te vragen.
  if (body.action === "test") {
    const klant = await getClientBySlug(slug);
    const uit = await hertestKoppeling(slug, klant?.domain || "");
    const d = await wpKoppelDetail(slug);
    return NextResponse.json({ ok: uit.ok, error: uit.error, set: d.gekoppeld, user: d.gebruiker, getestOp: d.getestOp, testOk: d.testOk, fout: d.fout, rol: d.rol });
  }

  // Testen én bewaren zitten in lib/wp-creds.ts, want de andere ingang
  // (/api/admin/wp-koppeling) moet exact hetzelfde doen. Twee routes die elk hun
  // eigen versie hadden, is precies hoe er een ongetest wachtwoord in de opslag
  // kwam terwijl het dashboard "gekoppeld" bleef melden.
  const client = await getClientBySlug(slug);
  const uit = await bewaarKoppeling(slug, client?.domain || "", String(body.user || ""), String(body.appPassword || ""));
  if (!uit.ok) return NextResponse.json({ ok: false, error: uit.error }, { status: 400 });
  const d = await wpKoppelDetail(slug);
  return NextResponse.json({ ok: true, set: true, user: d.gebruiker, getestOp: d.getestOp, testOk: d.testOk, fout: d.fout, rol: d.rol });
}
