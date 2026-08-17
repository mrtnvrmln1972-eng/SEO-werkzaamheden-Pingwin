import { waitUntil } from "@vercel/functions";
import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { urlKey } from "./url-key";

// ═══════════════════════════════════════════════════════════
// SINDS WANNEER STAAT EEN FASE ZO?
// ═══════════════════════════════════════════════════════════
// Het dashboard weet wél hoe ver een pagina is (zeven fases), maar niet hoe lang
// hij daar al staat. Juist dat is wat je wilt weten: "copy is af" zegt weinig,
// "staat al elf dagen te wachten op de dev" zegt alles.
//
// De fase-stand wordt grotendeels afgeleid (staat de copy live, is er schema),
// dus er is geen moment waarop iemand "klaar" aanklikt dat we kunnen bewaren.
// Daarom leggen we het vast bij het uitlezen: telkens als het bord de standen
// ophaalt, vergelijken we ze met wat we de vorige keer zagen. Verandert er iets,
// dan zetten we de datum op vandaag.
//
// Gevolg: dit begint pas te tellen vanaf nu. Voor wat er al af was, weten we de
// datum niet; die pagina's krijgen hun eerste stempel bij de eerste uitlezing.
// Dat is eerlijker dan een datum verzinnen.

export const FASE_SLEUTELS = ["strategie", "gelieerde", "analyse", "blauwdruk", "copy", "bouw", "structured"] as const;
export type FaseSleutel = (typeof FASE_SLEUTELS)[number];

// Hooguit één keer per database opbouwen, niet bij elke koude server. Zie
// lib/schema-stand.ts; bewaakt door proeven/schema-versie.proef.ts.
export const FASE_HISTORIE_SCHEMA_VERSIE = "fase-historie-1bdff2e7";
function ensureTabel(): Promise<void> {
  return eenmalig("fase-historie", FASE_HISTORIE_SCHEMA_VERSIE, doeHet);
}
async function doeHet(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_phase_history (
      client_slug TEXT NOT NULL,
      url_key     TEXT NOT NULL,
      fase        TEXT NOT NULL,
      af          BOOLEAN NOT NULL,
      sinds       TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url_key, fase)
    )`;
}

export type FaseSinds = Record<string, Partial<Record<FaseSleutel, string>>>;

/**
 * Vergelijkt de huidige fase-standen met wat we eerder zagen en werkt de datums
 * bij. Geeft per pagina per fase terug sinds wanneer die stand geldt.
 *
 * Faalt dit (tabel nog niet aangemaakt, database traag), dan geeft het een lege
 * lijst terug: het bord werkt gewoon, alleen zonder "al X dagen".
 */
export async function registreerFases(
  slug: string,
  pages: Record<string, Partial<Record<FaseSleutel, boolean>>>,
): Promise<FaseSinds> {
  const uit: FaseSinds = {};
  try {
    await ensureSchema();
    await ensureTabel();
    const { rows } = await sql`SELECT url_key, fase, af, sinds FROM page_phase_history WHERE client_slug = ${slug}`;
    const bekend = new Map<string, { af: boolean; sinds: string }>();
    for (const r of rows) {
      bekend.set(`${r.url_key}|${r.fase}`, { af: !!r.af, sinds: new Date(r.sinds as string).toISOString() });
    }

    const schrijf: Promise<unknown>[] = [];
    for (const [k, standen] of Object.entries(pages)) {
      uit[k] = {};
      for (const f of FASE_SLEUTELS) {
        const af = !!standen[f];
        const eerder = bekend.get(`${k}|${f}`);
        if (eerder && eerder.af === af) { uit[k]![f] = eerder.sinds; continue; }
        // Nieuw of omgeslagen: vanaf nu.
        uit[k]![f] = new Date().toISOString();
        schrijf.push(sql`
          INSERT INTO page_phase_history (client_slug, url_key, fase, af, sinds)
          VALUES (${slug}, ${k}, ${f}, ${af}, now())
          ON CONFLICT (client_slug, url_key, fase) DO UPDATE SET af = EXCLUDED.af, sinds = now()`);
      }
    }
    // Het antwoord hangt NIET op deze schrijfacties: de datums die we
    // teruggeven zijn hierboven al bepaald. Ze afwachten liet het bord dus
    // wachten op werk dat niemand ziet, elke keer opnieuw. `waitUntil` houdt de
    // server in leven tot ze klaar zijn, maar stuurt het antwoord meteen.
    if (schrijf.length) {
      const alles = Promise.all(schrijf).then(() => {}, () => {});
      try { waitUntil(alles); } catch { await alles; } // buiten Vercel: gewoon afwachten
    }
  } catch {
    return {};
  }
  return uit;
}

/** Hoeveel hele dagen geleden is dit? Leeg of ongeldig = null. */
export function dagenSinds(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 864e5));
}

export { urlKey };
