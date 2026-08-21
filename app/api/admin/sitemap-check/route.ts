import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sitemapCheck } from "../../../../lib/sitemap-check";
import { bewaarDeelStand } from "../../../../lib/deel-link";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

// GET: de sitemap van de klant vers ophalen en naast de spiegel leggen.
// Bewust een GET zonder bijwerkingen: de meekijk-sessie (alleen-lezen) kan de
// controle dus ook gewoon zien draaien.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;
  const uitkomst = await sitemapCheck(slug);
  // De stand achter de deel-link is altijd de laatste controle die hier gedraaid
  // heeft. Zo hoeft de publieke route zelf niets te berekenen (zie lib/deel-link.ts)
  // en ziet een meelezer exact hetzelfde als Maarten, met de datum erbij.
  if (uitkomst.ok) await bewaarDeelStand("sitemap", slug, uitkomst).catch(() => { /* delen mag de controle nooit blokkeren */ });
  return NextResponse.json(uitkomst, { status: uitkomst.ok ? 200 : 400 });
}
