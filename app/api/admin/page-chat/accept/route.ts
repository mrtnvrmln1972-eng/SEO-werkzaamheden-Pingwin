import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { savePagePlan } from "../../../../../lib/site-urls";
import { appendTasks } from "../../../../../lib/tasks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Neemt het chat-voorstel over: plan-alinea bijwerken en/of taken toevoegen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const plan = typeof body.plan === "string" ? body.plan : null;
  const tasks = Array.isArray(body.tasks) ? (body.tasks as { taak: string; fase?: string; wie?: string }[]) : [];
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  let planSaved = false;
  if (plan !== null) { await savePagePlan(slug, url, plan); planSaved = true; }

  let taskIds: number[] = [];
  if (tasks.length) {
    taskIds = await appendTasks(slug, tasks.map((t) => ({
      taak: t.taak, fase: t.fase || "", wie: t.wie || "SEO", status: "Gepland", pageUrl: url, klantZichtbaar: true,
    })));
  }

  return NextResponse.json({ ok: true, planSaved, tasksAdded: taskIds.length, taskIds });
}
