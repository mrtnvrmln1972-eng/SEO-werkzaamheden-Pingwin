import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { addWeekplanTasks, isoWeek } from "../../../../../lib/weekplan";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Zet een stuk chattekst ONGEWIJZIGD als één taak in de weekplanning. Geen AI, geen
// context ophalen, geen splitsing per pagina: voor kant-en-klare inhoud (een
// contentagenda, een uitgewerkt voorstel) die al af is en gewoon een plek in de
// planning nodig heeft, letterlijk zoals hij in het gesprek staat.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taak = String(body.taak || "").trim();
  const toelichting = String(body.toelichting || "").trim();
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en titel zijn verplicht." }, { status: 400 });

  const r = await addWeekplanTasks(slug, String(body.thread || ""), [{
    taak, toelichting, ruw: true, week: isoWeek(new Date()),
  }]);
  const n = r.added + r.merged;
  return n
    ? NextResponse.json({ ok: true, added: r.added, merged: r.merged })
    : NextResponse.json({ ok: false, error: "Toevoegen mislukt." }, { status: 500 });
}
