import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// EEN KLANT VERHUIZEN VAN DE ENE OMGEVING NAAR DE ANDERE
// ═══════════════════════════════════════════════════════════
// Waarvoor dit bestaat. De NOC-cockpit draaide als losse omgeving met een eigen
// database, en het werk dat daar staat (chats, taken, pagina's) hoort in het
// Pingwin-dashboard, tussen de andere klanten. Dit is de eenmalige verhuizing
// daarvan, en hij is niet aan NOC gebonden: elke klant kan zo van de ene
// omgeving naar de andere.
//
// WAAROM DIT GEEN HANDMATIGE LIJST IS. De vorige koppeling (de inlaaddeur voor
// de databrug) kende acht soorten gegevens, terwijl er vierenzeventig tabellen
// aan een klant hangen. Alles wat niet op zo'n lijst staat, verhuist niet, en
// niemand merkt dat totdat het gemist wordt. Daarom leest deze verhuizing zelf
// in de database welke tabellen een kolom `client_slug` hebben. Komt er morgen
// een tabel bij, dan gaat die vanzelf mee.
//
// WAT ER NIET MEEGAAT, en dat is bewust:
//  - het inlogwachtwoord van de klant (dat hoort bij de omgeving, niet bij de klant);
//  - bedragen, uren en facturatie (de ontvangende kant vult die zelf in of laat ze leeg);
//  - de eigen nummering van een rij. Elke rij krijgt aan de andere kant een nieuw
//    nummer, want anders botsen ze met rijen van andere klanten. Verwijzingen
//    tussen tabellen gaan hier niet over nummers maar over de klant en de URL,
//    op één na: een pagina-momentopname verwijst naar zijn vorige versie. Die
//    ketting valt na de verhuizing terug op "geen vorige versie".
// ═══════════════════════════════════════════════════════════

export type Telling = { tabel: string; rijen: number };
export type Pakket = { kolommen: string[]; rijen: unknown[][]; meer: boolean };

// De klantgegevens die wél meegaan: genoeg om de klantkaart aan de andere kant
// te laten ontstaan, zonder inlog en zonder bedragen.
export type KlantKaart = {
  slug: string;
  naam: string;
  domein: string;
  ahrefsProjectId: string;
  fase: string;
  seoProfiel: string;
};

// Alle tabellen die aan een klant hangen, rechtstreeks uit de database gelezen.
// Eén bron: de database zelf, geen lijst die kan verouderen.
export async function klantTabellen(): Promise<string[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'client_slug'
    ORDER BY table_name`;
  return rows.map((r) => String(r.table_name));
}

// Kolommen van een tabel, plus of ze een eigen ingevulde waarde hebben (zoals
// een oplopend nummer). Wordt aan beide kanten gebruikt: bij het ophalen om te
// weten wat er is, bij het inlezen om te weten wat er past.
async function kolommenVan(tabel: string): Promise<{ naam: string; soort: string; heeftDefault: boolean }[]> {
  const { rows } = await sql`
    SELECT column_name, column_default, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tabel}
    ORDER BY ordinal_position`;
  return rows.map((r) => ({
    naam: String(r.column_name),
    soort: String(r.data_type || ""),
    heeftDefault: r.column_default !== null,
  }));
}

// Bestaat deze tabel hier, en hangt hij aan een klant? Alles wat verderop een
// tabelnaam in een vraag zet, komt langs deze controle, zodat er nooit een naam
// van buiten in de SQL belandt.
async function bekendeTabel(tabel: string): Promise<boolean> {
  return (await klantTabellen()).includes(tabel);
}

// Hoeveel staat er van deze klant, per soort? Alleen wat gevuld is; een lijst
// met zestig keer "0 rijen" zegt niets.
export async function telling(slug: string): Promise<Telling[]> {
  const uit: Telling[] = [];
  for (const tabel of await klantTabellen()) {
    const { rows } = await sql.query(`SELECT count(*)::int AS n FROM "${tabel}" WHERE client_slug = $1`, [slug]);
    const n = Number(rows[0]?.n || 0);
    if (n > 0) uit.push({ tabel, rijen: n });
  }
  return uit;
}

// Eén hap uit één tabel. `ctid` is de fysieke plek van een rij en is daarmee de
// enige volgorde die élke tabel heeft, ook de tabellen zonder eigen nummer.
export async function pakket(slug: string, tabel: string, na: number, maat: number): Promise<Pakket> {
  if (!(await bekendeTabel(tabel))) return { kolommen: [], rijen: [], meer: false };
  const kolommen = (await kolommenVan(tabel)).map((k) => k.naam);
  const lijst = kolommen.map((k) => `"${k}"`).join(", ");
  const { rows } = await sql.query(
    `SELECT ${lijst} FROM "${tabel}" WHERE client_slug = $1 ORDER BY ctid LIMIT $2 OFFSET $3`,
    [slug, maat + 1, na],
  );
  const meer = rows.length > maat;
  const echte = meer ? rows.slice(0, maat) : rows;
  return { kolommen, rijen: echte.map((r) => kolommen.map((k) => (r as Record<string, unknown>)[k])), meer };
}

// De klantkaart zoals hij hier staat, voor zover hij meeverhuist.
export async function klantKaart(slug: string): Promise<KlantKaart | null> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT slug, name, domain, ahrefs_project_id, fase, seo_profile
    FROM clients WHERE slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    slug: String(r.slug),
    naam: String(r.name || ""),
    domein: String(r.domain || ""),
    ahrefsProjectId: String(r.ahrefs_project_id || ""),
    fase: String(r.fase || "klant"),
    seoProfiel: String(r.seo_profile || ""),
  };
}

// ── De ontvangende kant ─────────────────────────────────────

// Zorgt dat de klant hier bestaat. Bestaat hij al, dan blijft hij zoals hij is
// (een verhuizing die je twee keer draait, hoort de tweede keer niets kapot te
// maken). Nieuw: zonder inlog en met alle bedragen op nul, want een verhuisde
// eigen tak is geen betalende klant met een budget.
export async function zorgVoorKlant(kaart: KlantKaart): Promise<"nieuw" | "bestond"> {
  await ensureSchema();
  const bestaat = await sql`SELECT 1 FROM clients WHERE slug = ${kaart.slug} LIMIT 1`;
  if (bestaat.rows.length > 0) return "bestond";
  await sql`
    INSERT INTO clients (slug, login_id, name, email, sheet_id, gid, password_hash, fase, login_enabled,
                         domain, ahrefs_project_id, seo_profile)
    VALUES (${kaart.slug}, ${kaart.slug}, ${kaart.naam || kaart.slug}, NULL, '', '0', '', ${kaart.fase || "klant"}, false,
            ${kaart.domein || null}, ${kaart.ahrefsProjectId || null}, ${kaart.seoProfiel || ""})
    ON CONFLICT (slug) DO NOTHING`;
  return "nieuw";
}

// Eén hap wegschrijven. `vervang` geldt voor de eerste hap van een tabel: dan
// gaat weg wat er van deze klant al stond. Zo levert twee keer verhuizen niet
// twee keer dezelfde taak op.
export async function inlaad(
  slug: string,
  tabel: string,
  kolommen: string[],
  rijen: unknown[][],
  vervang: boolean,
): Promise<number> {
  if (!(await bekendeTabel(tabel))) return 0;
  const hier = await kolommenVan(tabel);
  const namen = new Map(hier.map((k) => [k.naam, k]));

  // Alleen kolommen die hier óók bestaan, en nooit de eigen nummering.
  const bruikbaar = kolommen
    .map((naam, i) => ({ naam, i }))
    .filter(({ naam }) => namen.has(naam))
    .filter(({ naam }) => !(naam === "id" && namen.get(naam)!.heeftDefault));
  if (bruikbaar.length === 0) return 0;

  if (vervang) {
    await sql.query(`DELETE FROM "${tabel}" WHERE client_slug = $1`, [slug]);
  }
  if (rijen.length === 0) return 0;

  const kolomLijst = bruikbaar.map(({ naam }) => `"${naam}"`).join(", ");
  const waarden: unknown[] = [];
  const stukken: string[] = [];
  for (const rij of rijen) {
    const plekken = bruikbaar.map(({ naam, i }) => {
      // De klant staat vast: wat er ook in het pakket zit, hier hoort deze klant.
      waarden.push(naam === "client_slug" ? slug : klaarVoorDatabase(rij[i], namen.get(naam)!.soort));
      return `$${waarden.length}`;
    });
    stukken.push(`(${plekken.join(", ")})`);
  }
  await sql.query(`INSERT INTO "${tabel}" (${kolomLijst}) VALUES ${stukken.join(", ")}`, waarden);
  return rijen.length;
}

// Onderweg is alles JSON geweest, dus een JSON-kolom en een lijstkolom zien er
// daarna hetzelfde uit: allebei een lijst. Raden welke van de twee het is gaat
// een keer mis (een JSON-kolom met alleen tekst erin ziet eruit als een lijst),
// dus we kijken naar wat de kolom hier ís, niet naar hoe de waarde eruitziet.
export function klaarVoorDatabase(waarde: unknown, soort: string): unknown {
  if (waarde === null || waarde === undefined) return null;
  if (soort === "jsonb" || soort === "json") return JSON.stringify(waarde);
  if (soort === "ARRAY") return Array.isArray(waarde) ? waarde : [waarde];
  if (typeof waarde === "object") return JSON.stringify(waarde);
  return waarde;
}
