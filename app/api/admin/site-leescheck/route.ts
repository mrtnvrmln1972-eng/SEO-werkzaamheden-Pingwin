import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getClientUrls } from "../../../../lib/site-urls";
import { controleerLeesbaarheid, bouwSitebeeld, beoordeelUitNavigatie } from "../../../../lib/site-controle";
import { pagePath } from "../../../../lib/page-internal-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ═══════════════════════════════════════════════════════════
// KAN IK DEZE SITE ÜBERHAUPT LEZEN?
// ═══════════════════════════════════════════════════════════
// De eerste vraag bij elke controle, en met opzet een eigen antwoord. Sommige
// klantsites weigeren een kale leespoging met een 403. Zonder deze check zou de
// controle dan melden dat er niets op de site staat, terwijl de deur gewoon
// dichtzat, en dat is precies het soort onwaarheid waar een developer ten
// onrechte de schuld van krijgt.
//
// GET, dus ook bruikbaar in de alleen-lezen kijk-modus.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  if (!client.domain) {
    return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen website ingevuld." }, { status: 400 });
  }

  // Vraag 2 (optioneel): staat dit pad nog in het site-brede menu of de footer?
  // Zelfde meting als de controleknop doet, maar zonder iets op te slaan en
  // zonder AI. Zo is elk oordeel van de controle na te rekenen, ook vanuit een
  // alleen-lezen sessie. Blijft opgesloten in het eigen domein van de klant: de
  // aanroeper geeft een pad, nooit een adres, dus dit kan geen doorgeefluik
  // worden om willekeurige sites op te halen.
  const navPad = (req.nextUrl.searchParams.get("navigatie") || "").trim();
  if (navPad) {
    if (!navPad.startsWith("/")) {
      return NextResponse.json({ ok: false, error: "Geef een pad dat met / begint." }, { status: 400 });
    }
    const urls = await getClientUrls(slug).catch(() => []);
    const paden = [...new Set([
      "/",
      pagePath(navPad),
      ...urls.filter((u) => (u.status ?? 200) < 400)
        .sort((a, b) => (b.gscClicks || 0) - (a.gscClicks || 0))
        .slice(0, 8).map((u) => pagePath(u.url)),
    ])];
    const beeld = await bouwSitebeeld(client.domain, paden);
    const oordeel = beoordeelUitNavigatie(beeld, navPad);
    return NextResponse.json({
      ok: true,
      pad: pagePath(navPad),
      uitslag: oordeel.uitslag,
      bewijs: oordeel.bewijs,
      details: oordeel.details,
      gelezen: beeld.paginas.filter((p) => p.meetbaar).map((p) => p.pad),
      nietGelezen: beeld.paginas.filter((p) => !p.meetbaar).map((p) => ({ pad: p.pad, reden: p.reden })),
    });
  }

  const { ok, ...rest } = await controleerLeesbaarheid(client.domain);
  // Twee verschillende vragen, dus twee velden: of de route slaagde (ok), en of
  // de site zich liet lezen (leesbaar). Die op één veld gooien maakt "de controle
  // ging mis" ononderscheidbaar van "de site zit dicht".
  return NextResponse.json({ ok: true, leesbaar: ok, ...rest });
}
