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
export const TWEAKS_SCHEMA_VERSIE = "tw1-738bb64c";

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
  // De oude standen omzetten naar de nieuwe namen (open/gedaan bestonden één dag).
  await sql`UPDATE tweaks SET stand = 'wachtrij' WHERE stand = 'open'`;
  await sql`UPDATE tweaks SET stand = 'klaar' WHERE stand = 'gedaan'`;
  await sql`CREATE INDEX IF NOT EXISTS tweaks_stand_idx ON tweaks (stand, id DESC)`;
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
 */
export type Stand = "wachtrij" | "bezig" | "controleer" | "klaar" | "apart";

/** Kleine aanpassing of een groter idee dat eerst uitgedacht moet worden. */
export type Soort = "tweak" | "idee";

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
  /** Eén regel: waarom apart gezet, of wat er precies is gewijzigd. */
  notitie: string;
  /** Het draadje: correcties van Maarten en opleveringen van mij, op volgorde. */
  reacties: Reactie[];
  /** Hoe vaak hier al een ronde overheen is gegaan. Meer dan 1 = het klopte niet meteen. */
  rondes: number;
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
    notitie: String(r.notitie ?? ""),
    reacties: leesReacties(r.reacties),
    rondes: Number(r.rondes ?? 0),
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
  const r = await sql`
    INSERT INTO tweaks (tekst, pad, scherm, klant, beeld, soort)
    VALUES (${t.tekst.trim()}, ${t.pad}, ${t.scherm}, ${t.klant}, ${beeld}, ${t.soort || "tweak"})
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
        SELECT id, tekst, pad, scherm, klant, soort, stand, notitie, reacties, rondes,
               aangemaakt, afgerond, (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks
        ORDER BY (stand IN ('wachtrij', 'bezig', 'controleer')) DESC, id DESC LIMIT 300`
    : await sql`
        SELECT id, tekst, pad, scherm, klant, soort, stand, notitie, reacties, rondes,
               aangemaakt, afgerond, (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks
        WHERE stand IN ('wachtrij', 'bezig', 'controleer') ORDER BY id DESC LIMIT 300`;
  return r.rows.map((x) => ({ ...rij(x), beeld: x.heeft_beeld ? "" : null }));
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
  opties: { notitie?: string; reactie?: Reactie; telRonde?: boolean } = {},
): Promise<void> {
  await ensureTweaks();
  const af = stand === "klaar" || stand === "apart" ? new Date().toISOString() : null;
  const huidig = await sql`SELECT reacties, notitie FROM tweaks WHERE id = ${id}`;
  const draad = leesReacties(huidig.rows[0]?.reacties);
  if (opties.reactie) draad.push(opties.reactie);
  const notitie = opties.notitie ?? String(huidig.rows[0]?.notitie ?? "");
  await sql`
    UPDATE tweaks
    SET stand = ${stand},
        notitie = ${notitie},
        reacties = ${JSON.stringify(draad)},
        rondes = rondes + ${opties.telRonde ? 1 : 0},
        afgerond = ${af}
    WHERE id = ${id}`;
}

export async function verwijderTweak(id: number): Promise<void> {
  await ensureTweaks();
  await sql`DELETE FROM tweaks WHERE id = ${id}`;
}

/** Wat er op de teller van het knopje staat: alles wat nog niet af is. */
export async function telOpen(): Promise<{ wachtrij: number; controleer: number }> {
  await ensureTweaks();
  const r = await sql`
    SELECT
      count(*) FILTER (WHERE stand IN ('wachtrij', 'bezig'))::int AS wachtrij,
      count(*) FILTER (WHERE stand = 'controleer')::int          AS controleer
    FROM tweaks`;
  return {
    wachtrij: Number(r.rows[0]?.wachtrij ?? 0),
    controleer: Number(r.rows[0]?.controleer ?? 0),
  };
}
