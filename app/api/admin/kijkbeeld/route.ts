import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { maakSchermafbeelding } from "../../../../lib/schermbeeld";
import { magVensterPad, vensterGeweigerd } from "../../../../lib/klantvenster";
import { richtingOpNaam } from "../../../../lib/proefstijl";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// EEN FOTO VAN ÉÉN SCHERM, OP AFROEP
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: Claude kan het dashboard wél lézen (het meekijk-recept met
// curl werkt), maar niet zíen. Een browser vanuit de Claude-omgeving komt niet
// bij dit domein: de tunnel naar de proxy komt er (CONNECT geeft 200 en het
// certificaat klopt), maar Chromium wordt daarna resetteert, terwijl curl over
// exact diezelfde tunnel gewoon werkt. Dat zit in de netwerkbewaking van die
// omgeving en is van binnenuit niet te repareren.
//
// Het antwoord is niet wachten tot die omgeving verruimd wordt, maar het van de
// andere kant doen: de server draait al een browser (dat is hoe de
// schermafbeeldingen voor de uitlegpagina gemaakt worden) en die kan zichzelf
// prima bereiken. Deze route maakt daar één foto mee, van elk pad, en geeft de
// PNG terug. Zo hoeft niemand meer met eigen ogen te controleren wat Claude net
// gebouwd heeft.
//
// Bewust GEEN opslag: dit is een blik, geen archief. De vaste schermen voor de
// uitlegpagina blijven in `schermafbeeldingen` staan, met hun eigen knop.
//
// Twee grenzen, allebei hard:
//  - alleen met een adminsessie (de meekijk-sessie telt mee, die is alleen-lezen
//    en dit verandert niets);
//  - alleen een pad op dit eigen domein. Geen volledige URL, geen dubbele slash,
//    geen protocol. Anders zou dit een middel worden om vanaf deze server een
//    willekeurige andere site op te halen.

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const pad = req.nextUrl.searchParams.get("pad") || "/";
  // Alleen een pad op dit domein. "//ergens.nl" is voor een browser een volledige
  // URL, dus die moet er net zo goed uit als "https://".
  if (!pad.startsWith("/") || pad.startsWith("//") || pad.includes("://")) {
    return NextResponse.json({ ok: false, error: "Geef een pad op dit domein, bijvoorbeeld /admin/client/kamsteeg?tab=werkzaamheden." }, { status: 400 });
  }
  // In een klantvenster mag deze foto niet meer laten zien dan het scherm zelf:
  // hetzelfde pad-slot als de middleware, anders zou je hier alsnog een blik op
  // een andere klant kunnen halen.
  if (!magVensterPad(pad)) return vensterGeweigerd();
  const basis = req.nextUrl.origin;
  // Extra wachttijd vóór de foto, in milliseconden (?wacht=5000). Nodig voor een
  // scherm dat zijn lijst zelf nabezorgt: dat staat na het laden nog even op
  // "bezig met opbouwen", en dan fotografeer je de wachtboodschap.
  const wacht = Number(req.nextUrl.searchParams.get("wacht")) || 600;
  // Optioneel: fotografeer dit scherm in een andere stijlrichting (?stijl=Strak
  // en zakelijk). Zo kan de speelruimte twee standen náást elkaar leggen, want
  // in de browser zelf kun je er maar één tegelijk aan hebben staan. Een naam die
  // niet bestaat is een fout en geen stilzwijgende terugval op de huidige stand:
  // anders krijg je twee identieke foto's zonder te weten waarom.
  const stijlNaam = req.nextUrl.searchParams.get("stijl");
  const thema = stijlNaam ? richtingOpNaam(stijlNaam) : null;
  if (stijlNaam && !thema) {
    return NextResponse.json({ ok: false, error: `Onbekende stijlrichting: ${stijlNaam}.` }, { status: 400 });
  }
  try {
    const png = await maakSchermafbeelding(pad, basis, wacht, thema);
    if (!png) {
      return NextResponse.json({ ok: false, error: "De browser kon niet starten op deze server." }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Nooit bewaren: je vraagt hem juist op om te zien hoe het er nú uitziet.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "De foto maken mislukte." }, { status: 500 });
  }
}
