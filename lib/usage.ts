// Verbruik-meting: wat kost het aan externe diensten, per klant en per periode.
// Elke betaalde aanroep schrijft één regel weg in service_usage (zie lib/db.ts).
// Vandaag meten we het Claude-verbruik (tokens uit het API-antwoord). Ahrefs en
// de aanbieder-totalen komen later; die staan hieronder al benoemd.

import { sql, ensureSchema } from "./db";

// ── Tokenprijzen (USD per 1 miljoen tokens) ──
// SCHATTING, makkelijk aan te passen als de prijs wijzigt. tokens_in en tokens_out
// worden ruw opgeslagen; cost_usd is afgeleid, dus een prijswijziging raakt alleen
// nieuwe regels. Prijs onbekend model -> valt terug op DEFAULT_PRICE.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
};
const DEFAULT_PRICE = { in: 3, out: 15 };

// Cache-tarieven: een cache-read kost 10% van de normale inputprijs, een
// cache-write 125% (eenmalige toeslag). Zo klopt het bedrag ook met caching aan.
export function estimateCostUsd(model: string | undefined, tokensIn: number, tokensOut: number, cacheRead = 0, cacheWrite = 0): number {
  const p = (model && PRICES[model]) || DEFAULT_PRICE;
  return (tokensIn / 1_000_000) * p.in
    + (cacheRead / 1_000_000) * p.in * 0.1
    + (cacheWrite / 1_000_000) * p.in * 1.25
    + (tokensOut / 1_000_000) * p.out;
}

export type UsageEntry = {
  slug?: string | null;
  service: string; // 'anthropic' | 'ahrefs' | 'google'
  action?: string | null;
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  cacheRead?: number;  // tokens uit de prompt-cache gelezen (10% tarief)
  cacheWrite?: number; // tokens naar de prompt-cache geschreven (125% tarief)
};

// Schrijft één verbruik-regel. Mag NOOIT de aanroeper laten crashen: als de
// meting faalt, gaat de chat/analyse gewoon door. Daarom alles in try/catch.
export async function logUsage(e: UsageEntry): Promise<void> {
  try {
    const tokensIn = e.tokensIn || 0;
    const tokensOut = e.tokensOut || 0;
    const cacheRead = e.cacheRead || 0;
    const cacheWrite = e.cacheWrite || 0;
    // Alleen Claude heeft een tokenprijs. Bij andere diensten (ahrefs: units in
    // tokens_in) zou de standaardprijs een onzin-bedrag opleveren; dus 0.
    const cost = e.service === "anthropic" ? estimateCostUsd(e.model || undefined, tokensIn, tokensOut, cacheRead, cacheWrite) : 0;
    await ensureSchema();
    // tokens_in blijft het totale input-beeld (vers + cache), zodat het overzicht
    // dezelfde aantallen toont; de korting zit in cost_usd.
    await sql`
      INSERT INTO service_usage (client_slug, service, action, model, tokens_in, tokens_out, cost_usd)
      VALUES (${e.slug ?? null}, ${e.service}, ${e.action ?? null}, ${e.model ?? null}, ${tokensIn + cacheRead + cacheWrite}, ${tokensOut}, ${cost})`;
  } catch (err) {
    // Bewust stil: meting mag de echte taak niet breken.
    console.error("[usage] loggen mislukt:", (err as Error).message);
  }
}

export type UsageRow = {
  client_slug: string | null;
  client_name: string | null;
  service: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
};

// Optelling per klant + dienst vanaf een startdatum (ISO). Voor het site-brede
// verbruik-overzicht. Klantnaam erbij via een losse join op clients.
export async function getUsageSummary(fromIso: string): Promise<UsageRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT
      u.client_slug,
      c.name AS client_name,
      u.service,
      COUNT(*)::int AS calls,
      COALESCE(SUM(u.tokens_in), 0)::int AS tokens_in,
      COALESCE(SUM(u.tokens_out), 0)::int AS tokens_out,
      COALESCE(SUM(u.cost_usd), 0)::float AS cost_usd
    FROM service_usage u
    LEFT JOIN clients c ON c.slug = u.client_slug
    WHERE u.created_at >= ${fromIso}
    GROUP BY u.client_slug, c.name, u.service
    ORDER BY cost_usd DESC`;
  return rows as UsageRow[];
}

export type UsageActionRow = { action: string | null; calls: number; tokens_in: number; tokens_out: number; cost_usd: number };

// Optelling per ACTIE (welke knop/functie kost hoeveel), voor de uitsplitsing. Alleen
// Claude/anthropic; de actie zegt namelijk welke AI-taak het was.
export async function getUsageByAction(fromIso: string): Promise<UsageActionRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT
      u.action,
      COUNT(*)::int AS calls,
      COALESCE(SUM(u.tokens_in), 0)::int AS tokens_in,
      COALESCE(SUM(u.tokens_out), 0)::int AS tokens_out,
      COALESCE(SUM(u.cost_usd), 0)::float AS cost_usd
    FROM service_usage u
    WHERE u.created_at >= ${fromIso} AND u.service = 'anthropic'
    GROUP BY u.action
    ORDER BY cost_usd DESC`;
  return rows as UsageActionRow[];
}
