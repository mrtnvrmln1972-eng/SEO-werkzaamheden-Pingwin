import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { getDeveloperTasks } from "../../../lib/developer";
import DeveloperOverview from "./DeveloperOverview";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // Het developer-overzicht is voor de eigenaar en voor teamleden met het
  // dev-recht (de sitebouwer). Een gewone gast hoort hier niet en gaat terug.
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  const tasks = await getDeveloperTasks();
  return <DeveloperOverview initialTasks={tasks} />;
}
