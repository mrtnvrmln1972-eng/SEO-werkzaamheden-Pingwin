import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { zetVolgorde, haalTweaks } from "../../../../../lib/tweaks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE VOLGORDE VAN DE WACHTRIJ
// ═══════════════════════════════════════════════════════════
// POST { ids: [3, 7, 1] } — de wachtrij in precies deze volgorde.
//
// De hele lijst in één keer, niet "verplaats melding 7 naar plek 2". Zo kan de
// volgorde op het scherm niet uiteenlopen met die in de database: wat je ziet is
// wat er is opgeslagen, ook als er tussendoor een melding bijkwam.
//
// Alleen Maarten sleept. De meekijk-sessie mag standen bijwerken, maar niet
// bepalen wat er als eerste aan de beurt is.
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => n > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Geen volgorde meegestuurd." }, { status: 400 });
  }
  await zetVolgorde(ids);
  return NextResponse.json({ ok: true, tweaks: await haalTweaks(true) });
}
