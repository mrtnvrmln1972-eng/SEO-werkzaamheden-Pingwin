import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionValue } from "../../lib/auth";
import { getClientBySlug } from "../../lib/clients";
import { getTasks } from "../../lib/tasks";
import { tasksToDashboardData } from "../../lib/sheet";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  const slug = verifySessionValue(value);
  if (!slug) redirect("/login");

  const client = await getClientBySlug(slug);
  if (!client) redirect("/login");

  // Nieuwe bron: taken uit het dashboard (database). Heeft de klant DB-taken,
  // dan tonen we die; anders valt het dashboard terug op de Google Sheet.
  const tasks = await getTasks(slug);
  const initialData = tasks.length ? tasksToDashboardData(tasks, client.budget) : undefined;

  return (
    <Dashboard
      name={client.name}
      sheetId={client.sheetId}
      gid={client.gid}
      budget={client.budget}
      initialData={initialData}
    />
  );
}
