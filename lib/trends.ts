import { sql, ensureSchema } from "./db";

// KPI-trend per klant (gevuld door de nachtelijke cron): laat in de
// klanten-dropdown zien welke klanten een mooie ontwikkeling doormaken.

export type TrendFlags = { good28: boolean; good90: boolean };

export async function saveClientTrend(
  slug: string,
  period: "28d" | "90d",
  data: { clicksNow: number; clicksPrev: number; impressionsNow: number; impressionsPrev: number; isGood: boolean },
): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO client_trends (client_slug, period, clicks_now, clicks_prev, impressions_now, impressions_prev, is_good, computed_at)
    VALUES (${slug}, ${period}, ${data.clicksNow}, ${data.clicksPrev}, ${data.impressionsNow}, ${data.impressionsPrev}, ${data.isGood}, now())
    ON CONFLICT (client_slug, period) DO UPDATE SET
      clicks_now = EXCLUDED.clicks_now, clicks_prev = EXCLUDED.clicks_prev,
      impressions_now = EXCLUDED.impressions_now, impressions_prev = EXCLUDED.impressions_prev,
      is_good = EXCLUDED.is_good, computed_at = now()`;
}

export type ClientTrend = {
  clicksNow: number; clicksPrev: number;
  impressionsNow: number; impressionsPrev: number;
  isGood: boolean; computedAt: string;
};

// De ruwe cijfers van één klant, voor het klantdashboard (R9: "ontwikkeling
// deze maand"). Geeft null als er voor deze klant nog nooit gerekend is
// (nieuwe klant, of de nachtelijke cron is er nog niet aan toegekomen).
export async function getClientTrend(slug: string, period: "28d" | "90d"): Promise<ClientTrend | null> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT clicks_now, clicks_prev, impressions_now, impressions_prev, is_good, computed_at
    FROM client_trends WHERE client_slug = ${slug} AND period = ${period} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    clicksNow: Number(r.clicks_now), clicksPrev: Number(r.clicks_prev),
    impressionsNow: Number(r.impressions_now), impressionsPrev: Number(r.impressions_prev),
    isGood: !!r.is_good, computedAt: new Date(r.computed_at as string).toISOString(),
  };
}

// Per klant de vlaggen good28/good90 (alleen klanten die ooit berekend zijn).
export async function getTrendFlags(): Promise<Record<string, TrendFlags>> {
  await ensureSchema();
  const { rows } = await sql`SELECT client_slug, period, is_good FROM client_trends`;
  const out: Record<string, TrendFlags> = {};
  for (const r of rows) {
    const slug = r.client_slug as string;
    if (!out[slug]) out[slug] = { good28: false, good90: false };
    if (r.period === "28d") out[slug].good28 = !!r.is_good;
    if (r.period === "90d") out[slug].good90 = !!r.is_good;
  }
  return out;
}
