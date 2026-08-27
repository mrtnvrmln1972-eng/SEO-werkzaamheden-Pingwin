// ═══════════════════════════════════════════════════════════
// DE VOLGORDE VAN DE BLOKKEN: SORTEREN EN ZELF VOORAAN ZETTEN
// ═══════════════════════════════════════════════════════════
// Het plan rekent zelf een volgorde uit (fase, dan waarde), en die is verdedigbaar
// maar niet heilig. Maartens woorden: "ik wil ook alle clusters rondom de SOA-test
// Amsterdam, SOA-test Rotterdam, SOA-test Utrecht gewoon bovenaan hebben; die zijn
// het belangrijkst." Dat weet hij en de motor niet.
//
// Daarom twee dingen naast elkaar: een sorteerkeuze voor de hele lijst, en een
// eigen prioriteit per blok die daar altijd bovenop gaat. Een blok dat hij vooraan
// zet blijft vooraan, wat de sortering ook is.

import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import type { Werkcluster } from "./werkplan";

export type Sortering = "plan" | "waarde" | "tijd" | "naam";

export const SORTERING_LABEL: Record<Sortering, string> = {
  plan: "volgorde van het plan",
  waarde: "meeste zoekvolume eerst",
  tijd: "kortste klus eerst",
  naam: "op naam",
};

/**
 * De blokken op volgorde. Een eigen prioriteit gaat altijd voor: dat is de enige
 * manier waarop "deze zijn voor mij het belangrijkst" bestand is tegen een motor
 * die iets anders uitrekent.
 */
export function sorteerClusters(
  clusters: Werkcluster[],
  sortering: Sortering,
  prioriteiten: Record<string, number>,
): Werkcluster[] {
  const prio = (c: Werkcluster) => prioriteiten[c.naam] ?? 0;
  const lijst = [...clusters];
  lijst.sort((a, b) => {
    // Hoger getal = belangrijker = eerder. Nul is "geen eigen mening".
    if (prio(a) !== prio(b)) return prio(b) - prio(a);
    switch (sortering) {
      case "waarde": return b.volume - a.volume || a.naam.localeCompare(b.naam);
      case "tijd": return a.minuten - b.minuten || a.naam.localeCompare(b.naam);
      case "naam": return a.naam.localeCompare(b.naam);
      default: return a.nummer - b.nummer;
    }
  });
  return lijst;
}

const SCHEMA_VERSIE = "cluster_volgorde-b09a2038";

function ensureTable(): Promise<void> {
  return eenmalig("cluster_volgorde", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_cluster_volgorde (
      client_slug TEXT NOT NULL,
      cluster     TEXT NOT NULL,
      prioriteit  INTEGER NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, cluster)
    )`;
}

export async function getPrioriteiten(slug: string): Promise<Record<string, number>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT cluster, prioriteit FROM client_cluster_volgorde WHERE client_slug = ${slug}`;
  const uit: Record<string, number> = {};
  for (const r of rows) uit[r.cluster as string] = Number(r.prioriteit) || 0;
  return uit;
}

export async function zetPrioriteit(slug: string, cluster: string, prioriteit: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const p = Math.max(0, Math.min(9999, Math.round(prioriteit)));
  await sql`
    INSERT INTO client_cluster_volgorde (client_slug, cluster, prioriteit)
    VALUES (${slug}, ${cluster}, ${p})
    ON CONFLICT (client_slug, cluster) DO UPDATE SET prioriteit = ${p}, updated_at = now()`;
}

/** Het eerstvolgende vrije prioriteitsgetal, zodat "vooraan" ook echt vooraan is. */
export async function volgendeVoorrang(slug: string): Promise<number> {
  const huidig = await getPrioriteiten(slug);
  const hoogste = Math.max(0, ...Object.values(huidig));
  return hoogste + 1;
}
