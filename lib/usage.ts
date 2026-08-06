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
  "claude-haiku-4-5": { in: 1, out: 5 },
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

export type UsageClientActionRow = { client_slug: string | null; action: string | null; calls: number; tokens_in: number; tokens_out: number; cost_usd: number };

// Optelling per KLANT + ACTIE: waar is het bedrag van één klant uit opgebouwd.
// Voor de uitklapregels in het "Per klant"-blok. Alleen Claude/anthropic.
export async function getUsageByClientAction(fromIso: string): Promise<UsageClientActionRow[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT
      u.client_slug,
      u.action,
      COUNT(*)::int AS calls,
      COALESCE(SUM(u.tokens_in), 0)::int AS tokens_in,
      COALESCE(SUM(u.tokens_out), 0)::int AS tokens_out,
      COALESCE(SUM(u.cost_usd), 0)::float AS cost_usd
    FROM service_usage u
    WHERE u.created_at >= ${fromIso} AND u.service = 'anthropic'
    GROUP BY u.client_slug, u.action
    ORDER BY cost_usd DESC`;
  return rows as UsageClientActionRow[];
}

// ── Ahrefs-units die DIT DASHBOARD verbruikte ──
// De teller in de kopbalk zet twee dingen naast elkaar: wat het hele Ahrefs-account
// deze abonnementsmaand op heeft (dat komt bij Ahrefs vandaan) en wat het dashboard
// daar zelf van gebruikte. Zonder die tweede helft weet je bij een oplopende teller
// niet of het dashboard de oorzaak is of iemand die in Ahrefs zelf zit te werken.
//
// Elke echte Ahrefs-aanroep schrijft één regel weg (units in tokens_in); cache-hits
// niet, dus dit is het echte verbruik en niet het aantal vragen dat gesteld is.
export type AhrefsEigenVerbruik = { units: number; calls: number; topKlant: { slug: string | null; units: number } | null };

export async function getAhrefsEigenVerbruik(fromIso: string): Promise<AhrefsEigenVerbruik> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT
      u.client_slug,
      COUNT(*)::int AS calls,
      COALESCE(SUM(u.tokens_in), 0)::int AS units
    FROM service_usage u
    WHERE u.created_at >= ${fromIso} AND u.service = 'ahrefs'
    GROUP BY u.client_slug
    ORDER BY units DESC`;
  const lijst = rows as { client_slug: string | null; calls: number; units: number }[];
  return {
    units: lijst.reduce((s, r) => s + (r.units || 0), 0),
    calls: lijst.reduce((s, r) => s + (r.calls || 0), 0),
    topKlant: lijst[0] ? { slug: lijst[0].client_slug, units: lijst[0].units } : null,
  };
}

// ── Claude-kosten over een periode ──
// Voedt de Claude-teller in de kopbalk. Eén vraag levert het totaal én waar het
// grootste deel vandaan komt: zonder die tweede helft is een oplopend bedrag geen
// signaal maar een raadsel, en kun je er dus niets mee.
export type ClaudeKosten = {
  usd: number;
  calls: number;
  topActie: { action: string | null; usd: number } | null;
  topKlant: { slug: string | null; usd: number } | null;
};

export async function getClaudeKosten(fromIso: string, totIso?: string | null): Promise<ClaudeKosten> {
  await ensureSchema();
  // Twee varianten in plaats van één query met een optionele grens: de
  // sql-sjabloon van @vercel/postgres laat zich niet halverwege aanvullen.
  const { rows } = totIso
    ? await sql`
        SELECT u.action, u.client_slug, COUNT(*)::int AS calls, COALESCE(SUM(u.cost_usd), 0)::float AS cost_usd
        FROM service_usage u
        WHERE u.service = 'anthropic' AND u.created_at >= ${fromIso} AND u.created_at < ${totIso}
        GROUP BY u.action, u.client_slug`
    : await sql`
        SELECT u.action, u.client_slug, COUNT(*)::int AS calls, COALESCE(SUM(u.cost_usd), 0)::float AS cost_usd
        FROM service_usage u
        WHERE u.service = 'anthropic' AND u.created_at >= ${fromIso}
        GROUP BY u.action, u.client_slug`;

  const lijst = rows as { action: string | null; client_slug: string | null; calls: number; cost_usd: number }[];
  const optellen = (sleutel: (r: (typeof lijst)[number]) => string | null) => {
    const per = new Map<string | null, number>();
    for (const r of lijst) per.set(sleutel(r), (per.get(sleutel(r)) || 0) + (r.cost_usd || 0));
    const beste = [...per.entries()].sort((a, b) => b[1] - a[1])[0];
    return beste ? { naam: beste[0], usd: beste[1] } : null;
  };
  const actie = optellen((r) => r.action);
  const klant = optellen((r) => r.client_slug);

  return {
    usd: lijst.reduce((s, r) => s + (r.cost_usd || 0), 0),
    calls: lijst.reduce((s, r) => s + (r.calls || 0), 0),
    topActie: actie ? { action: actie.naam, usd: actie.usd } : null,
    // Werk zonder klant (onderhoud, ontwikkeling) is geen "duurste klant".
    topKlant: klant && klant.naam ? { slug: klant.naam, usd: klant.usd } : null,
  };
}

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
