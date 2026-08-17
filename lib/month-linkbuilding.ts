import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// BUDGET-OVERRIDE PER MAAND (maandbudget + linkbuilding)
// ═══════════════════════════════════════════════════════════
// Het maandbudget (totaal) en het linkbuilding-deel zijn normaal elke maand
// gelijk aan de klantstandaard, maar kunnen per maand afwijken. Die afwijkingen
// bewaren we hier per maand. De beschikbare uren van een maand volgen daaruit:
// (maandbudget − linkbuilding) / uurtarief. Zo raakt het aanpassen van één maand
// nooit de andere maanden. De maand is een kleine-letter maandnaam
// ("januari" ... "december"), gelijk aan het maand-veld van de taken.
// (Tabelnaam is historisch client_month_linkbuilding.)
// ═══════════════════════════════════════════════════════════

export type MonthOverride = { maandbudget: number | null; linkbuilding: number | null };

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "month-linkbuilding-8d8b95ca";

async function ensureTable(): Promise<void> {
  return eenmalig("month-linkbuilding", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_month_linkbuilding (
      client_slug  TEXT NOT NULL,
      month        TEXT NOT NULL,
      linkbuilding INTEGER,
      maandbudget  INTEGER,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, month)
    )`;
  // Bestaande tabellen: linkbuilding mag nu leeg zijn (alleen maandbudget zetten kan)
  // en de maandbudget-kolom erbij.
  await sql`ALTER TABLE client_month_linkbuilding ALTER COLUMN linkbuilding DROP NOT NULL`.catch(() => null);
  await sql`ALTER TABLE client_month_linkbuilding ADD COLUMN IF NOT EXISTS maandbudget INTEGER`;
}

const clamp = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : Math.max(0, Math.round(Number(v) || 0));

export async function getMonthBudget(slug: string): Promise<Record<string, MonthOverride>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT month, maandbudget, linkbuilding FROM client_month_linkbuilding WHERE client_slug = ${slug}`;
  const out: Record<string, MonthOverride> = {};
  for (const r of rows) {
    out[(r.month as string).toLowerCase()] = {
      maandbudget: r.maandbudget == null ? null : Number(r.maandbudget),
      linkbuilding: r.linkbuilding == null ? null : Number(r.linkbuilding),
    };
  }
  return out;
}

// Werkt alleen de meegegeven velden bij (de rest van die maand blijft staan).
export async function setMonthBudget(slug: string, month: string, fields: Partial<MonthOverride>): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const m = (month || "").trim().toLowerCase();
  if (!m) return;
  const { rows } = await sql`SELECT maandbudget, linkbuilding FROM client_month_linkbuilding WHERE client_slug = ${slug} AND month = ${m} LIMIT 1`;
  const cur = rows[0] || {};
  const mb = "maandbudget" in fields ? clamp(fields.maandbudget) : (cur.maandbudget == null ? null : Number(cur.maandbudget));
  const lb = "linkbuilding" in fields ? clamp(fields.linkbuilding) : (cur.linkbuilding == null ? null : Number(cur.linkbuilding));
  await sql`
    INSERT INTO client_month_linkbuilding (client_slug, month, maandbudget, linkbuilding, updated_at)
    VALUES (${slug}, ${m}, ${mb}, ${lb}, now())
    ON CONFLICT (client_slug, month) DO UPDATE SET maandbudget = ${mb}, linkbuilding = ${lb}, updated_at = now()`;
}
