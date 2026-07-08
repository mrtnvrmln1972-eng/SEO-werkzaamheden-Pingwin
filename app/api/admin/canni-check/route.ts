import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscForPage } from "../../../../lib/google";
import { getUrlOrganicKeywords, getAhrefsTopPages, ahrefsConfigured } from "../../../../lib/ahrefs";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { canniRowDuiding } from "../../../../lib/page-cannibal";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Cross-check van één pagina uit de cannibalisatie-tabel: hoe staat die pagina
// er echt voor (GSC-topzoekwoorden, Ahrefs-rankings, verwijzende domeinen),
// zodat Maarten per rij kan beoordelen vóór hij uitvoert/doorzet/afwijst.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const pageUrl = req.nextUrl.searchParams.get("url") || "";
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!slug || !pageUrl || !path.startsWith("/")) return NextResponse.json({ ok: false, error: "Geen klant of pagina opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const client = await getClientBySlug(slug);
    const domain = client?.domain || "";
    if (!domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });
    let origin = "";
    try { origin = new URL(pageUrl).origin; } catch { origin = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`; }
    const fullUrl = origin + path;

    const [gsc, kws, topPages] = await Promise.all([
      getGscForPage(domain, fullUrl, 90).catch(() => []),
      ahrefsConfigured() ? getUrlOrganicKeywords(fullUrl).catch(() => []) : Promise.resolve([]),
      ahrefsConfigured() ? getAhrefsTopPages(domain).catch(() => []) : Promise.resolve([]),
    ]);
    const norm = (p: string) => (p || "").replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "") || "/";
    const refDomains = topPages.find((t) => norm(t.url) === norm(path))?.refDomains ?? null;

    return NextResponse.json({
      ok: true,
      fullUrl,
      refDomains,
      gsc: gsc
        .sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions))
        .slice(0, 12),
      ahrefs: kws
        .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0) || (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 12),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Check mislukt." }, { status: 500 });
  }
}

// POST: diepere duiding op aanvraag (AI legt de GSC-data van rij-pagina en
// winnaar naast elkaar: echte splitsing of niet, en klopt de voorgestelde actie).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const pageUrl = String(body.pageUrl || "").trim();
  const rowPath = String(body.rowPath || "").trim();
  if (!slug || !pageUrl || !rowPath.startsWith("/")) return NextResponse.json({ ok: false, error: "Geen klant of pagina opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    const duiding = await canniRowDuiding(slug, pageUrl, rowPath);
    return NextResponse.json({ ok: true, duiding });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Duiding mislukt." }, { status: 500 });
  }
}
