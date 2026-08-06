import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import { PUNTEN, nuDoen, voortgang, startprompt, geenAdviesReden } from "../../../../lib/routekaart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// WAT IS DE EERSTVOLGENDE ONTWIKKELTAAK?
// ═══════════════════════════════════════════════════════════
// Voedt het ontwikkelmenu in de kopbalk. Dat menu staat op élk adminscherm, en
// de kopbalken zijn per scherm met de hand geschreven; via deze route hoeft er
// geen enkele pagina extra gegevens door te geven om hem te laten werken.
//
// Achter guardDev, dezelfde poort als het developer-overzicht: dit is werkvloer.
// Een gast zonder ontwikkelrecht krijgt 403 en het menu verschijnt dan niet.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const advies = nuDoen();
  const lopend = PUNTEN.filter((p) => p.stand === "loopt").map((p) => ({ code: p.code, titel: p.titel }));
  return NextResponse.json({
    ok: true,
    advies: advies ? { code: advies.code, titel: advies.titel, prompt: startprompt(advies) } : null,
    // Waarom er niets wordt aangeraden. Zonder dit is "geen advies" een raadsel.
    reden: geenAdviesReden(),
    lopend,
    voortgang: voortgang(),
  });
}
