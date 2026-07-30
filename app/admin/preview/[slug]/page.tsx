import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getTasks } from "../../../../lib/tasks";
import { tasksToDashboardData } from "../../../../lib/sheet";
import Dashboard from "../../../dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // Gast zonder toegang tot deze klant: geen preview.
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  // Nieuwe bron: taken uit het dashboard (database). Heeft de klant DB-taken,
  // dan tonen we die; anders valt het dashboard terug op de Google Sheet.
  const tasks = await getTasks(params.slug);
  const initialData = tasks.length ? tasksToDashboardData(tasks, client.budget) : undefined;

  return (
    <Dashboard
      name={client.name}
      sheetId={client.sheetId}
      gid={client.gid}
      budget={client.budget}
      initialData={initialData}
      adminPreview
    />
  );
}
