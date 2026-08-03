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

// POST: start de analyse (draait server-side door via waitUntil; wegklikken mag).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await startCannibalRun(slug);
  waitUntil(runCannibalRedirect(slug));
  return NextResponse.json({ ok: true, started: true });
}
