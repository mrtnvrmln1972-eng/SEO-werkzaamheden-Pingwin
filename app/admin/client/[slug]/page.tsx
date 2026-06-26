import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug, listClients, type ClientConfig } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import { googleStatus, getGscForClient } from "../../../../lib/google";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "../../../../lib/sheet";
import { chatConfigured } from "../../../../lib/chat";
import ClientCockpit from "./ClientCockpit";

export const dynamic = "force-dynamic";

export type SheetTask = { text: string; link: string };

// Lopende werkzaamheden van de HUIDIGE maand uit de klant-Google-Sheet,
// alleen wat nog niet op 'klaar' staat. Faalt stil naar lege lijst.
async function loadCurrentMonthTasks(client: ClientConfig): Promise<SheetTask[]> {
  if (!client.sheetId) return [];
  const baseEdit = `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit`;
  try {
    const res = await fetch(sheetCsvUrl(client.sheetId, client.gid), { cache: "no-store" });
    if (!res.ok) return [];
    const data = structureData(parseCSV(await res.text()), client.budget);
    if (!data) return [];
    const month = MAAND_VOLGORDE[new Date().getMonth()];
    const done = /klaar|afgerond|gereed|done|afgehandeld|voltooid/i;
    return data.tasks
      .filter((t) => t.maand === month && !done.test(t.status))
      // Link gaat naar de exacte regel in de Sheet en selecteert (highlight) die rij.
      .map((t) => ({ text: t.taak, link: `${baseEdit}#gid=${client.gid}&range=${t.row}:${t.row}` }));
  } catch {
    return [];
  }
}

export default async function ClientCockpitPage({ params }: { params: { slug: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  const [storedEmails, metrics, keywords, pages, lastIngest, status, ms, sheetTasks, allClients] = await Promise.all([
    getEmails(params.slug),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    getStatus(params.slug),
    msStatus(),
    loadCurrentMonthTasks(client),
    listClients(),
  ]);

  // Search Console live ophalen als de Google-koppeling actief is.
  const google = await googleStatus();
  const gsc = google.connected ? await getGscForClient(client.domain || "") : null;

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
      myEmail={ms.account}
      sheetTasks={sheetTasks}
      allClients={allClients.map((c) => ({ slug: c.slug, name: c.name }))}
      gsc={gsc}
      googleConfigured={google.configured}
      googleConnected={google.connected}
      chatConfigured={chatConfigured()}
    />
  );
}
