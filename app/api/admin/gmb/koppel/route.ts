import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { zetKoppeling } from "../../../../../lib/gmb";
import { zoekProfiel, placesConfigured } from "../../../../../lib/places";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug=..&q=..: zoek kandidaat-profielen. Bewust een lijst waar een mens
// uit kiest: automatisch de eerste treffer nemen is precies hoe je het profiel
// van een naamgenoot aan een klant hangt.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!placesConfigured()) {
    return NextResponse.json({ ok: false, error: "De Google Maps-sleutel staat nog niet in deze omgeving." }, { status: 400 });
  }
  if (!q.trim()) return NextResponse.json({ ok: true, treffers: [] });
  return NextResponse.json({ ok: true, treffers: await zoekProfiel(q, 8) });
}

// POST: koppel een vestiging handmatig aan een place-id (of maak de koppeling los
// door een lege place-id te sturen).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const sleutel = String(body.sleutel || "").trim();
  const placeId = String(body.placeId || "").trim();
  if (!slug || !sleutel) return NextResponse.json({ ok: false, error: "Geen klant of vestiging opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, koppelingen: await zetKoppeling(slug, sleutel, placeId) });
}
