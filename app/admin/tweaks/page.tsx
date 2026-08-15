import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { haalTweaks, STARTREGEL } from "../../../lib/tweaks";
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

  const tweaks = await haalTweaks(true);
  return <TweaksClient begin={tweaks} startregel={STARTREGEL} />;
}
