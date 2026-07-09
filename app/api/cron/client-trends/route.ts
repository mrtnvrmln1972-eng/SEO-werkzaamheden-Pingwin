import { NextRequest, NextResponse } from "next/server";
import { listClients } from "../../../../lib/clients";
import { getGscComparison, googleStatus } from "../../../../lib/google";
import { saveClientTrend } from "../../../../lib/trends";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Nachtelijke berekening van de KPI-trend per klant (28 dagen en 3 maanden),
// voor de "mooie ontwikkeling"-selectie in de klanten-dropdown.
// Mooi = klikken minstens +10% t.o.v. de vorige periode (en niet uit bijna
// niets: minimaal 10 klikken), terwijl de vertoningen niet wegzakken.

function isGood(clicksNow: number, clicksPrev: number, imprNow: number, imprPrev: number): boolean {
  if (clicksNow < 10) return false;
  if (clicksNow < clicksPrev * 1.1) return false;
  return imprNow >= imprPrev * 0.95;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const google = await googleStatus();
  if (!google.connected) return NextResponse.json({ ok: true, skipped: "Google niet gekoppeld." });

  const clients = await listClients();
  let done = 0, failed = 0;
  for (const client of clients) {
    if (!client.domain) continue;
    for (const days of [28, 90] as const) {
      try {
        const gsc = await getGscComparison(client.domain, days, "prev");
        if (!gsc?.totals) continue;
        const c = gsc.totals.clicks, i = gsc.totals.impressions;
        await saveClientTrend(client.slug, days === 28 ? "28d" : "90d", {
          clicksNow: c.cur, clicksPrev: c.prev,
          impressionsNow: i.cur, impressionsPrev: i.prev,
          isGood: isGood(c.cur, c.prev, i.cur, i.prev),
        });
        done++;
      } catch { failed++; }
    }
  }
  return NextResponse.json({ ok: true, computed: done, failed });
}
