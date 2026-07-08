import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { getGscForPage } from "../../../../../lib/google";

export const runtime = "nodejs";

// Zoekwoorden waarop één pagina rankt (Search Console), voor de uitklap in de
// Pagina's-lijst van de KPI-tab: zoekwoord + klikken + vertoningen + positie.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url) return NextResponse.json({ ok: false, error: "Geen pagina-URL." }, { status: 400 });
  const days = Math.max(1, Math.min(400, Number(req.nextUrl.searchParams.get("days")) || 28));
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  try {
    const keywords = await getGscForPage(client.domain || "", url, days);
    return NextResponse.json({ ok: true, keywords });
  } catch {
    return NextResponse.json({ ok: false, error: "Kon de zoekwoorden niet ophalen." }, { status: 500 });
  }
}
