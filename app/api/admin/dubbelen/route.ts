import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { vindDubbelen, voegSamen } from "../../../../lib/samenvoegen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bedrijven die twee keer in de lijst staan: één keer met de hand aangemaakt en
// één keer opgehaald uit HubSpot. Zoeken mag automatisch, samenvoegen nooit:
// dat is onomkeerbaar en gaat dus per paar op een knop.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, paren: await vindDubbelen() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as { behoud?: string; weg?: string };
  try {
    const uit = await voegSamen(String(body.behoud || ""), String(body.weg || ""));
    return NextResponse.json(uit, { status: uit.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
