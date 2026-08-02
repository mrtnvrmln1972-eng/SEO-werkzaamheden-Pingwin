import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import WerklijstAdmin from "./WerklijstAdmin";

export const dynamic = "force-dynamic";

// De Pingwin-versie van de afwerkpagina: dezelfde lijst als de sitebouwer ziet,
// maar met de huidige meta ernaast en de knop "Voer door in de site". Zelfde
// toegangsregels als de cockpit; de sitebouwer komt hier dus nooit.
export default async function WerklijstPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return <WerklijstAdmin slug={params.slug} />;
}
