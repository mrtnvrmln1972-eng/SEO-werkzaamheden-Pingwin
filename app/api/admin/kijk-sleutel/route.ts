import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getViewKeyStatus, createViewKey, revokeViewKey } from "../../../../lib/claude-view-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Beheer van de kijk-sleutel waarmee Claude meekijkt. Alleen de eigenaar:
// een gast (of Claude zelf) mag hier niet bij, anders zou een alleen-lezen
// sessie zichzelf een nieuwe sleutel kunnen aanmaken.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, ...(await getViewKeyStatus()) });
}

// Nieuwe sleutel. De platte waarde komt hier één keer terug en wordt daarna
// nergens meer bewaard; in de database staat alleen de hash.
export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const sleutel = await createViewKey();
  return NextResponse.json({ ok: true, sleutel });
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await revokeViewKey();
  return NextResponse.json({ ok: true });
}
