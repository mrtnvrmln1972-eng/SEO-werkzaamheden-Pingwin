import { NextRequest, NextResponse } from "next/server";
import { getFocusHistorie, saveFocus } from "../../../../lib/focus";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// EENMALIG HERSTEL — Zoekwoorden & links, Paul Hoevenaars (14-08-2026)
// ═══════════════════════════════════════════════════════════
// De sleepbug in RijkTekstVeld.tsx (nu gerepareerd) haalde hier de inhoud van
// twee uitklappers los van hun kopje; de daaropvolgende automatische opslag
// schreef dat weg. Deze route zet de laatste volledige, bewaarde versie
// terug, buiten de normale meekijk-sessie om (die mag niet schrijven). Wordt
// direct na gebruik weer verwijderd; geen doorlopend onderdeel van de app.

const SLEUTEL = "emintCaHuUngvWkFABe1y_XMFJLwyTODRHkVMOlwzH4";
const SLUG = "paul-hoevenaars";

export async function POST(req: NextRequest) {
  const sleutel = req.nextUrl.searchParams.get("sleutel");
  if (sleutel !== SLEUTEL) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });

  const versies = await getFocusHistorie(SLUG);
  // Standaard versie 189: 07:54:53 UTC, 11.151 tekens, de laatst bewaarde
  // volledige versie vlak vóór de corruptie (07:58:57 UTC, 3.323 tekens).
  const id = Number(req.nextUrl.searchParams.get("id") || 189);
  const versie = versies.find((v) => v.id === id);
  if (!versie) {
    return NextResponse.json({
      ok: false, error: "Geen passende versie gevonden.",
      beschikbaar: versies.map((v) => ({ id: v.id, veld: v.veld, bewaardOp: v.bewaardOp, lengte: v.html.length })),
    }, { status: 404 });
  }

  const focus = await saveFocus(SLUG, versie.veld === "prioHtml" ? { prioHtml: versie.html } : { html: versie.html });
  return NextResponse.json({
    ok: true,
    hersteld: { id: versie.id, veld: versie.veld, bewaardOp: versie.bewaardOp, lengte: versie.html.length },
    huidigeLengte: { html: focus.html.length, prioHtml: focus.prioHtml.length },
  });
}
