import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getTasks } from "../../../../lib/tasks";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De taken die bij één pagina horen (page_url), voor de "Taken voor deze pagina"
// -lijst in de pagina-detail. Zo hoef je de chat niet te openen om ze te zien.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL verplicht." }, { status: 400 });
  const norm = (u?: string) => (u || "").trim().replace(/\/+$/, "");
  const all = await getTasks(slug);
  const tasks = all
    .filter((t) => norm(t.pageUrl) === norm(url))
    .map((t) => ({ id: t.id ?? null, taak: t.taak, fase: t.fase || "", wie: t.wie || "", status: t.status || "", docLink: t.docLink || "" }));
  return NextResponse.json({ ok: true, tasks });
}
