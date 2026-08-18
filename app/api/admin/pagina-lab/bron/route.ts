import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { vensterPoort } from "../../../../../lib/klantvenster";
import { fotografeerPagina, leesPagina, waaromNiet, type Apparaat } from "../../../../../lib/pagina-lab/bron";

export const runtime = "nodejs";
// Ruim genomen, net als de contentscan. Een browser starten kost op een koude
// server al seconden, en daarna moet een zware klantpagina nog laden, scrollen
// en gefotografeerd worden. Op 60 seconden liep de eerste meting van een
// homepage tegen de limiet aan.
export const maxDuration = 300;

// ═══════════════════════════════════════════════════════════
// ÉÉN PAGINA VAN BUITEN, GELEZEN OF GEFOTOGRAFEERD
// ═══════════════════════════════════════════════════════════
// De tegenhanger van /api/admin/kijkbeeld. Die maakt een foto van een scherm op
// dit eigen domein; deze doet hetzelfde voor een pagina daarbuiten, en kan hem
// ook uitlezen. Dat is de brug die het Pagina-lab nodig heeft, want vanuit de
// Claude-omgeving is geen enkele klantsite bereikbaar.
//
// Wat je meegeeft:
//   url        het volledige adres, met https://
//   vorm       "tekst" (standaard) of "foto"
//   apparaat   "desktop" (standaard) of "mobiel"
//   heel       1 voor de hele pagina in plaats van alleen het eerste scherm
//   vanaf      een strook uit een lange pagina: vanaf deze hoogte in pixels
//   hoogte     hoe hoog die strook is (standaard de schermhoogte)
//   wacht      extra wachttijd in milliseconden vóór de foto
//   cookies    "laat" om de cookiemelding te laten staan; standaard wordt hij
//              weggeklikt, want anders fotografeer je die melding in plaats van
//              het eerste scherm waar het oordeel over gaat
//   max        hoeveel tekens tekst er hoogstens terugkomen (standaard 30.000)
//
// De grenzen staan in lib/pagina-lab/bron.ts en zijn hard: een adminsessie
// (de meekijk-sessie telt mee, die is alleen-lezen en hier verandert niets),
// alleen http of https, en nooit een adres binnen een netwerk, ook niet na een
// omleiding.

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  // In een omgeving die maar één klant toont bestaat deze route niet. Hij haalt
  // een willekeurig adres op, en dat hoort niet te kunnen achter een voordeur
  // die je met iemand van buiten deelt. Het Pagina-lab is werk van het bureau.
  const weg = vensterPoort();
  if (weg) return weg;
  const p = req.nextUrl.searchParams;
  const url = (p.get("url") || "").trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: "Geef een volledig webadres mee, bijvoorbeeld ?url=https://voorbeeld.nl/pagina/" }, { status: 400 });
  }
  const fout = await waaromNiet(url);
  if (fout) return NextResponse.json({ ok: false, error: fout }, { status: 400 });

  const apparaat: Apparaat = p.get("apparaat") === "mobiel" ? "mobiel" : "desktop";
  const vorm = p.get("vorm") === "foto" ? "foto" : "tekst";

  try {
    if (vorm === "foto") {
      const png = await fotografeerPagina(url, {
        apparaat,
        heel: p.get("heel") === "1",
        vanaf: p.get("vanaf") ? Number(p.get("vanaf")) : undefined,
        hoogte: p.get("hoogte") ? Number(p.get("hoogte")) : undefined,
        wachtMs: p.get("wacht") ? Number(p.get("wacht")) : undefined,
        laatCookies: p.get("cookies") === "laat",
      });
      if (!png) {
        return NextResponse.json({ ok: false, error: "De browser kon niet starten op deze server." }, { status: 500 });
      }
      return new NextResponse(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }

    const bron = await leesPagina(url, apparaat);
    if (!bron) {
      return NextResponse.json({ ok: false, error: "De browser kon niet starten op deze server." }, { status: 500 });
    }
    // De tekst van een lange pagina kan enorm zijn. Afkappen met een zichtbaar
    // merkteken is eerlijker dan stilletjes de helft weglaten.
    const max = Math.max(1000, Math.min(200000, Number(p.get("max")) || 30000));
    const afgekapt = bron.tekst.length > max;
    return NextResponse.json({
      ok: true,
      ...bron,
      tekst: afgekapt ? `${bron.tekst.slice(0, max)}\n\n[afgekapt na ${max} tekens van ${bron.tekst.length}]` : bron.tekst,
      afgekapt,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "De pagina ophalen mislukte." }, { status: 502 });
  }
}
