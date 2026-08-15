import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeViewerSession } from "../../../lib/admin-auth";
import { checkViewKey, testViewKey } from "../../../lib/claude-view-key";

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

  // Uitprobeer-stand voor de cockpit: alleen kijken of deze sleutel de deur zou
  // openen, zonder hem te gebruiken. Geen sessie-cookie (die zou Maartens eigen
  // adminsessie overschrijven met een alleen-lezen sessie), geen stempel en geen
  // mislukte poging in het log. Zo kan de knop zichzelf bewijzen.
  if (req.nextUrl.searchParams.get("test") === "1") {
    try {
      const t = await testViewKey(sleutel);
      return NextResponse.json(t.ok ? { ok: true } : { ok: false, reden: t.reden }, { status: t.ok ? 200 : 401 });
    } catch {
      return NextResponse.json({ ok: false, error: "De database antwoordde niet." }, { status: 503 });
    }
  }

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
        "Er staat geen kijk-sleutel klaar. Zet meekijken aan op /admin, zet die ene sleutel in de Claude-omgeving " +
        "en open daarna een nieuwe chat.",
      // LET OP, DIT ANTWOORD HEEFT EEN DAG ELLENDE VEROORZAAKT.
      // Hier stond: "maak op /admin een nieuwe sleutel". Dat was precies de
      // handeling die de zojuist geplakte sleutel introk, waarna dezelfde
      // melding weer verscheen. Maarten liep daar op 15-08-2026 zesendertig
      // keer doorheen. Sinds die dag vervalt een sleutel niet meer vanzelf,
      // dus een nieuwe maken is nooit meer het antwoord op deze melding.
      "andere-sleutel":
        "Deze sleutel is met de hand ingetrokken (of is van vóór 15-08-2026). Sleutels vervallen niet meer vanzelf. " +
        "Maak op /admin ÉÉN nieuwe, zet hem in de Claude-omgeving en open daarna een nieuwe chat. Blijft deze chat " +
        "dit melden, dan is dat normaal: een lopende chat houdt de oude waarde. Maak dus géén tweede sleutel.",
      leeg: "Er kwam geen sleutel mee in het verzoek.",
    };
    // De telling die hier tijdens het uitzoeken bij zat hoort niet op een open
    // ingang thuis; hij staat nu achter de adminlogin, in de cockpit zelf.
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
