// Handmatige fase-vinkjes per pagina (projectkaart in de weekplanning).
// Een mark wint van de afgeleide stand, beide kanten op: afvinken en terugzetten.

import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";

export const PHASE_KEYS = ["strategie", "gelieerde", "analyse", "blauwdruk", "copy", "bouw", "structured"] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export async function getPhaseMarksAll(slug: string): Promise<Record<string, Partial<Record<PhaseKey, boolean>>>> {
  await ensureSchema();
  const { rows } = await sql`SELECT url_key, fase, done FROM page_phase_marks WHERE client_slug = ${slug}`;
  const out: Record<string, Partial<Record<PhaseKey, boolean>>> = {};
  for (const r of rows) {
    const k = String(r.url_key);
    (out[k] ||= {})[String(r.fase) as PhaseKey] = !!r.done;
  }
  return out;
}

export async function setPhaseMark(slug: string, url: string, fase: PhaseKey, done: boolean): Promise<void> {
  await ensureSchema();
  const k = urlKey(url);
  await sql`
    INSERT INTO page_phase_marks (client_slug, url_key, fase, done)
    VALUES (${slug}, ${k}, ${fase}, ${done})
    ON CONFLICT (client_slug, url_key, fase)
    DO UPDATE SET done = ${done}, updated_at = now()`;
}
