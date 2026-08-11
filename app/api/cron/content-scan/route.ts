import { NextRequest, NextResponse } from "next/server";
import { listClients } from "../../../../lib/clients";
import { getClientUrls, scanClientUrls } from "../../../../lib/site-urls";
import { scanPaginas, klantenOpMeetVolgorde, markeerContentScan } from "../../../../lib/content-tracking";

export const runtime = "nodejs";
export const maxDuration = 300;
// Nooit bij de build uitvoeren/prerenderen: dit draait de scan (externe fetches +
// DB) en zou anders tijdens 'next build' time-outen. Alleen op aanvraag draaien.
export const dynamic = "force-dynamic";

// Een run mag vijf minuten duren; we stoppen ruim daarvoor met een nieuwe klant
// beginnen, zodat de laatste klant zijn meting nog kan afmaken en wegschrijven.
const BUDGET_MS = 230_000;

// Wekelijkse automatische scan (Vercel Cron, maandag 4u): per klant de sitemap
// verversen en alle live pagina's op wijzigingen controleren. Zo verschijnen
// wijzigingen vanzelf, zonder handmatig scannen.
//
// De klanten gaan NIET op naam maar op "wie is het langst niet aan de beurt
// geweest". Anders haalt de cron binnen zijn vijf minuten alleen de eerste
// klanten, elke week opnieuw dezelfde, en blijven de pagina's van de klanten
// verderop in het alfabet maandenlang op een oude meting staan.
export async function GET(req: NextRequest) {
  // Beveiliging: als CRON_SECRET gezet is, moet de Authorization-header kloppen
  // (Vercel Cron stuurt die mee). Zonder secret laten we hem toe (voor handmatig testen).
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  const start = Date.now();
  const clients = await listClients().catch(() => []);
  const opVolgorde = await klantenOpMeetVolgorde(clients.map((c) => c.slug)).catch(() => clients.map((c) => c.slug));
  const bySlug = new Map(clients.map((c) => [c.slug, c]));

  const report: { client: string; scanned: number; changed: number }[] = [];
  const overgeslagen: string[] = [];
  for (const slug of opVolgorde) {
    const c = bySlug.get(slug);
    if (!c) continue;
    if (Date.now() - start > BUDGET_MS) { overgeslagen.push(slug); continue; }
    try {
      if (c.domain) await scanClientUrls(c.slug, c.domain).catch(() => null);
      const urls = (await getClientUrls(c.slug).catch(() => []))
        .filter((u) => u.status && u.status >= 200 && u.status < 300)
        .map((u) => u.url)
        .slice(0, 200);
      const { scanned, changed } = await scanPaginas(c.slug, urls);
      await markeerContentScan(c.slug, scanned).catch(() => null);
      report.push({ client: c.slug, scanned, changed });
    } catch { report.push({ client: c.slug, scanned: 0, changed: 0 }); }
  }
  // Wie niet aan de beurt kwam, staat volgende run vooraan: de volgorde komt
  // uit last_run_at, en die is voor deze klanten niet bijgewerkt.
  return NextResponse.json({ ok: true, clients: report.length, report, overgeslagen });
}
