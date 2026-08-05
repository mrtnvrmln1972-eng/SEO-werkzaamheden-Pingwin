import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWeekplanPages } from "../../../../lib/overview";

export const runtime = "nodejs";
export const maxDuration = 30;

// De fase-stand van ALLE pagina's van een klant, in één call.
//
// Waarom apart: de weekplanning toonde de zeven fases (strategie tot en met
// structured data) alleen op de kaarten die in het bord staan. In de Pagina's-lijst
// was diezelfde stand onzichtbaar, terwijl dat juist het overzicht is waar je kiest
// waar je verder gaat. Dit endpoint geeft precies dezelfde stand als de kaart, zodat
// beide schermen nooit iets anders kunnen beweren; de rekenkern staat in
// lib/overview.ts (getWeekplanPages) en wordt hier alleen uitgeserveerd.
//
// Bewust smal: alleen de zeven booleans per pagina, geen cijfers of links. Dat
// houdt de payload klein, want dit gaat over ALLE pagina's van de klant.

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const alle = await getWeekplanPages(slug);
    const pages: Record<string, Record<string, boolean>> = {};
    for (const [k, p] of Object.entries(alle)) {
      pages[k] = {
        strategie: !!p.strategie, gelieerde: !!p.gelieerde, analyse: !!p.analyse,
        blauwdruk: !!p.blauwdruk, copy: !!p.copy, bouw: !!p.bouw, structured: !!p.structured,
      };
    }
    return NextResponse.json({ ok: true, pages });
  } catch {
    return NextResponse.json({ ok: false, error: "Kon de fase-stand niet ophalen." }, { status: 500 });
  }
}
