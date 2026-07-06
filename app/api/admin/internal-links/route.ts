import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { getInternalLinksState, markInternalLinksRunning, runInternalLinks, suggestTargets } from "../../../../lib/internal-links";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de opgeslagen interne-link-analyse + status. Met ?suggest=1 geeft hij de
// voorgestelde doelpagina's (striking distance) terug voor de checkboxes.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (req.nextUrl.searchParams.get("suggest") === "1") {
    return NextResponse.json({ ok: true, suggestions: await suggestTargets(slug) });
  }
  return NextResponse.json({ ok: true, ...(await getInternalLinksState(slug)) });
}

// POST: start de analyse voor de gekozen doelpagina's (draait server-side door via
// waitUntil; wegklikken mag).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const targets = Array.isArray(body.targets) ? body.targets.map((t) => String(t)).filter(Boolean) : [];
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await markInternalLinksRunning(slug, targets);
  waitUntil(runInternalLinks(slug, targets));
  return NextResponse.json({ ok: true, started: true });
}
