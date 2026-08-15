import { sql } from "@vercel/postgres";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// DE GROTE PUNTEN: EERST SAMEN EEN PLAN, DAN 'S NACHTS BOUWEN
// ═══════════════════════════════════════════════════════════
// De tweak-stapel werkt omdat een tweak klein en duidelijk is: melden, in een
// ronde meenemen, klaar. Precies dat maakt hem ongeschikt voor het andere soort
// werk. Een groot punt ("de weekplanning moet anders", "het klantdashboard op
// echte data") is niet fout maar onaf: er is geen goed antwoord op "wat moet er
// gebeuren" zonder dat er eerst over nagedacht is.
//
// Zulke punten belandden daarom op één hoop bij de ideeën, waar ze bleven
// liggen. Niet omdat ze onbelangrijk waren, maar omdat er geen weg was tussen
// "goed idee" en "gebouwd". Elke keer opnieuw kostte dat een chat om terug te
// halen wat het idee ook alweer was.
//
// DE WEG DIE DIT BESTAND VASTLEGT, IN VIJF STANDEN:
//
//   idee        er ligt een gedachte, meer niet
//   plan-maken  ik werk er een plan van uit, en we sparren erover in het draadje
//               dat aan het punt zelf hangt (niet in een chat die verdwijnt)
//   plan-klaar  het plan ligt er in gewone taal en wacht op JOUW akkoord
//   wachtrij    goedgekeurd; staat in de bouwwachtrij voor de nacht
//   bouwt       wordt op dit moment gebouwd, één tegelijk
//
// En daarna: controleer (staat live, klopt het), klaar, of afgewezen.
//
// TWEE KADERS DIE HIER HARD IN ZITTEN, GEEN AFSPRAAK
// ───────────────────────────────────────────────────────────
//  1. ALLEEN EEN GOEDGEKEURD PLAN MAG DE BOUWWACHTRIJ IN. `magNaarWachtrij()`
//     hieronder weigert een punt zonder plan of zonder akkoord, en `zetStand()`
//     gooit een fout in plaats van het stilletjes toe te laten. Een nachtelijke
//     ronde bouwt dus nooit iets waar niemand ja tegen gezegd heeft.
//  2. GROTE PUNTEN EN TWEAKS BOUWEN NOOIT TEGELIJK. Dat staat niet hier maar in
//     `lib/bouwslot.ts`: er is één slot voor allebei de banen, dus twee rondes
//     in dezelfde bestanden kan domweg niet.
// ═══════════════════════════════════════════════════════════

// Vingerafdruk van `doeBouw()` hieronder; `proeven/schema-versie.proef.ts`
// rekent hem na en noemt zelf de waarde die hier hoort te staan.
export const GROTE_PUNTEN_SCHEMA_VERSIE = "gp1-3b3f36a5";

async function doeBouw(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS grote_punten (
      id          SERIAL PRIMARY KEY,
      code        TEXT NOT NULL DEFAULT '',
      titel       TEXT NOT NULL,
      tekst       TEXT NOT NULL DEFAULT '',
      plan        TEXT NOT NULL DEFAULT '',
      stand       TEXT NOT NULL DEFAULT 'idee',
      omvang      TEXT NOT NULL DEFAULT 'middel',
      raakt       TEXT NOT NULL DEFAULT '[]',
      routekaart  TEXT,
      bron_tweak  INTEGER,
      volgorde    INTEGER NOT NULL DEFAULT 0,
      draad       TEXT NOT NULL DEFAULT '[]',
      goedgekeurd TIMESTAMPTZ,
      ronde       TEXT,
      gestart     TIMESTAMPTZ,
      stap        TEXT NOT NULL DEFAULT '',
      stap_nr     INTEGER NOT NULL DEFAULT 0,
      stap_sinds  TIMESTAMPTZ,
      duur        INTEGER,
      rondes      INTEGER NOT NULL DEFAULT 0,
      aangemaakt  TIMESTAMPTZ NOT NULL DEFAULT now(),
      afgerond    TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS grote_punten_stand_idx ON grote_punten (stand, volgorde)`;
  // De gemeten bouwduur van afgeronde punten is waar de tijdsverwachting op
  // rust (zie lib/punt-tempo.ts). Een index erop houdt die vraag goedkoop, ook
  // als er straks honderden punten in staan.
  await sql`CREATE INDEX IF NOT EXISTS grote_punten_duur_idx ON grote_punten (omvang, duur)`;
}

export function ensureGrotePunten(): Promise<void> {
  return eenmalig("grote-punten", GROTE_PUNTEN_SCHEMA_VERSIE, doeBouw);
}

/**
 * De weg die een groot punt aflegt.
 *
 * De eerste vijf zijn de weg vooruit; de laatste drie zijn de uitkomsten. Wat
 * er NIET bij zit is een stand "geparkeerd": een punt dat even niet moet, sleep
 * je onderaan de wachtrij of zet je terug op plan-klaar. Een extra bak waar
 * dingen in verdwijnen is precies wat deze weg moest oplossen.
 */
export type Stand =
  | "idee" | "plan-maken" | "plan-klaar" | "wachtrij" | "bouwt"
  | "controleer" | "klaar" | "afgewezen";

export const STANDEN: Stand[] = [
  "idee", "plan-maken", "plan-klaar", "wachtrij", "bouwt", "controleer", "klaar", "afgewezen",
];

/** Hoe zwaar het punt is. Bepaalt de verwachte bouwtijd zolang er nog niets gemeten is. */
export type Omvang = "klein" | "middel" | "groot";
export const OMVANGEN: Omvang[] = ["klein", "middel", "groot"];

/** Eén regel in het draadje: het sparren over het plan, en wat er gebouwd is. */
export type Regel = {
  van: "maarten" | "claude";
  tekst: string;
  wanneer: string;
};

export type Punt = {
  id: number;
  /** G1, G2, ... Kort genoeg om naar te verwijzen in een chat of een gesprek. */
  code: string;
  titel: string;
  /** Het idee in Maartens eigen woorden, zoals hij het meldde. */
  tekst: string;
  /** Het plan in gewone taal. Leeg zolang er nog geen plan is. */
  plan: string;
  stand: Stand;
  omvang: Omvang;
  /** Welke schermen of motoren meebewegen; waarschuwt bij twee dingen tegelijk. */
  raakt: string[];
  /** Het R-nummer, als dit punt ook op de routekaart staat. */
  routekaart: string | null;
  /** De melding uit de tweak-stapel waar dit punt uit voortkomt. */
  bronTweak: number | null;
  /** Plek in de bouwwachtrij; laag getal is eerder aan de beurt. */
  volgorde: number;
  draad: Regel[];
  /** Wanneer Maarten ja zei tegen het plan. Zonder dit mag het niet gebouwd worden. */
  goedgekeurd: string | null;
  /** De ronde die dit punt nu bouwt, of null. */
  ronde: string | null;
  gestart: string | null;
  /** Waar de bouw nu mee bezig is, in gewone taal. */
  stap: string;
  /** De hoeveelste van STAPPEN. 0 = nog niet begonnen. */
  stapNr: number;
  stapSinds: string | null;
  /** Gemeten bouwtijd in minuten, gevuld zodra het punt live stond. */
  duur: number | null;
  /** Hoe vaak er een bouwronde overheen is gegaan. Meer dan 1 = het klopte niet meteen. */
  rondes: number;
  aangemaakt: string;
  afgerond: string | null;
};

/**
 * De vaste stappen van een bouwronde, in volgorde.
 *
 * Ze staan vast en niet per punt anders, want daar hangt de voortgangsbalk aan:
 * "stap 3 van 5" moet altijd hetzelfde betekenen, anders zegt de balk niets. De
 * ronde meldt elke stap zodra hij eraan begint (zie .claude/commands/groot-punt.md).
 */
export const STAPPEN = [
  "Plan gelezen en laatste code opgehaald",
  "Aan het bouwen",
  "De proeven draaien",
  "Live zetten",
  "Zelf nagekeken op het scherm",
];

/** De regel die Maarten in een verse chat plakt om zelf een punt op te pakken. */
export const STARTREGEL = "/groot-punt";

function leesDraad(waarde: unknown): Regel[] {
  try {
    const lijst = JSON.parse(String(waarde || "[]"));
    return Array.isArray(lijst) ? (lijst as Regel[]) : [];
  } catch {
    return [];
  }
}

function leesRaakt(waarde: unknown): string[] {
  try {
    const lijst = JSON.parse(String(waarde || "[]"));
    return Array.isArray(lijst) ? lijst.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function tijd(waarde: unknown): string | null {
  return waarde ? new Date(String(waarde)).toISOString() : null;
}

function rij(r: Record<string, unknown>): Punt {
  return {
    id: Number(r.id),
    code: String(r.code ?? ""),
    titel: String(r.titel ?? ""),
    tekst: String(r.tekst ?? ""),
    plan: String(r.plan ?? ""),
    stand: String(r.stand || "idee") as Stand,
    omvang: String(r.omvang || "middel") as Omvang,
    raakt: leesRaakt(r.raakt),
    routekaart: r.routekaart ? String(r.routekaart) : null,
    bronTweak: r.bron_tweak ? Number(r.bron_tweak) : null,
    volgorde: Number(r.volgorde ?? 0),
    draad: leesDraad(r.draad),
    goedgekeurd: tijd(r.goedgekeurd),
    ronde: r.ronde ? String(r.ronde) : null,
    gestart: tijd(r.gestart),
    stap: String(r.stap ?? ""),
    stapNr: Number(r.stap_nr ?? 0),
    stapSinds: tijd(r.stap_sinds),
    duur: r.duur === null || r.duur === undefined ? null : Number(r.duur),
    rondes: Number(r.rondes ?? 0),
    aangemaakt: tijd(r.aangemaakt) ?? "",
    afgerond: tijd(r.afgerond),
  };
}

/**
 * HET KADER, IN ÉÉN FUNCTIE: mag dit punt de bouwwachtrij in?
 *
 * Dit is de belangrijkste regel van de hele wachtrij, en daarom staat hij hier
 * als losse functie in plaats van verspreid over een route en een scherm. Een
 * nachtelijke ronde bouwt zonder toezicht; het enige dat voorkomt dat er iets
 * gebouwd wordt dat niemand wilde, is dat er een plan ligt waar Maarten ja
 * tegen gezegd heeft. `proeven/grote-punten.proef.ts` rekent deze functie na.
 *
 * De ondergrens op de planlengte is er tegen een leeg plan dat "ja" heet: één
 * regel is geen plan waar je 's nachts iets op kunt bouwen.
 */
export const PLAN_MINIMUM = 120;

export function magNaarWachtrij(p: Pick<Punt, "plan" | "goedgekeurd">): { ok: true } | { ok: false; reden: string } {
  if (!p.plan.trim()) {
    return { ok: false, reden: "Er is nog geen plan. Zonder plan bouwt de nacht niets." };
  }
  if (p.plan.trim().length < PLAN_MINIMUM) {
    return { ok: false, reden: "Het plan is te kort om 's nachts op te bouwen; schrijf uit wat er precies moet gebeuren." };
  }
  if (!p.goedgekeurd) {
    return { ok: false, reden: "Jij hebt het plan nog niet goedgekeurd. Alleen een goedgekeurd plan mag de bouwwachtrij in." };
  }
  return { ok: true };
}

/** Het eerstvolgende vrije nummer: G1, G2, ... */
async function volgendeCode(): Promise<string> {
  const r = await sql`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int), 0) AS hoogste
    FROM grote_punten WHERE code LIKE 'G%'`;
  return `G${Number(r.rows[0]?.hoogste ?? 0) + 1}`;
}

export async function nieuwPunt(p: {
  titel: string;
  tekst?: string;
  omvang?: Omvang;
  raakt?: string[];
  routekaart?: string | null;
  bronTweak?: number | null;
}): Promise<Punt> {
  await ensureGrotePunten();
  const code = await volgendeCode();
  const r = await sql`
    INSERT INTO grote_punten (code, titel, tekst, omvang, raakt, routekaart, bron_tweak, stand, volgorde)
    VALUES (
      ${code}, ${p.titel.trim().slice(0, 200)}, ${(p.tekst ?? "").trim()},
      ${p.omvang ?? "middel"}, ${JSON.stringify(p.raakt ?? [])},
      ${p.routekaart ?? null}, ${p.bronTweak ?? null},
      'idee', (SELECT COALESCE(MAX(volgorde), 0) + 10 FROM grote_punten)
    )
    RETURNING *`;
  return rij(r.rows[0]);
}

/** Alle punten die nog ergens onderweg zijn, plus (optioneel) de afgeronde. */
export async function haalPunten(alles = false): Promise<Punt[]> {
  await ensureGrotePunten();
  const r = alles
    ? await sql`SELECT * FROM grote_punten ORDER BY volgorde ASC, id ASC LIMIT 300`
    : await sql`
        SELECT * FROM grote_punten
        WHERE stand NOT IN ('klaar', 'afgewezen')
        ORDER BY volgorde ASC, id ASC LIMIT 300`;
  return r.rows.map(rij);
}

export async function haalPunt(id: number): Promise<Punt | null> {
  await ensureGrotePunten();
  const r = await sql`SELECT * FROM grote_punten WHERE id = ${id}`;
  return r.rows[0] ? rij(r.rows[0]) : null;
}

/** Het punt dat op dit moment gebouwd wordt, als er een is. */
export async function haalBouwend(): Promise<Punt | null> {
  await ensureGrotePunten();
  const r = await sql`SELECT * FROM grote_punten WHERE stand = 'bouwt' ORDER BY id ASC LIMIT 1`;
  return r.rows[0] ? rij(r.rows[0]) : null;
}

/**
 * De stand van een punt bijwerken, met eventueel een regel in het draadje.
 *
 * Gooit een fout als iemand het kader probeert te omzeilen (naar de wachtrij of
 * de bouw zonder goedgekeurd plan). Bewust een fout en geen stille weigering:
 * een route die denkt dat het gelukt is terwijl er niets gebeurde, is precies
 * hoe je een scherm krijgt dat iets anders zegt dan de werkelijkheid.
 */
export async function zetStand(
  id: number,
  stand: Stand,
  opties: {
    regel?: Regel;
    plan?: string;
    /** Zet het akkoord (alleen Maarten mag dit; de route bewaakt dat). */
    keurGoed?: boolean;
    telRonde?: boolean;
    omvang?: Omvang;
    routekaart?: string | null;
  } = {},
): Promise<Punt> {
  await ensureGrotePunten();
  const huidig = await haalPunt(id);
  if (!huidig) throw new Error("Dit punt bestaat niet (meer).");

  const plan = opties.plan !== undefined ? opties.plan : huidig.plan;
  const goedgekeurd = opties.keurGoed ? new Date().toISOString() : huidig.goedgekeurd;

  if (stand === "wachtrij" || stand === "bouwt") {
    const mag = magNaarWachtrij({ plan, goedgekeurd });
    if (!mag.ok) throw new Error(mag.reden);
  }

  const draad = [...huidig.draad];
  if (opties.regel) draad.push(opties.regel);

  // Klaar met bouwen: meet hoe lang het duurde. Dat cijfer is de basis onder
  // "hoe lang duurt het nog" bij het volgende punt van dezelfde omvang, dus het
  // moet uit de werkelijkheid komen en niet uit een schatting.
  const duur = stand === "controleer" && huidig.gestart
    ? Math.max(1, Math.round((Date.now() - new Date(huidig.gestart).getTime()) / 60000))
    : huidig.duur;

  const af = stand === "klaar" || stand === "afgewezen" ? new Date().toISOString() : null;
  // Niet meer aan het bouwen betekent: de claim los. Zou die blijven staan, dan
  // houdt een vastgelopen ronde het punt eeuwig bezet.
  const bouwt = stand === "bouwt";

  const r = await sql`
    UPDATE grote_punten
    SET stand       = ${stand},
        plan        = ${plan},
        goedgekeurd = ${goedgekeurd},
        draad       = ${JSON.stringify(draad)},
        omvang      = ${opties.omvang ?? huidig.omvang},
        routekaart  = ${opties.routekaart !== undefined ? opties.routekaart : huidig.routekaart},
        duur        = ${duur},
        rondes      = rondes + ${opties.telRonde ? 1 : 0},
        ronde       = CASE WHEN ${bouwt} THEN ronde ELSE NULL END,
        gestart     = CASE WHEN ${bouwt} THEN gestart ELSE NULL END,
        stap        = CASE WHEN ${bouwt} THEN stap ELSE '' END,
        stap_nr     = CASE WHEN ${bouwt} THEN stap_nr ELSE 0 END,
        stap_sinds  = CASE WHEN ${bouwt} THEN stap_sinds ELSE NULL END,
        afgerond    = ${af}
    WHERE id = ${id}
    RETURNING *`;
  return rij(r.rows[0]);
}

/** Het plan bijwerken zonder de stand aan te raken (sparren over een concept). */
export async function zetPlan(id: number, plan: string, regel?: Regel): Promise<Punt> {
  await ensureGrotePunten();
  const huidig = await haalPunt(id);
  if (!huidig) throw new Error("Dit punt bestaat niet (meer).");
  const draad = [...huidig.draad];
  if (regel) draad.push(regel);
  // Een gewijzigd plan is een nieuw plan: het oude akkoord vervalt. Zonder deze
  // regel kon een plan ná goedkeuring nog veranderen en tóch gebouwd worden, en
  // dan betekent "jij keurt goed" niets meer.
  const r = await sql`
    UPDATE grote_punten
    SET plan = ${plan},
        draad = ${JSON.stringify(draad)},
        goedgekeurd = CASE WHEN ${plan} <> plan THEN NULL ELSE goedgekeurd END
    WHERE id = ${id}
    RETURNING *`;
  return rij(r.rows[0]);
}

/** Alleen een regel aan het draadje toevoegen (sparren, een vraag, een antwoord). */
export async function zetRegel(id: number, regel: Regel): Promise<Punt> {
  await ensureGrotePunten();
  const huidig = await haalPunt(id);
  if (!huidig) throw new Error("Dit punt bestaat niet (meer).");
  const r = await sql`
    UPDATE grote_punten SET draad = ${JSON.stringify([...huidig.draad, regel])}
    WHERE id = ${id} RETURNING *`;
  return rij(r.rows[0]);
}

/** De voortgang van de lopende bouw, gemeld door de ronde zelf. */
export async function zetStap(id: number, nr: number, stap: string): Promise<void> {
  await ensureGrotePunten();
  await sql`
    UPDATE grote_punten
    SET stap = ${stap.slice(0, 200)}, stap_nr = ${nr}, stap_sinds = now()
    WHERE id = ${id} AND stand = 'bouwt'`;
}

/** De volgorde die Maarten zelf gesleept heeft. Stappen van tien. */
export async function zetVolgorde(ids: number[]): Promise<void> {
  await ensureGrotePunten();
  await Promise.all(ids.map((id, i) =>
    sql`UPDATE grote_punten SET volgorde = ${(i + 1) * 10} WHERE id = ${id}`));
}

export async function verwijderPunt(id: number): Promise<void> {
  await ensureGrotePunten();
  await sql`DELETE FROM grote_punten WHERE id = ${id}`;
}

/** De tellers voor het scherm en voor de melding in de kopbalk. */
export async function telPunten(): Promise<{
  idee: number; planMaken: number; planKlaar: number; wachtrij: number; bouwt: number; controleer: number;
}> {
  await ensureGrotePunten();
  const r = await sql`
    SELECT
      count(*) FILTER (WHERE stand = 'idee')::int       AS idee,
      count(*) FILTER (WHERE stand = 'plan-maken')::int AS plan_maken,
      count(*) FILTER (WHERE stand = 'plan-klaar')::int AS plan_klaar,
      count(*) FILTER (WHERE stand = 'wachtrij')::int   AS wachtrij,
      count(*) FILTER (WHERE stand = 'bouwt')::int      AS bouwt,
      count(*) FILTER (WHERE stand = 'controleer')::int AS controleer
    FROM grote_punten`;
  const x = r.rows[0] ?? {};
  return {
    idee: Number(x.idee ?? 0),
    planMaken: Number(x.plan_maken ?? 0),
    planKlaar: Number(x.plan_klaar ?? 0),
    wachtrij: Number(x.wachtrij ?? 0),
    bouwt: Number(x.bouwt ?? 0),
    controleer: Number(x.controleer ?? 0),
  };
}

/** De gemeten bouwtijden per omvang; de basis onder de tijdsverwachting. */
export async function gemetenDuur(): Promise<Record<Omvang, number[]>> {
  await ensureGrotePunten();
  const r = await sql`
    SELECT omvang, duur FROM grote_punten
    WHERE duur IS NOT NULL AND duur > 0
    ORDER BY id DESC LIMIT 60`;
  const uit: Record<Omvang, number[]> = { klein: [], middel: [], groot: [] };
  for (const x of r.rows) {
    const o = String(x.omvang || "middel") as Omvang;
    if (uit[o]) uit[o].push(Number(x.duur));
  }
  return uit;
}
