import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { haalTweaks, STARTREGEL } from "../../../lib/tweaks";
import { rondeStand } from "../../../lib/tweak-ronde";
import { haalNulmeting } from "../../../lib/nulmeting";
import { listClients } from "../../../lib/clients";
import TweaksClient from "./TweaksClient";

// ═══════════════════════════════════════════════════════════
// /admin/tweaks — DE STAPEL KLEINE AANPASSINGEN
// ═══════════════════════════════════════════════════════════
// De verzamelplek van het knopje "Tweak" dat op elk beheerscherm staat. Hier
// zie je wat er klaarstaat en pak je de startregel voor een verse chat die de
// hele stapel in één ronde afwerkt.
//
// Zelfde poort als de routekaart: werkvloer, dus de eigenaar of een gast met
// het ontwikkelrecht.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function TweaksPage() {
  const scope = await getScopeFromCookie(
    cookies().get(ADMIN_COOKIE)?.value,
    cookies().get(ADMIN_VIEWAS_COOKIE)?.value,
  );
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  // De nulmeting wijst naar de cockpit van een klant, en welke klant dat is doet
  // er niet toe: het gaat om het scherm, niet om die klant. De eerste is prima.
  const [tweaks, nulmeting, ronde, klanten] = await Promise.all([
    haalTweaks(true), haalNulmeting(), rondeStand(), listClients(),
  ]);
  return (
    <TweaksClient
      begin={tweaks}
      startregel={STARTREGEL}
      nulmeting={nulmeting}
      ronde={ronde}
      voorbeeldSlug={klanten[0]?.slug ?? null}
    />
  );
}
