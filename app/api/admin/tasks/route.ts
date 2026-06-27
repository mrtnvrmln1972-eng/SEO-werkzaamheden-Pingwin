import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getTasks, replaceTasks, type TaskRow } from "../../../../lib/tasks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  return NextResponse.json({ ok: true, tasks: await getTasks(slug) });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const tasks = Array.isArray(body.tasks) ? (body.tasks as TaskRow[]) : null;
  if (!slug || !tasks) return NextResponse.json({ ok: false, error: "Klant en taken zijn verplicht." }, { status: 400 });
  const n = await replaceTasks(slug, tasks);
  return NextResponse.json({ ok: true, saved: n });
}
