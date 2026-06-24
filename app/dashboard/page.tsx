import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionValue } from "../../lib/auth";
import { getClientBySlug } from "../../lib/clients";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  const slug = verifySessionValue(value);
  if (!slug) redirect("/login");

  const client = await getClientBySlug(slug);
  if (!client) redirect("/login");

  return (
    <Dashboard
      name={client.name}
      sheetId={client.sheetId}
      gid={client.gid}
      budget={client.budget}
    />
  );
}
