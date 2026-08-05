import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import Weekbord from "./Weekbord";

export const dynamic = "force-dynamic";

// Voorbeeldscherm: het weekoverzicht compact, één regel per taak met de
// fase-stand ernaast. Staat bewust náást het tabblad Taken; daar verandert
// niets tot dit bevalt. Zelfde toegangsregels als de rest van de cockpit.
export default async function WeekbordPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return <Weekbord slug={params.slug} clientName={client.name} domain={client.domain || ""} />;
}
