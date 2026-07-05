import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { anthropicConfigured } from "../../../../../lib/anthropic";
import { waitUntil } from "@vercel/functions";
import { createDocRun, getLatestDocRun, runNow } from "../../../../../lib/page-doc-run";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// POST: start een achtergrond-run (analyse -> blauwdruk -> copy) voor een pagina.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const extra = String(body.extra || "").trim().slice(0, 1500);
  const folderId = String(body.folderId || "").trim();
  const allowed = ["analyse", "blauwdruk", "copy"] as const;
  const reqSteps = (Array.isArray(body.steps) ? body.steps.map((s) => String(s)) : []).filter((s): s is (typeof allowed)[number] => (allowed as readonly string[]).includes(s));
  const steps = reqSteps.length ? reqSteps : [...allowed];
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  try {
    const runId = await createDocRun(slug, url, extra, folderId, steps);
    // Meteen server-side starten (los van de browser); de cron is alleen vangnet.
    waitUntil(runNow(runId));
    return NextResponse.json({ ok: true, runId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// GET: de laatste run-status voor een pagina (voor het live-volgen).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const run = await getLatestDocRun(slug, url);
  return NextResponse.json({ ok: true, run });
}
