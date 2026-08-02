import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getDocumentenOverzicht } from "../../../../lib/documenten";

export const runtime = "nodejs";
export const maxDuration = 60;

// Alle documenten van één klant op een rij: per pagina welke analyse, blauwdruk en
// copy er zijn, van wanneer, en of de copy inmiddels op de site staat.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const paginas = await getDocumentenOverzicht(slug);
    return NextResponse.json({
      ok: true,
      paginas,
      totaal: paginas.reduce((n, p) => n + p.docs.length, 0),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Het documentenoverzicht kon niet opgehaald worden." }, { status: 500 });
  }
}
