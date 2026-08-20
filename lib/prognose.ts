import { sql, ensureSchema } from "./db";
import { LEAD_STANDAARD_KANS } from "./prognose-kans";
import { eenmalig } from "./schema-stand";
import { getSetting, setSetting } from "./settings";
import { listKostenregels, pasKostenmodelToe, type KostenRegel } from "./kostenmodel";

// ═══════════════════════════════════════════════════════════
// PROGNOSE: WAT VERDIENEN WE DE KOMENDE MAANDEN
// ═══════════════════════════════════════════════════════════
// Eén vraag, maand voor maand beantwoord: wat houden we netto over, en wanneer
// staan we op het doelbedrag. Drie soorten geld komen samen:
//
//   1. LOPENDE KLANTEN. Wat er elke maand binnenkomt, min de kosten die daar
//      recht tegenover staan (linkbuilding, content, een freelancer).
//   2. LEADS. Hetzelfde, maar vermenigvuldigd met de kans dat het doorgaat.
//      Een lead van 1.500 met 40% telt dus voor 600 mee. Zo blijft de lijn
//      eerlijk: hij belooft niet wat nog niet getekend is, en hij negeert het
//      ook niet.
//   3. LOSSE POSTEN. Eenmalig of terugkerend, los van een klant: een website
//      die in oktober wordt opgeleverd, een tool die per januari duurder wordt.
//
// TWEE REGELS DIE DIT EERLIJK HOUDEN
// ──────────────────────────────────
//  - HET BEDRAG STAAT MAAR OP ÉÉN PLEK. Het maandbedrag en de linkbuildingkosten
//    van een klant of lead staan in de klantrij zelf (maandbudget/linkbuilding),
//    precies waar de rest van het dashboard ze ook leest. Deze module bewaart
//    alleen wat er níet stond: de kans, vanaf welke maand het meetelt, tot
//    wanneer, en eventuele extra maandkosten. Anders lopen twee bedragen uit
//    elkaar zonder dat iemand het merkt, en dat is hier de vaste les.
//  - NIETS WORDT GERADEN. Een lead zonder maandbedrag telt voor nul mee en wordt
//    op het scherm als "nog geen bedrag" gemeld, niet stilletjes geschat.
// ═══════════════════════════════════════════════════════════

export type PrognoseSoort = "omzet" | "kosten";

/** Een maand als "JJJJ-MM". Overal in dit bestand de enige vorm. */
export type Maand = string;

export function maandNu(): Maand {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function maandPlus(m: Maand, n: number): Maand {
  const [j, mm] = m.split("-").map(Number);
  const d = new Date(j, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function maandLabel(m: Maand): string {
  const [j, mm] = m.split("-");
  return `${MAAND_KORT[Number(mm) - 1] || mm} ${j.slice(2)}`;
}

/** Maakt van losse invoer een geldige "JJJJ-MM", of leeg als het niets is. */
export function normMaand(v: string | null | undefined): Maand | null {
  const t = String(v || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-?(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  return `${m[1]}-${m[2]}`;
}

// ── Opslag ──────────────────────────────────────────────────

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "prognose-60cf3123";

function ensureTable(): Promise<void> {
  return eenmalig("prognose", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  // Per klant of lead: alleen wat de klantrij zelf niet weet.
  await sql`
    CREATE TABLE IF NOT EXISTS prognose_regel (
      client_slug  TEXT PRIMARY KEY,
      kans         INTEGER NOT NULL DEFAULT 100,
      start_maand  TEXT,
      eind_maand   TEXT,
      extra_kosten NUMERIC NOT NULL DEFAULT 0,
      opmerking    TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Wie deze regel gezet heeft: "handmatig" (Maarten) of de naam van een
  // koppeling ("hubspot"). Leeg telt als handmatig, zodat alles wat er vóór deze
  // kolom al stond met rust gelaten wordt. Een koppeling overschrijft nooit een
  // handmatige waarde; zie saveRegelUitBron().
  await sql`ALTER TABLE prognose_regel ADD COLUMN IF NOT EXISTS bron TEXT`;
  // Wat er naast de SEO-fee aan een klant of lead hangt. Bewust vier losse
  // velden en niet één opgeteld bedrag: advertenties, de kosten die eraan
  // vastzitten en een eenmalige website zijn verschillende dingen, en zodra je
  // ze optelt kun je op het scherm niet meer laten zien waar een getal vandaan
  // komt. Het maandbedrag voor SEO blijft in de klantrij staan, waar de rest van
  // het dashboard hem ook leest.
  await sql`ALTER TABLE prognose_regel ADD COLUMN IF NOT EXISTS extra_omzet NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE prognose_regel ADD COLUMN IF NOT EXISTS eenmalig_omzet NUMERIC NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE prognose_regel ADD COLUMN IF NOT EXISTS eenmalig_kosten NUMERIC NOT NULL DEFAULT 0`;
  // Losse posten die niet aan een klant hangen (een website, een abonnement).
  await sql`
    CREATE TABLE IF NOT EXISTS prognose_post (
      id          SERIAL PRIMARY KEY,
      naam        TEXT NOT NULL,
      soort       TEXT NOT NULL DEFAULT 'omzet',
      maand       TEXT NOT NULL,
      bedrag      NUMERIC NOT NULL DEFAULT 0,
      kans        INTEGER NOT NULL DEFAULT 100,
      herhaalt    BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

// ── Instellingen (doel en vaste lasten) ─────────────────────

export const SETTING_TARGET = "prognose_target";
export const SETTING_TARGET_OP = "prognose_target_op";
export const SETTING_VASTE_LASTEN = "prognose_vaste_lasten";
export const SETTING_HORIZON = "prognose_horizon";

export type PrognoseInstelling = {
  /** Het doelbedrag per maand. */
  target: number;
  /** Meet het doel op de omzet of op wat er netto overblijft. */
  targetOp: "netto" | "omzet";
  /** Eigen vaste lasten per maand die niet aan een klant hangen. */
  vasteLasten: number;
  /** Hoeveel maanden vooruit de tabel loopt. */
  horizon: number;
};

const STANDAARD: PrognoseInstelling = { target: 30000, targetOp: "netto", vasteLasten: 0, horizon: 12 };

export async function getPrognoseInstelling(): Promise<PrognoseInstelling> {
  const [t, op, vl, hz] = await Promise.all([
    getSetting(SETTING_TARGET),
    getSetting(SETTING_TARGET_OP),
    getSetting(SETTING_VASTE_LASTEN),
    getSetting(SETTING_HORIZON),
  ]);
  const num = (v: string | null, standaard: number) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : standaard;
  };
  return {
    target: num(t, STANDAARD.target),
    targetOp: op === "omzet" ? "omzet" : "netto",
    vasteLasten: num(vl, STANDAARD.vasteLasten),
    horizon: Math.min(36, Math.max(3, Math.round(num(hz, STANDAARD.horizon)))),
  };
}

export async function savePrognoseInstelling(p: Partial<PrognoseInstelling>): Promise<void> {
  const taken: Promise<void>[] = [];
  if (p.target !== undefined) taken.push(setSetting(SETTING_TARGET, String(Math.max(0, Math.round(p.target)))));
  if (p.targetOp !== undefined) taken.push(setSetting(SETTING_TARGET_OP, p.targetOp === "omzet" ? "omzet" : "netto"));
  if (p.vasteLasten !== undefined) taken.push(setSetting(SETTING_VASTE_LASTEN, String(Math.max(0, Math.round(p.vasteLasten)))));
  if (p.horizon !== undefined) taken.push(setSetting(SETTING_HORIZON, String(Math.min(36, Math.max(3, Math.round(p.horizon))))));
  await Promise.all(taken);
}

// ── Regels per klant/lead ───────────────────────────────────

export type RegelExtra = {
  kans: number;
  startMaand: Maand | null;
  eindMaand: Maand | null;
  extraKosten: number;
  opmerking: string;
  /** Andere maandomzet dan SEO, bijvoorbeeld de fee voor advertenties. */
  extraOmzet: number;
  /** Een eenmalig bedrag (een website), in de maand dat het traject start. */
  eenmaligOmzet: number;
  /** De kosten die aan dat eenmalige bedrag vastzitten. */
  eenmaligKosten: number;
};

type RegelRow = {
  client_slug: string; kans: number; start_maand: string | null;
  eind_maand: string | null; extra_kosten: string | number; opmerking: string | null;
  extra_omzet: string | number; eenmalig_omzet: string | number; eenmalig_kosten: string | number;
};

// De standaardkans van een onbeoordeelde lead staat in lib/prognose-kans.ts,
// want de leadlijst in de browser rekent er ook mee en die kan dit bestand niet
// laden (Postgres-client). Hier alleen doorgeven, zodat er één getal blijft.
export { LEAD_STANDAARD_KANS };

/** Alle prognose-regels ineens, per slug. Voor een lijst met veel leads. */
export async function getRegelsPerSlug(): Promise<Record<string, RegelExtra>> {
  const map = await getRegelExtras();
  const uit: Record<string, RegelExtra> = {};
  for (const [slug, r] of map) uit[slug] = r;
  return uit;
}

async function getRegelExtras(): Promise<Map<string, RegelExtra>> {
  await ensureTable();
  const { rows } = await sql<RegelRow>`
    SELECT client_slug, kans, start_maand, eind_maand, extra_kosten, opmerking,
           extra_omzet, eenmalig_omzet, eenmalig_kosten FROM prognose_regel`;
  const map = new Map<string, RegelExtra>();
  for (const r of rows) {
    map.set(r.client_slug, {
      kans: Math.min(100, Math.max(0, Number(r.kans))),
      startMaand: normMaand(r.start_maand),
      eindMaand: normMaand(r.eind_maand),
      extraKosten: Number(r.extra_kosten) || 0,
      opmerking: r.opmerking || "",
      extraOmzet: Number(r.extra_omzet) || 0,
      eenmaligOmzet: Number(r.eenmalig_omzet) || 0,
      eenmaligKosten: Number(r.eenmalig_kosten) || 0,
    });
  }
  return map;
}

/** De prognose-regel van één klant of lead (kans, startmaand), of null. */
export async function getRegelExtra(slug: string): Promise<RegelExtra | null> {
  return (await getRegelExtras()).get(slug) || null;
}

export async function saveRegelExtra(slug: string, p: Partial<RegelExtra>): Promise<void> {
  await ensureTable();
  const huidig = (await getRegelExtras()).get(slug);
  const n: RegelExtra = {
    kans: p.kans !== undefined ? Math.min(100, Math.max(0, Math.round(p.kans))) : huidig?.kans ?? 100,
    startMaand: p.startMaand !== undefined ? normMaand(p.startMaand) : huidig?.startMaand ?? null,
    eindMaand: p.eindMaand !== undefined ? normMaand(p.eindMaand) : huidig?.eindMaand ?? null,
    extraKosten: p.extraKosten !== undefined ? Math.max(0, p.extraKosten) : huidig?.extraKosten ?? 0,
    opmerking: p.opmerking !== undefined ? String(p.opmerking).slice(0, 500) : huidig?.opmerking ?? "",
    extraOmzet: p.extraOmzet !== undefined ? Math.max(0, p.extraOmzet) : huidig?.extraOmzet ?? 0,
    eenmaligOmzet: p.eenmaligOmzet !== undefined ? Math.max(0, p.eenmaligOmzet) : huidig?.eenmaligOmzet ?? 0,
    eenmaligKosten: p.eenmaligKosten !== undefined ? Math.max(0, p.eenmaligKosten) : huidig?.eenmaligKosten ?? 0,
  };
  await sql`
    INSERT INTO prognose_regel (client_slug, kans, start_maand, eind_maand, extra_kosten, opmerking,
                                extra_omzet, eenmalig_omzet, eenmalig_kosten, bron, updated_at)
    VALUES (${slug}, ${n.kans}, ${n.startMaand}, ${n.eindMaand}, ${n.extraKosten}, ${n.opmerking || null},
            ${n.extraOmzet}, ${n.eenmaligOmzet}, ${n.eenmaligKosten}, 'handmatig', now())
    ON CONFLICT (client_slug) DO UPDATE SET
      kans = ${n.kans}, start_maand = ${n.startMaand}, eind_maand = ${n.eindMaand},
      extra_kosten = ${n.extraKosten}, opmerking = ${n.opmerking || null},
      extra_omzet = ${n.extraOmzet}, eenmalig_omzet = ${n.eenmaligOmzet}, eenmalig_kosten = ${n.eenmaligKosten},
      bron = 'handmatig', updated_at = now()`;
}

/**
 * Kans en startmaand die uit een koppeling komen (vandaag: HubSpot).
 *
 * De regel is kort: WAT MAARTEN ZELF ZET, BLIJFT STAAN. Bestaat er al een regel
 * die niet door dezelfde koppeling geschreven is, dan raakt deze functie hem
 * niet aan. Zo kan een ronde van elk kwartier nooit een oordeel overschrijven,
 * en hoeft niemand te onthouden welk getal "van hem" was.
 */
export async function saveRegelUitBron(
  slug: string,
  p: { kans?: number | null; startMaand?: string | null; extraKosten?: number | null },
  bron = "hubspot",
): Promise<boolean> {
  await ensureTable();
  const { rows } = await sql<{ bron: string | null }>`
    SELECT bron FROM prognose_regel WHERE client_slug = ${slug} LIMIT 1`;
  if (rows.length && (rows[0].bron || "handmatig") !== bron) return false;

  const kans = p.kans === null || p.kans === undefined ? null : Math.min(100, Math.max(0, Math.round(p.kans)));
  const maand = normMaand(p.startMaand ?? null);
  const kosten = p.extraKosten === null || p.extraKosten === undefined ? null : Math.max(0, Math.round(p.extraKosten));
  if (kans === null && maand === null && kosten === null) return false;

  const huidig = rows.length ? (await getRegelExtras()).get(slug) : undefined;
  const nieuweKans = kans ?? huidig?.kans ?? 100;
  const nieuweMaand = maand ?? huidig?.startMaand ?? null;
  const nieuweKosten = kosten ?? huidig?.extraKosten ?? 0;
  await sql`
    INSERT INTO prognose_regel (client_slug, kans, start_maand, extra_kosten, bron, updated_at)
    VALUES (${slug}, ${nieuweKans}, ${nieuweMaand}, ${nieuweKosten}, ${bron}, now())
    ON CONFLICT (client_slug) DO UPDATE SET
      kans = ${nieuweKans}, start_maand = ${nieuweMaand}, extra_kosten = ${nieuweKosten},
      bron = ${bron}, updated_at = now()`;
  return true;
}

/**
 * Haalt een losse post weg op zijn naam. Gebruikt door de HubSpot-ronde: staat er
 * geen bedrag meer voor de advertentie-fee of de eenmalige post, dan hoort die
 * regel ook uit de prognose te verdwijnen in plaats van als oude waarheid te
 * blijven staan.
 */
export async function verwijderPostOpNaam(naam: string): Promise<void> {
  await ensureTable();
  const schoon = String(naam || "").trim().slice(0, 120);
  if (!schoon) return;
  await sql`DELETE FROM prognose_post WHERE naam = ${schoon}`;
}

/** Wie de prognoseregel van deze klant gezet heeft: "handmatig" of "hubspot". */
export async function getRegelBron(slug: string): Promise<string> {
  await ensureTable();
  const { rows } = await sql<{ bron: string | null }>`
    SELECT bron FROM prognose_regel WHERE client_slug = ${slug} LIMIT 1`;
  return rows.length ? (rows[0].bron || "handmatig") : "";
}

// ── Losse posten ────────────────────────────────────────────

export type Post = {
  id: number;
  naam: string;
  soort: PrognoseSoort;
  maand: Maand;
  bedrag: number;
  kans: number;
  herhaalt: boolean;
};

type PostRow = { id: number; naam: string; soort: string; maand: string; bedrag: string | number; kans: number; herhaalt: boolean };

export async function listPosten(): Promise<Post[]> {
  await ensureTable();
  const { rows } = await sql<PostRow>`
    SELECT id, naam, soort, maand, bedrag, kans, herhaalt FROM prognose_post ORDER BY maand, id`;
  return rows.map((r) => ({
    id: r.id,
    naam: r.naam,
    soort: r.soort === "kosten" ? "kosten" : "omzet",
    maand: normMaand(r.maand) || maandNu(),
    bedrag: Number(r.bedrag) || 0,
    kans: Math.min(100, Math.max(0, Number(r.kans))),
    herhaalt: !!r.herhaalt,
  }));
}

export async function addPost(p: { naam: string; soort?: string; maand?: string; bedrag?: number; kans?: number; herhaalt?: boolean }): Promise<Post> {
  await ensureTable();
  const naam = String(p.naam || "").trim().slice(0, 120);
  if (!naam) throw new Error("Geef de post een naam.");
  const { rows } = await sql<PostRow>`
    INSERT INTO prognose_post (naam, soort, maand, bedrag, kans, herhaalt)
    VALUES (${naam}, ${p.soort === "kosten" ? "kosten" : "omzet"}, ${normMaand(p.maand) || maandNu()},
            ${Math.max(0, Number(p.bedrag) || 0)}, ${Math.min(100, Math.max(0, Math.round(Number(p.kans) ?? 100)))},
            ${!!p.herhaalt})
    RETURNING id, naam, soort, maand, bedrag, kans, herhaalt`;
  const r = rows[0];
  return { id: r.id, naam: r.naam, soort: r.soort === "kosten" ? "kosten" : "omzet", maand: r.maand, bedrag: Number(r.bedrag), kans: r.kans, herhaalt: !!r.herhaalt };
}

/**
 * Zet een post neer die maar één keer mag bestaan, herkenbaar aan zijn naam.
 * Gebruikt door het vullen uit de boekhouding: twee keer op dezelfde knop
 * drukken hoort de post bij te werken, niet te verdubbelen.
 */
export async function vervangPost(naam: string, p: { soort?: string; maand?: string; bedrag?: number; kans?: number; herhaalt?: boolean }): Promise<Post> {
  await ensureTable();
  const schoon = String(naam || "").trim().slice(0, 120);
  if (!schoon) throw new Error("Geef de post een naam.");
  await sql`DELETE FROM prognose_post WHERE naam = ${schoon}`;
  return addPost({ naam: schoon, ...p });
}

export async function deletePost(id: number): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await sql`DELETE FROM prognose_post WHERE id = ${id}`;
  return !!rowCount && rowCount > 0;
}

// ── De berekening ───────────────────────────────────────────

/** Eén klant of lead, met alles wat de prognose van hem gebruikt. */
export type PrognoseRegel = {
  slug: string;
  naam: string;
  fase: string;
  /** Wat er per maand binnenkomt. */
  bedrag: number;
  /** Linkbuilding per maand (staat in de klantrij). */
  linkbuilding: number;
  /** Overige maandkosten die aan deze klant hangen. */
  extraKosten: number;
  /** Andere maandomzet dan SEO (advertenties). */
  extraOmzet: number;
  /** Een eenmalig bedrag plus de kosten daarvan, in de startmaand. */
  eenmaligOmzet: number;
  eenmaligKosten: number;
  kans: number;
  startMaand: Maand | null;
  eindMaand: Maand | null;
  opmerking: string;
  /** Waarschuwing voor op het scherm, bijvoorbeeld een lead zonder bedrag. */
  gat: string;
  /**
   * Kosten die uit het kostenmodel komen (een percentage van de omzet, of een
   * deel van een leveranciersfactuur). Staat hier iets in, dan is dát de
   * kostenkant van deze klant en telt zijn eigen linkbuildingbedrag NIET mee.
   * Anders zou je dubbel tellen, en dat is precies het soort fout dat er
   * plausibel uitziet.
   */
  modelKosten: { naam: string; bedrag: number }[];
};

/** Wat één regel in één maand bijdraagt. */
export type Bijdrage = {
  slug: string;
  naam: string;
  soort: "klant" | "lead" | "post";
  kans: number;
  omzet: number;      // al gewogen met de kans
  kosten: number;     // al gewogen met de kans
  netto: number;
  bruto: number;      // omzet zonder weging, om te tonen wat het wordt als het doorgaat
};

export type MaandUitkomst = {
  maand: Maand;
  label: string;
  /** Van klanten die al lopen. */
  zekerOmzet: number;
  zekerKosten: number;
  /** Van leads, al vermenigvuldigd met de kans. */
  verwachtOmzet: number;
  verwachtKosten: number;
  /** Losse posten, gewogen. */
  postOmzet: number;
  postKosten: number;
  vasteLasten: number;
  /** Kosten uit het kostenmodel die niet aan een klant zijn toegerekend. */
  modelVast: { naam: string; bedrag: number }[];
  omzet: number;
  /**
   * De omzet van deze maand uitgesplitst naar waar hij vandaan komt: de
   * maandfee voor SEO, de fee voor advertenties, en een eenmalig bedrag (een
   * website) dat alleen in de startmaand meetelt. Allemaal al gewogen met de
   * kans, precies zoals `omzet` zelf. Losse posten zitten hier NIET in; die
   * staan in postOmzet, want die hangen niet aan een klant en zijn dus geen
   * SEO of advertenties.
   */
  omzetSeo: number;
  omzetAds: number;
  omzetEenmalig: number;
  kosten: number;
  netto: number;
  /** Waar het doel op gemeten wordt (netto of omzet), voor de balk. */
  opDoel: number;
  haaltDoel: boolean;
  bijdragen: Bijdrage[];
};

export type PrognoseUitkomst = {
  instelling: PrognoseInstelling;
  maanden: MaandUitkomst[];
  regels: PrognoseRegel[];
  posten: Post[];
  /** De eerste maand waarin het doel gehaald wordt, of leeg. */
  doelMaand: Maand | null;
  /** Wat er deze maand nog tekortkomt op het doel (0 als het gehaald wordt). */
  tekortNu: number;
  /** Gemiddelde netto per klant, om het tekort in klanten uit te drukken. */
  gemiddeldPerKlant: number;
};

type KlantBron = {
  slug: string; name: string; fase: string;
  /** Klantgroep: leeg = eigen Pingwin-klant, "mmc" = Multimedia Concepts. */
  grp?: string | null;
  budget: { maandbudget: number; linkbuilding: number };
};

/** Telt een regel mee in deze maand? Leeg begin = loopt al, leeg eind = doorlopend. */
function actiefIn(r: { startMaand: Maand | null; eindMaand: Maand | null }, maand: Maand): boolean {
  if (r.startMaand && maand < r.startMaand) return false;
  if (r.eindMaand && maand > r.eindMaand) return false;
  return true;
}

/**
 * Bouwt de volledige prognose. De klanten komen binnen als parameter (en niet
 * uit een import hier), zodat deze module te lezen en te toetsen is zonder
 * database, en zodat de aanroeper bepaalt welke klanten meedoen.
 */
export function berekenPrognose(
  klanten: KlantBron[],
  extras: Map<string, RegelExtra>,
  posten: Post[],
  instelling: PrognoseInstelling,
  vanaf: Maand = maandNu(),
  // Het kostenmodel komt van buiten (lib/kostenmodel.ts) zodat deze functie
  // puur rekenwerk blijft en zonder database te toetsen is.
  kosten: { perKlant: Map<string, { naam: string; bedrag: number }[]>; vast: { naam: string; bedrag: number }[] }
    = { perKlant: new Map(), vast: [] },
): PrognoseUitkomst {
  const regels: PrognoseRegel[] = klanten
    .filter((k) => k.fase === "klant" || k.fase === "lead")
    .map((k) => {
      const e = extras.get(k.slug);
      const isLead = k.fase === "lead";
      const bedrag = Number(k.budget.maandbudget) || 0;
      // Een lead die nooit is beoordeeld krijgt niet stilletjes 100%: dan zou
      // de lijn beloven wat nog niet getekend is. 30 is een nuchtere start die
      // Maarten per lead bijstelt.
      const kans = e ? e.kans : isLead ? LEAD_STANDAARD_KANS : 100;
      return {
        slug: k.slug,
        naam: k.name,
        fase: k.fase,
        bedrag,
        linkbuilding: Number(k.budget.linkbuilding) || 0,
        extraKosten: e?.extraKosten || 0,
        extraOmzet: e?.extraOmzet || 0,
        eenmaligOmzet: e?.eenmaligOmzet || 0,
        eenmaligKosten: e?.eenmaligKosten || 0,
        kans,
        startMaand: e?.startMaand || null,
        eindMaand: e?.eindMaand || null,
        opmerking: e?.opmerking || "",
        gat: bedrag <= 0 && !(e?.extraOmzet || e?.eenmaligOmzet) ? "nog geen maandbedrag ingevuld" : "",
        modelKosten: kosten.perKlant.get(k.slug) || [],
      };
    })
    .sort((a, b) => (a.fase === b.fase ? b.bedrag - a.bedrag : a.fase === "klant" ? -1 : 1));

  const maanden: MaandUitkomst[] = [];
  for (let i = 0; i < instelling.horizon; i++) {
    const maand = maandPlus(vanaf, i);
    const bijdragen: Bijdrage[] = [];
    let zekerOmzet = 0, zekerKosten = 0, verwachtOmzet = 0, verwachtKosten = 0, postOmzet = 0, postKosten = 0;
    let omzetSeo = 0, omzetAds = 0, omzetEenmalig = 0;

    for (const r of regels) {
      if (!actiefIn(r, maand)) continue;
      // Dekt het kostenmodel deze klant, dan is dát de kostenkant en telt zijn
      // eigen linkbuildingbedrag niet ook nog eens mee. Nooit allebei.
      const uitModel = r.modelKosten.reduce((s, m) => s + m.bedrag, 0);
      const eigenKosten = (r.modelKosten.length ? uitModel : r.linkbuilding) + r.extraKosten;
      // Het eenmalige bedrag (een website) telt in de maand dat het traject
      // start, en verder nooit; zonder startmaand in de eerste maand van de
      // tabel, want dan is het nu aan de orde.
      const startMaand = r.startMaand || vanaf;
      const eenmaligNu = maand === startMaand;
      const maandOmzet = r.bedrag + r.extraOmzet + (eenmaligNu ? r.eenmaligOmzet : 0);
      const maandKosten = eigenKosten + (eenmaligNu ? r.eenmaligKosten : 0);
      if (maandOmzet <= 0 && maandKosten <= 0) continue;
      const w = r.fase === "klant" ? 1 : r.kans / 100;
      const omzet = maandOmzet * w;
      const kosten = maandKosten * w;
      if (r.fase === "klant") { zekerOmzet += omzet; zekerKosten += kosten; }
      else { verwachtOmzet += omzet; verwachtKosten += kosten; }
      // Dezelfde weging, maar dan uitgesplitst, zodat een scherm kan laten zien
      // waar de maand uit bestaat zonder het hier nog eens uit te rekenen.
      omzetSeo += r.bedrag * w;
      omzetAds += r.extraOmzet * w;
      if (eenmaligNu) omzetEenmalig += r.eenmaligOmzet * w;
      bijdragen.push({
        slug: r.slug, naam: r.naam, soort: r.fase === "klant" ? "klant" : "lead",
        kans: r.fase === "klant" ? 100 : r.kans,
        omzet, kosten, netto: omzet - kosten, bruto: maandOmzet - maandKosten,
      });
    }

    for (const p of posten) {
      const telt = p.herhaalt ? maand >= p.maand : maand === p.maand;
      if (!telt) continue;
      const w = p.kans / 100;
      const bedrag = p.bedrag * w;
      if (p.soort === "omzet") postOmzet += bedrag; else postKosten += bedrag;
      bijdragen.push({
        slug: `post-${p.id}`, naam: p.naam, soort: "post", kans: p.kans,
        omzet: p.soort === "omzet" ? bedrag : 0,
        kosten: p.soort === "kosten" ? bedrag : 0,
        netto: p.soort === "omzet" ? bedrag : -bedrag,
        bruto: p.soort === "omzet" ? p.bedrag : -p.bedrag,
      });
    }

    // Kosten uit het kostenmodel die bij niemand horen (hosting, Google Ads):
    // één keer per maand, net als de eigen vaste lasten.
    const modelVastTotaal = kosten.vast.reduce((s, v) => s + v.bedrag, 0);

    const omzet = zekerOmzet + verwachtOmzet + postOmzet;
    const kostenTotaal = zekerKosten + verwachtKosten + postKosten + instelling.vasteLasten + modelVastTotaal;
    const netto = omzet - kostenTotaal;
    const opDoel = instelling.targetOp === "omzet" ? omzet : netto;
    maanden.push({
      maand, label: maandLabel(maand),
      zekerOmzet, zekerKosten, verwachtOmzet, verwachtKosten, postOmzet, postKosten,
      vasteLasten: instelling.vasteLasten,
      modelVast: kosten.vast,
      omzet, omzetSeo, omzetAds, omzetEenmalig, kosten: kostenTotaal, netto, opDoel,
      haaltDoel: opDoel >= instelling.target,
      bijdragen: bijdragen.sort((a, b) => b.netto - a.netto),
    });
  }

  const doelMaand = maanden.find((m) => m.haaltDoel)?.maand || null;
  const nu = maanden[0];
  const tekortNu = nu ? Math.max(0, instelling.target - nu.opDoel) : 0;
  const lopende = regels.filter((r) => r.fase === "klant" && r.bedrag > 0);
  const gemiddeldPerKlant = lopende.length
    ? lopende.reduce((s, r) => {
        const uitModel = r.modelKosten.reduce((t, m) => t + m.bedrag, 0);
        return s + (r.bedrag - (r.modelKosten.length ? uitModel : r.linkbuilding) - r.extraKosten);
      }, 0) / lopende.length
    : 0;

  return { instelling, maanden, regels, posten, doelMaand, tekortNu, gemiddeldPerKlant };
}

/** De prognose zoals het scherm hem krijgt: klanten uit de database erbij. */
export async function getPrognose(
  klanten: KlantBron[],
  // Minimaal zoveel maanden teruggeven, ook als de prognose zelf op minder
  // staat. De strook op het klantenoverzicht wil altijd een half jaar laten
  // zien; zijn horizon op /admin/financien gaat daar niet over.
  minimaalMaanden = 0,
): Promise<PrognoseUitkomst & { kostenregels: KostenRegel[]; kostenMeldingen: string[] }> {
  const [instellingRuw, extras, posten, kostenregels] = await Promise.all([
    getPrognoseInstelling(),
    getRegelExtras(),
    listPosten(),
    listKostenregels().catch(() => [] as KostenRegel[]),
  ]);
  const instelling = minimaalMaanden > instellingRuw.horizon
    ? { ...instellingRuw, horizon: minimaalMaanden }
    : instellingRuw;
  const model = pasKostenmodelToe(
    klanten.map((k) => ({ ...k, grp: k.grp ?? null })),
    kostenregels,
  );
  const uit = berekenPrognose(klanten, extras, posten, instelling, maandNu(), model);
  return { ...uit, kostenregels, kostenMeldingen: model.meldingen };
}
