import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import Dashboard from "../../../dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: { slug: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  return (
    <Dashboard
      name={client.name}
      sheetId={client.sheetId}
      gid={client.gid}
      budget={client.budget}
      adminPreview
    />
  );
}
