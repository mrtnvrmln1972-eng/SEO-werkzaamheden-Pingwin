import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { bouwWerklijst, markeerContentOver, markeerDoorgevoerd, tellingen } from "../../../../lib/opruim-werklijst";
import { chatBesluitenVoor } from "../../../../lib/opruim-chat-besluiten";
import { getOpruimRegels } from "../../../../lib/opruim-regels";

export const runtime = "nodejs";
export const maxDuration = 300;

// De ene lijst: alles wat er over pagina's is uitgezocht, samengevoegd tot één
// regel per pagina met één uitkomst. De losse blokken blijven bestaan als view;
// hier komt de gecombineerde lijst vandaan.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    // Bewust NIET opnieuw berekenen: het plaatsadvies staat opgeslagen bij de
    // analyse. Het live doen kostte veertien seconden, en dat drie keer per
    // scherm, waardoor het bovenste blok minutenlang "wordt samengesteld" toonde.
    const domain = (await getClientBySlug(slug).catch(() => null))?.domain || "";
    const [st, plaatsen, vaste] = await Promise.all([
      getCannibalAnalysis(slug),
      domain ? zorgVoorPlaatsen(slug, domain).catch(() => null) : Promise.resolve(null),
      getOpruimRegels(slug).catch(() => []),
    ]);
    const regels = markeerContentOver(
      markeerDoorgevoerd(
        bouwWerklijst(st.result, plaatsen?.adviezen || [], chatBesluitenVoor(slug)),
        vaste.filter((r) => r.doorgevoerd).map((r) => r.van),
      ),
      vaste.filter((r) => r.contentOver).map((r) => r.van),
    );
    return NextResponse.json({ ok: true, regels, tellingen: tellingen(regels), lijstDatum: st.result?.generatedAt || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lijst bouwen mislukt." }, { status: 500 });
  }
}
