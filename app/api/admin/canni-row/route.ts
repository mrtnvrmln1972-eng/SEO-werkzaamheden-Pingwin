import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWpConnForClient, findWpEditUrl, getCanniRowStatuses, setCanniRowStatus } from "../../../../lib/wp";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: statussen (uitgevoerd/afgewezen) per rij van de cannibalisatie-tabel.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Geen klant of pagina opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, statuses: await getCanniRowStatuses(slug, url) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 500 });
  }
}

// POST: status van een rij zetten/wissen, of (action=editlink) de wp-admin
// bewerk-URL van het rij-pad opzoeken zodat de UI hem kan openen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const pageUrl = String(body.pageUrl || "").trim();
  const rowPath = String(body.rowPath || "").trim();
  if (!slug || !pageUrl || !rowPath) return NextResponse.json({ ok: false, error: "Rij onvolledig." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    if (body.action === "editlink") {
      const conn = await getWpConnForClient(slug);
      if (!conn) return NextResponse.json({ ok: false, error: "Er is nog geen WordPress-koppeling voor deze klant." }, { status: 400 });
      const editUrl = await findWpEditUrl(conn, rowPath);
      if (!editUrl) return NextResponse.json({ ok: false, error: `De pagina ${rowPath} is niet gevonden in WordPress.` }, { status: 404 });
      return NextResponse.json({ ok: true, editUrl });
    }
    const raw = body.status;
    const status = raw === "uitgevoerd" || raw === "afgewezen" ? raw : null;
    await setCanniRowStatus(slug, pageUrl, rowPath, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt." }, { status: 500 });
  }
}
