import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getOrgData, saveOrgData, setOrgLocked, autofillOrgData, type OrgData } from "../../../../lib/org-data";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de bedrijfsgegevens van een klant (voor het cockpit-formulier).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  // Onbekende klant: dat zeggen, in plaats van een leeg formulier tonen alsof
  // er nog van alles ingevuld moet worden.
  if (!(await getClientBySlug(slug).catch(() => null))) {
    return NextResponse.json({ ok: false, error: "Deze klant bestaat niet." }, { status: 404 });
  }
  const rec = await getOrgData(slug);
  return NextResponse.json({ ok: true, ...rec });
}

// POST: opslaan (action "save"), automatisch vullen (action "autofill").
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string; action?: string; data?: OrgData };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });

  if (body.action === "autofill") {
    const res = await autofillOrgData(slug);
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, data: res.data });
  }
  if (!body.data) return NextResponse.json({ ok: false, error: "Geen gegevens meegegeven." }, { status: 400 });
  const res = await saveOrgData(slug, body.data, "admin");
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// PATCH: vergrendelen/ontgrendelen.
export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string; locked?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  await setOrgLocked(slug, body.locked !== false);
  return NextResponse.json({ ok: true });
}
