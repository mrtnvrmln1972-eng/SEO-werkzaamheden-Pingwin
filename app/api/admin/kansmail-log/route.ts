import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { laatsteKansmails, logKansmail } from "../../../../lib/kansmail-log";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET ?slug=&soort= : hoe de laatste mails van dit soort aan deze klant begonnen.
// Het scherm gebruikt dat om de volgende mail vanuit een andere invalshoek en met
// een ander stuk werkwijze te laten schrijven.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const soort = req.nextUrl.searchParams.get("soort") || "";
  if (!slug || !soort) return NextResponse.json({ ok: false, error: "Klant en soort zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, regels: await laatsteKansmails(slug, soort, 6) });
}

// POST: onthouden dat er een mail uit is gegaan, met de invalshoek en de openingszin.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const soort = String(body.soort || "").trim();
  if (!slug || !soort) return NextResponse.json({ ok: false, error: "Klant en soort zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await logKansmail(slug, soort, String(body.invalshoek || ""), String(body.werkwijze || ""), String(body.opening || ""));
  return NextResponse.json({ ok: true });
}
