import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getDevWorklist, runDevWorklist } from "../../../../lib/dev-worklist";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Status van de werklijst-sitebouwer-run (voor de polling in het bord).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const state = await getDevWorklist(slug);
  return NextResponse.json({ ok: true, ...state });
}

// Start de run: crawlt de live pagina's, schrijft meta's en alt-teksten, maakt
// het Drive-document en de verzamelkaart. Draait binnen deze aanroep (max 300s);
// de UI volgt de voortgang via GET.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const cur = await getDevWorklist(slug);
  if (cur.status === "running") return NextResponse.json({ ok: true, status: "running" });
  const r = await runDevWorklist(slug);
  return NextResponse.json(r.ok ? { ok: true, status: "done", docLink: r.docLink || "" } : { ok: false, error: r.error || "Werklijst maken mislukt." }, r.ok ? undefined : { status: 500 });
}
