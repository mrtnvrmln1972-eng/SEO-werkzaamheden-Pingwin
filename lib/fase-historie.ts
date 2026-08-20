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
  /**
   * De ECHTE datums uit de database (lib/fase-datum.ts), voor fases die al af
   * waren voordat deze tabel bestond.
   *
   * Zonder dit kreeg zo'n fase bij de eerste uitlezing de datum van vandaag, en
   * dat is precies het verkeerde antwoord: bij /hovenier-oss/ stonden analyse,
   * blauwdruk en copy van 2 augustus, en die zouden dan "vandaag" gaan heten,
   * terwijl de vraag juist is of je naar oud of nieuw werk kijkt. Een datum
   * verzinnen is erger dan er geen hebben; een datum die er écht is, is beter
   * dan allebei.
   */
  echteDatums: Partial<Record<string, Partial<Record<FaseSleutel, string>>>> = {},
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
        // ── Het echte moment wint altijd (20-08-2026) ──
        // Deze tabel is een terugval: hij onthoudt wannéér we een verandering
        // zágen, want voor de meeste fases is er geen knop waarop iemand "klaar"
        // drukt. Maar voor een afgeronde fase is er meestal wél een echt moment
        // in de database: het document dat gemaakt is, de strategie die is
        // vastgelegd, het advies dat is doorgegeven. Dat moment is de waarheid en
        // deze tabel de schatting, dus de waarheid gaat voor.
        //
        // Eerst gold dat alleen bij de allereerste stempel, en dat was te weinig:
        // rijen die al een (verkeerde) datum hadden bleven er precies zo bij
        // staan. Op /hovenier-oss/ stond bij strategie, analyse, blauwdruk en
        // copy alle vier "5 aug 16:32", terwijl de strategie die ochtend om 10:25
        // was vastgelegd en de documenten van 2 augustus waren. Nu corrigeert hij
        // zichzelf: klopt de opgeslagen datum niet met het echte moment, dan
        // wordt hij bijgetrokken.
        const echt = af ? (echteDatums[k]?.[f] || "") : "";
        if (echt) {
          uit[k]![f] = echt;
          if (!eerder || eerder.af !== af || eerder.sinds !== echt) {
            schrijf.push(sql`
              INSERT INTO page_phase_history (client_slug, url_key, fase, af, sinds)
              VALUES (${slug}, ${k}, ${f}, ${af}, ${echt})
              ON CONFLICT (client_slug, url_key, fase) DO UPDATE SET af = EXCLUDED.af, sinds = EXCLUDED.sinds`);
          }
          continue;
        }
        if (eerder && eerder.af === af) { uit[k]![f] = eerder.sinds; continue; }
        // Geen echt moment te vinden (een fase die nog niet af is, of eentje die
        // geen spoor in de database achterlaat): dan telt vanaf nu. Dat is waar
        // deze tabel voor bedoeld is.
        const wanneer = new Date().toISOString();
        uit[k]![f] = wanneer;
        schrijf.push(sql`
          INSERT INTO page_phase_history (client_slug, url_key, fase, af, sinds)
          VALUES (${slug}, ${k}, ${f}, ${af}, ${wanneer})
          ON CONFLICT (client_slug, url_key, fase) DO UPDATE SET af = EXCLUDED.af, sinds = EXCLUDED.sinds`);
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
