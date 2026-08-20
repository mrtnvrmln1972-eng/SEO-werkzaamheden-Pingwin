import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug, getScopeFromCookie, canAccessSlug } from "../../../../lib/admin-scope";
import { ADMIN_VIEWAS_COOKIE } from "../../../../lib/constants";
import { listClients } from "../../../../lib/clients";
import { getOnboardingStand, getOnboardingSignalen, wisSignaalCache } from "../../../../lib/onboarding";
import { getOnboardingRun, startOnboardingRun, draaiOnboardingRun } from "../../../../lib/onboarding-run";
import { isKlant } from "../../../../lib/klant-groepen";

export const runtime = "nodejs";
// De rit wacht de korte stappen af (site uitlezen, profiel, tone of voice,
// concurrenten, kansen) en start daarna de lange scans zonder te wachten.
export const maxDuration = 800;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug=... : de volledige stand van één klant plus de laatste rit.
// GET ?alle=1   : één regel per klant voor het signaal in de klantenlijst.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });

  if (req.nextUrl.searchParams.get("alle") === "1") {
    const scope = await getScopeFromCookie(req.cookies.get(ADMIN_COOKIE)?.value, req.cookies.get(ADMIN_VIEWAS_COOKIE)?.value);
    if (!scope) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
    const clients = await listClients();
    // Alleen lopende klanten (geen leads, geen verloren deals) en alleen wat
    // deze gebruiker mag zien.
    const slugs = clients.filter((c) => isKlant(c) && canAccessSlug(scope, c.slug)).map((c) => c.slug);
    return NextResponse.json({ ok: true, signalen: await getOnboardingSignalen(slugs) });
  }

  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const [stand, run] = await Promise.all([getOnboardingStand(slug), getOnboardingRun(slug)]);
  return NextResponse.json({ ok: true, stand, run });
}

// POST: de onboarding starten. Wat al af is wordt overgeslagen, dus dit is ook
// de knop voor een bestaande klant die alleen de gaten wil laten vullen.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const lopend = await getOnboardingRun(slug);
  if (lopend.status === "running") return NextResponse.json({ ok: false, error: "De onboarding loopt al." }, { status: 400 });

  await startOnboardingRun(slug);
  wisSignaalCache();
  waitUntil(draaiOnboardingRun(slug));
  return NextResponse.json({ ok: true, started: true });
}
