import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { isKlant } from "../../../lib/klant-groepen";
import { listTeamUsers } from "../../../lib/team-users";
import { moneybirdConfigured } from "../../../lib/moneybird";
import BeheerClient from "./BeheerClient";

export const dynamic = "force-dynamic";

export default async function BeheerPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // Beheer is uitsluitend voor de eigenaar. Een gast belandt terug op het overzicht.
  if (!scope.isOwner) redirect("/admin");

  const [clients, team] = await Promise.all([listClients(), listTeamUsers()]);

  return (
    <BeheerClient
      // Alleen lopende klanten, via dezelfde regel als elk ander scherm
      // (lib/klant-groepen.ts). Leads en afgesloten deals horen hier niet: door
      // een verkeerde HubSpot-ronde stonden er op 19-08-2026 driehonderd rijen,
      // en daarin waren zijn eigen klanten niet meer te vinden.
      clients={clients.filter(isKlant).map((c) => ({
        slug: c.slug,
        name: c.name,
        email: c.email,
        domain: c.domain,
        loginEnabled: c.loginEnabled,
        ahrefsKeyRef: c.ahrefsKeyRef,
        voordeurUrl: c.cockpit.voordeurUrl,
      }))}
      team={team}
      showFinance={moneybirdConfigured()}
    />
  );
}
