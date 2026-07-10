import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../lib/constants";
import { getScopeFromCookie } from "../../lib/admin-scope";
import { listClients } from "../../lib/clients";
import { moneybirdConfigured } from "../../lib/moneybird";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  const all = await listClients();
  // Gast: alleen de eigen klanten. Eigenaar: alles.
  const clients = scope.isOwner ? all : all.filter((c) => scope.allowedSlugs?.includes(c.slug));
  // Groepen (Multimedia Concepts) alleen in de Pingwin-wereld tonen.
  const isNoc = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").includes("noc-seo-cockpit");
  // Financiën (Maartens privé-administratie) alleen tonen in de wereld waar
  // Moneybird ook echt gekoppeld is; in andere werelden bestaat de knop niet.
  return <AdminClient initialClients={clients} isOwner={scope.isOwner} showGroups={!isNoc} showFinance={moneybirdConfigured()} />;
}
