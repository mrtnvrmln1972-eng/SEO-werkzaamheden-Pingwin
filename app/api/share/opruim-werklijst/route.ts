import { NextRequest, NextResponse } from "next/server";
import { getSlugByOpruimToken } from "../../../../lib/opruim-deel";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { bouwWerklijst, tellingen } from "../../../../lib/opruim-werklijst";

export const runtime = "nodejs";
export const maxDuration = 300;

// Dezelfde werklijst als in de cockpit, maar via het deeltoken in plaats van een
// admin-cookie. Bewust dezelfde bouwstenen: een tweede versie van deze lijst zou
// achterlopen zodra er iets aan de eerste verandert, en dat is precies hoe de
// klantversie een ronde achterop raakte.
//
// Alleen lezen: er is geen POST, en alles wat een besluit vastlegt (op de
// planning zetten, corrigeren, doorvoeren) zit achter de adminroutes.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByOpruimToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });

  try {
    const domain = (await getClientBySlug(slug).catch(() => null))?.domain || "";
    const [st, plaatsen] = await Promise.all([
      getCannibalAnalysis(slug),
      domain ? zorgVoorPlaatsen(slug, domain).catch(() => null) : Promise.resolve(null),
    ]);
    const regels = bouwWerklijst(st.result, plaatsen?.adviezen || []);
    return NextResponse.json({ ok: true, regels, tellingen: tellingen(regels), lijstDatum: st.result?.generatedAt || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lijst bouwen mislukt." }, { status: 500 });
  }
}
