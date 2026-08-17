import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getMetaKansen, generateMetaProposal, regenerateMetaField, updateMetaProposal, checkLiveProposals, addCtrEffects, refreshMetaPages, importCopydocProposal, type MetaProposalStatus, type MetaFieldStatus } from "../../../../lib/meta-ctr";
import { getWpStatus } from "../../../../lib/wp-push";

export const runtime = "nodejs";
// Het meten van alle pagina's kan een paar minuten duren (zes tegelijk, tot 60 stuks).
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// ═══════════════════════════════════════════════════════════
// EERST DE LIJST, DAARNA PAS HET CONTROLEWERK
// ═══════════════════════════════════════════════════════════
// GET ?slug= gaf de kansenlijst, maar deed er twee dingen bij vóórdat er ook
// maar iets op het scherm kwam: tot acht live pagina's van de site van de klant
// ophalen om te kijken of goedgekeurde meta's al doorgevoerd waren, en tot
// twaalf CTR-effecten uit Search Console berekenen. Allebei nuttig, geen van
// beide iets waar je op hoort te wachten. Gemeten op 17-08-2026: het tabblad
// Meta & CTR deed er 7,7 tot 28 seconden over, en dat is bijna helemaal dit.
//
// Nu twee beurten, precies zoals de mail in de cockpit al werkt: de lijst komt
// meteen, en het paneel vraagt daarna zelf om de controle. Zie je dus even
// "goedgekeurd, wacht op site" staan terwijl het al live is, dan klopt dat een
// paar seconden lang en corrigeert het zichzelf.
//
// Zet die twee NOOIT terug in de eerste beurt. Groeit er iets bij dat de site
// of Google aanspreekt, dan hoort dat in de tweede.
// ═══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const rows = await getMetaKansen(slug);

  // Tweede beurt: het paneel vraagt hier zelf om, ná het tonen van de lijst.
  if (req.nextUrl.searchParams.get("controle") === "1") {
    await checkLiveProposals(slug, rows).catch(() => { /* live-check is aanvulling */ });
    await addCtrEffects(slug, rows).catch(() => { /* effect is aanvulling */ });
    return NextResponse.json({ ok: true, rows });
  }

  // Kunnen wij zelf op de site schrijven? Zonder koppeling kun je wel goedkeuren
  // maar niet doorvoeren; de tekst gaat dan via de deelpagina naar de bouwer.
  const wp = await getWpStatus(slug).catch(() => ({ connected: false, username: null }));
  return NextResponse.json({ ok: true, rows, wpConnected: wp.connected });
}

// POST {slug, url, keyword?, base?, field?, actie?} : genereer (of vernieuw) het
// AI-voorstel voor één pagina; met field ("title"|"desc") wordt alleen dat ene
// veld herschreven. actie "meten" meet alle pagina's opnieuw (wat staat er nu, en
// deugt dat), actie "copydoc" neemt de meta uit het copydocument over.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string; keyword?: string; field?: string; actie?: string; base?: { ctr?: number; position?: number; impressions?: number } };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g0 = await guardSlug(req, slug); if (!g0.ok) return g0.res;

  // De pagina's opnieuw meten: hiermee komen ook pagina's zonder Search
  // Console-cijfers in beeld, met het oordeel of hun meta aan de regels voldoet.
  if (body.actie === "meten") {
    try {
      const r = await refreshMetaPages(slug);
      return NextResponse.json({
        ok: true, ...r,
        samenvatting: `${r.gemeten} pagina's gemeten, ${r.kapot} met een meta die niet voldoet${r.overgeslagen ? `. ${r.overgeslagen} pagina's niet meegenomen (maximaal 60 per ronde)` : ""}.`,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Meten mislukte." }, { status: 500 });
    }
  }

  if (!url) return NextResponse.json({ ok: false, error: "Pagina verplicht." }, { status: 400 });
  try {
    if (body.actie === "copydoc") {
      const result = await importCopydocProposal(slug, url);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.field === "title" || body.field === "desc") {
      const result = await regenerateMetaField(slug, url, body.field);
      return NextResponse.json({ ok: true, ...result });
    }
    const result = await generateMetaProposal(slug, url, (body.keyword || "").trim(), body.base);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Genereren mislukte." }, { status: 500 });
  }
}

// PATCH {slug, url, propTitle?, propDesc?, status?, titleStatus?, descStatus?} :
// voorstel bewerken of status zetten (per veld of als geheel).
export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string; propTitle?: string; propDesc?: string; status?: MetaProposalStatus; titleStatus?: MetaFieldStatus; descStatus?: MetaFieldStatus };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  if (body.status && !["open", "goedgekeurd", "doorgevoerd", "afgewezen"].includes(body.status)) {
    return NextResponse.json({ ok: false, error: "Onbekende status." }, { status: 400 });
  }
  for (const fs of [body.titleStatus, body.descStatus]) {
    if (fs && !["open", "goedgekeurd", "afgewezen"].includes(fs)) {
      return NextResponse.json({ ok: false, error: "Onbekende veld-status." }, { status: 400 });
    }
  }
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await updateMetaProposal(slug, url, { propTitle: body.propTitle, propDesc: body.propDesc, status: body.status, titleStatus: body.titleStatus, descStatus: body.descStatus });
  return NextResponse.json({ ok: true });
}
