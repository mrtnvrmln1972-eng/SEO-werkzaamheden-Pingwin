import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { trekConclusie, oogstTaken, zetOogstWeg, type OogstTaak } from "../../../../../lib/chat";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De drie stappen van "eerst sparren, dan concluderen, dan pas taken". Alle drie
// door Maarten met een knop getriggerd; er gebeurt niets automatisch.
//   stap "conclusie"  → lees het hele gesprek terug en schrijf de conclusie
//   stap "taken"      → bepaal welk werk eruit volgt (een VOORSTEL, nog geen kaarten)
//   stap "wegzetten"  → zet de AANGEVINKTE taken als projectkaarten in de weekplanning
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = String(body.thread || "overzicht");
  const stap = String(body.stap || "");
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });

  try {
    if (stap === "conclusie") return NextResponse.json(await trekConclusie(slug, thread));
    if (stap === "taken") return NextResponse.json(await oogstTaken(slug, thread));
    if (stap === "wegzetten") {
      const index = Math.max(0, Math.round(Number(body.index) || 0));
      const taken = (Array.isArray(body.taken) ? body.taken : []) as OogstTaak[];
      return NextResponse.json(await zetOogstWeg(slug, thread, index, taken));
    }
    return NextResponse.json({ ok: false, error: "Onbekende stap." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Er ging iets mis: " + (e as Error).message }, { status: 500 });
  }
}
