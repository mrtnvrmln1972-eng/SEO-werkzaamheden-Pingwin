import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { getPriorityUrls } from "../../../../../lib/content-tracking";
import { ahrefsConfigured, getAiResponsesCount } from "../../../../../lib/ahrefs";
import { getAhrefsKeywords } from "../../../../../lib/ahrefs-keywords";
import { getOpportunities } from "../../../../../lib/keyword-opportunities";
import { getCompetitors } from "../../../../../lib/competitors";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// ÉÉN VERZOEK VOOR ALLES WAT HET RESULTATEN-TABBLAD BIJ HET OPENEN NODIG HEEFT
// ═══════════════════════════════════════════════════════════
// Het KPI-paneel vuurde bij het openen vijf losse verzoeken af: de gemarkeerde
// pagina's, de AI-vindbaarheid, de Ahrefs-zoekwoorden, de kansen en de
// concurrenten. Elk daarvan betaalde apart zijn eigen inlogcontrole, zijn eigen
// toegangscheck, zijn eigen databaseverbinding en (op Vercel) zijn eigen
// opstart. Vijf keer hetzelfde voorwerk voor vijf kleine uitkomsten.
//
// Nu is het één verzoek. De vijf bronnen worden op de server naast elkaar
// opgehaald, dus het duurt zo lang als de traagste in plaats van als de som, en
// het voorwerk gebeurt één keer.
//
// De zware Google-cijfers zitten hier met opzet NIET bij: die komen uit Search
// Console en Analytics en duren seconden. Die blijven in hun eigen verzoek
// (/api/admin/kpi), zodat de rest van het scherm niet op ze staat te wachten.
// Zet ze hier dus nooit bij.
//
// Elke bron valt apart terug op leeg: hapert Ahrefs, dan blijft de rest gewoon
// staan in plaats van dat het hele tabblad leeg blijft.
// ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const aiVindbaarheid = async () => {
    if (!ahrefsConfigured()) return [];
    const client = await getClientBySlug(slug);
    if (!client?.domain) return [];
    return getAiResponsesCount(client.domain);
  };

  const [prioriteit, platforms, ahrefsKeywords, kansen, concurrenten] = await Promise.all([
    getPriorityUrls(slug).catch(() => [] as string[]),
    aiVindbaarheid().catch(() => []),
    getAhrefsKeywords(slug).catch(() => []),
    getOpportunities(slug).catch(() => []),
    getCompetitors(slug).catch(() => []),
  ]);

  return NextResponse.json({ ok: true, prioriteit, platforms, ahrefsKeywords, kansen, concurrenten });
}
