import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import NavigatieRoadmap from "./NavigatieRoadmap";

export const dynamic = "force-dynamic";

// Navigatie-roadmap: de hele sitestructuur (huidig én beoogd) met per pagina
// hoofdzoekterm, klikbare slug en voortgang. Zelfde toegangsregels als de cockpit.
export default async function NavigatiePage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return <NavigatieRoadmap slug={params.slug} clientName={client.name} domain={client.domain || ""} />;
}
