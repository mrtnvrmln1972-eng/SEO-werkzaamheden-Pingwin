import { NextRequest, NextResponse } from "next/server";
import { guardDev, isMeekijker } from "../../../../../lib/admin-scope";
import { claimRonde, geefRondeTerug, breekRondeAf, rondeStand, MAX_PER_RONDE } from "../../../../../lib/tweak-ronde";
import { meldGebouwd } from "../../../../../lib/tweaks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// HET SLOT VAN DE WACHTRIJ
// ═══════════════════════════════════════════════════════════
// GET                       loopt er een ronde, en sinds wanneer
// POST { actie: "claim" }   begin een ronde en krijg de meldingen die erbij horen
// POST { actie: "terug" }   geef de ronde terug (klaar, of gestopt)
//
// Dit is de enige juiste manier om een ronde te beginnen. Een chat die zelf de
// lijst ophaalt en gaat bouwen weet niet of er al een ronde loopt, en twee
// rondes tegelijk in dezelfde bestanden is precies wat er eerder is misgegaan.
//
// De meekijk-sessie mag hier wél schrijven, om dezelfde reden als bij de standen:
// de ronde wordt door Claude gedraaid, dus als hij het slot niet kan pakken kan
// hij ook niet voorkomen dat een tweede ronde eroverheen loopt. De uitzondering
// blijft smal: claimen en teruggeven, verder niets.
// ═══════════════════════════════════════════════════════════

/** Een naam voor deze ronde, zodat in de lijst staat wie het slot heeft. */
function rondeNaam(vanClaude: boolean): string {
  const tijd = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `${vanClaude ? "claude" : "handmatig"}-${tijd}`;
}

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, ronde: await rondeStand(), maxPerRonde: MAX_PER_RONDE });
}

export async function POST(req: NextRequest) {
  const meekijker = isMeekijker(req);
  if (!meekijker) { const g = await guardDev(req); if (!g.ok) return g.res; }

  const body = await req.json().catch(() => null);
  const actie = String(body?.actie ?? "claim");

  // De noodrem hoort bij Maarten, niet bij een ronde. Zou de meekijk-sessie hem
  // ook hebben, dan kan een ronde zichzelf of een ander losbreken en is het slot
  // geen slot meer.
  if (actie === "afbreken") {
    if (meekijker) {
      return NextResponse.json({ ok: false, error: "Alleen jij kunt een ronde afbreken." }, { status: 403 });
    }
    const g = await guardDev(req); if (!g.ok) return g.res;
    const terug = await breekRondeAf();
    return NextResponse.json({ ok: true, terug, ronde: await rondeStand() });
  }

  if (actie === "terug") {
    const ronde = String(body?.ronde ?? "").trim();
    if (!ronde) return NextResponse.json({ ok: false, error: "Welke ronde?" }, { status: 400 });
    await geefRondeTerug(ronde);
    return NextResponse.json({ ok: true, ronde: await rondeStand() });
  }

  // De ronde meldt per melding dat hij hem gewijzigd heeft, nog vóór het live
  // zetten. Dat is het enige signaal dat tijdens een ronde beweegt; zonder dit
  // staat de balk minuten stil op "0 van 3" terwijl er volop gewerkt wordt.
  if (actie === "gebouwd") {
    const id = Number(body?.id);
    if (!id) return NextResponse.json({ ok: false, error: "Welke melding?" }, { status: 400 });
    await meldGebouwd(id);
    return NextResponse.json({ ok: true, ronde: await rondeStand() });
  }

  if (actie !== "claim") {
    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
  }

  const uitslag = await claimRonde(String(body?.ronde ?? "").trim() || rondeNaam(meekijker));
  if (!uitslag.ok) {
    return NextResponse.json({
      ok: false,
      reden: uitslag.reden,
      // Twee heel verschillende dingen, dus twee heel verschillende zinnen. Een
      // ronde die niets vindt is goed nieuws; een ronde die botst is een stop.
      error: uitslag.reden === "bezet"
        ? "Er loopt al een ronde. Wacht tot die klaar is; twee rondes tegelijk in dezelfde bestanden gaat mis."
        : "Er staat niets in de wachtrij. Niets te doen.",
      ronde: uitslag.stand,
    }, { status: uitslag.reden === "bezet" ? 409 : 200 });
  }

  return NextResponse.json({ ok: true, ronde: uitslag.ronde, tweaks: uitslag.tweaks });
}
