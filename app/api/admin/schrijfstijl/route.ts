import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getSchrijfstijl, setSchrijfstijl, leidSchrijfstijlAf } from "../../../../lib/schrijfstijl";
import { vensterPoort } from "../../../../lib/klantvenster";

export const runtime = "nodejs";
// Het afleiden bevraagt de mailbox per klant; dat is een reeks aanroepen.
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  return NextResponse.json({ ok: true, stijl: await getSchrijfstijl() });
}

/**
 * POST met `{ profiel, voorbeelden }` bewaart wat Maarten zelf typte; die versie
 * wordt daarna niet meer overschreven door de maandelijkse ronde.
 * POST met `{ opnieuw: true }` leidt hem opnieuw af uit de mailbox.
 */
export async function POST(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  if (body.opnieuw === true) {
    const r = await leidSchrijfstijlAf(true);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, stijl: r.stijl });
  }

  const huidig = await getSchrijfstijl();
  const stijl = {
    ...huidig,
    profiel: String(body.profiel ?? huidig.profiel),
    voorbeelden: Array.isArray(body.voorbeelden) ? body.voorbeelden.map(String).slice(0, 12) : huidig.voorbeelden,
    // Vanaf nu met de hand onderhouden: de maandronde blijft er dan af.
    handmatig: body.handmatig === false ? false : true,
  };
  await setSchrijfstijl(stijl);
  return NextResponse.json({ ok: true, stijl });
}
