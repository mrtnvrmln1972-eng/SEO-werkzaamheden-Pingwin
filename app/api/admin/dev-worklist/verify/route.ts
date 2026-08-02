import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { verifyDevWorklist } from "../../../../../lib/dev-worklist";

export const runtime = "nodejs";
export const maxDuration = 300;

// Handmatige live-controle vanaf de werklijst-kaart: meet de pagina's en zet
// de groene gecontroleerd-vinkjes op alles wat er echt goed op staat.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const r = await verifyDevWorklist(slug);
  return r.ok ? NextResponse.json({ ok: true, samenvatting: r.samenvatting }) : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
}
