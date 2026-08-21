import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import {
  DEEL_PAD, isDeelSoort, getDeelToken, getOrCreateDeelToken, regenerateDeelToken, trekDeelTokenIn,
} from "../../../../lib/deel-link";

export const runtime = "nodejs";

// De deellink van een deelbaar scherm: opvragen, aanmaken, opnieuw maken,
// intrekken. Eén route voor alle soorten; welk scherm het is, staat in `soort`.
function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function soortUit(x: string): x is Parameters<typeof getDeelToken>[0] {
  return isDeelSoort(x);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const soort = req.nextUrl.searchParams.get("soort") || "";
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!soortUit(soort)) return NextResponse.json({ ok: false, error: "Onbekend soort." }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const t = await getDeelToken(soort, slug);
  return NextResponse.json({ ok: true, url: t ? `${req.nextUrl.origin}${DEEL_PAD[soort]}/${t}` : "" });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { soort?: string; slug?: string; actie?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const soort = String(body.soort || "");
  const slug = String(body.slug || "").trim();
  if (!soortUit(soort)) return NextResponse.json({ ok: false, error: "Onbekend soort." }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (body.actie === "intrekken") { await trekDeelTokenIn(soort, slug); return NextResponse.json({ ok: true, url: "" }); }
  const t = body.actie === "vernieuwen" ? await regenerateDeelToken(soort, slug) : await getOrCreateDeelToken(soort, slug);
  return NextResponse.json({ ok: true, url: `${req.nextUrl.origin}${DEEL_PAD[soort]}/${t}` });
}
