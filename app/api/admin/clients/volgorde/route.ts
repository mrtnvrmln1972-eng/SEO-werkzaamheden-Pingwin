import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../../lib/admin-scope";
import { setClientsVolgorde } from "../../../../../lib/clients";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// DE VOLGORDE VAN DE KLANTEN-/LEADLIJST
// ═══════════════════════════════════════════════════════════
// POST { ids: [3, 7, 1] } — de lijst in precies deze volgorde. De hele lijst
// in één keer, niet "verplaats klant 7 naar plek 2"; zie de tweak-wachtrij
// (app/api/admin/tweaks/volgorde) voor dezelfde reden.
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => n > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Geen volgorde meegestuurd." }, { status: 400 });
  }
  await setClientsVolgorde(ids);
  return NextResponse.json({ ok: true });
}
