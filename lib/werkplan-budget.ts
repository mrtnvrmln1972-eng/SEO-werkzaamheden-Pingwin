import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// UREN-BUDGET PER WEEK (werkplanning-proef)
// ═══════════════════════════════════════════════════════════
// Zelfde patroon als lib/opruim-euro.ts: een instelling per klant, opgeslagen
// als JSON onder één sleutel. Bepaalt hoeveel taken er per week in passen bij
// het uitrekenen van de weekprojectie.

export type WerkplanBudget = { urenPerWeek: number; ingevuld: boolean };

const sleutel = (slug: string) => `werkplan_budget:${slug}`;

export async function getWerkplanBudget(slug: string): Promise<WerkplanBudget> {
  const ruw = await getSetting(sleutel(slug)).catch(() => null);
  if (!ruw) return { urenPerWeek: 3, ingevuld: false };
  try {
    const d = JSON.parse(ruw) as { urenPerWeek?: unknown };
    const urenPerWeek = Number(d.urenPerWeek) || 3;
    return { urenPerWeek, ingevuld: true };
  } catch { return { urenPerWeek: 3, ingevuld: false }; }
}

export async function zetWerkplanBudget(slug: string, urenPerWeek: number): Promise<WerkplanBudget> {
  // Grenzen tegen een typefout: 0 uur plant nooit iets, 80 uur is geen week meer.
  const u = Math.min(80, Math.max(0.5, Number(urenPerWeek) || 3));
  await setSetting(sleutel(slug), JSON.stringify({ urenPerWeek: u }));
  return { urenPerWeek: u, ingevuld: true };
}
