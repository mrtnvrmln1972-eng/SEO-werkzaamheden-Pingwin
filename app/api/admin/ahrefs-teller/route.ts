import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import { getAhrefsSubscriptionUsage } from "../../../../lib/ahrefs";
import { getAhrefsEigenVerbruik } from "../../../../lib/usage";
import { tellerStand } from "../../../../lib/ahrefs-teller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// HOEVEEL AHREFS-TEGOED IS ER NOG?
// ═══════════════════════════════════════════════════════════
// Voedt het tellertje in de kopbalk van elk beheerscherm. Twee bronnen naast
// elkaar: het tegoed van het hele Ahrefs-account (bij Ahrefs opgevraagd, gratis
// en met een uurcache) en wat dit dashboard er de afgelopen zeven dagen zelf van
// verbruikte (uit onze eigen verbruiktabel).
//
// Waarom die tweede: een oplopende teller zegt niets zolang je niet weet wie hem
// laat oplopen. Staat het dashboard op bijna niets terwijl de teller volloopt,
// dan zit iemand in Ahrefs zelf te werken en heeft afremmen in het dashboard
// geen zin.
//
// Achter guardDev, dezelfde poort als het Intern-menu ernaast: dit is werkvloer,
// geen klantinformatie. Geen recht = foutcode = het tellertje tekent niets.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  const week = new Date();
  week.setDate(week.getDate() - 7);

  // Het eigen verbruik mag de teller nooit tegenhouden: valt de database weg, dan
  // is de belangrijkste helft (het tegoed bij Ahrefs) nog steeds bruikbaar.
  const [sub, eigen] = await Promise.all([
    getAhrefsSubscriptionUsage().catch(() => null),
    getAhrefsEigenVerbruik(week.toISOString()).catch(() => null),
  ]);

  const stand = tellerStand(sub);
  if (stand.used === null) return NextResponse.json({ ok: true, stand: null });

  return NextResponse.json({
    ok: true,
    stand,
    abonnement: sub?.abonnement ?? null,
    // Wat de sleutel van dit dashboard binnen dat totaal voor zijn rekening nam.
    usedKey: sub?.usedKey ?? null,
    eigen: eigen ? { units: eigen.units, calls: eigen.calls, topKlant: eigen.topKlant } : null,
  });
}
