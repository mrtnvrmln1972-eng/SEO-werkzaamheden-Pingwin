import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { alleSchermen, vernieuwAlleSchermen, SCHERMEN } from "../../../../lib/schermbeeld";

export const runtime = "nodejs";
export const maxDuration = 300;

// R14: schermafbeeldingen die het dashboard zelf van zichzelf maakt (zie
// lib/schermbeeld.ts). GET geeft de huidige set terug, POST maakt ze allemaal
// opnieuw. Eigenaar-only: dit doet alsof het Maarten zelf is die inlogt.
export async function GET(req: NextRequest) {
  const g = await guardOwner(req);
  if (!g.ok) return g.res;
  const schermen = await alleSchermen();
  return NextResponse.json({ ok: true, schermen, verwacht: SCHERMEN.length });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req);
  if (!g.ok) return g.res;
  const uitslagen = await vernieuwAlleSchermen(req.nextUrl.origin);
  const gelukt = uitslagen.filter((u) => u.ok).length;
  return NextResponse.json({ ok: gelukt > 0, uitslagen, gelukt, totaal: uitslagen.length });
}
