import { sql, ensureSchema } from "./db";
import { getSetting, setSetting } from "./settings";

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

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
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
};

type RegelRow = {
  client_slug: string; kans: number; start_maand: string | null;
  eind_maand: string | null; extra_kosten: string | number; opmerking: string | null;
};

async function getRegelExtras(): Promise<Map<string, RegelExtra>> {
  await ensureTable();
  const { rows } = await sql<RegelRow>`
    SELECT client_slug, kans, start_maand, eind_maand, extra_kosten, opmerking FROM prognose_regel`;
  const map = new Map<string, RegelExtra>();
  for (const r of rows) {
    map.set(r.client_slug, {
      kans: Math.min(100, Math.max(0, Number(r.kans))),
      startMaand: normMaand(r.start_maand),
      eindMaand: normMaand(r.eind_maand),
      extraKosten: Number(r.extra_kosten) || 0,
      opmerking: r.opmerking || "",
    });
  }
  return map;
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
  };
  await sql`
    INSERT INTO prognose_regel (client_slug, kans, start_maand, eind_maand, extra_kosten, opmerking, updated_at)
    VALUES (${slug}, ${n.kans}, ${n.startMaand}, ${n.eindMaand}, ${n.extraKosten}, ${n.opmerking || null}, now())
    ON CONFLICT (client_slug) DO UPDATE SET
      kans = ${n.kans}, start_maand = ${n.startMaand}, eind_maand = ${n.eindMaand},
      extra_kosten = ${n.extraKosten}, opmerking = ${n.opmerking || null}, updated_at = now()`;
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
  kans: number;
  startMaand: Maand | null;
  eindMaand: Maand | null;
  opmerking: string;
  /** Waarschuwing voor op het scherm, bijvoorbeeld een lead zonder bedrag. */
  gat: string;
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
  omzet: number;
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
      const kans = e ? e.kans : isLead ? 30 : 100;
      return {
        slug: k.slug,
        naam: k.name,
        fase: k.fase,
        bedrag,
        linkbuilding: Number(k.budget.linkbuilding) || 0,
        extraKosten: e?.extraKosten || 0,
        kans,
        startMaand: e?.startMaand || null,
        eindMaand: e?.eindMaand || null,
        opmerking: e?.opmerking || "",
        gat: bedrag <= 0 ? "nog geen maandbedrag ingevuld" : "",
      };
    })
    .sort((a, b) => (a.fase === b.fase ? b.bedrag - a.bedrag : a.fase === "klant" ? -1 : 1));

  const maanden: MaandUitkomst[] = [];
  for (let i = 0; i < instelling.horizon; i++) {
    const maand = maandPlus(vanaf, i);
    const bijdragen: Bijdrage[] = [];
    let zekerOmzet = 0, zekerKosten = 0, verwachtOmzet = 0, verwachtKosten = 0, postOmzet = 0, postKosten = 0;

    for (const r of regels) {
      if (!actiefIn(r, maand)) continue;
      if (r.bedrag <= 0 && r.linkbuilding <= 0 && r.extraKosten <= 0) continue;
      const w = r.fase === "klant" ? 1 : r.kans / 100;
      const omzet = r.bedrag * w;
      const kosten = (r.linkbuilding + r.extraKosten) * w;
      if (r.fase === "klant") { zekerOmzet += omzet; zekerKosten += kosten; }
      else { verwachtOmzet += omzet; verwachtKosten += kosten; }
      bijdragen.push({
        slug: r.slug, naam: r.naam, soort: r.fase === "klant" ? "klant" : "lead",
        kans: r.fase === "klant" ? 100 : r.kans,
        omzet, kosten, netto: omzet - kosten, bruto: r.bedrag - r.linkbuilding - r.extraKosten,
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

    const omzet = zekerOmzet + verwachtOmzet + postOmzet;
    const kosten = zekerKosten + verwachtKosten + postKosten + instelling.vasteLasten;
    const netto = omzet - kosten;
    const opDoel = instelling.targetOp === "omzet" ? omzet : netto;
    maanden.push({
      maand, label: maandLabel(maand),
      zekerOmzet, zekerKosten, verwachtOmzet, verwachtKosten, postOmzet, postKosten,
      vasteLasten: instelling.vasteLasten,
      omzet, kosten, netto, opDoel,
      haaltDoel: opDoel >= instelling.target,
      bijdragen: bijdragen.sort((a, b) => b.netto - a.netto),
    });
  }

  const doelMaand = maanden.find((m) => m.haaltDoel)?.maand || null;
  const nu = maanden[0];
  const tekortNu = nu ? Math.max(0, instelling.target - nu.opDoel) : 0;
  const lopende = regels.filter((r) => r.fase === "klant" && r.bedrag > 0);
  const gemiddeldPerKlant = lopende.length
    ? lopende.reduce((s, r) => s + (r.bedrag - r.linkbuilding - r.extraKosten), 0) / lopende.length
    : 0;

  return { instelling, maanden, regels, posten, doelMaand, tekortNu, gemiddeldPerKlant };
}

/** De prognose zoals het scherm hem krijgt: klanten uit de database erbij. */
export async function getPrognose(klanten: KlantBron[]): Promise<PrognoseUitkomst> {
  const [instelling, extras, posten] = await Promise.all([
    getPrognoseInstelling(),
    getRegelExtras(),
    listPosten(),
  ]);
  return berekenPrognose(klanten, extras, posten, instelling);
}
