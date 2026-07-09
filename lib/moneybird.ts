import { sql, ensureSchema } from "./db";

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
  if (!token || !adm) throw new Error("MONEYBIRD_API_TOKEN of MONEYBIRD_ADMINISTRATION_ID ontbreekt.");
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
    return await res.json();
  } finally {
    clearTimeout(timer);
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
  let list = await cacheGet<Cached>("open_invoices", "all", 60);
  if (!list) {
    const raw = (await mbFetchAll("/sales_invoices.json", { filter: "state:open|late|reminded" })) as RawInvoice[];
    list = raw.map((r) => ({
      id: String(r.id),
      invoiceId: String(r.invoice_id || r.id),
      contactId: r.contact?.id != null ? String(r.contact.id) : r.contact_id != null ? String(r.contact_id) : null,
      contactName: contactDisplayName(r.contact),
      contactEmail: r.contact?.send_invoices_to_email || r.contact?.email || null,
      date: String(r.date || ""),
      dueDate: r.due_date ? String(r.due_date) : null,
      state: String(r.state || "open"),
      totalUnpaid: Number(r.total_unpaid || 0),
      url: mbInvoiceUrl(String(r.id)),
    }));
    await cacheSet("open_invoices", "all", list);
  }
  return list.map((i) => ({ ...i, daysOpen: daysSince(i.date) }));
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
