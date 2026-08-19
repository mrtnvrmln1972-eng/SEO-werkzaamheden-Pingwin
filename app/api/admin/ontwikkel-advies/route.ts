import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import { PUNTEN, nuDoen, voortgang, startprompt, geenAdviesReden } from "../../../../lib/routekaart";
import { vensterKlant } from "../../../../lib/klantvenster";

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
//
// Draait deze omgeving als voordeur van één klant, dan gaat `venster` mee. Het
// menu weet in de browser niet wat er in de omgeving staat, en zou anders
// vijftien schermen tonen die daar niet bestaan. De ontwikkeling van het
// dashboard zelf hoort daar sowieso niet thuis, dus dan blijft alleen over wat
// er wél is (zie lib/klantvenster.ts, padHoortBijVenster).
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;
  const venster = vensterKlant();
  const advies = venster ? null : nuDoen();
  const lopend = venster ? [] : PUNTEN.filter((p) => p.stand === "loopt").map((p) => ({ code: p.code, titel: p.titel }));
  return NextResponse.json({
    ok: true,
    venster,
    advies: advies ? { code: advies.code, titel: advies.titel, prompt: startprompt(advies) } : null,
    // Waarom er niets wordt aangeraden. Zonder dit is "geen advies" een raadsel.
    reden: geenAdviesReden(),
    lopend,
    voortgang: voortgang(),
  });
}
