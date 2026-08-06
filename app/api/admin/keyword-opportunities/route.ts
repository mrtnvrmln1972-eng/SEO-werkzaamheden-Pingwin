import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { waitUntil } from "@vercel/functions";
import { draaiKlus, getKlus } from "../../../../lib/klussen";
import { poort } from "../../../../lib/onboarding";
import { getOpportunities, collectOpportunities } from "../../../../lib/keyword-opportunities";

export const runtime = "nodejs";
export const maxDuration = 180;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De opgeslagen zoekwoord-kansen van een klant.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, opportunities: await getOpportunities(slug) });
}

// Zoekt kansen (keyword-ideas rond de kernthema's, Claude-relevantiefilter).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g2 = await guardSlug(req, slug); if (!g2.ok) return g2.res;
  const p = await poort(slug, "zoekwoorden");
  if (!p.mag) return NextResponse.json({ ok: false, error: p.reden, onboarding: p.ontbreekt }, { status: 400 });

  const lopend = await getKlus(slug, "zoekwoordkansen").catch(() => null);
  if (lopend?.status === "bezig") return NextResponse.json({ ok: true, alBezig: true });

  waitUntil(draaiKlus(slug, "zoekwoordkansen", "Zoekwoordkansen verzamelen", 0, async (stap) => {
    await stap(0, "De zoekwoorden van de concurrenten vergelijken met die van de klant");
    const res = await collectOpportunities(slug);
    if (!res.ok) throw new Error(res.error || "Verzamelen mislukte.");
    return `${res.total ?? 0} kansen verzameld.`;
  }));
  return NextResponse.json({ ok: true, gestart: true });
}
