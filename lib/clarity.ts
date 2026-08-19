import { sql } from "@vercel/postgres";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// MICROSOFT CLARITY: HOE ECHTE BEZOEKERS ZICH GEDRAGEN
// ═══════════════════════════════════════════════════════════
// Het Pagina-lab beoordeelt een pagina op conversie, bruikbaarheid, vormgeving
// en interactie. Voor twee van die vier is een oordeel zonder gedragsdata half
// werk: je kunt zién dat een knop laag staat, maar niet dat niemand er ooit
// komt, dat mensen woedend op iets klikken dat geen knop is, of dat ze op de
// helft van de pagina rechtsomkeert maken. Clarity meet precies dat, gratis, en
// is daarmee de natuurlijke tweede bron naast Google Analytics.
//
// WAT DEZE KOPPELING WEL EN NIET IS
// ═════════════════════════════════
// Clarity heeft twee gezichten. Het scherm van Clarity zelf toont opnames en
// heatmaps per pagina; daar kan geen enkele koppeling bij, dat blijft kijken met
// je eigen ogen. Wat de API wél geeft zijn de cijfers achter dat scherm:
// sessies, scrolldiepte, tijd op de pagina, en de vier frustratiesignalen
// (dode klik, woedeklik, terugspringen, overmatig scrollen). Uit te splitsen
// naar maximaal drie kenmerken tegelijk, bijvoorbeeld URL en apparaat.
//
// TWEE HARDE GRENZEN VAN DIE API, EN DAAROM DEZE OPZET
// ════════════════════════════════════════════════════
//  1. Tien opvragingen per project per dag. Dat is niets. Elke opvraging wordt
//     daarom bewaard, en alles wat daarna kijkt leest die bewaarde meting in
//     plaats van opnieuw op te halen.
//  2. Nooit verder terug dan drie dagen. Wie een maand wil zien, moet dus zelf
//     verzamelen. Ook daarom wordt elke meting bewaard: dat archief kan alleen
//     nog groeien, en het kan nooit met terugwerkende kracht aangelegd worden.
//
// STAND OP 19-08-2026: NOG NIET IN HET ECHT GEDRAAID
// ══════════════════════════════════════════════════
// Maarten heeft nog geen Clarity-account. Alles hieronder is gebouwd op de
// beschrijving van de API van Microsoft en wacht op de eerste echte sleutel.
// Daarom leest de verwerking hieronder BEWUST losjes: de ruwe JSON wordt
// integraal bewaard en de vertaling naar cijfers gaat op namen die kunnen
// verschillen, zonder ergens te struikelen. Wat er niet in zit, komt er niet
// uit; niets gaat stuk. Zodra er een sleutel is, zie je in één opvraging of de
// namen kloppen, en dan is dit bestand de enige plek die bijgesteld hoeft.
// ═══════════════════════════════════════════════════════════

const API = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

/**
 * Ons eigen plafond, lager dan dat van Clarity (tien per project per dag).
 * De marge is er zodat een handmatige controle nooit de opvraging opeet die een
 * automatische ronde later op de dag nodig heeft.
 */
export const DAGLIMIET = 8;

/** Het aantal dagen dat de API toestaat. Meer bestaat niet. */
export type Dagen = 1 | 2 | 3;

/** Waarop je de cijfers kunt uitsplitsen. Clarity kent er meer; dit is wat wij gebruiken. */
export const DIMENSIES = ["URL", "Device", "Browser", "OS", "Country", "Source"] as const;
export type Dimensie = (typeof DIMENSIES)[number];

const SCHEMA_VERSIE = "clarity-a04aa136";

async function ensureTable(): Promise<void> {
  return eenmalig("clarity", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_clarity (
      client_slug TEXT PRIMARY KEY,
      api_token   TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS clarity_metingen (
      id           SERIAL PRIMARY KEY,
      client_slug  TEXT NOT NULL,
      opgehaald_op TIMESTAMPTZ NOT NULL DEFAULT now(),
      dagen        INT NOT NULL,
      dimensie     TEXT,
      ruw          JSONB NOT NULL
    )`;
  await sql`CREATE INDEX IF NOT EXISTS clarity_metingen_klant ON clarity_metingen (client_slug, dimensie, opgehaald_op DESC)`;
}

// ── De sleutel ──────────────────────────────────────────────
// Gevoelig, dus dezelfde regel als bij de WordPress-inloggegevens: hij gaat
// nooit terug naar de browser. Het scherm toont alleen óf hij er is.

export async function clarityToken(slug: string): Promise<string | null> {
  await ensureTable();
  const { rows } = await sql`SELECT api_token FROM client_clarity WHERE client_slug = ${slug} LIMIT 1`;
  return (rows[0]?.api_token as string) || null;
}

export async function bewaarClarityToken(slug: string, token: string): Promise<void> {
  await ensureTable();
  await sql`
    INSERT INTO client_clarity (client_slug, api_token, updated_at)
    VALUES (${slug}, ${token}, now())
    ON CONFLICT (client_slug) DO UPDATE SET api_token = ${token}, updated_at = now()`;
}

export async function verwijderClarityToken(slug: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM client_clarity WHERE client_slug = ${slug}`;
}

// ── De stand ────────────────────────────────────────────────

export type ClarityStand = {
  gekoppeld: boolean;
  /** Wanneer er voor het laatst iets is opgehaald. */
  laatste: string | null;
  /** Hoeveel opvragingen er vandaag al gedaan zijn. */
  vandaag: number;
  /** Hoeveel er vandaag nog mogen binnen ons eigen plafond. */
  ruimte: number;
  /** Hoeveel metingen er in het archief zitten. Dit getal kan alleen groeien. */
  bewaard: number;
};

export async function clarityStand(slug: string): Promise<ClarityStand> {
  await ensureTable();
  const [token, tel] = await Promise.all([
    clarityToken(slug),
    sql`
      SELECT
        count(*) FILTER (WHERE opgehaald_op > now() - interval '1 day')::int AS vandaag,
        count(*)::int AS bewaard,
        max(opgehaald_op) AS laatste
      FROM clarity_metingen WHERE client_slug = ${slug}`,
  ]);
  const r = tel.rows[0] || {};
  const vandaag = Number(r.vandaag) || 0;
  return {
    gekoppeld: !!token,
    laatste: r.laatste ? new Date(r.laatste as string).toISOString() : null,
    vandaag,
    ruimte: Math.max(0, DAGLIMIET - vandaag),
    bewaard: Number(r.bewaard) || 0,
  };
}

/**
 * De stand van álle klanten in twee opdrachten in plaats van twee per klant.
 * Voor het overzicht; met dertig klanten is het verschil zestig rondjes naar de
 * database.
 */
export async function clarityStandAlle(): Promise<Record<string, ClarityStand>> {
  await ensureTable();
  const [sleutels, tellingen] = await Promise.all([
    sql`SELECT client_slug FROM client_clarity`,
    sql`
      SELECT client_slug,
        count(*) FILTER (WHERE opgehaald_op > now() - interval '1 day')::int AS vandaag,
        count(*)::int AS bewaard,
        max(opgehaald_op) AS laatste
      FROM clarity_metingen GROUP BY client_slug`,
  ]);
  const uit: Record<string, ClarityStand> = {};
  const zet = (slug: string) => (uit[slug] ||= { gekoppeld: false, laatste: null, vandaag: 0, ruimte: DAGLIMIET, bewaard: 0 });
  for (const r of sleutels.rows) zet(String(r.client_slug)).gekoppeld = true;
  for (const r of tellingen.rows) {
    const s = zet(String(r.client_slug));
    s.vandaag = Number(r.vandaag) || 0;
    s.ruimte = Math.max(0, DAGLIMIET - s.vandaag);
    s.bewaard = Number(r.bewaard) || 0;
    s.laatste = r.laatste ? new Date(r.laatste as string).toISOString() : null;
  }
  return uit;
}

// ── Ophalen ─────────────────────────────────────────────────

export type Regel = { dimensie: string | null; waarden: Record<string, number> };
export type Meting = { metriek: string; regels: Regel[] };

/**
 * De ruwe JSON van Clarity omzetten naar iets waar een scherm mee kan werken.
 *
 * Bewust vergevingsgezind, want dit is nog nooit tegen een echt antwoord
 * gedraaid (zie de kop van dit bestand). Het antwoord is een lijst van
 * `{ metricName, information: [...] }`, en in zo'n informatieregel staat het
 * kenmerk waarop is uitgesplitst naast een handvol getallen waarvan de namen
 * per metriek verschillen. We nemen daarom alles mee wat een getal is, en de
 * eerste tekstwaarde geldt als de uitsplitsing.
 */
export function verwerk(ruw: unknown): Meting[] {
  if (!Array.isArray(ruw)) return [];
  const uit: Meting[] = [];
  for (const blok of ruw) {
    if (!blok || typeof blok !== "object") continue;
    const b = blok as Record<string, unknown>;
    const metriek = String(b.metricName || b.metric || "onbekend");
    const info = Array.isArray(b.information) ? b.information : [];
    const regels: Regel[] = [];
    for (const rij of info) {
      if (!rij || typeof rij !== "object") continue;
      const waarden: Record<string, number> = {};
      let dimensie: string | null = null;
      for (const [sleutel, waarde] of Object.entries(rij as Record<string, unknown>)) {
        const getal = typeof waarde === "number" ? waarde : Number(String(waarde ?? "").replace(",", "."));
        if (waarde !== null && waarde !== "" && Number.isFinite(getal)) waarden[sleutel] = getal;
        else if (dimensie === null && typeof waarde === "string" && waarde) dimensie = waarde;
      }
      regels.push({ dimensie, waarden });
    }
    uit.push({ metriek, regels });
  }
  return uit;
}

export type Ophaal = { ok: boolean; error?: string; metingen?: Meting[]; opgehaaldOp?: string };

/**
 * Eén opvraging bij Clarity, en die wordt meteen bewaard.
 *
 * De teller loopt vóór de aanvraag mee, niet erna: een mislukte poging telt bij
 * Clarity waarschijnlijk óók mee, en dan is het beter dat wij één opvraging te
 * voorzichtig zijn dan dat de tiende het slot dichtgooit.
 */
export async function haalClarity(slug: string, dagen: Dagen = 3, dimensie: Dimensie | null = "URL"): Promise<Ophaal> {
  const token = await clarityToken(slug);
  if (!token) return { ok: false, error: "Deze klant heeft nog geen Clarity-sleutel." };

  const stand = await clarityStand(slug);
  if (stand.ruimte <= 0) {
    return { ok: false, error: `Vandaag al ${stand.vandaag} keer opgehaald. Clarity staat er tien per dag toe; morgen kan het weer.` };
  }

  const p = new URLSearchParams({ numOfDays: String(dagen) });
  if (dimensie) p.set("dimension1", dimensie);

  let res: Response;
  try {
    res = await fetch(`${API}?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Clarity was niet bereikbaar." };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "De sleutel werd geweigerd. Maak in Clarity een nieuwe aan en plak die hier." };
  }
  if (res.status === 429) {
    return { ok: false, error: "Clarity houdt de opvragingen tegen: het dagplafond van tien is bereikt." };
  }
  if (!res.ok) {
    return { ok: false, error: `Clarity gaf foutcode ${res.status} terug.` };
  }

  let ruw: unknown;
  try { ruw = await res.json(); } catch { return { ok: false, error: "Het antwoord van Clarity was geen leesbare JSON." }; }

  await ensureTable();
  const bewaard = await sql`
    INSERT INTO clarity_metingen (client_slug, dagen, dimensie, ruw)
    VALUES (${slug}, ${dagen}, ${dimensie}, ${JSON.stringify(ruw)}::jsonb)
    RETURNING opgehaald_op`;

  return {
    ok: true,
    metingen: verwerk(ruw),
    opgehaaldOp: new Date(bewaard.rows[0].opgehaald_op as string).toISOString(),
  };
}

// ── Lezen uit wat er al opgehaald is ────────────────────────
// Alles wat een oordeel over een pagina wil, leest hier. Nooit rechtstreeks bij
// Clarity langs: tien per dag is te weinig om per pagina op te vragen.

export type BewaardeMeting = { opgehaaldOp: string; dagen: number; dimensie: string | null; metingen: Meting[] };

export async function laatsteMeting(slug: string, dimensie: Dimensie | null = "URL"): Promise<BewaardeMeting | null> {
  await ensureTable();
  const { rows } = await sql`
    SELECT opgehaald_op, dagen, dimensie, ruw FROM clarity_metingen
    WHERE client_slug = ${slug} AND dimensie IS NOT DISTINCT FROM ${dimensie}
    ORDER BY opgehaald_op DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    opgehaaldOp: new Date(r.opgehaald_op as string).toISOString(),
    dagen: Number(r.dagen) || 0,
    dimensie: (r.dimensie as string) || null,
    metingen: verwerk(r.ruw),
  };
}

/** Het pad zoals Clarity het meestal teruggeeft, zodat vergelijken lukt. */
export function padVan(url: string): string {
  try { return new URL(url).pathname.replace(/\/+$/, "") || "/"; } catch { return url.replace(/\/+$/, "") || "/"; }
}

export type PaginaGedrag = {
  opgehaaldOp: string;
  dagen: number;
  /** Per metriek de regel die bij deze pagina hoort. Leeg = deze pagina zat niet in de meting. */
  regels: { metriek: string; waarden: Record<string, number> }[];
};

/**
 * Wat er over één pagina bekend is uit de laatst opgehaalde meting.
 *
 * Clarity geeft de URL soms met en soms zonder domein of afsluitende schuine
 * streep terug, dus er wordt op het kale pad vergeleken.
 */
export async function clarityVoorPagina(slug: string, url: string): Promise<PaginaGedrag | null> {
  const meting = await laatsteMeting(slug, "URL");
  if (!meting) return null;
  const doel = padVan(url);
  const regels: { metriek: string; waarden: Record<string, number> }[] = [];
  for (const m of meting.metingen) {
    const raak = m.regels.find((r) => r.dimensie && padVan(r.dimensie) === doel);
    if (raak) regels.push({ metriek: m.metriek, waarden: raak.waarden });
  }
  return { opgehaaldOp: meting.opgehaaldOp, dagen: meting.dagen, regels };
}
