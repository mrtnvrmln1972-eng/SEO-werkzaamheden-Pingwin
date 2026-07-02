import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// LINKBUILDING-BUDGET PER MAAND (override op de klantstandaard)
// ═══════════════════════════════════════════════════════════
// Het maandbudget (totaal) en het uurtarief zijn vaste klantwaarden. Het
// linkbuilding-deel is normaal elke maand hetzelfde (de klantstandaard), maar
// kan per maand afwijken. Die afwijking bewaren we hier per maand. De
// beschikbare uren van een maand volgen daaruit: (maandbudget − linkbuilding) /
// uurtarief. Zo verandert het aanpassen van één maand nooit de andere maanden.
// De maand is een kleine-letter maandnaam ("januari" ... "december"), gelijk aan
// het maand-veld van de taken.
// ═══════════════════════════════════════════════════════════

let tableReady: Promise<void> | null = null;
async function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_month_linkbuilding (
      client_slug  TEXT NOT NULL,
      month        TEXT NOT NULL,
      linkbuilding INTEGER NOT NULL,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, month)
    )`;
}

export async function getMonthLinkbuilding(slug: string): Promise<Record<string, number>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT month, linkbuilding FROM client_month_linkbuilding WHERE client_slug = ${slug}`;
  const out: Record<string, number> = {};
  for (const r of rows) out[(r.month as string).toLowerCase()] = Number(r.linkbuilding) || 0;
  return out;
}

export async function setMonthLinkbuilding(slug: string, month: string, linkbuilding: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const m = (month || "").trim().toLowerCase();
  if (!m) return;
  await sql`
    INSERT INTO client_month_linkbuilding (client_slug, month, linkbuilding, updated_at)
    VALUES (${slug}, ${m}, ${Math.max(0, Math.round(linkbuilding) || 0)}, now())
    ON CONFLICT (client_slug, month) DO UPDATE SET linkbuilding = ${Math.max(0, Math.round(linkbuilding) || 0)}, updated_at = now()`;
}
