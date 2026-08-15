import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { rondeStand } from "../../../../../lib/tweak-ronde";
import { telOpen } from "../../../../../lib/tweaks";
import { startWerkstroom, werkstroomKlaar } from "../../../../../lib/werkstroom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE KNOP "NU DRAAIEN"
// ═══════════════════════════════════════════════════════════
// Een ronde starten was handwerk: een verse chat openen en /tweaks plakken. Dat
// werkt, maar het betekent dat Maarten aan een computer moet zitten met een chat
// ernaast, terwijl de ronde zelf niemand nodig heeft. Deze route start dezelfde
// ronde vanaf de knop, via GitHub Actions.
//
// TWEE SLEUTELS, EN SINDS 15-08-2026 NIET MEER DRIE
//  1. GITHUB_TWEAK_TOKEN, in Vercel. Waarmee dit dashboard de werkstroom mag
//     starten. Fijnmazig, alleen deze repo, alleen "Actions: read and write".
//  2. ANTHROPIC_API_KEY, als repo-secret in GitHub. Waarmee de ronde mag denken.
//     Die staat bewust NIET in Vercel: dit dashboard hoeft er niet bij.
//
// De derde (PINGWIN_KIJK_SLEUTEL als repo-secret) is weg, en dat is een
// reparatie en geen versimpeling. Die sleutel is van een mens: hij vervalt zodra
// Maarten in de cockpit een nieuwe meekijk-sleutel maakt. Dat gebeurde op
// 15-08-2026, en vanaf dat moment kwam elke ronde het dashboard niet meer in.
// De ronde meldde "geslaagd", claimde niets, en de vier meldingen stonden een uur
// later nog gewoon in de wachtrij. Nu krijgt elke ronde hier zijn eigen
// ondertekende toegangsbon mee (lib/ronde-bon.ts): niets te kopiëren, en een
// nieuwe meekijk-sleutel raakt de rondes niet meer.
// ═══════════════════════════════════════════════════════════

const WERKSTROOM = "tweak-ronde.yml";

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, ...(await werkstroomKlaar(WERKSTROOM)) });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Draait er al een? Dan is nog een keer starten precies de botsing die de
  // wachtrij moet voorkomen. Deze controle staat er dus vóór de knop, niet erna.
  const stand = await rondeStand();
  if (stand.ronde) {
    return NextResponse.json({
      ok: false,
      error: stand.baan === "punt"
        ? "Er wordt nu een groot punt gebouwd. Tweaks en grote punten bouwen nooit tegelijk."
        : "Er loopt al een ronde. Die is meestal binnen een paar minuten klaar.",
      ronde: stand,
    }, { status: 409 });
  }

  const tellers = await telOpen();
  if (tellers.wachtrij === 0) {
    return NextResponse.json({ ok: false, error: "Er staat niets in de wachtrij." }, { status: 400 });
  }

  const uit = await startWerkstroom(WERKSTROOM, "tweak", "knop");
  if (!uit.ok) {
    return NextResponse.json({ ok: false, error: uit.error, klaarzetten: uit.klaarzetten }, { status: uit.status });
  }

  return NextResponse.json({
    ok: true,
    melding: `De ronde is gestart. ${tellers.wachtrij === 1 ? "Eén aanpassing" : `${tellers.wachtrij} aanpassingen`} gaan mee; zodra ze live staan verschijnen ze hier onder "Klaar, klopt het?".`,
  });
}
