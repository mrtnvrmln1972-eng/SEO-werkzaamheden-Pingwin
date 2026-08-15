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
export const TWEAKS_SCHEMA_VERSIE = "tw1-e6536479";

async function doeBouw(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tweaks (
      id         SERIAL PRIMARY KEY,
      tekst      TEXT NOT NULL,
      pad        TEXT NOT NULL DEFAULT '',
      scherm     TEXT NOT NULL DEFAULT '',
      klant      TEXT,
      beeld      TEXT,
      stand      TEXT NOT NULL DEFAULT 'open',
      notitie    TEXT NOT NULL DEFAULT '',
      aangemaakt TIMESTAMPTZ NOT NULL DEFAULT now(),
      afgerond   TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS tweaks_stand_idx ON tweaks (stand, id DESC)`;
}

export function ensureTweaks(): Promise<void> {
  return eenmalig("tweaks", TWEAKS_SCHEMA_VERSIE, doeBouw);
}

/**
 * open   = staat op de stapel, wacht op de volgende ronde
 * gedaan = doorgevoerd en live
 * apart  = bleek groter dan een tweak; hoort op de routekaart, niet in de stapel
 */
export type Stand = "open" | "gedaan" | "apart";

export type Tweak = {
  id: number;
  tekst: string;
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

function rij(r: Record<string, unknown>): Tweak {
  return {
    id: Number(r.id),
    tekst: String(r.tekst ?? ""),
    pad: String(r.pad ?? ""),
    scherm: String(r.scherm ?? ""),
    klant: r.klant ? String(r.klant) : null,
    beeld: r.beeld ? String(r.beeld) : null,
    stand: (String(r.stand || "open") as Stand),
    notitie: String(r.notitie ?? ""),
    aangemaakt: r.aangemaakt ? new Date(String(r.aangemaakt)).toISOString() : "",
    afgerond: r.afgerond ? new Date(String(r.afgerond)).toISOString() : null,
  };
}

export async function nieuweTweak(t: {
  tekst: string; pad: string; scherm: string; klant: string | null; beeld: string | null;
}): Promise<Tweak> {
  await ensureTweaks();
  const beeld = t.beeld && t.beeld.length <= MAX_BEELD ? t.beeld : null;
  const r = await sql`
    INSERT INTO tweaks (tekst, pad, scherm, klant, beeld)
    VALUES (${t.tekst.trim()}, ${t.pad}, ${t.scherm}, ${t.klant}, ${beeld})
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
        SELECT id, tekst, pad, scherm, klant, stand, notitie, aangemaakt, afgerond,
               (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks ORDER BY (stand = 'open') DESC, id DESC LIMIT 300`
    : await sql`
        SELECT id, tekst, pad, scherm, klant, stand, notitie, aangemaakt, afgerond,
               (beeld IS NOT NULL) AS heeft_beeld
        FROM tweaks WHERE stand = 'open' ORDER BY id DESC LIMIT 300`;
  return r.rows.map((x) => ({ ...rij(x), beeld: x.heeft_beeld ? "" : null }));
}

/** Het beeld van één melding, los opgehaald. */
export async function haalBeeld(id: number): Promise<string | null> {
  await ensureTweaks();
  const r = await sql`SELECT beeld FROM tweaks WHERE id = ${id}`;
  return r.rows[0]?.beeld ? String(r.rows[0].beeld) : null;
}

export async function zetStand(id: number, stand: Stand, notitie = ""): Promise<void> {
  await ensureTweaks();
  const klaar = stand === "open" ? null : new Date().toISOString();
  await sql`
    UPDATE tweaks SET stand = ${stand}, notitie = ${notitie}, afgerond = ${klaar}
    WHERE id = ${id}`;
}

export async function verwijderTweak(id: number): Promise<void> {
  await ensureTweaks();
  await sql`DELETE FROM tweaks WHERE id = ${id}`;
}

export async function telOpen(): Promise<number> {
  await ensureTweaks();
  const r = await sql`SELECT count(*)::int AS n FROM tweaks WHERE stand = 'open'`;
  return Number(r.rows[0]?.n ?? 0);
}
