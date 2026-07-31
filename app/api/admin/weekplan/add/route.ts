import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { addWeekplanTasks, isoWeek } from "../../../../../lib/weekplan";
import { getStepLinks } from "../../../../../lib/page-doc-run";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Voegt ÉÉN taak (uit een bird's eye-voorstel) toe aan de weekplanning. De week is
// relatief meegegeven (1 = deze week, 2 = volgende week, enzovoort); we rekenen die
// hier om naar het echte ISO-weeknummer.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taak = String(body.taak || "").trim();
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en taak zijn verplicht." }, { status: 400 });

  const seq = Math.max(1, Number(body.week) || 1);
  const d = new Date();
  d.setDate(d.getDate() + (seq - 1) * 7);
  const week = isoWeek(d);

  const url = body.url ? String(body.url) : undefined;
  // Copy-link server-side afleiden zodat de bord-kaart direct naar de aangeleverde copy linkt.
  const copyUrl = url ? await getStepLinks(slug, url).then((s) => s.copy).catch(() => "") : "";

  const r = await addWeekplanTasks(slug, String(body.thread || ""), [{
    taak,
    toelichting: body.toelichting ? String(body.toelichting) : undefined,
    wie: body.wie ? String(body.wie) : undefined,
    url,
    taaktype: body.taaktype ? String(body.taaktype) : undefined,
    bronMail: body.bronMail ? String(body.bronMail) : undefined,
    copyUrl,
    week,
  }]);
  const n = r.added + r.merged;
  return n ? NextResponse.json({ ok: true, added: n, week }) : NextResponse.json({ ok: false, error: "Toevoegen mislukt." }, { status: 500 });
}
