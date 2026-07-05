import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { getScopeFromCookie } from "../../lib/admin-scope";
import { listClients } from "../../lib/clients";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  const all = await listClients();
  // Gast: alleen de eigen klanten. Eigenaar: alles.
  const clients = scope.isOwner ? all : all.filter((c) => scope.allowedSlugs?.includes(c.slug));
  return <AdminClient initialClients={clients} isOwner={scope.isOwner} />;
}
