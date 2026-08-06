import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { poort } from "../../../../lib/onboarding";
import {
  getPrioriteitenScan, startPrioRun, runPrioriteitenScan,
  getPropositie, setPropositie,
} from "../../../../lib/prioriteiten-scan";

export const runtime = "nodejs";
// Zelfde venster als de opruimanalyse. Wat er niet in past hervat de cron-werker
// /api/cron/prioriteiten-runs bij de stap waar hij was.
export const maxDuration = 800;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de opgeslagen scan, de status en de propositie-zin (met voorstel).
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const [state, propositie] = await Promise.all([getPrioriteitenScan(slug), getPropositie(slug)]);
  return NextResponse.json({ ok: true, ...state, propositie });
}

// POST: scan starten, een gestrande run hervatten, of de propositie-zin bewaren.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  if (typeof body.propositie === "string") {
    await setPropositie(slug, body.propositie.trim());
    return NextResponse.json({ ok: true, bewaard: true });
  }

  if (body.hervat === true) {
    const st = await getPrioriteitenScan(slug);
    if (st.status !== "running") {
      return NextResponse.json({ ok: false, error: "Er loopt geen scan om te hervatten. Klik op “Scan draaien”." }, { status: 400 });
    }
    waitUntil(runPrioriteitenScan(slug));
    return NextResponse.json({ ok: true, hervat: true });
  }

  // De poort: een scan zonder inventarisatie levert een gok op in plaats van een
  // meting. Wat er precies mist staat in lib/onboarding.ts, niet hier.
  const p = await poort(slug, "prioriteiten");
  if (!p.mag) return NextResponse.json({ ok: false, error: p.reden, onboarding: p.ontbreekt }, { status: 400 });

  // De propositie is niet verplicht om te kunnen starten, maar zonder die zin
  // drijft de scan af naar veel volume dat niet bij de klant past. Het scherm
  // waarschuwt daarvoor; hier blokkeren we niet, want dat zou de knop dood maken.
  await startPrioRun(slug);
  waitUntil(runPrioriteitenScan(slug));
  return NextResponse.json({ ok: true, started: true });
}
