import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { haalNulmeting, zetNagelopen } from "../../../../../lib/nulmeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE NULMETING VAN ALLE SCHERMEN
// ═══════════════════════════════════════════════════════════
// GET                                     welke schermen zijn nagelopen
// POST { sleutel, aan, notitie }          een scherm afvinken of het vinkje weghalen
//
// De lijst schermen staat hier bewust niet in: die komt uit het Intern-menu en
// de tabbalk van een klant, en die twee lijsten bestaan al. Hier staat alleen de
// uitkomst, anders is er een derde lijst die na een maand iets anders zegt.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, nulmeting: await haalNulmeting() });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const sleutel = String(body?.sleutel ?? "").trim();
  if (!sleutel) return NextResponse.json({ ok: false, error: "Welk scherm?" }, { status: 400 });
  await zetNagelopen(sleutel, body?.aan !== false, String(body?.notitie ?? ""));
  return NextResponse.json({ ok: true, nulmeting: await haalNulmeting() });
}
