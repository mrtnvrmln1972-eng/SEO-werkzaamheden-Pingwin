import { sql, ensureSchema } from "./db";
import { meldingToevoegen } from "./meldingen";

// ═══════════════════════════════════════════════════════════
// OPVOLGING VAN EEN VERSTUURDE MAIL
// ═══════════════════════════════════════════════════════════
// Je stuurt een mail vanuit een kaart, naar de klant of de sitebouwer, en dan is
// het stil. Kwam er antwoord? Is het ook echt gedaan op de site? Dat onthouden is
// handwerk, en handwerk wordt vergeten.
//
// Daarom kun je bij het versturen zeggen: herinner me hier over zoveel dagen aan.
// Op die dag verschijnt er een melding bij het belletje in de kopbalk, met de
// klant, waar het over ging en naar wie het ging. Klik je hem weg, dan is de
// opvolging afgerond.
//
// Bewust in de bestaande meldingen gehangen en niet in een eigen scherm: er is al
// één plek waar dingen om aandacht vragen, en dat moet er één blijven.
// ═══════════════════════════════════════════════════════════

let klaar: Promise<void> | null = null;

async function tabel(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS mail_opvolg (
      id            SERIAL PRIMARY KEY,
      client_slug   TEXT NOT NULL,
      taak          TEXT NOT NULL DEFAULT '',
      onderwerp     TEXT NOT NULL DEFAULT '',
      naar          TEXT NOT NULL DEFAULT '',
      url           TEXT,
      verstuurd_op  TIMESTAMPTZ NOT NULL DEFAULT now(),
      herinner_op   DATE NOT NULL,
      afgerond_op   TIMESTAMPTZ
    )`;
  await sql`CREATE INDEX IF NOT EXISTS mail_opvolg_open_idx ON mail_opvolg (herinner_op) WHERE afgerond_op IS NULL`;
}
async function ensure(): Promise<void> {
  await ensureSchema();
  if (!klaar) klaar = tabel();
  await klaar;
}

export type Opvolging = {
  id: number; clientSlug: string; taak: string; onderwerp: string;
  naar: string; url: string | null; verstuurdOp: string; herinnerOp: string;
};

/** Legt vast dat je over `dagen` dagen aan deze mail herinnerd wilt worden. */
export async function planOpvolging(o: {
  clientSlug: string; taak?: string; onderwerp?: string; naar?: string; url?: string; dagen: number;
}): Promise<void> {
  const dagen = Math.min(90, Math.max(1, Math.round(o.dagen || 0)));
  if (!o.clientSlug || !dagen) return;
  await ensure();
  const datum = new Date();
  datum.setDate(datum.getDate() + dagen);
  await sql`
    INSERT INTO mail_opvolg (client_slug, taak, onderwerp, naar, url, herinner_op)
    VALUES (${o.clientSlug}, ${(o.taak || "").slice(0, 300)}, ${(o.onderwerp || "").slice(0, 300)},
            ${(o.naar || "").slice(0, 200)}, ${o.url || null}, ${datum.toISOString().slice(0, 10)})`;
}

/**
 * Zet elke opvolging waarvan de dag geweest is om in een melding.
 * Wordt aangeroepen als de meldingen opgehaald worden, dus er is geen aparte
 * taak nodig die op de achtergrond moet draaien.
 */
export async function verwerkVervallenOpvolging(): Promise<number> {
  await ensure();
  const { rows } = await sql`
    SELECT o.id, o.client_slug, o.taak, o.onderwerp, o.naar, o.url, o.verstuurd_op, c.name AS klant
    FROM mail_opvolg o LEFT JOIN clients c ON c.slug = o.client_slug
    WHERE o.afgerond_op IS NULL AND o.herinner_op <= CURRENT_DATE
    ORDER BY o.herinner_op LIMIT 50`;
  for (const r of rows) {
    const dagen = Math.max(1, Math.round((Date.now() - new Date(r.verstuurd_op as string).getTime()) / 86400000));
    await meldingToevoegen({
      soort: "mail-opvolg",
      titel: `${(r.klant as string) || (r.client_slug as string)}: is er antwoord op je mail?`,
      regel: `${r.onderwerp || r.taak || "Mail"} — ${dagen} ${dagen === 1 ? "dag" : "dagen"} geleden verstuurd${r.naar ? ` naar ${r.naar}` : ""}. Check of er terugkoppeling is en of het ook echt gedaan is.`,
      link: `/admin/client/${r.client_slug}`,
      wie: (r.naar as string) || "",
      bron: "mail-opvolg",
      bronId: String(r.id),
    });
  }
  return rows.length;
}

/** Opvolging afronden: de melding hoeft niet meer terug te komen. */
export async function rondOpvolgingAf(id: number): Promise<void> {
  await ensure();
  await sql`UPDATE mail_opvolg SET afgerond_op = now() WHERE id = ${id} AND afgerond_op IS NULL`;
}

/** De openstaande opvolgingen van een klant, voor in de cockpit. */
export async function openOpvolging(clientSlug: string): Promise<Opvolging[]> {
  await ensure();
  const { rows } = await sql`
    SELECT id, client_slug, taak, onderwerp, naar, url, verstuurd_op, herinner_op
    FROM mail_opvolg WHERE client_slug = ${clientSlug} AND afgerond_op IS NULL
    ORDER BY herinner_op`;
  return rows.map((r) => ({
    id: Number(r.id), clientSlug: r.client_slug as string, taak: (r.taak as string) || "",
    onderwerp: (r.onderwerp as string) || "", naar: (r.naar as string) || "",
    url: (r.url as string) || null,
    verstuurdOp: new Date(r.verstuurd_op as string).toISOString(),
    herinnerOp: String(r.herinner_op).slice(0, 10),
  }));
}
