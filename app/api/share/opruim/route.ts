import { NextRequest, NextResponse } from "next/server";
import { getSlugByOpruimToken } from "../../../../lib/opruim-deel";
import { getCannibalAnalysis } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { paginaStructuur } from "../../../../lib/opruim-structuur";
import { bouwEindstructuur } from "../../../../lib/opruim-eindstructuur";

export const runtime = "nodejs";
export const maxDuration = 60;

// Publiek, alleen lezen. Het token is de toegang; er is hier bewust geen POST,
// dus via deze weg valt er niets te wijzigen. Alles wat een besluit vastlegt
// zit achter de adminroutes en die eisen een admin-cookie.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByOpruimToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });

  const [analyse, client] = await Promise.all([getCannibalAnalysis(slug), getClientBySlug(slug)]);
  const domain = (client?.domain || "").trim();
  // De eindstructuur hoort juist WEL in de klantversie: dat is het enige blok dat
  // een resultaat toont in plaats van werk, en daar begint een klantgesprek.
  const [structuur, eindstructuur] = await Promise.all([
    paginaStructuur(slug, domain).catch(() => null),
    bouwEindstructuur(slug, analyse.result).catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    clientName: client?.name || "",
    domain,
    result: analyse.result,
    updatedAt: analyse.updatedAt,
    structuur,
    eindstructuur,
  });
}
