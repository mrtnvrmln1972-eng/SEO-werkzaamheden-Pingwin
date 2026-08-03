import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getUrlStructuur, zetUrlStructuur } from "../../../../lib/opruim-regels";

export const runtime = "nodejs";

// De gekozen URL-vorm per klant, bijvoorbeeld /soa-klinieken/soa-test-<plaats>/.
// Die keuze gaat als harde regel mee in elke volgende opruim-analyse, zodat de
// motor nooit meer een omleiding voorstelt naar een vorm die we uitfaseren.

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, vorm: await getUrlStructuur(slug) });
}

export async function PUT(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const vorm = String(body.vorm || "").trim();
  if (vorm && !vorm.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "Een URL-vorm begint met een schuine streep, bijvoorbeeld /soa-klinieken/soa-test-<plaats>/." }, { status: 400 });
  }
  await zetUrlStructuur(slug, vorm);
  return NextResponse.json({ ok: true, vorm });
}
