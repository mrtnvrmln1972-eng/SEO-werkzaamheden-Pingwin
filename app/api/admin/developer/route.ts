import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getDeveloperTasks, saveDeveloperOrder, setDeveloperStatus } from "../../../../lib/developer";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  // Actie "status": één taak afvinken (klaar/niet klaar) + terugkoppeling opslaan.
  if (body.action === "status") {
    const clientSlug = String(body.clientSlug || "").trim();
    const taskKey = String(body.taskKey || "").trim();
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    await setDeveloperStatus(clientSlug, taskKey, !!body.done, String(body.note || ""));
    return NextResponse.json({ ok: true });
  }

  const items = Array.isArray(body.items) ? (body.items as { clientSlug: string; taskKey: string; execDate: string }[]) : null;
  if (!items) return NextResponse.json({ ok: false, error: "Geen taken opgegeven." }, { status: 400 });
  const n = await saveDeveloperOrder(items);
  return NextResponse.json({ ok: true, saved: n });
}
