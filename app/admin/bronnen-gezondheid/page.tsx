import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { controleerAlleBronnen, controleerWordpressKlanten } from "../../../lib/bron-gezondheid-controle";
import BronnenGezondheidClient from "./BronnenGezondheidClient";

// ═══════════════════════════════════════════════════════════
// /admin/bronnen-gezondheid — R7: WELKE BRON IS VANDAAG STIL?
// ═══════════════════════════════════════════════════════════
// Werkvloer, geen klantscherm: zelfde poort als de routekaart en de developer-
// pagina. Elke keer dat dit scherm opent, doet het meteen een verse controle per
// koppeling (geen cache), zodat een net losgetrokken koppeling binnen een
// minuut zichtbaar is in plaats van pas bij de eerstvolgende toevallige aanroep.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function BronnenGezondheidPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  const [bronnen, wordpress] = await Promise.all([
    controleerAlleBronnen(),
    controleerWordpressKlanten(),
  ]);

  return <BronnenGezondheidClient bronnen={bronnen} wordpress={wordpress} />;
}
