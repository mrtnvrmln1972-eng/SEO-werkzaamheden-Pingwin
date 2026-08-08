import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// GELEERDE REGELS: CORRECTIES DIE IN ÉLKE MOTOR BLIJVEN GELDEN
// ═══════════════════════════════════════════════════════════
// Dit is de algemene vorm van wat bij opruimen (lib/opruim-regels.ts) al werkte:
// corrigeert Maarten een AI-voorstel, dan onthoudt het dashboard dat, en de
// volgende ronde krijgt die correctie mee als harde regel. Waar opruim-regels.ts
// alleen redirect-besluiten kent (van/naar), is dit de algemene vorm voor élke
// motor: een klant, een motor (welk onderdeel), een sleutel (wat er precies
// gecorrigeerd is) en wat er voortaan geldt.
//
// Vandaag gevuld door de meta-motor (lib/meta-ctr.ts): keurt Maarten een
// meta-titel of -beschrijving goed of af, dan komt hier een regel bij, en de
// eerstvolgende keer dat er voor die pagina een nieuwe meta geschreven wordt,
// krijgt de AI die regel als harde instructie mee (geleerdeRegelsAlsInstructie).
// Interne links en de prioriteitenscan kunnen dezelfde tabel gebruiken zodra zij
// zelf een correctie-actie krijgen; dat bestaat daar nog niet (zie routekaart R8).
// Opruimen blijft voorlopig zijn eigen, bewezen tabel gebruiken (client_opruim_regels);
// die twee samenvoegen is toekomstig werk, geen onderdeel van deze stap.
// ═══════════════════════════════════════════════════════════

export type Motor = "meta" | "interne_links" | "prioriteiten" | "opruim";

export type GeleerdeRegel = {
  motor: Motor;
  sleutel: string;
  label: string;
  watGold: string;
  waarom: string;
  actief: boolean;
  updatedAt: string;
};

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) ready = doEnsure().catch((e) => { ready = null; throw e; });
  return ready;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_geleerde_regels (
      id SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      motor       TEXT NOT NULL,
      sleutel     TEXT NOT NULL,
      label       TEXT NOT NULL DEFAULT '',
      wat_gold    TEXT NOT NULL DEFAULT '',
      waarom      TEXT NOT NULL DEFAULT '',
      actief      BOOLEAN NOT NULL DEFAULT true,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (client_slug, motor, sleutel)
    )`;
}

/**
 * Legt een correctie vast (of werkt hem bij als hij al bestond). Bestond de
 * regel al maar stond hij uit, dan gaat hij door deze aanroep weer aan: een
 * nieuwe correctie op dezelfde plek betekent dat hij er weer toe doet.
 */
export async function voegGeleerdeRegelToe(
  slug: string, motor: Motor, sleutel: string, label: string, watGold: string, waarom = "",
): Promise<void> {
  await ensureSchema();
  await ensureTable();
  if (!slug || !motor || !sleutel || !watGold) return;
  await sql`
    INSERT INTO client_geleerde_regels (client_slug, motor, sleutel, label, wat_gold, waarom, actief, updated_at)
    VALUES (${slug}, ${motor}, ${sleutel}, ${label.slice(0, 300)}, ${watGold.slice(0, 600)}, ${waarom.slice(0, 600)}, true, now())
    ON CONFLICT (client_slug, motor, sleutel) DO UPDATE SET
      label = EXCLUDED.label,
      wat_gold = EXCLUDED.wat_gold,
      waarom = COALESCE(NULLIF(EXCLUDED.waarom, ''), client_geleerde_regels.waarom),
      actief = true,
      updated_at = now()`;
}

export async function haalGeleerdeRegels(slug: string, motor?: Motor): Promise<GeleerdeRegel[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = motor
    ? await sql`SELECT motor, sleutel, label, wat_gold, waarom, actief, updated_at FROM client_geleerde_regels WHERE client_slug = ${slug} AND motor = ${motor} ORDER BY updated_at DESC`
    : await sql`SELECT motor, sleutel, label, wat_gold, waarom, actief, updated_at FROM client_geleerde_regels WHERE client_slug = ${slug} ORDER BY updated_at DESC`;
  return rows.map((r) => ({
    motor: r.motor as Motor,
    sleutel: r.sleutel as string,
    label: (r.label as string) || "",
    watGold: (r.wat_gold as string) || "",
    waarom: (r.waarom as string) || "",
    actief: !!r.actief,
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : "",
  }));
}

/** Een regel uitzetten (terugdraaien) of weer aanzetten, en/of de reden bijwerken. */
export async function zetGeleerdeRegel(
  slug: string, motor: Motor, sleutel: string, patch: { actief?: boolean; waarom?: string },
): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const actief = patch.actief === undefined ? null : patch.actief;
  const waarom = patch.waarom === undefined ? null : patch.waarom.slice(0, 600);
  await sql`
    UPDATE client_geleerde_regels SET
      actief = COALESCE(${actief}, actief),
      waarom = COALESCE(${waarom}, waarom),
      updated_at = now()
    WHERE client_slug = ${slug} AND motor = ${motor} AND sleutel = ${sleutel}`;
}

/**
 * De actieve regels van deze klant en motor, als harde instructie voor de AI.
 * Zelfde vorm als regelsAlsInstructie() in lib/opruim-regels.ts: leeg als er
 * niets is, anders een blok dat vóór de eigen analyse van het model gaat.
 */
export async function geleerdeRegelsAlsInstructie(slug: string, motor: Motor): Promise<string> {
  const regels = (await haalGeleerdeRegels(slug, motor).catch(() => [])).filter((r) => r.actief);
  if (!regels.length) return "";
  return [
    "EERDERE CORRECTIES VAN MAARTEN. Dit zijn HARDE regels; ze overrulen je eigen aanpak zonder discussie.",
    ...regels.map((r) => `- ${r.label}: ${r.watGold}${r.waarom ? ` (reden: ${r.waarom})` : ""}`),
  ].join("\n");
}
