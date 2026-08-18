import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { leesHuisstijl, bewaarHuisstijl, vergeetHuisstijl } from "../../../../lib/huisstijl";
import { BASIS, zelfdeThema, type Thema } from "../../../../lib/proefstijl";

export const runtime = "nodejs";

// Het vastleggen van de huisstijl. Alleen de eigenaar: dit verandert hoe het
// dashboard er voor iedereen uitziet, klanten inbegrepen, dus het is geen knop
// die een gast of een developer per ongeluk mag omzetten.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, thema: await leesHuisstijl() });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;

  const body = await req.json().catch(() => null) as { thema?: Thema | null } | null;
  const thema = body?.thema ?? null;

  // Wat er binnenkomt wordt nagekeken in plaats van geloofd: dit gaat rechtstreeks
  // de opmaak van elke pagina in. Een kleur die geen kleur is, zou het hele blok
  // ongeldig maken en dan valt de stijl van het dashboard om.
  if (thema !== null) {
    const kleurOk = typeof thema.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(thema.accent);
    const letterOk = typeof thema.letter === "string" && thema.letter.length < 120 && !/[{};<]/.test(thema.letter);
    const getalOk = (n: unknown, min: number, max: number) =>
      typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
    const rondingOk = Array.isArray(thema.ronding) && thema.ronding.length === 3
      && thema.ronding.every((n) => getalOk(n, 0, 40));
    if (!kleurOk || !letterOk || !rondingOk
      || !getalOk(thema.ruimte, 0.5, 2) || !getalOk(thema.tekst, 0.7, 1.5) || !getalOk(thema.diepte, 0, 3)) {
      return NextResponse.json({ ok: false, error: "Deze stand klopt niet." }, { status: 400 });
    }
  }

  const bewaren = thema && !zelfdeThema(thema, BASIS) ? { ...thema, naam: String(thema.naam || "Eigen stand").slice(0, 60) } : null;
  await bewaarHuisstijl(bewaren);
  vergeetHuisstijl();
  return NextResponse.json({ ok: true, thema: bewaren });
}
