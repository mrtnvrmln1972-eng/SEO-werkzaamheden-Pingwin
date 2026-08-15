import { sql } from "@vercel/postgres";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// DE TWEAK-STAPEL: kleine aanpassingen verzamelen en in één ronde doorvoeren
// ═══════════════════════════════════════════════════════════
// Maarten ziet tijdens het werken voortdurend kleine dingen die anders moeten:
// een venster dat half onder de kopbalk hangt, een link zonder naam, een knop
// op de verkeerde plek. Losse aanpassingen dus, elk van twee minuten werk.
//
// Toch kostte zo'n aanpassing in de praktijk een kwartier. Niet door het
// bouwen, maar door alles eromheen: een chat die eerst uitzoekt waar het scherm
// staat, een wijziging die onderweg wordt uitgebreid met gedeelde code en een
// nieuwe proef, en een bouw plus deploy voor die ene regel. Die kosten betaal je
// per chat, niet per aanpassing. Tien losse tweaks kostten dus tien keer de
// volle prijs.
//
// Deze tabel draait dat om. Maarten meldt een tweak op het moment dat hij hem
// ziet, vanaf het scherm waar hij al staat, met het scherm en de klant er
// automatisch bij. Ze stapelen op. Als hij vindt dat het er genoeg zijn, wordt
// de hele stapel in één chat afgewerkt: één keer inlezen, één bouw, één deploy.
//
// DE REGEL DIE HIERBIJ HOORT (en die de tijdwinst maakt):
// een tweak is klaar als de tweak klaar is. Geen refactor, geen nieuwe proef,
// geen tweede bestand dat niet stuk was. Blijkt een tweak groter dan hij leek,
// dan gaat hij op "apart" met één regel uitleg, in plaats van stilletjes uit te
// lopen en de rest van de stapel op te houden. Die werkwijze staat voluit in
// `.claude/commands/tweaks.md`.
// ═══════════════════════════════════════════════════════════

// Vingerafdruk van `doeBouw()` hieronder; `proeven/schema-versie.proef.ts`
// rekent hem na en noemt zelf de waarde die hier hoort te staan.
export const TWEAKS_SCHEMA_VERSIE = "tw1-4cd18496";

async function doeBouw(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tweaks (
      id         SERIAL PRIMARY KEY,
      tekst      TEXT NOT NULL,
      pad        TEXT NOT NULL DEFAULT '',
      scherm     TEXT NOT NULL DEFAULT '',
      klant      TEXT,
      beeld      TEXT,
      stand      TEXT NOT NULL DEFAULT 'wachtrij',
      notitie    TEXT NOT NULL DEFAULT '',
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT now(),
      afgerond   TIMESTAMPTZ
    )`;
  // Klein of groot: hetzelfde knopje, twee bakken. Een idee wordt niet in een
  // ronde weggewerkt maar krijgt eerst een voorstel.
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS soort TEXT NOT NULL DEFAULT 'tweak'`;
  // Het draadje: elke correctie en elke oplevering komt hieronder te staan, als
  // JSON-lijst. Zo blijft één onderwerp één regel op de stapel, ook als er drie
  // rondes overheen gaan, in plaats van drie losse briefjes die niemand meer
  // aan elkaar knoopt.
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS reacties TEXT NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS rondes INTEGER NOT NULL DEFAULT 0`;
  // Eigen volgorde: de stapel is een wachtrij, dus de plek in de lijst hoort te
  // zeggen wat er straks als eerste gebeurt. Stappen van tien, zodat er tussen
  // twee meldingen nog iets past zonder de hele lijst te hernummeren.
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS volgorde INTEGER NOT NULL DEFAULT 0`;
  // 'nu' gaat voorop, 'geparkeerd' gaat niet mee in een ronde (maar blijft wel
  // staan; weggooien is iets anders dan even niet nu).
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS prioriteit TEXT NOT NULL DEFAULT 'gewoon'`;
  // Welke ronde deze melding heeft opgepakt, en sinds wanneer. Samen zijn dat de
  // twee dingen die een vastgelopen ronde herkenbaar maken.
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS ronde TEXT`;
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS bezig_sinds TIMESTAMPTZ`;
  // De brug naar de routekaart: het R-nummer dat uit dit idee is voortgekomen.
  await sql`ALTER TABLE tweaks ADD COLUMN IF NOT EXISTS punt TEXT`;
  // De oude standen omzetten naar de nieuwe namen (open/gedaan bestonden één dag).
  await sql`UPDATE tweaks SET stand = 'wachtrij' WHERE stand = 'open'`;
  await sql`UPDATE tweaks SET stand = 'klaar' WHERE stand = 'gedaan'`;
  // Meldingen van vóór de eigen volgorde stonden allemaal op 0; dan zegt de
  // lijst niets. Ze krijgen hun bestaande volgorde (oudste eerst) alsnog mee.
  await sql`UPDATE tweaks SET volgorde = id * 10 WHERE volgorde = 0`;
  await sql`CREATE INDEX IF NOT EXISTS tweaks_stand_idx ON tweaks (stand, id DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS tweaks_wachtrij_idx ON tweaks (stand, volgorde)`;
  // Het slot van de wachtrij: precies één rij, met daarin de ronde die nu loopt.
  // Eén rij en niet een kolom per tweak, want het gaat om "er is een ronde
  // bezig", niet om "deze melding is bezet".
  await sql`
    CREATE TABLE IF NOT EXISTS tweak_ronde (
      id      INTEGER PRIMARY KEY,
      ronde   TEXT,
      gestart TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`INSERT INTO tweak_ronde (id, ronde) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING`;
  // De nulmeting: welk scherm is één keer helemaal nagelopen, en wanneer. Alleen
  // de uitkomst staat hier; de lijst schermen zelf komt uit het Intern-menu en de
  // tabbalk van een klant, want die lijsten bestaan al.
  await sql`
    CREATE TABLE IF NOT EXISTS scherm_nulmeting (
      sleutel   TEXT PRIMARY KEY,
      nagelopen TIMESTAMPTZ NOT NULL DEFAULT now(),
      notitie   TEXT NOT NULL DEFAULT ''
    )`;
}

export function ensureTweaks(): Promise<void> {
  return eenmalig("tweaks", TWEAKS_SCHEMA_VERSIE, doeBouw);
}

/**
 * De weg die een melding aflegt. Vijf standen, want vier waren er niet genoeg:
 * Maarten moet kunnen zien of iets nog wacht, of ik ermee bezig ben, of het
 * klaarstaat om te controleren, of het echt af is.
 *
 *  wachtrij   = staat op de stapel, wacht op de volgende ronde
 *  bezig      = wordt op dit moment gebouwd (zodat twee rondes niet botsen)
 *  controleer = doorgevoerd en live; kijk of het klopt
 *  klaar      = door Maarten goedgekeurd
 *  apart      = bleek groter dan een tweak; wordt een idee, geen ronde-werk
 *  routekaart = een idee waar Maarten ja tegen zei; wordt een ontwikkelpunt
 */
export type Stand = "wachtrij" | "bezig" | "controleer" | "klaar" | "apart" | "routekaart";

/** Kleine aanpassing of een groter idee dat eerst uitgedacht moet worden. */
export type Soort = "tweak" | "idee";

/**
 * Wat er als eerste gebeurt, en wat even níet.
 *
 *  nu         = direct doorvoeren: gaat voorop in de eerstvolgende ronde
 *  gewoon     = gaat mee op zijn eigen plek in de wachtrij
 *  geparkeerd = blijft staan maar gaat nergens in mee, tot je hem terugzet
 */
export type Prioriteit = "nu" | "gewoon" | "geparkeerd";

/** Eén regel in het draadje van een melding. */
export type Reactie = {
  /** "maarten" = correctie of akkoord van hem, "claude" = wat er gebouwd is. */
  van: "maarten" | "claude";
  tekst: string;
  wanneer: string;
};

export type Tweak = {
  id: number;
  tekst: string;
  soort: Soort;
  /** Het pad waar Maarten stond toen hij hem meldde, bijv. /admin/client/kamsteeg. */
  pad: string;
  /** Hoe dat scherm heet in gewone taal, bijv. "Cockpit Kamsteeg". */
  scherm: string;
  klant: string | null;
  /** Schermafbeelding als data-URL, of leeg. Bij het overzicht niet meegestuurd. */
  beeld: string | null;
  stand: Stand;
  prioriteit: Prioriteit;
  /** Plek in de wachtrij; laag getal is eerder aan de beurt. */
  volgorde: number;
  /** Eén regel: waarom apart gezet, of wat er precies is gewijzigd. */
  notitie: string;
  /** Het draadje: correcties van Maarten en opleveringen van mij, op volgorde. */
  reacties: Reactie[];
  /** Hoe vaak hier al een ronde overheen is gegaan. Meer dan 1 = het klopte niet meteen. */
  rondes: number;
  /** Het R-nummer op de routekaart, als dit idee daar een punt is geworden. */
  punt: string | null;
  aangemaakt: string;
  afgerond: string | null;
};

/** De regel die Maarten in een verse chat plakt om de stapel af te werken. */
export const STARTREGEL = "/tweaks";

// Een schermafbeelding wordt in de browser al verkleind naar maximaal 1400
// pixels breed. Deze grens is het vangnet daaronder: hij houdt een enkele
// uitschieter (een heel hoge pagina, een plaatje dat niet samengedrukt wilde
// worden) uit de database in plaats van de melding te laten mislukken.
export const MAX_BEELD = 2_000_000;

/** Het draadje uit de database, met een lege lijst als het ooit stuk zou staan. */
function leesReacties(waarde: unknown): Reactie[] {
  try {
    const lijst = JSON.parse(String(waarde || "[]"));
    return Array.isArray(lijst) ? (lijst as Reactie[]) : [];
  } catch {
    return [];
  }
}

function rij(r: Record<string, unknown>): Tweak {
  return {
    id: Number(r.id),
    tekst: String(r.tekst ?? ""),
    pad: String(r.pad ?? ""),
    scherm: String(r.scherm ?? ""),
    klant: r.klant ? String(r.klant) : null,
    beeld: r.beeld ? String(r.beeld) : null,
    soort: (String(r.soort || "tweak") as Soort),
    stand: (String(r.stand || "wachtrij") as Stand),
    prioriteit: (String(r.prioriteit || "gewoon") as Prioriteit),
    volgorde: Number(r.volgorde ?? 0),
    notitie: String(r.notitie ?? ""),
    reacties: leesReacties(r.reacties),
    rondes: Number(r.rondes ?? 0),
    punt: r.punt ? String(r.punt) : null,
    aangemaakt: r.aangemaakt ? new Date(String(r.aangemaakt)).toISOString() : "",
    afgerond: r.afgerond ? new Date(String(r.afgerond)).toISOString() : null,
  };
}

export async function nieuweTweak(t: {
  tekst: string; pad: string; scherm: string; klant: string | null; beeld: string | null;
  soort?: Soort;
}): Promise<Tweak> {
  await ensureTweaks();
  const beeld = t.beeld && t.beeld.length <= MAX_BEELD ? t.beeld : null;
  // Achteraan in de wachtrij. Wie voorrang wil geeft die zelf, met "direct
  // doorvoeren" of door hem naar boven te slepen; niet doordat hij nieuw is.
  const r = await sql`
    INSERT INTO tweaks (tekst, pad, scherm, klant, beeld, soort, volgorde)
    VALUES (
      ${t.tekst.trim()}, ${t.pad}, ${t.scherm}, ${t.klant}, ${beeld}, ${t.soort || "tweak"},
      (SELECT COALESCE(MAX(volgorde), 0) + 10 FROM tweaks)
    )
    RETURNING *`;
  return rij(r.rows[0]);
}

/**
 * De stapel. Het beeld gaat hier bewust NIET mee: een lijst van dertig
 * meldingen met elk een schermafbeelding erin is megabytes aan overdracht voor
 * een scherm waar je ze niet eens alle dertig tegelijk bekijkt. Het beeld
 * wordt per stuk opgehaald zodra je erop klikt.
 */
export async function haalTweaks(alles = false): Promise<Tweak[]> {
  await ensureTweaks();
  const r = alles
    ? await sql`
        SELECT id, tekst, pad, scherm, klant, soort, stand, prioriteit, volgorde, notitie,
               reacties, rondes, punt, aangemaakt, afgerond, (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks
        ORDER BY (stand IN ('wachtrij', 'bezig', 'controleer', 'routekaart')) DESC,
                 volgorde ASC, id ASC LIMIT 300`
    : await sql`
        SELECT id, tekst, pad, scherm, klant, soort, stand, prioriteit, volgorde, notitie,
               reacties, rondes, punt, aangemaakt, afgerond, (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks
        WHERE stand IN ('wachtrij', 'bezig', 'controleer', 'routekaart')
        ORDER BY volgorde ASC, id ASC LIMIT 300`;
  return r.rows.map((x) => ({ ...rij(x), beeld: x.heeft_beeld ? "" : null }));
}

/** De ideeën die een routekaartpunt worden. Gelezen door /admin/routekaart. */
export async function haalRoutekaartIdeeen(): Promise<Tweak[]> {
  await ensureTweaks();
  const r = await sql`
    SELECT id, tekst, pad, scherm, klant, soort, stand, prioriteit, volgorde, notitie,
           reacties, rondes, punt, aangemaakt, afgerond, FALSE AS heeft_beeld
    FROM tweaks WHERE stand = 'routekaart' ORDER BY id ASC LIMIT 50`;
  return r.rows.map((x) => ({ ...rij(x), beeld: null }));
}

/** Het beeld van één melding, los opgehaald. */
export async function haalBeeld(id: number): Promise<string | null> {
  await ensureTweaks();
  const r = await sql`SELECT beeld FROM tweaks WHERE id = ${id}`;
  return r.rows[0]?.beeld ? String(r.rows[0].beeld) : null;
}

/**
 * Stand bijwerken, en desgewenst een regel aan het draadje toevoegen.
 *
 * Een tweak die van "controleer" terugvalt naar "wachtrij" is een correctie:
 * dan gaat de rondeteller omhoog. Zo is later te zien welke dingen in één keer
 * goed gingen en welke drie pogingen kostten, zonder dat iemand dat bijhoudt.
 */
export async function zetStand(
  id: number,
  stand: Stand,
  opties: { notitie?: string; reactie?: Reactie; telRonde?: boolean; punt?: string | null } = {},
): Promise<void> {
  await ensureTweaks();
  const af = stand === "klaar" || stand === "apart" ? new Date().toISOString() : null;
  const huidig = await sql`SELECT reacties, notitie, punt FROM tweaks WHERE id = ${id}`;
  const draad = leesReacties(huidig.rows[0]?.reacties);
  if (opties.reactie) draad.push(opties.reactie);
  const notitie = opties.notitie ?? String(huidig.rows[0]?.notitie ?? "");
  const punt = opties.punt !== undefined ? opties.punt : (huidig.rows[0]?.punt ?? null);
  // Terug de wachtrij in betekent: hij is niet meer van een lopende ronde. Zou de
  // claim blijven staan, dan houdt een vastgelopen ronde hem eeuwig bezet.
  const losGeclaimd = stand !== "bezig";
  await sql`
    UPDATE tweaks
    SET stand = ${stand},
        notitie = ${notitie},
        reacties = ${JSON.stringify(draad)},
        rondes = rondes + ${opties.telRonde ? 1 : 0},
        punt = ${punt},
        ronde = CASE WHEN ${losGeclaimd} THEN NULL ELSE ronde END,
        bezig_sinds = CASE WHEN ${losGeclaimd} THEN NULL ELSE bezig_sinds END,
        afgerond = ${af}
    WHERE id = ${id}`;
}

/**
 * Direct doorvoeren, gewoon meelopen of even parkeren.
 *
 * "nu" zet hem ook meteen vooraan in de rij, want anders zegt de lijst iets
 * anders dan de ronde doet, en dan geloof je de lijst niet meer.
 */
export async function zetPrioriteit(id: number, prioriteit: Prioriteit): Promise<void> {
  await ensureTweaks();
  if (prioriteit === "nu") {
    await sql`
      UPDATE tweaks
      SET prioriteit = 'nu',
          volgorde = (SELECT COALESCE(MIN(volgorde), 10) - 10 FROM tweaks WHERE stand = 'wachtrij')
      WHERE id = ${id}`;
    return;
  }
  await sql`UPDATE tweaks SET prioriteit = ${prioriteit} WHERE id = ${id}`;
}

/** De volgorde die Maarten zelf gesleept heeft. Stappen van tien. */
export async function zetVolgorde(ids: number[]): Promise<void> {
  await ensureTweaks();
  await Promise.all(ids.map((id, i) =>
    sql`UPDATE tweaks SET volgorde = ${(i + 1) * 10} WHERE id = ${id}`));
}

export async function verwijderTweak(id: number): Promise<void> {
  await ensureTweaks();
  await sql`DELETE FROM tweaks WHERE id = ${id}`;
}

/** Wat er op de teller van het knopje staat: alles wat nog niet af is. */
export async function telOpen(): Promise<{ wachtrij: number; controleer: number; geparkeerd: number }> {
  await ensureTweaks();
  const r = await sql`
    SELECT
      count(*) FILTER (WHERE stand IN ('wachtrij', 'bezig') AND prioriteit <> 'geparkeerd')::int AS wachtrij,
      count(*) FILTER (WHERE stand = 'controleer')::int                                          AS controleer,
      count(*) FILTER (WHERE stand = 'wachtrij' AND prioriteit = 'geparkeerd')::int              AS geparkeerd
    FROM tweaks`;
  return {
    wachtrij: Number(r.rows[0]?.wachtrij ?? 0),
    controleer: Number(r.rows[0]?.controleer ?? 0),
    geparkeerd: Number(r.rows[0]?.geparkeerd ?? 0),
  };
}
