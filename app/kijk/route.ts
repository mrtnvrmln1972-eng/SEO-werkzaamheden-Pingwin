import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeViewerSession } from "../../lib/admin-auth";
import { checkViewKey } from "../../lib/claude-view-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE MEEKIJK-LINK: ÉÉN ADRES DAT DE DEUR OPENT EN DOORLOOPT
// ═══════════════════════════════════════════════════════════
// `/api/kijk` bestaat al en geeft een kaal antwoord met een cookie terug. Dat is
// precies goed voor een commando, en precies verkeerd voor iets wat je plakt:
// je belandt op een blokje tekst in plaats van in het dashboard.
//
// Deze route doet dezelfde controle en stuurt je daarna door naar het scherm.
// Daarmee kan Maarten één link delen met een Claude die geen omgevingsvariabelen
// kent (Cowork, een gewone chat) of gewoon zelf op een andere computer kijken.
//
// Wat hij uitdeelt is niet meer dan wat de sleutel al kon: ALLEEN LEZEN. Elk
// verzoek dat geen GET is wordt centraal geweigerd in lib/admin-scope.ts. En hij
// is met één knop in te trekken, want het is dezelfde sleutel als altijd; er komt
// geen tweede soort geheim bij.
//
// LET OP: wie deze link heeft, kan alles in het dashboard lezen. Dat is de
// afweging die bij optie B hoort en die staat zo op het scherm bij de knop.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json({ ok: false, error: "Server niet geconfigureerd." }, { status: 500 });
  }
  const sleutel = req.nextUrl.searchParams.get("sleutel") || "";
  // Waar je heen wilt na binnenkomst. Altijd een pad binnen dit dashboard, nooit
  // een adres ergens anders: een open doorstuur is een uitnodiging om deze link
  // te misbruiken als springplank.
  const gevraagd = req.nextUrl.searchParams.get("pad") || "/admin";
  const pad = gevraagd.startsWith("/") && !gevraagd.startsWith("//") ? gevraagd : "/admin";

  let uitkomst;
  try {
    uitkomst = await checkViewKey(sleutel);
  } catch {
    return NextResponse.json(
      { ok: false, error: "De sleutel kon niet gecontroleerd worden; de database antwoordde niet." },
      { status: 503 },
    );
  }
  if (!uitkomst.ok) {
    // Geen omleiding bij een afwijzing: dan land je op de inlogpagina en denk je
    // dat je iets verkeerd doet, terwijl de link zelf het probleem is.
    const uitleg: Record<typeof uitkomst.reden, string> = {
      "geen-sleutel": "Er staat geen kijk-sleutel klaar. Zet meekijken aan op /admin en maak een nieuwe link.",
      "andere-sleutel": "Deze link is ingetrokken. Maak op /admin een nieuwe.",
      leeg: "Er stond geen sleutel in deze link.",
    };
    return NextResponse.json({ ok: false, reden: uitkomst.reden, error: uitleg[uitkomst.reden] }, { status: 401 });
  }

  // De sleutel staat in het adres, dus de sleutel mag niet het adres blijven waar
  // je op staat: doorsturen haalt hem uit de adresbalk en uit de verwijzing die de
  // volgende pagina meekrijgt.
  const res = NextResponse.redirect(new URL(pad, req.nextUrl.origin), { status: 303 });
  res.cookies.set(ADMIN_COOKIE, makeViewerSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
