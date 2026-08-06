import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { poort } from "../../../../lib/onboarding";
import { getGmbStand, markGmbRunning, runGmbScan } from "../../../../lib/gmb";
import { placesConfigured } from "../../../../lib/places";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: de opgeslagen profielscan plus de status.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, meetdeur: placesConfigured(), ...(await getGmbStand(slug)) });
}

// POST: start de scan. Draait server-side door via waitUntil, dus wegklikken mag.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  if (!placesConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "Hiervoor is een Google Maps-sleutel nodig. Zet GOOGLE_MAPS_API_KEY in Vercel bij dit project en deploy één keer opnieuw; daarna werkt deze knop.",
    }, { status: 400 });
  }
  // Zonder bedrijfsgegevens weten we niet welke naam, welk adres en welk nummer
  // er zouden moeten staan, en dan is de halve scan een gok in plaats van een meting.
  const p = await poort(slug, "googleprofiel");
  if (!p.mag) return NextResponse.json({ ok: false, error: p.reden, onboarding: p.ontbreekt }, { status: 400 });

  await markGmbRunning(slug);
  waitUntil(runGmbScan(slug));
  return NextResponse.json({ ok: true, started: true });
}
