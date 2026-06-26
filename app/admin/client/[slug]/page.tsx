import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import ClientCockpit from "./ClientCockpit";

export const dynamic = "force-dynamic";

export default async function ClientCockpitPage({ params }: { params: { slug: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  const [emails, metrics, keywords, pages, lastIngest, status] = await Promise.all([
    getEmails(params.slug),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    getStatus(params.slug),
  ]);

  return (
    <ClientCockpit
      client={client}
      emails={emails}
      metrics={metrics}
      keywords={keywords}
      pages={pages}
      lastIngest={lastIngest}
      status={status.status}
      statusUpdatedAt={status.updatedAt}
    />
  );
}
