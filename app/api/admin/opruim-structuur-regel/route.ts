import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getUrlStructuur, zetUrlStructuur, getAdsPaginas, zetAdsPaginas } from "../../../../lib/opruim-regels";
import { getEuroInstelling, zetEuroInstelling } from "../../../../lib/opruim-euro";

export const runtime = "nodejs";

// De gekozen URL-vorm per klant, bijvoorbeeld /soa-klinieken/soa-test-<plaats>/.
// Die keuze gaat als harde regel mee in elke volgende opruim-analyse, zodat de
// motor nooit meer een omleiding voorstelt naar een vorm die we uitfaseren.

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const [vorm, ads, euro] = await Promise.all([getUrlStructuur(slug), getAdsPaginas(slug), getEuroInstelling(slug)]);
  return NextResponse.json({ ok: true, vorm, ads, euro });
}

export async function PUT(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  // Twee dingen op één route: de gekozen URL-vorm en de advertentiepagina's. Beide
  // zijn "wat de analyse moet weten voordat hij mag draaien", dus ze horen bij elkaar.
  if (body.ads !== undefined || body.geenAds !== undefined) {
    const ruw = Array.isArray(body.ads) ? body.ads.map(String) : String(body.ads || "").split(/[\n,]/);
    const paden = ruw.map((p) => p.trim()).filter(Boolean);
    const fout = paden.find((p) => !p.startsWith("/") && !p.startsWith("http"));
    if (fout) return NextResponse.json({ ok: false, error: `"${fout}" is geen pad. Zet er een schuine streep voor, bijvoorbeeld /landing-page/.` }, { status: 400 });
    const ads = await zetAdsPaginas(slug, paden, body.geenAds === true);
    return NextResponse.json({ ok: true, ads });
  }

  // Wat een klant waard is, zodat de lijsten in euro's kunnen praten in plaats van
  // in zoekvolume. Zonder deze twee getallen rekent het dashboard niets uit; een
  // verzonnen standaard zou eruitzien als een meting.
  if (body.klantwaarde !== undefined || body.conversie !== undefined) {
    const k = Number(body.klantwaarde);
    const c = Number(body.conversie);
    if (!Number.isFinite(k) || !Number.isFinite(c) || k < 0 || c < 0) {
      return NextResponse.json({ ok: false, error: "Vul allebei een getal in: wat één klant gemiddeld opbrengt, en welk deel van de bezoekers klant wordt." }, { status: 400 });
    }
    if (c > 100) return NextResponse.json({ ok: false, error: "Een conversie hoger dan 100% kan niet; vul het percentage in, niet het aantal." }, { status: 400 });
    const euro = await zetEuroInstelling(slug, k, c);
    return NextResponse.json({ ok: true, euro });
  }

  const vorm = String(body.vorm || "").trim();
  if (vorm && !vorm.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "Een URL-vorm begint met een schuine streep, bijvoorbeeld /soa-klinieken/soa-test-<plaats>/." }, { status: 400 });
  }
  await zetUrlStructuur(slug, vorm);
  return NextResponse.json({ ok: true, vorm });
}
