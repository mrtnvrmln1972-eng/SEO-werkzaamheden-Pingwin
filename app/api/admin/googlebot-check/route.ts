import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { googlebotCheck } from "../../../../lib/googlebot-check";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET: vraag Google zelf wat Googlebot van een handjevol pagina's vindt
// (URL-inspectie). Bewust een GET zonder bijwerkingen, zodat de meekijk-sessie
// (alleen-lezen) hem ook kan draaien.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;
  // Diagnosemodus: laat Google zelf vertellen wat het geminte token is (welke
  // rechten, hoe lang geldig) en test beide aanroepstijlen. Geen tokenwaarde in
  // het antwoord, alleen de eigenschappen.
  if (req.nextUrl.searchParams.get("diag") === "1") {
    const { getGoogleAccessToken } = await import("../../../../lib/google");
    const token = await getGoogleAccessToken();
    if (!token) return NextResponse.json({ ok: false, error: "Geen token." }, { status: 400 });
    const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    const zonderCacheOptie = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.status).catch(() => 0);
    const metNoStore = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.status).catch(() => 0);
    // Tweede munt plus metadata van de koppelingsrij (géén geheime waarden).
    const token2 = await getGoogleAccessToken();
    const info2 = token2 ? await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token2)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null) : null;
    const { sql } = await import("../../../../lib/db");
    const { rows } = await sql`SELECT provider, account, updated_at, length(refresh_token) AS rt_lengte, left(refresh_token, 4) AS rt_soort FROM oauth_tokens WHERE provider LIKE 'google%' ORDER BY provider`;
    return NextResponse.json({
      ok: true,
      munt1: { lengte: token.length, soort: token.slice(0, 5), scope: info?.scope || info?.error || null, verlooptOverSec: info?.expires_in || null },
      munt2: token2 ? { lengte: token2.length, soort: token2.slice(0, 5), zelfde: token2 === token, scope: info2?.scope || info2?.error || null } : null,
      zonderCacheOptie, metNoStore,
      rijen: rows.map((r) => ({ provider: r.provider, account: r.account, bijgewerkt: r.updated_at, rtLengte: Number(r.rt_lengte), rtSoort: r.rt_soort })),
    });
  }

  const urls = (req.nextUrl.searchParams.get("urls") || "").split(",").filter(Boolean);
  if (!urls.length) return NextResponse.json({ ok: false, error: "Geen pagina's opgegeven." }, { status: 400 });
  const uitkomst = await googlebotCheck(slug, urls);
  return NextResponse.json(uitkomst, { status: uitkomst.ok ? 200 : 400 });
}
