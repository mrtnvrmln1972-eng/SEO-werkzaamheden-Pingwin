import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getGscForPage } from "../../../../lib/google";
import { cacheGet, cacheSet, getKeywordsOverview } from "../../../../lib/ahrefs";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET ?slug=&url= : alle zoekwoorden waar één pagina nu op scoort in Google
// (Search Console, laatste 90 dagen), gesorteerd op klikken. Een halve dag
// gecached zodat herhaald openklappen niets kost.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  if (!domain) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingesteld." }, { status: 400 });

  type Kw = { keyword: string; clicks: number; impressions: number; position: number; volume: number | null };
  let rows: Kw[] | null = await cacheGet<Kw[]>("gsc_page_kws2", domain, url, 0.5).catch(() => null);
  if (!rows) {
    const gsc = await getGscForPage(domain, url, 90).catch(() => []);
    gsc.sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions));
    rows = gsc.map((k) => ({ ...k, volume: null }));
    // Maandelijks zoekvolume erbij (Ahrefs, per zoekwoord 30 dagen gecached);
    // maximaal de eerste 100 zoekwoorden om het unit-verbruik te begrenzen.
    try {
      const vols = await getKeywordsOverview(rows.slice(0, 100).map((r) => r.keyword));
      const volMap = new Map(vols.map((v) => [v.keyword, v.volume]));
      for (const r of rows) r.volume = volMap.get(r.keyword.trim().toLowerCase()) ?? null;
    } catch { /* volume is aanvulling */ }
    await cacheSet("gsc_page_kws2", domain, url, rows).catch(() => {});
  }
  return NextResponse.json({ ok: true, keywords: rows });
}
