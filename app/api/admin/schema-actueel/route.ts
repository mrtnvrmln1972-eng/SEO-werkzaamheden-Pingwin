import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getSchemaActueel, runSchemaActueel } from "../../../../lib/schema-actueel";
import { vensterPoort } from "../../../../lib/klantvenster";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const stand = await getSchemaActueel();
  return NextResponse.json({ ok: true, stand });
}

// Ververs de stand via websearch (ook de "maandelijkse" run: het panel vraagt
// erom zodra de vorige stand ouder is dan een maand).
export async function POST(req: NextRequest) {
  const weg = vensterPoort(); if (weg) return weg;
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  try {
    const stand = await runSchemaActueel();
    return NextResponse.json({ ok: true, stand });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Onderzoek mislukte: " + (e as Error).message }, { status: 500 });
  }
}
