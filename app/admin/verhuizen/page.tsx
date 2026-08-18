import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import VerhuizenClient from "./VerhuizenClient";

// ═══════════════════════════════════════════════════════════
// /admin/verhuizen — EEN KLANT VAN DE ENE OMGEVING NAAR DE ANDERE
// ═══════════════════════════════════════════════════════════
// Gebouwd voor de verhuizing van het Nationaal Oogcentrum uit zijn eigen losse
// cockpit naar het Pingwin-dashboard, maar niet aan die klant gebonden.
//
// Beide omgevingen draaien dezelfde code, dus dit ene scherm doet beide kanten:
// waar de klant naartoe gaat maak je een verhuiscode, waar hij vandaan komt vul
// je die code in en druk je op de knop.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function VerhuizenPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");

  const klanten = (await listClients()).map((c) => ({ slug: c.slug, name: c.name }));
  return <VerhuizenClient klanten={klanten} />;
}
