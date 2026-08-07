import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getMeldingen, SETTING_MELDINGEN_GEZIEN } from "../../../../lib/meldingen";
import { getSetting, setSetting } from "../../../../lib/settings";
import { verwerkVervallenOpvolging, rondOpvolgingAf } from "../../../../lib/mail-opvolg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// MELDINGEN VOOR MAARTEN
// ═══════════════════════════════════════════════════════════
// Voedt het belletje in de kopbalk. Achter guardOwner: dit zijn Maartens eigen
// meldingen, en de sitebouwer werkt in datzelfde dashboard. Zij hoort geen
// belletje te krijgen over haar eigen afgevinkte taak.
//
// GET  = de laatste meldingen, met per stuk of hij nieuw is.
// POST = alles als gezien markeren (één tijdstempel, geen vinkje per melding).
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  try {
    // Mails waarvan de herinnerdag geweest is worden hier meldingen. Geen aparte
    // achtergrondtaak nodig: je ziet ze zodra je het belletje opent.
    await verwerkVervallenOpvolging().catch(() => 0);
    const gezien = await getSetting(SETTING_MELDINGEN_GEZIEN);
    const meldingen = await getMeldingen(gezien);
    return NextResponse.json({
      ok: true,
      meldingen,
      nieuw: meldingen.filter((m) => m.nieuw).length,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "De meldingen konden niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  // Eén opvolging afronden: die komt dan niet meer terug.
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const opvolgId = Number((body as Record<string, unknown>)?.opvolgId || 0);
  if (opvolgId) {
    await rondOpvolgingAf(opvolgId);
    return NextResponse.json({ ok: true });
  }
  await setSetting(SETTING_MELDINGEN_GEZIEN, new Date().toISOString());
  return NextResponse.json({ ok: true });
}
