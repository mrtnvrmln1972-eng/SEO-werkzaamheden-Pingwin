import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// CONCURRENTEN PER KLANT (voor de gap-analyse in de kansen-zoektocht)
// ═══════════════════════════════════════════════════════════
// 2 tot 4 concurrent-domeinen per klant. Hun organische zoekwoorden geven de
// "gap": waar zij wel op scoren en de klant nog niet. Die kandidaten gaan daarna
// door de Claude-relevantiefilter. Multi-tenant per client_slug.
// ═══════════════════════════════════════════════════════════

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "competitors-55e463e2";

async function ensureTable(): Promise<void> {
  return eenmalig("competitors", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_competitors (
      client_slug TEXT NOT NULL,
      domain      TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, domain)
    )`;
}

const cleanDomain = (d: string) => (d || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase();

export async function getCompetitors(slug: string): Promise<string[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT domain FROM client_competitors WHERE client_slug = ${slug} ORDER BY domain ASC`;
  return rows.map((r) => r.domain as string);
}

// Vervangt de concurrentenlijst (max 4). Lege/ongeldige domeinen worden genegeerd.
export async function setCompetitors(slug: string, domains: string[]): Promise<string[]> {
  await ensureSchema();
  await ensureTable();
  const clean = [...new Set(domains.map(cleanDomain).filter((d) => d && d.includes(".")))].slice(0, 4);
  await sql`DELETE FROM client_competitors WHERE client_slug = ${slug}`;
  for (const d of clean) {
    await sql`INSERT INTO client_competitors (client_slug, domain, updated_at) VALUES (${slug}, ${d}, now()) ON CONFLICT (client_slug, domain) DO NOTHING`;
  }
  return clean;
}
