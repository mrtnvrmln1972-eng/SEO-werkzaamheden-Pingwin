import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getViewKeyStatus, createViewKey, revokeViewKey, viewKeyDiagnose } from "../../../../lib/claude-view-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Beheer van de kijk-sleutel waarmee Claude meekijkt. Alleen de eigenaar:
// een gast (of Claude zelf) mag hier niet bij, anders zou een alleen-lezen
// sessie zichzelf een nieuwe sleutel kunnen aanmaken.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  // De telling hoort hier, achter de adminlogin: hoeveel sleutels er zijn, welke
  // actief is en wanneer hij is aangemaakt. Zo is een rare situatie na te kijken
  // zonder dat er iets van op een open ingang komt te staan.
  const [status, diagnose] = await Promise.all([getViewKeyStatus(), viewKeyDiagnose().catch(() => null)]);
  return NextResponse.json({ ok: true, ...status, diagnose });
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
