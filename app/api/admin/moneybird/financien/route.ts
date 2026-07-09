import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../../lib/admin-scope";
import { getProfitLoss, getProfitLossRaw, getLedgerAccounts, moneybirdConfigured } from "../../../../../lib/moneybird";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Financiële data voor de begrotingspagina (alleen eigenaar).
// ?period=202607 of ?period=202601..202612 (hele maanden, zoals Moneybird eist).
// ?raw=pl geeft de onbewerkte rapport-respons terug (debug van veldnamen).

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  if (!moneybirdConfigured()) return NextResponse.json({ ok: true, configured: false });

  const period = (req.nextUrl.searchParams.get("period") || "this_year").trim();

  try {
    if (req.nextUrl.searchParams.get("raw") === "pl") {
      return NextResponse.json({ ok: true, configured: true, raw: await getProfitLossRaw(period) });
    }
    const [profitLoss, ledger] = await Promise.all([getProfitLoss(period), getLedgerAccounts()]);
    return NextResponse.json({ ok: true, configured: true, profitLoss, ledger });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 502 });
  }
}
