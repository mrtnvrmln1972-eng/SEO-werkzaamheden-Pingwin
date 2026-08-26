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
  try {
    // createViewKey heeft de sleutel hier al door dezelfde deur gehaald die
    // Claude gebruikt; komt hij daar niet doorheen, dan gooit hij. `getest`
    // hoort dus bij dít antwoord. Eerder deed het scherm daarna zelf nog een
    // tweede verzoek om het te controleren, en juist dat tweede verzoek zei
    // "de ingang accepteert hem nog niet" terwijl de sleutel gewoon goed was.
    const sleutel = await createViewKey();
    return NextResponse.json({ ok: true, sleutel, getest: true });
  } catch (e) {
    // createViewKey deelt sinds 26-08-2026 alleen een sleutel uit die hij zelf
    // door de controle heeft gehaald. Lukt dat niet, dan hoort de reden op het
    // scherm te staan in plaats van een sleutel die nergens werkt.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "De sleutel kon niet aangemaakt worden." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await revokeViewKey();
  return NextResponse.json({ ok: true });
}
