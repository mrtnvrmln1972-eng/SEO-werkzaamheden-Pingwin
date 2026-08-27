import { NextRequest, NextResponse } from "next/server";
import { getSlugByDeelToken } from "../../../../lib/deel-link";
import { getClientBySlug } from "../../../../lib/clients";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { bouwWerklijst, markeerContentOver, markeerDoelRisico, markeerDoorgevoerd } from "../../../../lib/opruim-werklijst";
import { chatBesluitenVoor } from "../../../../lib/opruim-chat-besluiten";
import { getOpruimRegels, teBredeAdsPaden, zonderTeBrede } from "../../../../lib/opruim-regels";
import { adsVoorKlant } from "../../../../lib/ads-lijst";
import { bepaalWeggelaten } from "../../../../lib/opruim-weggelaten";
import { duidRest, sleutelVan, type PaginaCijfers } from "../../../../lib/rest-duiding";
import { beoordeelTaalvarianten, merkWoordenVan } from "../../../../lib/taalvarianten";
import { getClientUrls } from "../../../../lib/site-urls";
import { getGscQueryPagePairs } from "../../../../lib/google";
import { getWerkplanBudget } from "../../../../lib/werkplan-budget";

export const runtime = "nodejs";
export const maxDuration = 300;

// Publiek, alleen lezen. Het token is de toegang; er is hier bewust geen POST,
// dus via deze weg valt er niets te wijzigen. Alles wat een besluit vastlegt
// (in de planning zetten, een omleiding doorvoeren) zit achter /api/admin/* en
// die eisen een admin-cookie.
//
// Dezelfde data als de cockpit-versie, want een klant hoort hetzelfde plan te
// zien als Maarten. Wat er níet in zit is de weg terug naar de rest van het
// dashboard; de publieke pagina toont alleen dit ene scherm.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByDeelToken("werkplan", token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });

  const client = await getClientBySlug(slug).catch(() => null);
  const domain = (client?.domain || "").trim();

  const [st, plaatsen, vaste, ads, urls, budget] = await Promise.all([
    getCannibalAnalysis(slug),
    domain ? zorgVoorPlaatsen(slug, domain).catch(() => null) : Promise.resolve(null),
    getOpruimRegels(slug).catch(() => []),
    adsVoorKlant(slug).catch(() => ({ paden: [], geen: false, ingevuld: false })),
    getClientUrls(slug).catch(() => []),
    getWerkplanBudget(slug).catch(() => null),
  ]);

  const livePaden = urls.filter((u) => (u.status ?? 200) === 200).map((u) => u.url);
  const gsc = domain ? await getGscQueryPagePairs(domain, 90).catch(() => []) : [];
  const taal = beoordeelTaalvarianten(livePaden, gsc, merkWoordenVan(domain));
  const adsEffectief = zonderTeBrede(ads, livePaden);

  const regels = markeerDoelRisico(
    markeerContentOver(
      markeerDoorgevoerd(
        bouwWerklijst(st.result, plaatsen?.adviezen || [], chatBesluitenVoor(slug), taal.oordelen),
        vaste.filter((r) => r.doorgevoerd).map((r) => r.van),
      ),
      vaste.filter((r) => r.contentOver).map((r) => r.van),
    ),
    livePaden,
    Object.fromEntries(urls.filter((u) => u.redirectTarget).map((u) => [u.url, u.redirectTarget as string])),
  );

  const weggelaten = bepaalWeggelaten(
    livePaden,
    regels.map((r) => r.pad),
    adsEffectief,
    (plaatsen?.adviezen || []).map((a) => a.plaats),
    plaatsen?.vormen || [],
  );

  const cijfers = new Map<string, PaginaCijfers>();
  for (const r of gsc) {
    const k = sleutelVan((r.page || "").replace(/^https?:\/\/[^/]+/, ""));
    const e = cijfers.get(k) || { klikken: 0, vertoningen: 0, positie: null };
    e.klikken += r.clicks;
    e.vertoningen += r.impressions;
    if (e.positie == null || r.position < e.positie) e.positie = r.position;
    cijfers.set(k, e);
  }
  const rest = duidRest(
    weggelaten.paginas.filter((p) => p.reden === "geen-aanleiding").map((p) => p.pad),
    cijfers,
  );

  return NextResponse.json({
    ok: true,
    clientName: client?.name || "",
    domain,
    regels,
    weggelaten,
    rest,
    adsTeBreed: teBredeAdsPaden(ads, livePaden),
    budget: budget?.urenPerWeek ?? 3,
    lijstDatum: st.result?.generatedAt || null,
  });
}
