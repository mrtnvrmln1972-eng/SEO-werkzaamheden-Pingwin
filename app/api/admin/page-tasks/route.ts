import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getTasks, deleteTasksByIds } from "../../../../lib/tasks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}
const norm = (u?: string) => (u || "").trim().replace(/\/+$/, "");

// De taken die bij één pagina horen (page_url), voor de "Taken voor deze pagina"
// -lijst in de pagina-detail. Zo hoef je de chat niet te openen om ze te zien.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL verplicht." }, { status: 400 });
  const all = await getTasks(slug);
  const tasks = all
    .filter((t) => norm(t.pageUrl) === norm(url))
    .map((t) => ({ id: t.id ?? null, taak: t.taak, fase: t.fase || "", wie: t.wie || "", status: t.status || "", docLink: t.docLink || "", stepKind: t.stepKind || "" }));
  return NextResponse.json({ ok: true, tasks });
}

// Opruimen: verwijdert de LOSSE taken van een pagina (geen pijplijn-stap, dus
// step_kind leeg). De pijplijn-werkzaamheden (analyse/blauwdruk/copy) blijven staan.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL verplicht." }, { status: 400 });
  const all = await getTasks(slug);
  const looseIds = all
    .filter((t) => norm(t.pageUrl) === norm(url) && !(t.stepKind || "").trim() && typeof t.id === "number")
    .map((t) => t.id as number);
  const removed = await deleteTasksByIds(slug, looseIds);
  return NextResponse.json({ ok: true, removed });
}
