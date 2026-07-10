import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { getPageSchema, markPageSchemaRunning, runPageSchema } from "../../../../lib/page-schema";
import { getChangeEventsForUrl } from "../../../../lib/content-tracking";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: status/resultaat van de structured-data-analyse voor één pagina.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  const state = await getPageSchema(slug, url);
  // Drift-signaal: is de pagina gewijzigd (Wijzigingen-tab) ná de laatste analyse,
  // dan past de structured data mogelijk niet meer bij de zichtbare content.
  let stale = false;
  if (state.status === "done" && state.updatedAt) {
    try {
      const events = await getChangeEventsForUrl(slug, url);
      const last = events[0]?.detectedAt || "";
      stale = !!last && new Date(last).getTime() > new Date(state.updatedAt).getTime();
    } catch { /* signaal is aanvulling */ }
  }
  return NextResponse.json({ ok: true, ...state, stale });
}

// POST: start de analyse (draait server-side door; de kaart pollt de status).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: { slug?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  await markPageSchemaRunning(slug, url);
  waitUntil(runPageSchema(slug, url));
  return NextResponse.json({ ok: true });
}
