import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import { alleSchermen, vernieuwAlleSchermen, SCHERMEN } from "../../../../lib/schermbeeld";

export const runtime = "nodejs";
export const maxDuration = 300;

// R14: schermafbeeldingen die het dashboard zelf van zichzelf maakt (zie
// lib/schermbeeld.ts). GET geeft de huidige set terug, POST maakt ze allemaal
// opnieuw (en logt daarbij zelf in met een admin-sessie). guardDev laat de
// eigenaar en teamleden met het dev-recht meekijken; alleen-lezen sessies
// (de meekijk-modus) kunnen hier wél kijken maar niets vernieuwen.
export async function GET(req: NextRequest) {
  const g = await guardDev(req);
  if (!g.ok) return g.res;
  const schermen = await alleSchermen();
  return NextResponse.json({ ok: true, schermen, verwacht: SCHERMEN.length });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req);
  if (!g.ok) return g.res;
  const uitslagen = await vernieuwAlleSchermen(req.nextUrl.origin);
  const gelukt = uitslagen.filter((u) => u.ok).length;
  return NextResponse.json({ ok: gelukt > 0, uitslagen, gelukt, totaal: uitslagen.length });
}
