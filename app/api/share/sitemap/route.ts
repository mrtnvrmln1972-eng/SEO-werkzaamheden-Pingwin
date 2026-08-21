import { NextRequest, NextResponse } from "next/server";
import { getSlugByDeelToken, leesDeelStand } from "../../../../lib/deel-link";
import { getClientBySlug } from "../../../../lib/clients";
import type { SitemapCheckUitkomst } from "../../../../lib/sitemap-check";

export const runtime = "nodejs";

// Publiek, alleen lezen. Het token is de toegang; er is hier bewust geen POST,
// dus via deze weg valt er niets te wijzigen en niets aan te zetten.
//
// Twee dingen die deze route met opzet NIET doet:
//  1. De controle zelf draaien. Dat kost tientallen seconden en gaat langs de
//     site van de klant; wie de link heeft zou de server en die site anders met
//     verversen kunnen bestoken. Hij leest uitsluitend de stand die het
//     beheerscherm bij zijn laatste controle heeft weggeschreven.
//  2. Meer teruggeven dan dit ene onderwerp. Geen andere klant, geen andere
//     analyse, geen lijst met klanten; alleen de sitemap-uitkomst van de klant
//     die bij dit token hoort.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByDeelToken("sitemap", token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });

  const [stand, client] = await Promise.all([
    leesDeelStand<SitemapCheckUitkomst>("sitemap", slug),
    getClientBySlug(slug),
  ]);
  if (!stand) {
    return NextResponse.json({
      ok: false,
      error: "Deze controle is nog niet klaargezet om te delen. Vraag Pingwin om hem één keer te draaien.",
    }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    clientName: client?.name || "",
    domain: (client?.domain || "").trim(),
    gecontroleerd: stand.bijgewerkt,
    data: stand.inhoud,
  });
}
