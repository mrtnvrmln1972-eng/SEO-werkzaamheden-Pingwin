import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { bouwWerklijst, markeerContentOver, markeerDoelRisico, markeerDoorgevoerd, tellingen } from "../../../../lib/opruim-werklijst";
import { chatBesluitenVoor } from "../../../../lib/opruim-chat-besluiten";
import { getAdsPaginas, getOpruimRegels, teBredeAdsPaden, zonderTeBrede } from "../../../../lib/opruim-regels";
import { beoordeelTaalvarianten, merkWoordenVan } from "../../../../lib/taalvarianten";
import { getGscQueryPagePairs } from "../../../../lib/google";
import { bepaalWeggelaten } from "../../../../lib/opruim-weggelaten";
import { duidRest, type PaginaCijfers } from "../../../../lib/rest-duiding";
import { getClientUrls } from "../../../../lib/site-urls";

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
    const [st, plaatsen, vaste, ads, urls] = await Promise.all([
      getCannibalAnalysis(slug),
      domain ? zorgVoorPlaatsen(slug, domain).catch(() => null) : Promise.resolve(null),
      getOpruimRegels(slug).catch(() => []),
      getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false })),
      getClientUrls(slug).catch(() => []),
    ]);

    // De Engelse vraagmeting: per pagina in een taalboom of er zoekvraag in díe
    // taal is. Zonder eigen publiek is het een vertaling die niemand zoekt en die
    // zijn tegenhanger in de weg zit; mét publiek blijft hij en moet hij echt
    // vertaald worden. Zie lib/taalvarianten.ts voor de redenering.
    const livePaden = urls.filter((u) => (u.status ?? 200) === 200).map((u) => u.url);
    const gsc = domain ? await getGscQueryPagePairs(domain, 90).catch(() => []) : [];
    const taal = beoordeelTaalvarianten(livePaden, gsc, merkWoordenVan(domain));
    // Een regel die een hele sectie dekt is geen advertentiepagina. Genegeerd bij
    // het rekenen, en gemeld op het scherm zodat hij opgeruimd kan worden.
    const adsEffectief = zonderTeBrede(ads, livePaden);
    const adsTeBreed = teBredeAdsPaden(ads, livePaden);
    const regels = markeerDoelRisico(
      markeerContentOver(
        markeerDoorgevoerd(
          bouwWerklijst(st.result, plaatsen?.adviezen || [], chatBesluitenVoor(slug), taal.oordelen),
          vaste.filter((r) => r.doorgevoerd).map((r) => r.van),
        ),
        vaste.filter((r) => r.contentOver).map((r) => r.van),
      ),
      // Alleen pagina's die echt 200 geven tellen als bestaand doel. Een 301 is
      // geen bestemming maar een doorverwijzing, en juist dat leverde het plan om
      // `/soa-poli-zoetermeer/` naar een adres te sturen dat via twee stappen op
      // zichzelf uitkwam.
      urls.filter((u) => (u.status ?? 200) === 200).map((u) => u.url),
      Object.fromEntries(
        urls.filter((u) => u.redirectTarget).map((u) => [u.url, u.redirectTarget as string]),
      ),
    );
    // Wat er NIET in de lijst staat, met de reden. Zonder dit is een weglating
    // niet te onderscheiden van een gat: zoeken op "Utrecht" gaf vier blokken
    // titelwerk en verder niets, terwijl er zes Utrecht-pagina's bewust buiten
    // de analyse zijn gehouden.
    const weggelaten = bepaalWeggelaten(
      urls.filter((u) => (u.status ?? 200) === 200).map((u) => u.url),
      regels.map((r) => r.pad),
      adsEffectief,
      (plaatsen?.adviezen || []).map((a) => a.plaats),
      // Zonder de vormen valt de reden "plaats-verweesd" stil terug op "geen
      // aanleiding", en dan is precies het gat dat we zichtbaar wilden maken weer
      // onzichtbaar. De proef dekt de functie, niet deze aanroep; vandaar dit.
      plaatsen?.vormen || [],
    );
    // De rest is geen restbak maar een oordeel. Elke pagina die nergens in het plan
    // staat krijgt er een, met de cijfers uit Search Console erbij: niemand vindt
    // hem, of er is juist vraag die we laten liggen. Een lijst URL's zonder cijfers
    // is niet te plannen.
    const cijfers = new Map<string, PaginaCijfers>();
    for (const r of gsc) {
      const k = (r.page || "").replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "").toLowerCase();
      if (!k) continue;
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
    return NextResponse.json({ ok: true, regels, tellingen: tellingen(regels), weggelaten, rest, adsTeBreed, taalBomen: taal.bomen, lijstDatum: st.result?.generatedAt || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lijst bouwen mislukt." }, { status: 500 });
  }
}
