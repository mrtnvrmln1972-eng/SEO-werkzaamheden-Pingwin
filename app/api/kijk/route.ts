import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeViewerSession } from "../../../lib/admin-auth";
import { checkViewKey } from "../../../lib/claude-view-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// INGANG VOOR CLAUDE OM MEE TE KIJKEN
// ═══════════════════════════════════════════════════════════
// Claude wisselt hier zijn kijk-sleutel in voor een alleen-lezen sessie. De
// sleutel staat in zijn omgevingsinstellingen (PINGWIN_KIJK_SLEUTEL); Maarten
// maakt hem één keer aan in de cockpit en zet hem daar neer.
//
// Alleen-lezen wordt NIET hier geregeld maar in lib/admin-scope.ts, waar
// guardSlug elk verzoek dat geen GET is centraal weigert. Eén plek, over alle
// routes heen, zodat er nooit een knop vergeten kan worden.
//
// De controle is onvoorwaardelijk: geen geldige sleutel is geen sessie. Nooit
// een variant bouwen waarin dit wegvalt als er niets is ingesteld; dat was
// precies de fout in /admin/enter.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!process.env.SESSION_SECRET) {
    return NextResponse.json({ ok: false, error: "Server niet geconfigureerd." }, { status: 500 });
  }
  const sleutel = req.nextUrl.searchParams.get("sleutel") || "";

  // Het antwoord vertelt precies wát er mis is. Eerst stond hier één algemene
  // afwijzing, en dan is van buitenaf niet te zien of meekijken uitstaat, of de
  // sleutel verouderd is, of de database hapert; dat kost een ronde heen en weer
  // met Maarten. De sleutel zelf is 48 willekeurige tekens, dus dit onderscheid
  // helpt niemand die hem probeert te raden.
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
    const uitleg: Record<typeof uitkomst.reden, string> = {
      "geen-sleutel":
        "Er staat geen kijk-sleutel klaar. Zet meekijken aan op /admin en zet de nieuwe sleutel in de Claude-omgeving.",
      "andere-sleutel":
        "Deze sleutel is verlopen: er staat een nieuwere klaar. Maak op /admin een nieuwe sleutel en zet die in de Claude-omgeving.",
      leeg: "Er kwam geen sleutel mee in het verzoek.",
    };
    return NextResponse.json(
      { ok: false, reden: uitkomst.reden, error: uitleg[uitkomst.reden] },
      { status: 401 },
    );
  }

  // Kaal antwoord in plaats van een omleiding: Claude haalt dit op met een
  // commando, niet in een browser, en wil gewoon de bevestiging plus de cookie.
  const res = NextResponse.json({
    ok: true,
    modus: "alleen-lezen",
    uitleg: "Je kunt nu alles bekijken op /admin. Wijzigen wordt geweigerd.",
  });
  res.cookies.set(ADMIN_COOKIE, makeViewerSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // een halve dag; een sessie leeft toch korter
  });
  return res;
}
