import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import ClientCockpit from "./ClientCockpit";

export const dynamic = "force-dynamic";

export default async function ClientCockpitPage({ params }: { params: { slug: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  const [storedEmails, metrics, keywords, pages, lastIngest, status, ms] = await Promise.all([
    getEmails(params.slug),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    getStatus(params.slug),
    msStatus(),
  ]);

  // Live mails uit Microsoft 365 als de koppeling actief is; anders de opgeslagen mails.
  let emails = storedEmails;
  let mailLive = false;
  if (ms.connected) {
    const query = (client.email || client.domain || "").trim();
    if (query) {
      const live = await msSearchClientEmails(query, ms.account || "", 15);
      if (live) { emails = live; mailLive = true; }
    }
  }

  return (
    <ClientCockpit
      client={client}
      emails={emails}
      metrics={metrics}
      keywords={keywords}
      pages={pages}
      lastIngest={mailLive ? null : lastIngest}
      status={status.status}
      statusUpdatedAt={status.updatedAt}
      mailLive={mailLive}
      msConfigured={ms.configured}
      msConnected={ms.connected}
    />
  );
}
