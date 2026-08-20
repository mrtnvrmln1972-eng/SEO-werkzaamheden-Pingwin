import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { PHASE_KEYS, type PhaseKey } from "./phase-marks";

// ═══════════════════════════════════════════════════════════
// WANNEER IS DEZE FASE VOOR HET LAATST GEDRAAID?
// ═══════════════════════════════════════════════════════════
// Een vinkje zegt dát een fase af is, niet wanneer. Bij /hovenier-oss/ stonden
// analyse, blauwdruk en copy alle drie op groen, terwijl die documenten van
// 2 augustus waren en de strategie op 20 augustus herzien was. Op het scherm was
// dat verschil niet te zien: zeven groene vinkjes, en niets dat vertelt dat er
// drie van vóór de bijstelling zijn. Maarten: "zodat je kunt zien waar je bent
// gebleven, of dat een oude of een nieuwe fase draaien is."
//
// Elke fase heeft zijn eigen spoor in de database, en dat is precies waarom dit
// hier bij elkaar staat in plaats van zeven keer los in een scherm:
//
//   strategie   page_plans.updated_at            (het moment van vastleggen)
//   gelieerde   page_cluster_advice.created_at   (het moment van doorgeven)
//   analyse     \
//   blauwdruk    > client_activiteit.gebeurde_op (het moment dat het document er kwam)
//   copy        /
//   bouw        client_activiteit, soort copy-live (het moment dat het live stond)
//   structured  client_activiteit, soort structured
//
// Daarnaast is er het handmatige vinkje (page_phase_marks.updated_at): zet je een
// fase zelf om, dan is dát het moment waarop hij af was. De nieuwste van de twee
// wint, want beide zijn een echt moment waarop er iets met die fase gebeurde.
// ═══════════════════════════════════════════════════════════

/** Per genormaliseerde URL: per fase de laatste datum (ISO), of niets. */
export type FaseDatums = Record<string, Partial<Record<PhaseKey, string>>>;

// Welke soort activiteit bij welke fase hoort. Eén plek; de soorten zelf staan
// in lib/activiteit.ts.
const SOORT_VOOR_FASE: Partial<Record<PhaseKey, string[]>> = {
  analyse: ["analyse"],
  blauwdruk: ["blauwdruk"],
  copy: ["copy"],
  // "Implementatie" is af als de copy echt op de pagina staat. Het concept telt
  // niet mee: dat is klaarzetten, niet doorvoeren.
  bouw: ["copy-live"],
  structured: ["structured"],
};

const iso = (v: unknown): string => {
  const d = new Date(String(v || ""));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

/** Zet een datum alleen als hij nieuwer is dan wat er al staat. */
function bewaarNieuwste(uit: FaseDatums, k: string, fase: PhaseKey, datum: string) {
  if (!k || !datum) return;
  const rij = (uit[k] ||= {});
  if (!rij[fase] || rij[fase]! < datum) rij[fase] = datum;
}

/**
 * De laatste datum per fase, voor alle pagina's van één klant.
 *
 * Vier queries voor zeven fases, parallel: de activiteit dekt er vijf, de
 * strategie en het doorgeven hebben elk hun eigen tabel, en het handmatige
 * vinkje kan overal overheen. Alles faalt zacht: geen datum is geen ramp, een
 * kapot scherm wel.
 */
export async function getFaseDatumsAll(slug: string): Promise<FaseDatums> {
  await ensureSchema();
  const uit: FaseDatums = {};

  const [activiteit, plannen, cluster, marks] = await Promise.all([
    sql`SELECT url, soort, MAX(gebeurde_op) AS wanneer
        FROM client_activiteit
        WHERE client_slug = ${slug} AND url IS NOT NULL
        GROUP BY url, soort`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url, updated_at FROM page_plans WHERE client_slug = ${slug}`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT source_url, MAX(created_at) AS wanneer
        FROM page_cluster_advice
        WHERE client_slug = ${slug} AND source_url IS NOT NULL AND source_url <> ''
        GROUP BY source_url`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
    sql`SELECT url_key, fase, updated_at FROM page_phase_marks WHERE client_slug = ${slug} AND done = true`
      .then((r) => r.rows).catch(() => [] as Record<string, unknown>[]),
  ]);

  // Van soort naar fase, één keer omgedraaid zodat de lus hieronder één opzoeking is.
  const faseVanSoort = new Map<string, PhaseKey>();
  for (const [fase, soorten] of Object.entries(SOORT_VOOR_FASE)) {
    for (const s of soorten || []) faseVanSoort.set(s, fase as PhaseKey);
  }

  for (const r of activiteit) {
    const fase = faseVanSoort.get(String(r.soort || ""));
    if (fase) bewaarNieuwste(uit, urlKey(String(r.url)), fase, iso(r.wanneer));
  }
  for (const r of plannen) bewaarNieuwste(uit, urlKey(String(r.url)), "strategie", iso(r.updated_at));
  for (const r of cluster) bewaarNieuwste(uit, urlKey(String(r.source_url)), "gelieerde", iso(r.wanneer));
  for (const r of marks) {
    const fase = String(r.fase) as PhaseKey;
    if ((PHASE_KEYS as readonly string[]).includes(fase)) {
      bewaarNieuwste(uit, String(r.url_key), fase, iso(r.updated_at));
    }
  }

  return uit;
}
