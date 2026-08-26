import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import WerkplanningProef from "./WerkplanningProef";

export const dynamic = "force-dynamic";

// Losse proefpagina (nog niet gekoppeld aan het klantmenu of de echte
// weekplanning-tab), zodat Maarten 'm op de echte data kan beoordelen voordat
// dit een vast onderdeel van de planning wordt. Zelfde toegangsregels als de
// cockpit: dezelfde scope-check als elke andere losse route onder een klant.
export default async function Page({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return <WerkplanningProef slug={params.slug} klantNaam={client.name} domein={client.domain} />;
}
