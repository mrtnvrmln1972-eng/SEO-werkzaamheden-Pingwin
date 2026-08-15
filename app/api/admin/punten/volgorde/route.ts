import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { zetVolgorde, haalPunten } from "../../../../../lib/grote-punten";
import { wachtrijMetTijden } from "../../../../../lib/punt-ronde";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De volgorde van de bouwwachtrij: die bepaalt wat er vannacht als eerste
// gebeurt. Bewust een aparte route ZONDER de meekijk-uitzondering: wat als
// eerste gebouwd wordt is een keuze van Maarten, en een ronde hoort zichzelf
// niet naar voren te kunnen schuiven.
export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.map((x: unknown) => Number(x)).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "Geen volgorde meegestuurd." }, { status: 400 });
  await zetVolgorde(ids);
  const wachtrij = await wachtrijMetTijden();
  return NextResponse.json({ ok: true, punten: await haalPunten(), starts: wachtrij.starts });
}
