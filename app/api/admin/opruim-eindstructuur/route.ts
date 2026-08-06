import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCannibalAnalysis } from "../../../../lib/cannibal-redirect";
import { bouwEindstructuur } from "../../../../lib/opruim-eindstructuur";
import { getNametingen, nametingSamenvatting } from "../../../../lib/opruim-nameten";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hoe de site eruitziet als alles doorgevoerd is, plus wat de al doorgevoerde
// omleidingen tot nu toe hebben opgeleverd. Twee dingen op één route omdat ze op
// hetzelfde scherm onder elkaar staan en allebei uit dezelfde analyse komen.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const st = await getCannibalAnalysis(slug);
    const [structuur, metingen] = await Promise.all([
      bouwEindstructuur(slug, st.result),
      getNametingen(slug).catch(() => []),
    ]);
    return NextResponse.json({ ok: true, structuur, metingen, metingenTekst: nametingSamenvatting(metingen) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Structuur bepalen mislukt." }, { status: 500 });
  }
}
