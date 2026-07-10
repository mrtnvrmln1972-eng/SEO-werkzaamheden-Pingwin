import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getMetaKansen, generateMetaProposal, updateMetaProposal, checkLiveProposals, addCtrEffects, type MetaProposalStatus } from "../../../../lib/meta-ctr";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug= : de kansenlijst (GSC-CTR-gat) samengevoegd met de opgeslagen
// voorstellen; controleert en passant of goedgekeurde meta's live staan en
// vult de CTR-effecten voor doorgevoerde pagina's aan.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const rows = await getMetaKansen(slug);
  await checkLiveProposals(slug, rows).catch(() => { /* live-check is aanvulling */ });
  await addCtrEffects(slug, rows).catch(() => { /* effect is aanvulling */ });
  return NextResponse.json({ ok: true, rows });
}

// POST {slug, url, keyword?, base?} : genereer (of vernieuw) het AI-voorstel voor één pagina.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string; keyword?: string; base?: { ctr?: number; position?: number; impressions?: number } };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const result = await generateMetaProposal(slug, url, (body.keyword || "").trim(), body.base);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Genereren mislukte." }, { status: 500 });
  }
}

// PATCH {slug, url, propTitle?, propDesc?, status?} : voorstel bewerken of status zetten.
export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string; propTitle?: string; propDesc?: string; status?: MetaProposalStatus };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  if (body.status && !["open", "goedgekeurd", "doorgevoerd", "afgewezen"].includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Onbekende status." }, { status: 400 });
  }
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await updateMetaProposal(slug, url, { propTitle: body.propTitle, propDesc: body.propDesc, status: body.status });
  return NextResponse.json({ ok: true });
}
