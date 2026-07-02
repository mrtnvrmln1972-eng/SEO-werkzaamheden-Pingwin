import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../../lib/clients";
import { addWordpressChanges } from "../../../../../lib/content-tracking";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Haalt uit WordPress de laatst-gewijzigd-datums op en zet ze als wijzigingen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  if (!client.domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });
  const res = await addWordpressChanges(slug, client.domain);
  if (!res.hasApi) return NextResponse.json({ ok: false, error: "Geen open WordPress REST API gevonden op dit domein. Mogelijk staat de API uit of is het geen WordPress; dan is een applicatie-wachtwoord nodig." }, { status: 400 });
  return NextResponse.json({ ok: true, ...res });
}
