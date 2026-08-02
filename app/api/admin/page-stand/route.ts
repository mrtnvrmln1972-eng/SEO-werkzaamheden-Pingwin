import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getWeekplanPages } from "../../../../lib/overview";
import { urlKey } from "../../../../lib/url-key";
import { sql, ensureSchema } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

// De stand van één pagina, uit de DATABASE.
//
// Waarom dit bestaat: de Pagina's-tab bewaarde "strategie gedaan", "doorgegeven aan
// gelieerde pagina's" en "documenten gemaakt" in localStorage van de browser. Op een
// andere computer, een ander profiel of na het legen van de cache stond alles daar
// weer op nul, ook al was het werk gedaan. De weekplanning keek intussen wél in de
// database, dus dezelfde vraag kreeg op twee schermen een ander antwoord.
//
// Dit endpoint geeft precies de stand die de weekplan-kaart ook gebruikt, plus de
// pagina's die advies kregen, zodat je achteraf kunt zien wat er is uitgegaan.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    const k = urlKey(url);
    const [pages, advies] = await Promise.all([
      getWeekplanPages(slug, new Set([k])).catch(() => ({} as Awaited<ReturnType<typeof getWeekplanPages>>)),
      ensureSchema()
        .then(() => sql`SELECT url, created_at FROM page_cluster_advice
                        WHERE client_slug = ${slug} AND source_url = ${url}
                        ORDER BY created_at DESC`)
        .then((r) => r.rows)
        .catch(() => [] as Record<string, unknown>[]),
    ]);

    const p = pages[k] || null;
    return NextResponse.json({
      ok: true,
      stand: p,
      // Welke pagina's kregen advies vanuit deze pagina. De melding na het starten
      // verdween en daarna was nergens meer te zien dát het gebeurd was.
      gelieerdeUrls: advies.map((a) => ({
        url: String(a.url),
        wanneer: a.created_at ? new Date(a.created_at as string).toISOString() : null,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "De stand kon niet opgehaald worden." }, { status: 500 });
  }
}
