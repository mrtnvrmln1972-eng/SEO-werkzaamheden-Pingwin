import { NextRequest, NextResponse } from "next/server";
import { herstelVastgelopen, runControle } from "../../../../lib/mail-controle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// Vangnet voor controles die halverwege stilvielen, bijvoorbeeld doordat er een
// nieuwe versie werd uitgerold terwijl de werker bezig was. De controle zelf start
// gewoon meteen bij het indrukken van de knop; deze cron pikt alleen op wat blijft
// liggen, en stopt na drie pogingen definitief zodat een controle die telkens
// sneuvelt geen AI-kosten blijft stapelen.
export async function GET(req: NextRequest) {
  const geheim = process.env.CRON_SECRET;
  if (geheim) {
    const meegegeven = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (meegegeven !== geheim) {
      return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
    }
  }

  const ids = await herstelVastgelopen().catch(() => [] as number[]);
  for (const id of ids.slice(0, 3)) {
    await runControle(id).catch(() => null);
  }
  return NextResponse.json({ ok: true, hervat: ids.length });
}
