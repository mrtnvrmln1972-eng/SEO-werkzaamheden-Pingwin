import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../lib/admin-auth";
import { getDeveloperTasks } from "../../../lib/developer";
import DeveloperOverview from "./DeveloperOverview";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const tasks = await getDeveloperTasks();
  return <DeveloperOverview initialTasks={tasks} />;
}
