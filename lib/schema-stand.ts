import { sql } from "@vercel/postgres";

// ═══════════════════════════════════════════════════════════
// SCHEMA-STEMPEL: de tabellen worden één keer gemaakt, niet elke keer opnieuw
// ═══════════════════════════════════════════════════════════
// Het dashboard is "zelfhelend": bij de eerste query maakt de app zelf alle
// tabellen en kolommen aan (CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD
// COLUMN IF NOT EXISTS). Dat blijft zo, want de Neon-gegevens zijn afgeschermd
// en er is geen los migratiescript.
//
// Wat er misging: dat waren honderd losse opdrachten, één voor één, en ze
// draaiden bij ELKE koude server opnieuw. Vercel start voortdurend nieuwe
// servers (per route, na elke deploy, na elke rustperiode), dus in de praktijk
// betaalde bijna elk bezoek die honderd rondjes naar de database. Gemeten op
// 11 augustus 2026: de Taken-pagina deed er koud 11,6 seconden over en warm
// 1,0 seconde. Dat verschil zat vrijwel volledig hierin.
//
// De oplossing is een stempel. In de tabel `schema_stand` staat per onderdeel
// welke versie er in de database staat. Klopt die met de versie in de code, dan
// slaan we het hele blok over. Eén korte leesopdracht (voor de hele app samen,
// niet per onderdeel) in plaats van honderden schrijfopdrachten.
//
// Belangrijk: de stempel wordt PAS gezet als het bouwblok helemaal gelukt is.
// Loopt hij vast, dan blijft de oude stempel staan en probeert de volgende
// aanvraag het gewoon opnieuw. Zelfhelend blijft zelfhelend.
//
// Vergeten de versie op te hogen kan niet: `proeven/schema-versie.proef.ts`
// rekent de vingerafdruk van de code na en laat de bouw mislukken als de
// opgegeven versie er niet meer bij past. Een poort, geen afspraak.
// ═══════════════════════════════════════════════════════════

// De stand van álle onderdelen wordt in één keer gelezen en daarna hergebruikt.
// Zo betaalt de eerste `eenmalig()` van een server één leesopdracht en alle
// volgende (site-urls, developer, content-tracking, ...) nul.
let standBelofte: Promise<Map<string, string>> | null = null;

async function leesStand(): Promise<Map<string, string>> {
  try {
    const r = await sql`SELECT naam, versie FROM schema_stand`;
    return new Map(r.rows.map((x) => [String(x.naam), String(x.versie)]));
  } catch {
    // Bestaat de stempeltabel nog niet, dan is dit een verse database (of de
    // allereerste keer na deze wijziging). Aanmaken en met een lege stand
    // beginnen: dan bouwt elk onderdeel zichzelf gewoon één keer op.
    await sql`
      CREATE TABLE IF NOT EXISTS schema_stand (
        naam       TEXT PRIMARY KEY,
        versie     TEXT NOT NULL,
        bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    return new Map();
  }
}

// Per onderdeel onthouden we de lopende belofte, zodat tien gelijktijdige
// aanvragen op dezelfde server samen één keer bouwen in plaats van tien keer.
const bezig = new Map<string, Promise<void>>();

/**
 * Voer `bouw` hooguit één keer uit per versie, per database.
 *
 * @param naam    unieke naam van het onderdeel, bijv. "kern" of "site-urls"
 * @param versie  hoog dit op zodra je iets aan `bouw` verandert
 * @param bouw    de CREATE TABLE / ALTER TABLE-opdrachten
 */
export function eenmalig(naam: string, versie: string, bouw: () => Promise<void>): Promise<void> {
  const lopend = bezig.get(naam);
  if (lopend) return lopend;

  const belofte = (async () => {
    if (!standBelofte) standBelofte = leesStand();
    let stand: Map<string, string>;
    try {
      stand = await standBelofte;
    } catch (err) {
      standBelofte = null; // niet een kapotte leesactie blijvend onthouden
      throw err;
    }

    if (stand.get(naam) === versie) return; // al goed, niets te doen

    await bouw();

    // Pas nu de stempel. Twee servers die dit tegelijk doen is geen probleem:
    // het bouwblok is idempotent en de stempel overschrijft zichzelf.
    await sql`
      INSERT INTO schema_stand (naam, versie, bijgewerkt)
      VALUES (${naam}, ${versie}, now())
      ON CONFLICT (naam) DO UPDATE SET versie = EXCLUDED.versie, bijgewerkt = now()`;
    stand.set(naam, versie);
  })();

  // Mislukt het, dan de herinnering wissen zodat de volgende aanvraag opnieuw
  // probeert. Zonder dit zou één hapering de server blijvend stuk laten staan.
  belofte.catch(() => { bezig.delete(naam); });

  bezig.set(naam, belofte);
  return belofte;
}

/** Alleen voor de proeven: alles vergeten alsof de server net is opgestart. */
export function vergeetStand(): void {
  standBelofte = null;
  bezig.clear();
}
