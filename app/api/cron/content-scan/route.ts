import { NextRequest, NextResponse } from "next/server";
import { listClients } from "../../../../lib/clients";
import { getClientUrls, scanClientUrls } from "../../../../lib/site-urls";
import { captureAndDetect } from "../../../../lib/content-tracking";

export const runtime = "nodejs";
export const maxDuration = 300;
// Nooit bij de build uitvoeren/prerenderen: dit draait de scan (externe fetches +
// DB) en zou anders tijdens 'next build' time-outen. Alleen op aanvraag draaien.
export const dynamic = "force-dynamic";

// Wekelijkse automatische scan (Vercel Cron, maandag 4u): per klant de sitemap
// verversen en alle live pagina's op wijzigingen controleren. Zo verschijnen
// wijzigingen vanzelf, zonder handmatig scannen.
export async function GET(req: NextRequest) {
  // Beveiliging: als CRON_SECRET gezet is, moet de Authorization-header kloppen
  // (Vercel Cron stuurt die mee). Zonder secret laten we hem toe (voor handmatig testen).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  const clients = await listClients().catch(() => []);
  const report: { client: string; scanned: number; changed: number }[] = [];
  for (const c of clients) {
    try {
      if (c.domain) await scanClientUrls(c.slug, c.domain).catch(() => null);
      const urls = (await getClientUrls(c.slug).catch(() => []))
        .filter((u) => u.status && u.status >= 200 && u.status < 300)
        .map((u) => u.url)
        .slice(0, 200);
      let scanned = 0, changed = 0;
      const POOL = 5;
      for (let i = 0; i < urls.length; i += POOL) {
        const batch = urls.slice(i, i + POOL);
        const results = await Promise.all(batch.map((u) => captureAndDetect(c.slug, u).catch(() => ({ changed: false }))));
        scanned += batch.length;
        changed += results.filter((r) => r.changed).length;
      }
      report.push({ client: c.slug, scanned, changed });
    } catch { report.push({ client: c.slug, scanned: 0, changed: 0 }); }
  }
  return NextResponse.json({ ok: true, clients: report.length, report });
}
