import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getCannibalAnalysis } from "../../../../lib/cannibal-redirect";
import { adviesPerPlaats } from "../../../../lib/opruim-plaatsen";
import { bouwWerklijst, tellingen } from "../../../../lib/opruim-werklijst";

export const runtime = "nodejs";
export const maxDuration = 300;

// De ene lijst: alles wat er over pagina's is uitgezocht, samengevoegd tot één
// regel per pagina met één uitkomst. De losse blokken blijven bestaan als view;
// hier komt de gecombineerde lijst vandaan.
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
    const [st, plaatsen] = await Promise.all([
      getCannibalAnalysis(slug),
      adviesPerPlaats(slug, domain).catch(() => ({ adviezen: [] })),
    ]);
    const regels = bouwWerklijst(st.result, plaatsen.adviezen);
    return NextResponse.json({ ok: true, regels, tellingen: tellingen(regels), lijstDatum: st.result?.generatedAt || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lijst bouwen mislukt." }, { status: 500 });
  }
}
