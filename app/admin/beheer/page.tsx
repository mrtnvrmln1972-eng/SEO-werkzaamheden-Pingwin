import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { listTeamUsers } from "../../../lib/team-users";
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
      clients={clients.map((c) => ({
        slug: c.slug,
        name: c.name,
        email: c.email,
        domain: c.domain,
        loginEnabled: c.loginEnabled,
      }))}
      team={team}
    />
  );
}
