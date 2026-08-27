import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { bouwWerklijst, markeerContentOver, markeerDoelRisico, markeerDoorgevoerd, tellingen } from "../../../../lib/opruim-werklijst";
import { chatBesluitenVoor } from "../../../../lib/opruim-chat-besluiten";
import { getAdsPaginas, getOpruimRegels } from "../../../../lib/opruim-regels";
import { bepaalWeggelaten } from "../../../../lib/opruim-weggelaten";
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
    const regels = markeerDoelRisico(
      markeerContentOver(
        markeerDoorgevoerd(
          bouwWerklijst(st.result, plaatsen?.adviezen || [], chatBesluitenVoor(slug)),
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
      ads,
      (plaatsen?.adviezen || []).map((a) => a.plaats),
      // Zonder de vormen valt de reden "plaats-verweesd" stil terug op "geen
      // aanleiding", en dan is precies het gat dat we zichtbaar wilden maken weer
      // onzichtbaar. De proef dekt de functie, niet deze aanroep; vandaar dit.
      plaatsen?.vormen || [],
    );
    return NextResponse.json({ ok: true, regels, tellingen: tellingen(regels), weggelaten, lijstDatum: st.result?.generatedAt || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lijst bouwen mislukt." }, { status: 500 });
  }
}
