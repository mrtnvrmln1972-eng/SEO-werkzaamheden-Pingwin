import { sql, ensureSchema } from "./db";
import { logBronGebeurtenis } from "./bron-gezondheid";

// ═══════════════════════════════════════════════════════════
// MONEYBIRD API v2 — boekhouding (alleen-lezen)
// ═══════════════════════════════════════════════════════════
// Vereist MONEYBIRD_API_TOKEN en MONEYBIRD_ADMINISTRATION_ID in Vercel.
// Deze laag doet UITSLUITEND GET-requests: er wordt nooit iets aangemaakt of
// gewijzigd in de boekhouding. Rate limit is 150 requests per 5 minuten
// (rapporten zelfs 50 per 5 min), daarom cachen we alles in moneybird_cache.
// ═══════════════════════════════════════════════════════════

const BASE = "https://moneybird.com/api/v2";

export function moneybirdConfigured(): boolean {
  return !!process.env.MONEYBIRD_API_TOKEN && !!process.env.MONEYBIRD_ADMINISTRATION_ID;
}

function administrationId(): string {
  return (process.env.MONEYBIRD_ADMINISTRATION_ID || "").trim();
}

// Deeplinks naar de Moneybird web-UI (vereist dat Maarten daar ingelogd is).
// Op de factuurpagina zit ook de knop "Herinnering versturen".
export function mbInvoiceUrl(invoiceId: string): string {
  return `https://moneybird.com/${administrationId()}/sales_invoices/${invoiceId}`;
}
export function mbContactUrl(contactId: string): string {
  return `https://moneybird.com/${administrationId()}/contacts/${contactId}`;
}

// Alleen GET: deze functie kent bewust geen method-parameter.
async function mbFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = process.env.MONEYBIRD_API_TOKEN;
  const adm = administrationId();
  if (!token || !adm) {
    logBronGebeurtenis("moneybird", false, "MONEYBIRD_API_TOKEN of MONEYBIRD_ADMINISTRATION_ID ontbreekt.").catch(() => {});
    throw new Error("MONEYBIRD_API_TOKEN of MONEYBIRD_ADMINISTRATION_ID ontbreekt.");
  }
  const url = new URL(`${BASE}/${adm}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctl.signal,
    });
    if (res.status === 401) throw new Error("Moneybird: token ongeldig of ingetrokken (401). Controleer MONEYBIRD_API_TOKEN.");
    if (res.status === 429) {
      const wait = res.headers.get("Retry-After") || "?";
      throw new Error(`Moneybird: te veel verzoeken (429), probeer het over ${wait} seconden opnieuw.`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Moneybird ${path}: ${res.status} ${body.slice(0, 300)}`);
    }
    logBronGebeurtenis("moneybird", true).catch(() => {});
    return await res.json();
  } catch (e) {
    logBronGebeurtenis("moneybird", false, (e as Error).message?.slice(0, 400) || "Onbekende fout.").catch(() => {});
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Verse controle voor het bronnen-gezondheidsscherm. */
export async function moneybirdHealthCheck(): Promise<{ ok: boolean; melding: string }> {
  if (!moneybirdConfigured()) return { ok: false, melding: "Niet ingesteld in deze omgeving." };
  try {
    await mbFetch("/ledger_accounts");
    return { ok: true, melding: "Werkt." };
  } catch (e) {
    return { ok: false, melding: (e as Error).message || "Onbekende fout." };
  }
}

// Alle pagina's van een lijst-endpoint ophalen (max 100 per pagina).
async function mbFetchAll(path: string, params: Record<string, string> = {}): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let page = 1; page <= 20; page++) {
    const batch = (await mbFetch(path, { ...params, page: String(page), per_page: "100" })) as unknown[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// ─── Cache in Postgres (zelfde patroon als ahrefs_cache) ───

async function ensureCache(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS moneybird_cache (
      kind       TEXT NOT NULL,
      k          TEXT NOT NULL,
      data       JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (kind, k)
    )`;
}
async function cacheGet<T>(kind: string, key: string, maxAgeMinutes: number): Promise<T | null> {
  await ensureSchema(); await ensureCache();
  const { rows } = await sql`SELECT data, fetched_at FROM moneybird_cache WHERE kind = ${kind} AND k = ${key} LIMIT 1`;
  if (!rows[0]) return null;
  const ageMs = Date.now() - new Date(rows[0].fetched_at as string).getTime();
  if (ageMs > maxAgeMinutes * 60000) return null;
  return rows[0].data as T;
}
async function cacheSet(kind: string, key: string, data: unknown): Promise<void> {
  await ensureSchema(); await ensureCache();
  await sql`
    INSERT INTO moneybird_cache (kind, k, data, fetched_at) VALUES (${kind}, ${key}, ${JSON.stringify(data)}, now())
    ON CONFLICT (kind, k) DO UPDATE SET data = ${JSON.stringify(data)}, fetched_at = now()`;
}

// ─── Openstaande verkoopfacturen ───

export type OpenInvoice = {
  id: string;            // lange Moneybird-id (voor deeplink)
  invoiceId: string;     // zichtbaar factuurnummer, bijv. "2026-0012"
  contactId: string | null;
  contactName: string;
  contactEmail: string | null;
  date: string;          // verzenddatum (YYYY-MM-DD)
  dueDate: string | null;
  state: string;         // open | late | reminded
  totalUnpaid: number;   // openstaand bedrag incl. btw
  daysOpen: number;      // dagen sinds verzenddatum
  url: string;           // deeplink naar de factuur in Moneybird
};

type RawInvoice = {
  id: string | number;
  invoice_id?: string | null;
  state?: string;
  invoice_date?: string | null;
  date?: string | null;
  due_date?: string | null;
  total_unpaid?: string | number | null;
  contact_id?: string | number | null;
  contact?: { id?: string | number; company_name?: string | null; firstname?: string | null; lastname?: string | null; email?: string | null; send_invoices_to_email?: string | null } | null;
};

function contactDisplayName(c: RawInvoice["contact"]): string {
  if (!c) return "Onbekende klant";
  const company = (c.company_name || "").trim();
  if (company) return company;
  const person = [c.firstname, c.lastname].filter(Boolean).join(" ").trim();
  return person || "Onbekende klant";
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// Alle openstaande verkoopfacturen (open, te laat of herinnerd), genormaliseerd.
// Cache: 1 uur. daysOpen wordt bij het teruggeven berekend zodat het aantal
// dagen klopt, ook als de rest uit de cache komt.
export async function getOpenInvoices(): Promise<OpenInvoice[]> {
  type Cached = Omit<OpenInvoice, "daysOpen">[];
  let list = await cacheGet<Cached>("open_invoices", "all_v2", 60);
  if (!list) {
    const raw = (await mbFetchAll("/sales_invoices.json", { filter: "state:open|late|reminded" })) as RawInvoice[];
    list = raw.map((r) => ({
      id: String(r.id),
      invoiceId: String(r.invoice_id || r.id),
      contactId: r.contact?.id != null ? String(r.contact.id) : r.contact_id != null ? String(r.contact_id) : null,
      contactName: contactDisplayName(r.contact),
      contactEmail: r.contact?.send_invoices_to_email || r.contact?.email || null,
      // Verkoopfacturen hebben de verzenddatum in invoice_date (niet date).
      date: String(r.invoice_date || r.date || ""),
      dueDate: r.due_date ? String(r.due_date) : null,
      state: String(r.state || "open"),
      totalUnpaid: Number(r.total_unpaid || 0),
      url: mbInvoiceUrl(String(r.id)),
    }));
    await cacheSet("open_invoices", "all_v2", list);
  }
  return list.map((i) => ({ ...i, daysOpen: daysSince(i.date) }));
}

// ─── Grootboekrekeningen (kostenposten/omzetposten) ───

export type LedgerAccount = {
  id: string;
  name: string;
  accountType: string; // revenue | direct_costs | expenses | other_income_expenses | ...
  parentId: string | null;
};

// Alle grootboekrekeningen (voor de namen van de posten). Cache: 7 dagen.
export async function getLedgerAccounts(): Promise<LedgerAccount[]> {
  const cached = await cacheGet<LedgerAccount[]>("ledger_accounts", "all", 7 * 24 * 60);
  if (cached) return cached;
  const raw = (await mbFetchAll("/ledger_accounts.json")) as { id: string | number; name?: string; account_type?: string; parent_id?: string | number | null }[];
  const list = raw.map((r) => ({
    id: String(r.id),
    name: String(r.name || "Onbekende post"),
    accountType: String(r.account_type || ""),
    parentId: r.parent_id != null ? String(r.parent_id) : null,
  }));
  await cacheSet("ledger_accounts", "all", list);
  return list;
}

// ─── Winst & verlies (rapporten-API) ───

export type LedgerAmount = { ledgerAccountId: string; value: number };
export type ProfitLoss = {
  period: string;
  totalRevenue: number;
  totalExpenses: number;      // directe kosten + bedrijfskosten samen
  netProfit: number;
  revenueByLedger: LedgerAmount[];
  costsByLedger: LedgerAmount[]; // directe kosten + bedrijfskosten + overig, samengevoegd
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function ledgerList(v: unknown): LedgerAmount[] {
  // Moneybird nest de uitsplitsing onder { ledger_accounts: [...] }.
  const arr = Array.isArray(v) ? v : (v as { ledger_accounts?: unknown[] } | null)?.ledger_accounts;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => {
      const row = r as Record<string, unknown>;
      return { ledgerAccountId: String(row.ledger_account_id ?? ""), value: toNum(row.value ?? row.amount) };
    })
    .filter((r) => r.ledgerAccountId && r.value !== 0);
}

// Winst & verlies voor een periode (bijv. "this_year", "202601..202612" of
// "202607" voor één maand). Cache: 6 uur per periode. Het rapport telt zelf
// alles op; wij hoeven alleen te normaliseren.
export async function getProfitLoss(period: string): Promise<ProfitLoss> {
  const cached = await cacheGet<ProfitLoss>("profit_loss_v2", period, 6 * 60);
  if (cached) return cached;
  const raw = (await mbFetch("/reports/profit_loss", { period })) as Record<string, unknown>;

  // Live geverifieerd (2026-07): total_expenses bevat ALLE kosten (directe
  // kosten + bedrijfskosten), en total_revenue - total_expenses = net_profit.
  const revenue = toNum(raw.total_revenue);
  const expenses = toNum(raw.total_expenses);
  const net = raw.net_profit !== undefined ? toNum(raw.net_profit) : revenue - expenses;

  const result: ProfitLoss = {
    period,
    totalRevenue: revenue,
    totalExpenses: expenses,
    netProfit: net,
    revenueByLedger: ledgerList(raw.revenue_by_ledger_account),
    costsByLedger: [
      ...ledgerList(raw.direct_costs_by_ledger_account),
      ...ledgerList(raw.expenses_by_ledger_account),
      ...ledgerList(raw.other_income_expenses_by_ledger_account),
    ],
  };
  await cacheSet("profit_loss_v2", period, result);
  return result;
}

// Ruwe rapport-respons (alleen voor eigenaar-debug: veldnamen live controleren).
export async function getProfitLossRaw(period: string): Promise<unknown> {
  return mbFetch("/reports/profit_loss", { period });
}

// ─── Drill-down: facturen achter een grootboekpost ───

export type PostInvoice = {
  id: string;
  label: string;       // factuurnummer of omschrijving/referentie
  date: string;
  state: string;
  amount: number;      // aandeel van deze factuur in de gekozen post (excl. btw)
  url: string;
};
export type PostContact = {
  contactId: string | null;
  contactName: string;
  total: number;
  invoices: PostInvoice[];
};

type RawDetailRow = {
  ledger_account_id?: string | number | null;
  price?: string | number | null;
  amount?: string | null;
  total_price_excl_tax_with_discount?: string | number | null;
  total_price_excl_tax_with_discount_base?: string | number | null;
};
type RawDocument = RawInvoice & {
  reference?: string | null;
  details?: RawDetailRow[] | null;
};

function rowAmount(d: RawDetailRow): number {
  const v = d.total_price_excl_tax_with_discount ?? d.total_price_excl_tax_with_discount_base ?? d.price;
  return Number(v || 0) || 0;
}

function docUrl(kind: "sales" | "purchase", id: string): string {
  return kind === "sales"
    ? `https://moneybird.com/${administrationId()}/sales_invoices/${id}`
    : `https://moneybird.com/${administrationId()}/documents/${id}`;
}

// Alle facturen (verkoop of inkoop+bonnetjes) die in een periode op één
// grootboekpost boeken, gegroepeerd per klant/leverancier. Cache: 6 uur.
// Kleine afwijkingen t.o.v. het rapport zijn mogelijk (memoriaal-/bankboekingen
// lopen buiten facturen om); dit is bedoeld om te zien WAAR een post uit bestaat.
export async function getPostDetails(type: "revenue" | "cost", ledgerId: string, period: string): Promise<PostContact[]> {
  // Het facturenfilter eist een bereik met begin en eind; één maand wordt "maand..maand".
  if (/^\d{6}$/.test(period)) period = `${period}..${period}`;
  const key = `${type}:${ledgerId}:${period}`;
  const cached = await cacheGet<PostContact[]>("post_detail", key, 6 * 60);
  if (cached) return cached;

  let docs: { doc: RawDocument; kind: "sales" | "purchase" }[] = [];
  if (type === "revenue") {
    const raw = (await mbFetchAll("/sales_invoices.json", { filter: `period:${period}` })) as RawDocument[];
    docs = raw.map((doc) => ({ doc, kind: "sales" as const }));
  } else {
    // Inkoopfacturen en bonnetjes ondersteunen een direct filter op de post.
    const [pi, rc] = await Promise.all([
      mbFetchAll("/documents/purchase_invoices.json", { filter: `period:${period},ledger_account_id:${ledgerId}` }),
      mbFetchAll("/documents/receipts.json", { filter: `period:${period},ledger_account_id:${ledgerId}` }),
    ]);
    docs = [...(pi as RawDocument[]), ...(rc as RawDocument[])].map((doc) => ({ doc, kind: "purchase" as const }));
  }

  const byContact = new Map<string, PostContact>();
  for (const { doc, kind } of docs) {
    const share = (doc.details || [])
      .filter((d) => String(d.ledger_account_id ?? "") === ledgerId)
      .reduce((s, d) => s + rowAmount(d), 0);
    if (Math.abs(share) < 0.005) continue; // deze factuur boekt niet op deze post
    const cid = doc.contact?.id != null ? String(doc.contact.id) : doc.contact_id != null ? String(doc.contact_id) : "";
    const name = contactDisplayName(doc.contact);
    const entry = byContact.get(cid || name) || { contactId: cid || null, contactName: name, total: 0, invoices: [] };
    entry.total += share;
    entry.invoices.push({
      id: String(doc.id),
      label: String(doc.invoice_id || doc.reference || "factuur"),
      date: String(doc.invoice_date || doc.date || ""),
      state: String(doc.state || ""),
      amount: share,
      url: docUrl(kind, String(doc.id)),
    });
    byContact.set(cid || name, entry);
  }

  const list = [...byContact.values()]
    .map((c) => ({ ...c, invoices: c.invoices.sort((a, b) => (b.date || "").localeCompare(a.date || "")) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  await cacheSet("post_detail", key, list);
  return list;
}

// ─── Kosten per leverancier (voor abonnement-herkenning) ───

export type ContactAmount = { contactId: string; contactName: string; value: number };

function contactAmountList(raw: unknown): ContactAmount[] {
  // Verwachte vorm: { contacts: [{ contact_id, value, ... }] }, maar we zoeken
  // defensief naar de eerste array met contact_id/value erin.
  const root = raw as Record<string, unknown>;
  let arr: unknown[] | null = Array.isArray(raw) ? (raw as unknown[]) : null;
  if (!arr && root && typeof root === "object") {
    for (const v of Object.values(root)) {
      if (Array.isArray(v)) { arr = v; break; }
      if (v && typeof v === "object") {
        const inner = Object.values(v as Record<string, unknown>).find((x) => Array.isArray(x));
        if (inner) { arr = inner as unknown[]; break; }
      }
    }
  }
  if (!arr) return [];
  return arr
    .map((r) => {
      const row = r as Record<string, unknown>;
      const contact = row.contact as Record<string, unknown> | undefined;
      return {
        contactId: String(row.contact_id ?? contact?.id ?? ""),
        contactName: String(row.contact_name ?? contact?.company_name ?? contact?.name ?? ""),
        value: toNum(row.value ?? row.amount),
      };
    })
    .filter((r) => r.contactId && r.value !== 0);
}

// Kosten per leverancier in één maand (rapport). Cache: 24 uur per maand.
export async function getExpensesByContact(month: string): Promise<ContactAmount[]> {
  const cached = await cacheGet<ContactAmount[]>("expenses_by_contact", month, 24 * 60);
  if (cached) return cached;
  const raw = await mbFetch("/reports/expenses_by_contact", { period: month });
  const list = contactAmountList(raw);
  await cacheSet("expenses_by_contact", month, list);
  return list;
}

export async function getExpensesByContactRaw(month: string): Promise<unknown> {
  return mbFetch("/reports/expenses_by_contact", { period: month });
}

// ─── Contacten (voor het koppelen aan dashboard-klanten) ───

export type MbContact = {
  id: string;
  name: string;
  email: string | null;
  url: string; // deeplink naar het contact in Moneybird
};

type RawContact = {
  id: string | number;
  company_name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  email?: string | null;
  send_invoices_to_email?: string | null;
};

// Alle Moneybird-contacten, genormaliseerd. Cache: 24 uur.
export async function getMbContacts(): Promise<MbContact[]> {
  const cached = await cacheGet<MbContact[]>("contacts", "all", 24 * 60);
  if (cached) return cached;
  const raw = (await mbFetchAll("/contacts.json")) as RawContact[];
  const list = raw.map((r) => ({
    id: String(r.id),
    name: contactDisplayName(r),
    email: r.send_invoices_to_email || r.email || null,
    url: mbContactUrl(String(r.id)),
  }));
  await cacheSet("contacts", "all", list);
  return list;
}
