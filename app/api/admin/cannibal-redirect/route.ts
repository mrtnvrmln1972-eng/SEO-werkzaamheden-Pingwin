import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { getCannibalAnalysis, startCannibalRun, runCannibalRedirect } from "../../../../lib/cannibal-redirect";

export const runtime = "nodejs";
// 800s (Vercel Pro/Fluid), net als de documenten-werker. Eén analyse duurt langer dan
// dit venster; wat er niet in past hervat de cron-werker /api/cron/opruim-runs.
export const maxDuration = 800;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de opgeslagen site-brede cannibalisatie-/redirect-analyse + status.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, ...(await getCannibalAnalysis(slug)) });
}

// POST: start de analyse, of hervat een gestrande run ({ hervat: true }) zonder
// hem opnieuw te beginnen. Dat laatste is de ontsnapping voor als het cron-vangnet
// wegblijft: één klik en de analyse loopt verder waar hij was, in plaats van
// afhankelijk zijn van een cron waar we niet in kunnen kijken.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (body.hervat === true) {
    const st = await getCannibalAnalysis(slug);
    if (st.status !== "running") return NextResponse.json({ ok: false, error: "Er loopt geen analyse om te hervatten. Klik op “Analyse draaien”." }, { status: 400 });
    waitUntil(runCannibalRedirect(slug));
    return NextResponse.json({ ok: true, hervat: true });
  }
  await startCannibalRun(slug);
  waitUntil(runCannibalRedirect(slug));
  return NextResponse.json({ ok: true, started: true });
}
