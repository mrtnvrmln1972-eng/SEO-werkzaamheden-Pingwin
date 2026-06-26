import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { getClientBySlug, listClients, type ClientConfig } from "../../../../lib/clients";
import { getEmails, getMetrics, getKeywords, getPages, getLastIngest, getStatus } from "../../../../lib/snapshots";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import { googleStatus, getGscForClient, getGa4ForClient } from "../../../../lib/google";
import { sheetCsvUrl, parseCSV, structureData, MAAND_VOLGORDE } from "../../../../lib/sheet";
import { chatConfigured, getChatHistory } from "../../../../lib/chat";
import ClientCockpit from "./ClientCockpit";

export const dynamic = "force-dynamic";

export type SheetTask = { text: string; link: string; done: boolean; wie: string };
export type MonthTasks = { thisMonth: SheetTask[]; nextMonth: SheetTask[]; thisLabel: string; nextLabel: string };

function monthLabel(offset: number): string {
  const i = (new Date().getMonth() + offset + 12) % 12;
  return MAAND_VOLGORDE[i];
}

// Werkzaamheden uit de klant-Google-Sheet, opgesplitst in deze maand en
// volgende maand. Eigen, simpele parser (de budget/totaal-regels hebben een
// lege Taak-kolom en worden overgeslagen). Link gaat naar de exacte rij.
async function loadTasksByMonth(client: ClientConfig): Promise<MonthTasks> {
  const empty: MonthTasks = { thisMonth: [], nextMonth: [], thisLabel: monthLabel(0), nextLabel: monthLabel(1) };
  if (!client.sheetId) return empty;
  const baseEdit = `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit`;
  const rowLink = (rowNum: number) => `${baseEdit}#gid=${client.gid}&range=${rowNum}:${rowNum}`;
  try {
    const res = await fetch(sheetCsvUrl(client.sheetId, client.gid), { cache: "no-store" });
    if (!res.ok) return empty;
    const rows = parseCSV(await res.text());
    const done = /klaar|afgerond|gereed|done|afgehandeld|voltooid/i;
    const thisM = monthLabel(0);
    const nextM = monthLabel(1);
    const thisMonth: SheetTask[] = [];
    const nextMonth: SheetTask[] = [];
    for (let i = 1; i < rows.length; i++) {
      const taak = (rows[i][1] || "").trim();
      if (!taak) continue; // header/budget/totaal-regels
      if (done.test((rows[i][4] || "").trim())) continue; // alleen niet-afgeronde taken
      const maand = (rows[i][5] || "").trim().toLowerCase();
      const t: SheetTask = { text: taak, link: rowLink(i + 1), done: false, wie: (rows[i][7] || "").trim() };
      if (maand === thisM) thisMonth.push(t);
      else if (maand === nextM) nextMonth.push(t);
    }
    return { thisMonth, nextMonth, thisLabel: thisM, nextLabel: nextM };
  } catch {
    return empty;
  }
}

export default async function ClientCockpitPage({ params }: { params: { slug: string } }) {
  const ok = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  if (!ok) redirect("/admin/login");

  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");

  const [storedEmails, metrics, keywords, pages, lastIngest, status, ms, monthTasks, allClients] = await Promise.all([
    getEmails(params.slug),
    getMetrics(params.slug),
    getKeywords(params.slug),
    getPages(params.slug),
    getLastIngest(params.slug),
    getStatus(params.slug),
    msStatus(),
    loadTasksByMonth(client),
    listClients(),
  ]);

  const chatHistory = await getChatHistory(params.slug);

  // Search Console live ophalen als de Google-koppeling actief is.
  const google = await googleStatus();
  const [gsc, ga4] = google.connected
    ? await Promise.all([getGscForClient(client.domain || ""), getGa4ForClient(params.slug, client.domain || "")])
    : [null, null];

  // Live mails uit Microsoft 365 als de koppeling actief is; anders de opgeslagen mails.
  let emails = storedEmails;
  let mailLive = false;
  if (ms.connected) {
    const query = (client.email || client.domain || "").trim();
    if (query) {
      const live = await msSearchClientEmails(query, ms.account || "", 25);
      if (live) { emails = live; mailLive = true; }
    }
  }
  // Ahrefs-rapportmails (automatisch) uit de mailstroom houden.
  emails = emails.filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()));

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
      monthTasks={monthTasks}
      allClients={allClients.map((c) => ({ slug: c.slug, name: c.name }))}
      gsc={gsc}
      ga4={ga4}
      googleConfigured={google.configured}
      googleConnected={google.connected}
      chatConfigured={chatConfigured()}
      chatHistory={chatHistory}
    />
  );
}
