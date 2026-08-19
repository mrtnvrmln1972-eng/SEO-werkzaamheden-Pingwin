import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { gedragVoorPagina } from "../../../../../lib/pagina-lab/gedrag";

// ═══════════════════════════════════════════════════════════
// WAT BEZOEKERS OP ÉÉN PAGINA DEDEN (Pagina-lab, alleen lezen)
// ═══════════════════════════════════════════════════════════
// Analytics en Clarity naast elkaar voor één adres. Bewust alleen GET: deze
// route haalt niets op bij Clarity zelf (dat mag maar tien keer per dag en
// gebeurt op /api/admin/gedrag), hij leest de laatst opgehaalde meting.
// ═══════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Geef een klant en een adres op." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const dagen = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("dagen")) || 28));
  const klant = await getClientBySlug(slug);
  const uitkomst = await gedragVoorPagina(slug, url, dagen, klant?.domain || "");
  return NextResponse.json({ ok: true, ...uitkomst });
}
