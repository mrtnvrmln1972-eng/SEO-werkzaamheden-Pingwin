import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { haalPunten, STARTREGEL } from "../../../lib/grote-punten";
import { puntStand, wachtrijMetTijden } from "../../../lib/punt-ronde";
import GrotePuntenClient from "./GrotePuntenClient";

// ═══════════════════════════════════════════════════════════
// /admin/grote-punten — DE WACHTRIJ VOOR GROTE PUNTEN
// ═══════════════════════════════════════════════════════════
// De plek waar een idee een plan wordt, het plan jouw akkoord krijgt, en het
// daarna 's nachts gebouwd wordt. Zelfde poort als de routekaart en de tweaks:
// werkvloer, dus de eigenaar of een gast met het ontwikkelrecht.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function GrotePuntenPage() {
  const scope = await getScopeFromCookie(
    cookies().get(ADMIN_COOKIE)?.value,
    cookies().get(ADMIN_VIEWAS_COOKIE)?.value,
  );
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  const [punten, stand, wachtrij] = await Promise.all([
    haalPunten(true), puntStand(), wachtrijMetTijden(),
  ]);

  return (
    <GrotePuntenClient
      begin={punten}
      beginStand={stand}
      beginStarts={wachtrij.starts}
      startregel={STARTREGEL}
    />
  );
}
