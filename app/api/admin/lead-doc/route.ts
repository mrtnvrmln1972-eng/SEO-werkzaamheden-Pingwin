import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { listLeadDocs, deleteLeadDoc, maakLeadDocument, SJABLONEN } from "../../../../lib/lead-doc";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De plank: alle documenten die we voor dit bedrijf gemaakt hebben, plus de
// beschikbare sjablonen.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const sjablonen = SJABLONEN.map((s) => ({ key: s.key, naam: s.naam, omschrijving: s.omschrijving }));
  return NextResponse.json({ ok: true, docs: await listLeadDocs(slug), sjablonen });
}

// Een document maken vanuit een sjabloon. De opdracht is wat Maarten op dat
// moment meegeeft (budget, accenten, welke pagina's) en wint van de standaard.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const r = await maakLeadDocument(slug, String(body.sjabloon || "seo-voorstel"), String(body.opdracht || ""));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, doc: r.doc, driveError: r.driveError || "" });
}

export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Bedrijf en nummer zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: await deleteLeadDoc(slug, id) });
}
