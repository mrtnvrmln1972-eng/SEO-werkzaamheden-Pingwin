import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { adviesPerPlaats } from "../../../../lib/opruim-plaatsen";

export const runtime = "nodejs";
// Eén Ahrefs-opvraag voor alle plaatstermen samen, plus Search Console. Ruim
// binnen dit venster, en de tweede keer komt alles uit de cache van 30 dagen.
export const maxDuration = 300;

// Het advies per plaats: vijf vragen per plaatspagina, met de vestigingen uit de
// bedrijfsgegevens als input voor de laatste vraag.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  const domain = (client?.domain || "").trim();
  if (!domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, ...(await adviesPerPlaats(slug, domain)) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Advies bepalen mislukt." }, { status: 500 });
  }
}
