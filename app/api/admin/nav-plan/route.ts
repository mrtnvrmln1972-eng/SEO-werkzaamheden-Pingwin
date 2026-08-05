import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getRoadmap, scanSiteMenu, proposeNavPlan, confirmNavPlan, discardNavPlanProposal, upsertNavPage, deleteNavPage, completeNavPage } from "../../../../lib/nav-plan";
import { getClientBySlug } from "../../../../lib/clients";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const data = await getRoadmap(slug);
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const action = String(body.action || "").trim();
  try {
    if (action === "voorstel") { const r = await proposeNavPlan(slug); return r.ok ? NextResponse.json({ ok: true, aantal: r.aantal }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 }); }
    if (action === "menu") { const r = await scanSiteMenu(slug); return r.ok ? NextResponse.json({ ok: true, aantal: r.aantal }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 }); }
    if (action === "bevestig") { await confirmNavPlan(slug); return NextResponse.json({ ok: true }); }
    if (action === "verwerp") { await discardNavPlanProposal(slug); return NextResponse.json({ ok: true }); }
    if (action === "add" || action === "update") {
      const url = String(body.url || "").trim();
      if (!url) return NextResponse.json({ ok: false, error: "Geen pagina opgegeven." }, { status: 400 });
      await upsertNavPage(slug, url, { parent: body.parent !== undefined ? String(body.parent || "") : undefined, hoofdzoekterm: body.hoofdzoekterm !== undefined ? String(body.hoofdzoekterm || "") : undefined });
      return NextResponse.json({ ok: true });
    }
    if (action === "del") { await deleteNavPage(slug, String(body.url || "")); return NextResponse.json({ ok: true }); }
    if (action === "voltooi") {
      const client = await getClientBySlug(slug);
      await completeNavPage(slug, String(body.url || ""), client?.domain || "");
      return NextResponse.json({ ok: true });
    }
  } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
