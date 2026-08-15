import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeViewerSession } from "../../../../lib/admin-auth";
import { leesBon } from "../../../../lib/ronde-bon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE MACHINE-INGANG: EEN RONDE WISSELT ZIJN BON IN VOOR EEN SESSIE
// ═══════════════════════════════════════════════════════════
// Naast `/api/kijk` (de ingang voor Claude in een chat, met de meekijk-sleutel
// die Maarten zelf aanmaakt) is dit de ingang voor werk dat zonder toezicht
// draait: de tweak-ronde en de nachtelijke bouwronde.
//
// Waarom die twee gescheiden zijn, en waarom dat moest: de meekijk-sleutel is
// van een mens en wordt ingetrokken zodra Maarten een nieuwe maakt. Op
// 15-08-2026 gebeurde dat, en vanaf dat moment kwam élke ronde er niet meer in.
// Ze meldden "geslaagd" en deden niets. Een nacht die stilstaat omdat iemand een
// knop indrukte in een heel ander scherm, is een ontwerpfout en geen ongeluk.
//
// Een bon wordt gemaakt door het dashboard zelf op het moment dat het een ronde
// start, ondertekend met `SESSION_SECRET`. Er komt dus geen nieuw geheim bij en
// er valt niets te kopiëren. Zie lib/ronde-bon.ts.
//
// De sessie die hieruit komt is exact dezelfde alleen-lezen sessie als bij
// `/api/kijk`: kijken mag overal, schrijven wordt centraal geweigerd in
// lib/admin-scope.ts, met alleen de standen van de wachtrijen als uitzondering.
// Deze route deelt dus geen enkel recht uit dat er niet al was.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json({ ok: false, error: "Server niet geconfigureerd." }, { status: 500 });
  }

  const bon = leesBon(req.nextUrl.searchParams.get("bon"));
  if (!bon) {
    // Bewust één antwoord voor alle manieren waarop een bon niet deugt. Anders
    // dan bij de meekijk-sleutel is hier geen mens die moet uitzoeken wat er
    // mis is: het dashboard maakt de bon zelf, dus als hij niet klopt is er iets
    // anders aan de hand dan een typefout.
    return NextResponse.json({
      ok: false,
      error: "Deze bon is niet geldig of verlopen. Start de ronde opnieuw vanaf het dashboard.",
    }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, ronde: bon.ronde, baan: bon.baan, modus: "alleen-lezen" });
  res.cookies.set(ADMIN_COOKIE, makeViewerSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Even lang als de bon zelf geldig is; korter zou een lange bouw halverwege
    // buitensluiten, langer zou een sessie laten leven na zijn eigen ronde.
    maxAge: 4 * 60 * 60,
  });
  return res;
}
