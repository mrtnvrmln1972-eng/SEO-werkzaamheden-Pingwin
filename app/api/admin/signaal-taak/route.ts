import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { zetOpPlanning, bronBestaat } from "../../../../lib/signaal-taak";
// Het register laden is genoeg om alle bronnen aan te sluiten.
import "../../../../lib/signaal-bronnen";

export const runtime = "nodejs";
export const maxDuration = 120;

// De ene ingang van signaal naar kaart op de planning, voor élk scherm dat iets
// signaleert. Het scherm stuurt alleen wélke bron en wélke punten; wat er in de
// kaart komt te staan wordt server-side opgediept uit de opgeslagen analyse van
// dat scherm (zie lib/signaal-taak.ts). Zo kan de browser nooit een kaart met
// verzonnen inhoud laten aanmaken, en staat de kaartopmaak op één plek.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const bron = String(body.bron || "").trim();
  if (!slug || !bron) return NextResponse.json({ ok: false, error: "Geen klant of bron opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!bronBestaat(bron)) {
    return NextResponse.json({ ok: false, error: "Dit scherm is nog niet aangesloten op de planning." }, { status: 400 });
  }

  const keys = Array.isArray(body.keys) ? body.keys.map(String).filter(Boolean) : [];
  const ctx: Record<string, string> = {};
  if (body.ctx && typeof body.ctx === "object") {
    for (const [k, v] of Object.entries(body.ctx as Record<string, unknown>)) ctx[k] = String(v ?? "");
  }

  try {
    const r = await zetOpPlanning(slug, bron, keys, ctx);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Taken maken is misgegaan: ${(e as Error).message}` }, { status: 500 });
  }
}
