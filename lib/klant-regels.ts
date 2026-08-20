import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// MEER DAN ÉÉN REGEL PER KLANT OF LEAD
// ═══════════════════════════════════════════════════════════
// Bij één bedrijf lopen vaak meerdere dingen tegelijk: de SEO per maand, een
// website die eenmalig gebouwd wordt, en advertenties met een eigen fee en eigen
// kosten. Dat paste niet in één rij: er was één maandbedrag en één kostenpost,
// dus alles werd op één hoop gegooid en je kon later niet meer zien waar het
// geld vandaan kwam.
//
// Daarom kan elk bedrijf extra regels hebben. De klantrij zelf blijft wat hij
// was (de SEO-fee en de kosten die daaraan vasthangen); een extra regel is een
// eigen stukje omzet met een eigen naam, eigen kosten en een eigen soort.
//
// TWEE REGELS DIE DIT EERLIJK HOUDEN
// ──────────────────────────────────
//  - EEN EXTRA REGEL HOORT BIJ ÉÉN BEDRIJF en erft zijn levensfase: hangt hij
//    aan een lead, dan telt hij mee met de kans van die lead; hangt hij aan een
//    klant, dan telt hij voor honderd procent mee. Wil je voor dit ene stukje
//    een andere kans (de website gaat wél door, de SEO nog niet zeker), zet dan
//    een eigen kans op de regel.
//  - DE PROGNOSE REKENT ERMEE, dus wat je hier neerzet komt meteen terug in de
//    maandstrook en op /admin/financien. Er wordt nergens een tweede optelling
//    gemaakt; zie lib/prognose.ts.
// ═══════════════════════════════════════════════════════════

/** Waar dit stukje omzet onder valt. Stuurt de uitsplitsing in de maandstrook. */
export type RegelSoort = "seo" | "ads" | "website" | "overig";

export const REGEL_SOORTEN: { waarde: RegelSoort; label: string }[] = [
  { waarde: "seo", label: "SEO" },
  { waarde: "ads", label: "Advertenties" },
  { waarde: "website", label: "Website" },
  { waarde: "overig", label: "Overig" },
];

export type KlantRegel = {
  id: number;
  clientSlug: string;
  naam: string;
  soort: RegelSoort;
  /** Per maand, zolang het loopt. */
  bedrag: number;
  kosten: number;
  /** Eén keer, in de startmaand. */
  eenmaligOmzet: number;
  eenmaligKosten: number;
  /** Leeg = vanaf nu. */
  startMaand: string | null;
  /** Leeg = de kans van het bedrijf zelf. */
  kans: number | null;
  /** Wanneer je hierover weer contact hebt. Mag anders zijn dan bij de rij erboven. */
  opvolgDatum: string | null;
};

type Rij = {
  id: number; client_slug: string; naam: string; soort: string;
  bedrag: string | number; kosten: string | number;
  eenmalig_omzet: string | number; eenmalig_kosten: string | number;
  start_maand: string | null; kans: number | null; opvolg_datum: string | null;
};

const SCHEMA_VERSIE = "klant-regel-a28a4ce5";

function ensureTable(): Promise<void> {
  return eenmalig("klant-regel", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS klant_regel (
      id              SERIAL PRIMARY KEY,
      client_slug     TEXT NOT NULL,
      naam            TEXT NOT NULL DEFAULT '',
      soort           TEXT NOT NULL DEFAULT 'overig',
      bedrag          NUMERIC NOT NULL DEFAULT 0,
      kosten          NUMERIC NOT NULL DEFAULT 0,
      eenmalig_omzet  NUMERIC NOT NULL DEFAULT 0,
      eenmalig_kosten NUMERIC NOT NULL DEFAULT 0,
      start_maand     TEXT,
      kans            INTEGER,
      opvolg_datum    DATE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ix_klant_regel_slug ON klant_regel (client_slug)`;
}

function naarRegel(r: Rij): KlantRegel {
  const soort = (["seo", "ads", "website", "overig"] as const).includes(r.soort as RegelSoort)
    ? (r.soort as RegelSoort) : "overig";
  return {
    id: r.id,
    clientSlug: r.client_slug,
    naam: r.naam || "",
    soort,
    bedrag: Number(r.bedrag) || 0,
    kosten: Number(r.kosten) || 0,
    eenmaligOmzet: Number(r.eenmalig_omzet) || 0,
    eenmaligKosten: Number(r.eenmalig_kosten) || 0,
    startMaand: r.start_maand || null,
    kans: r.kans === null || r.kans === undefined ? null : Math.min(100, Math.max(0, Number(r.kans))),
    opvolgDatum: r.opvolg_datum ? String(r.opvolg_datum).slice(0, 10) : null,
  };
}

/** Alle extra regels, oudste eerst. */
export async function listKlantRegels(): Promise<KlantRegel[]> {
  await ensureTable();
  const { rows } = await sql<Rij>`
    SELECT id, client_slug, naam, soort, bedrag, kosten, eenmalig_omzet, eenmalig_kosten, start_maand, kans, opvolg_datum
    FROM klant_regel ORDER BY client_slug, id`;
  return rows.map(naarRegel);
}

/** Een nieuwe regel bij een bedrijf. Leeg, want de bedragen typ je zelf. */
export async function addKlantRegel(slug: string, naam = "", soort: RegelSoort = "overig"): Promise<KlantRegel> {
  await ensureTable();
  const { rows } = await sql<Rij>`
    INSERT INTO klant_regel (client_slug, naam, soort)
    VALUES (${slug}, ${naam}, ${soort})
    RETURNING id, client_slug, naam, soort, bedrag, kosten, eenmalig_omzet, eenmalig_kosten, start_maand, kans, opvolg_datum`;
  return naarRegel(rows[0]);
}

/** Eén veld (of een paar) van een regel bijwerken. Wat je niet meestuurt blijft. */
export async function saveKlantRegel(id: number, p: Partial<Omit<KlantRegel, "id" | "clientSlug">>): Promise<void> {
  await ensureTable();
  const { rows } = await sql<Rij>`
    SELECT id, client_slug, naam, soort, bedrag, kosten, eenmalig_omzet, eenmalig_kosten, start_maand, kans, opvolg_datum
    FROM klant_regel WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return;
  const h = naarRegel(rows[0]);
  const getal = (v: number | undefined, terugval: number) =>
    v === undefined ? terugval : Math.max(0, Math.round(Number(v) || 0));
  const maand = p.startMaand === undefined
    ? h.startMaand
    : (/^\d{4}-\d{2}$/.test(String(p.startMaand || "")) ? p.startMaand : null);
  const kans = p.kans === undefined
    ? h.kans
    : (p.kans === null ? null : Math.min(100, Math.max(0, Math.round(Number(p.kans) || 0))));
  await sql`
    UPDATE klant_regel SET
      naam            = ${p.naam === undefined ? h.naam : String(p.naam).slice(0, 80)},
      soort           = ${p.soort === undefined ? h.soort : p.soort},
      bedrag          = ${getal(p.bedrag, h.bedrag)},
      kosten          = ${getal(p.kosten, h.kosten)},
      eenmalig_omzet  = ${getal(p.eenmaligOmzet, h.eenmaligOmzet)},
      eenmalig_kosten = ${getal(p.eenmaligKosten, h.eenmaligKosten)},
      start_maand     = ${maand},
      kans            = ${kans},
      opvolg_datum    = ${p.opvolgDatum === undefined ? h.opvolgDatum : (/^\d{4}-\d{2}-\d{2}$/.test(String(p.opvolgDatum || "")) ? p.opvolgDatum : null)}
    WHERE id = ${id}`;
}

export async function deleteKlantRegel(id: number): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM klant_regel WHERE id = ${id}`;
}

/** Gaat een bedrijf weg, dan gaan zijn extra regels mee. */
export async function verwijderRegelsVanKlant(slug: string): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM klant_regel WHERE client_slug = ${slug}`;
}
