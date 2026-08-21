import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { SNIPPET_BESTAND, WP_SNIPPET } from "../../../../lib/wp-snippet";

export const runtime = "nodejs";

// Het bestand dat de SEO-velden openzet voor de WordPress-API, als download.
// De foutmelding op het meta-scherm verwees hiernaar terwijl het nergens te
// krijgen was; zie de uitleg bovenaan lib/wp-snippet.ts.
//
// Het bestand is voor élke site hetzelfde en bevat niets van een klant, maar hij
// wordt opgehaald vanaf het scherm van één klant. Daarom gewoon dezelfde poort
// als de rest van dat scherm: dan geldt in een klantvenster ook hier één klant.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return new NextResponse("Geen toegang.", { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  return new NextResponse(WP_SNIPPET, {
    headers: {
      // Bewust als platte tekst: dit bestand hoort op een WordPress-site te
      // landen, niet hier uitgevoerd te worden.
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${SNIPPET_BESTAND}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
