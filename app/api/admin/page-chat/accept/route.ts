import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { savePagePlan } from "../../../../../lib/site-urls";
import { generatePageSummary } from "../../../../../lib/page-summary";
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
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const plan = typeof body.plan === "string" ? body.plan : null;
  const tasks = Array.isArray(body.tasks) ? (body.tasks as { taak: string; fase?: string; wie?: string }[]) : [];
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  let planSaved = false;
  // Vastleggen is één handeling, ook al zijn het twee lagen: de volledige
  // strategie én de korte samenvatting ("In het kort") die erboven staat. Die
  // samenvatting werd alleen gemaakt als je de knop in Pagina's gebruikte; deed
  // je hetzelfde op de projectkaart, dan bleef hij leeg en moest je hem daar
  // alsnog met de hand laten maken. Twee kopieën van dezelfde keten die uit
  // elkaar liepen, dus hij staat nu hier: op de plek waar de strategie wordt
  // vastgelegd, en dus voor beide knoppen gelijk. Mislukt het samenvatten, dan
  // is de strategie gewoon vastgelegd; de kaart erboven kan hem altijd nog
  // opnieuw maken.
  let summary = null;
  if (plan !== null) {
    await savePagePlan(slug, url, plan);
    planSaved = true;
    try { const s = await generatePageSummary(slug, url); if (s.ok) summary = s.summary; } catch { /* strategie staat, samenvatting kan later */ }
  }

  let taskIds: number[] = [];
  if (tasks.length) {
    taskIds = await appendTasks(slug, tasks.map((t) => ({
      taak: t.taak, fase: t.fase || "", wie: t.wie || "SEO", status: "Gepland", pageUrl: url, klantZichtbaar: true,
    })));
  }

  return NextResponse.json({ ok: true, planSaved, summary, tasksAdded: taskIds.length, taskIds });
}
