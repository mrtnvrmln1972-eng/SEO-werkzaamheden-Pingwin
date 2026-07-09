import { getProfitLoss, getOpenInvoices, getExpensesByContact, getLedgerAccounts, moneybirdConfigured } from "./moneybird";
import { callClaude } from "./anthropic";
import { getChatHistory, replaceChatHistory, type ChatMessage } from "./chat";

// ═══════════════════════════════════════════════════════════
// FINANCIËN-CHAT (Moneybird, alleen eigenaar)
// ═══════════════════════════════════════════════════════════
// Gegronde chat op de eigen cijfers: winst & verlies per maand (dit jaar),
// vorig jaar als vergelijking, kosten per leverancier en openstaande facturen.
// Voor vragen als "waar kan ik besparen", "waar zit winstpotentieel" en "wat
// is de prognose voor het einde van het jaar".
// Opslag: de bestaande client_chat-tabel onder pseudo-slug "_financien"
// (staat niet in de clients-tabel en verschijnt dus nergens in lijsten).
// ═══════════════════════════════════════════════════════════

export const FINANCE_SLUG = "_financien";

export { moneybirdConfigured };

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

async function buildFinanceContext(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const parts: string[] = [];
  const mm = (m: number) => String(m).padStart(2, "0");

  const ledgers = await getLedgerAccounts().catch(() => []);
  const lname = (id: string) => ledgers.find((l) => l.id === id)?.name || `post ${id}`;

  // Dit jaar per maand (gecachte rapporten) + jaartotaal tot nu.
  parts.push(`VANDAAG: ${now.toLocaleDateString("nl-NL")} (maand ${curMonth} van 12).`);
  parts.push(`\nWINST & VERLIES ${year}, PER MAAND (opbrengsten / kosten / resultaat):`);
  let ytdRev = 0, ytdCost = 0;
  const monthReports: { m: number; rev: number; cost: number }[] = [];
  for (let m = 1; m <= curMonth; m++) {
    try {
      const pl = await getProfitLoss(`${year}${mm(m)}`);
      ytdRev += pl.totalRevenue; ytdCost += pl.totalExpenses;
      monthReports.push({ m, rev: pl.totalRevenue, cost: pl.totalExpenses });
      parts.push(`- ${MONTH_NAMES[m - 1]}: ${euro(pl.totalRevenue)} / ${euro(pl.totalExpenses)} / ${euro(pl.netProfit)}`);
    } catch { /* maand overslaan */ }
  }
  parts.push(`Jaar tot nu: opbrengsten ${euro(ytdRev)}, kosten ${euro(ytdCost)}, resultaat ${euro(ytdRev - ytdCost)}.`);

  // Vorig jaar als vergelijking (totaal).
  try {
    const prev = await getProfitLoss(`${year - 1}01..${year - 1}12`);
    parts.push(`\nVORIG JAAR (${year - 1}, heel jaar): opbrengsten ${euro(prev.totalRevenue)}, kosten ${euro(prev.totalExpenses)}, resultaat ${euro(prev.netProfit)}.`);
  } catch { /* geen vergelijking */ }

  // Uitsplitsing per post (jaar tot nu), voor besparingsvragen.
  try {
    const pl = await getProfitLoss(`${year}01..${year}${mm(curMonth)}`);
    const top = (list: { ledgerAccountId: string; value: number }[], n = 12) =>
      [...list].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, n)
        .map((r) => `- ${lname(r.ledgerAccountId)}: ${euro(r.value)}`);
    if (pl.revenueByLedger.length) { parts.push(`\nOPBRENGSTEN PER POST (${year} tot nu):`); parts.push(...top(pl.revenueByLedger)); }
    if (pl.costsByLedger.length) { parts.push(`\nKOSTEN PER POST (${year} tot nu):`); parts.push(...top(pl.costsByLedger, 18)); }
  } catch { /* uitsplitsing is aanvulling */ }

  // Kosten per leverancier (laatste volledige maand): abonnementen/besparingskandidaten.
  try {
    const lastFull = curMonth > 1 ? `${year}${mm(curMonth - 1)}` : `${year - 1}12`;
    const byContact = await getExpensesByContact(lastFull);
    if (byContact.length) {
      parts.push(`\nKOSTEN PER LEVERANCIER (maand ${lastFull}, grootste eerst):`);
      parts.push(...[...byContact].sort((a, b) => b.value - a.value).slice(0, 20).map((c) => `- ${c.contactName}: ${euro(c.value)}`));
    }
  } catch { /* aanvulling */ }

  // Openstaande facturen.
  try {
    const open = await getOpenInvoices();
    if (open.length) {
      const total = open.reduce((s, i) => s + i.totalUnpaid, 0);
      parts.push(`\nOPENSTAANDE VERKOOPFACTUREN (${open.length} stuks, samen ${euro(total)}):`);
      parts.push(...open.slice(0, 20).map((i) => `- ${i.contactName}: ${i.invoiceId}, ${euro(i.totalUnpaid)}, ${i.daysOpen} dagen open`));
    } else {
      parts.push("\nOPENSTAANDE VERKOOPFACTUREN: geen.");
    }
  } catch { /* aanvulling */ }

  return parts.join("\n");
}

export async function answerFinanceChat(messages: ChatMessage[], thread = "algemeen"): Promise<{ ok: boolean; answer?: string; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Geen ANTHROPIC_API_KEY ingesteld." };
  if (!moneybirdConfigured()) return { ok: false, error: "Moneybird is niet gekoppeld." };

  const context = await buildFinanceContext();
  const system =
    `Je bent de financieel adviseur van Maarten (Pingwin Online Marketing, eenmanszaak/klein bureau). ` +
    `Beantwoord in het Nederlands, op basis van de onderstaande Moneybird-cijfers. Je helpt met vragen over besparingen, winstpotentieel, kostenposten, openstaande facturen en de prognose voor het einde van het jaar.\n\n` +
    `OPMAAK: conversationeel en netjes, in Markdown. Geen emoji. Korte alinea's, bullets (-) voor opsommingen, **vet** voor kernpunten; zet cijfervergelijkingen (maanden, posten) in een nette Markdown-tabel.\n\n` +
    `WERKWIJZE: geef ANTWOORDEN met concrete bedragen uit de cijfers, geen algemene financiële praatjes.\n` +
    `- Prognoses: extrapoleer eerlijk (bijv. gemiddelde per maand × resterende maanden) en benoem dat het een indicatie is, inclusief wat de prognose kan laten afwijken (seizoen, eenmalige posten).\n` +
    `- Besparingen: kijk naar de grootste kostenposten en leveranciers en benoem concreet welke het bekijken waard zijn.\n` +
    `- Staat iets niet in de cijfers (bijv. btw, privé, belastingen), zeg dat eerlijk.\n\n--- FINANCIËLE CONTEXT (Moneybird) ---\n${context}`;

  try {
    const apiMessages = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const answer = await callClaude(system, apiMessages, 2000, { slug: FINANCE_SLUG, action: "finance-chat" });
    const finalAnswer = answer || "(geen antwoord)";
    await replaceChatHistory(FINANCE_SLUG, thread, [...messages, { role: "assistant", content: finalAnswer }]);
    return { ok: true, answer: finalAnswer };
  } catch (err) {
    return { ok: false, error: "AI niet bereikbaar: " + (err as Error).message };
  }
}

export async function getFinanceChatHistory(thread = "algemeen"): Promise<ChatMessage[]> {
  return getChatHistory(FINANCE_SLUG, thread);
}
