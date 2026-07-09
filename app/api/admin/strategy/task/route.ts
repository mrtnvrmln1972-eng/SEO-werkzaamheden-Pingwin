import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getStrategySessions, markActionAdded } from "../../../../../lib/strategy";
import { appendTasks } from "../../../../../lib/tasks";

export const runtime = "nodejs";

// POST: zet één actiepunt uit een strategie-sessie om in een taak (zonder maand),
// met een verwijzing terug naar de sessie in het Taken-tabblad.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: { slug?: string; sessionId?: number; actionIndex?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const sessionId = Number(body.sessionId || 0);
  const actionIndex = Number(body.actionIndex ?? -1);
  if (!slug || !sessionId || actionIndex < 0) return NextResponse.json({ ok: false, error: "Sessie en actiepunt zijn verplicht." }, { status: 400 });

  const sessions = await getStrategySessions(slug).catch(() => []);
  const session = sessions.find((s) => s.id === sessionId);
  const action = session?.actions[actionIndex];
  if (!session || !action) return NextResponse.json({ ok: false, error: "Actiepunt niet gevonden." }, { status: 404 });
  if (action.taskId) return NextResponse.json({ ok: true, taskId: action.taskId, already: true });

  const ids = await appendTasks(slug, [{
    categorie: "Site-wide strategie",
    taak: action.taak,
    toelichting: `Uit strategie-sessie: ${session.title}`,
    uren: null,
    status: "Gepland",
    maand: "",
    link: `?tab=werkzaamheden&strategie=${session.id}`,
    wie: action.wie || "SEO",
    fase: action.fase || "",
    klantZichtbaar: false,
  }]);
  const taskId = ids[0];
  if (taskId) await markActionAdded(slug, sessionId, actionIndex, taskId).catch(() => { /* vinkje is hulpinfo */ });
  return NextResponse.json({ ok: true, taskId });
}
