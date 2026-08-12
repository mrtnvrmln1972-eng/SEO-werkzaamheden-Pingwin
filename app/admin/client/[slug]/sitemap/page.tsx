import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import SitemapCheck from "./SitemapCheck";

export const dynamic = "force-dynamic";

// Sitemap-check: de sitemap van de klant vers opgehaald en naast de pagina-
// spiegel gelegd. Zelfde toegangsregels als de cockpit.
export default async function SitemapPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return <SitemapCheck slug={params.slug} clientName={client.name} domain={client.domain || ""} />;
}
