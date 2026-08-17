import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import inventaris from "../../../lib/stijl-inventaris.json";
import plafondBestand from "../../../proeven/stijl-plafond.json";
import StijlClient from "./StijlClient";
import type { Meting } from "../../../lib/stijl-meting";

// ═══════════════════════════════════════════════════════════
// /admin/stijl — DE SPIEGEL
// ═══════════════════════════════════════════════════════════
// Eén scherm dat naast elkaar zet wat de bedoeling is en wat er werkelijk staat.
//
// WAAROM DIT ER IS
// ────────────────
// Het dashboard heeft een design-fundament: schaal-tokens voor ruimte, tekst,
// ronding en schaduw, plus gedeelde bouwstenen. Dat fundament is echt en het
// wordt bewaakt door drie proeven. En tóch bestaan er 331 verschillende kleuren
// en 98 eigen knop-classnamen, want die proeven vragen "doet dit bestand het
// goed?" en niet "hoeveel verschillende zijn er in totaal?".
//
// Dit scherm beantwoordt die tweede vraag, en het is met opzet ongemakkelijk:
// de bovenste helft toont hoe weinig beslissingen er zouden moeten zijn, de
// onderste hoeveel er echt zijn. Dat verschil is de werklijst.
//
// En het is meteen de testbank voor later. Zodra alles uit de tokens leest, is
// een ander ontwerp kiezen niets meer dan die tokens veranderen, en dán zie je
// hier in één blik wat dat met alle bouwstenen tegelijk doet. Het strak trekken
// en de speelruimte bouwen zijn niet twee klussen maar één.
//
// De cijfers komen uit lib/stijl-inventaris.json, dat bij élke bouw opnieuw
// wordt geschreven (scripts/stijl-inventaris.ts in prebuild). Geen live meting
// op schijf: op Vercel staat de broncode er niet gegarandeerd, en een spiegel
// die lokaal wel werkt en live niet is erger dan geen spiegel.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function StijlPage() {
  const scope = await getScopeFromCookie(
    cookies().get(ADMIN_COOKIE)?.value,
    cookies().get(ADMIN_VIEWAS_COOKIE)?.value
  );
  if (!scope) redirect("/admin/login");
  // Werkvloer, geen klantscherm: dezelfde poort als de routekaart en het
  // developer-overzicht. Een gast zonder ontwikkelrecht hoort hier niet.
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  return (
    <StijlClient
      meting={inventaris as unknown as Meting}
      plafond={plafondBestand.plafond}
      doel={plafondBestand.doel}
    />
  );
}
