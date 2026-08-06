import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// ACHTERGRONDKLUSSEN: ÉÉN PLEK DIE WEET WAT ER DRAAIT
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat. Er draaiden twee soorten werk door elkaar heen:
//
//  1. Werk dat écht op de achtergrond liep (de prioriteitenscan, opruimen, de
//     interne links, de documenten) met een eigen tabel, een eigen stappenteller
//     en een cron-vangnet. Daar kon je van wegklikken.
//  2. Werk dat de browser stond af te wachten: de site inlezen (445 pagina's),
//     de wijzigingen-scan, de zoekwoordkansen, de opruimlijst herwegen. Klikte je
//     weg, dan was het molentje weg, en je kon nergens meer zien of het nog liep
//     of dat het klaar was. Het werk zelf ging meestal wel door, maar dat was
//     niet te zien, en dat is hetzelfde als kwijt.
//
// Dit bestand maakt van soort 2 hetzelfde als soort 1: de knop start het werk en
// komt meteen terug, het werk draait server-side door, en de voortgang staat in
// de database. Elk scherm kan hem daar ophalen, ook een scherm dat je pas tien
// minuten later opent.
//
// `lopendeKlussen()` telt daarbij de vier eigen motoren mee, zodat er één
// antwoord is op de vraag "draait er iets voor deze klant". Die vraag hoort niet
// per tabblad een ander antwoord te hebben.
// ═══════════════════════════════════════════════════════════

export type KlusStatus = "bezig" | "klaar" | "fout" | "vastgelopen";

export type Klus = {
  soort: string;
  /** Zoals het op het scherm heet ("De site inlezen"). */
  naam: string;
  status: KlusStatus;
  /** Bij welke stap hij is, en hoeveel het er zijn. 0 stappen = onbekend, dan draait het rondje rond. */
  stap: number;
  stappen: number;
  /** Wat er nú gebeurt, in gewone taal. */
  label: string;
  error: string;
  gestart: string | null;
  bijgewerkt: string | null;
  /** Waar dit werk hoort, zodat het scherm er een knop naartoe kan maken. */
  tab?: string;
};

// Een klus zonder hartslag is doodgelopen: het serverless-venster is dan
// verlopen zonder dat er iets is afgerond. Vijftien minuten, gelijk aan de grens
// die de opruim- en prioriteitenmotor al hanteren voor hun cron-vangnet.
const STIL_MS = 15 * 60 * 1000;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_klussen (
      client_slug TEXT NOT NULL,
      soort       TEXT NOT NULL,
      naam        TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'bezig',
      stap        INTEGER NOT NULL DEFAULT 0,
      stappen     INTEGER NOT NULL DEFAULT 0,
      label       TEXT NOT NULL DEFAULT '',
      error       TEXT NOT NULL DEFAULT '',
      started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, soort)
    )`;
}

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rij(r: any): Klus {
  const bijgewerkt = iso(r.updated_at);
  const stil = r.status === "bezig" && bijgewerkt && Date.now() - new Date(bijgewerkt).getTime() > STIL_MS;
  return {
    soort: r.soort as string,
    naam: (r.naam as string) || (r.soort as string),
    status: stil ? "vastgelopen" : (r.status as KlusStatus),
    stap: Number(r.stap || 0),
    stappen: Number(r.stappen || 0),
    label: (r.label as string) || "",
    error: (r.error as string) || "",
    gestart: iso(r.started_at),
    bijgewerkt,
  };
}

export async function startKlus(slug: string, soort: string, naam: string, stappen = 0, label = ""): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO client_klussen (client_slug, soort, naam, status, stap, stappen, label, error, started_at, updated_at)
    VALUES (${slug}, ${soort}, ${naam}, 'bezig', 0, ${stappen}, ${label}, '', now(), now())
    ON CONFLICT (client_slug, soort) DO UPDATE SET
      naam = EXCLUDED.naam, status = 'bezig', stap = 0, stappen = EXCLUDED.stappen,
      label = EXCLUDED.label, error = '', started_at = now(), updated_at = now()`;
}

/** De hartslag én de voortgang in één: hiermee weet het scherm dat hij nog leeft. */
export async function zetStap(slug: string, soort: string, stap: number, label = ""): Promise<void> {
  await ensureTable();
  await sql`
    UPDATE client_klussen SET stap = ${stap}, label = ${label}, updated_at = now()
    WHERE client_slug = ${slug} AND soort = ${soort}`;
}

export async function klusKlaar(slug: string, soort: string, label = ""): Promise<void> {
  await ensureTable();
  await sql`
    UPDATE client_klussen SET status = 'klaar', stap = GREATEST(stap, stappen), label = ${label}, updated_at = now()
    WHERE client_slug = ${slug} AND soort = ${soort}`;
}

export async function klusFout(slug: string, soort: string, error: string): Promise<void> {
  await ensureTable();
  await sql`
    UPDATE client_klussen SET status = 'fout', error = ${error.slice(0, 500)}, updated_at = now()
    WHERE client_slug = ${slug} AND soort = ${soort}`;
}

export async function getKlus(slug: string, soort: string): Promise<Klus | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_klussen WHERE client_slug = ${slug} AND soort = ${soort} LIMIT 1`;
  return rows[0] ? rij(rows[0]) : null;
}

export async function getKlussen(slug: string): Promise<Klus[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_klussen WHERE client_slug = ${slug} ORDER BY updated_at DESC`;
  return rows.map(rij);
}

/**
 * Draait `fn` als achtergrondklus en houdt de stand bij. Roep dit aan binnen een
 * waitUntil, zodat het endpoint meteen antwoord geeft en het werk doorloopt.
 * De meegegeven `stap`-functie is de hartslag; gebruik hem bij elke fase.
 */
export async function draaiKlus(
  slug: string,
  soort: string,
  naam: string,
  stappen: number,
  fn: (stap: (n: number, label: string) => Promise<void>) => Promise<string | void>,
): Promise<void> {
  await startKlus(slug, soort, naam, stappen);
  try {
    const slot = await fn((n, label) => zetStap(slug, soort, n, label));
    await klusKlaar(slug, soort, typeof slot === "string" ? slot : "");
  } catch (e) {
    await klusFout(slug, soort, e instanceof Error ? e.message : "Onbekende fout.");
  }
}

// ═══════════════════════════════════════════════════════════
// WAT DRAAIT ER NU, ALLES BIJ ELKAAR
// ═══════════════════════════════════════════════════════════
// Naast de tabel hierboven hebben vier motoren hun eigen tabel, met hun eigen
// stappenteller. Die worden hier meegeteld in plaats van nagebouwd: één antwoord
// op "draait er iets voor deze klant", op elk tabblad hetzelfde.
//
// De volgorde is bewust: eerst de lichte controle of er überhaupt iets loopt
// (één query per motor, alleen status), en pas als er iets loopt de volledige
// lees-functie met de stap-labels erbij. Zo kost het niets als er niets draait,
// en dat is de normale situatie.

type Motor = { soort: string; naam: string; tab: string };
const MOTOREN: Record<string, Motor> = {
  prioriteiten: { soort: "prioriteiten", naam: "Prioriteitenscan", tab: "prioriteiten" },
  opruimen: { soort: "opruimen", naam: "Opruimanalyse", tab: "cannibalisatie" },
  internelinks: { soort: "internelinks", naam: "Interne links", tab: "interne-links" },
  documenten: { soort: "documenten", naam: "Documenten", tab: "paginas" },
  googleprofiel: { soort: "googleprofiel", naam: "Google-profielscan", tab: "google-profiel" },
};

async function draaitEr(tabel: "prio" | "opruim" | "links" | "gmb", slug: string): Promise<boolean> {
  try {
    if (tabel === "prio") {
      const { rows } = await sql`SELECT 1 FROM client_prioriteiten_scan WHERE client_slug = ${slug} AND status = 'running' LIMIT 1`;
      return rows.length > 0;
    }
    if (tabel === "opruim") {
      const { rows } = await sql`SELECT 1 FROM client_cannibal_analysis WHERE client_slug = ${slug} AND status = 'running' LIMIT 1`;
      return rows.length > 0;
    }
    if (tabel === "links") {
      const { rows } = await sql`SELECT 1 FROM client_internal_links WHERE client_slug = ${slug} AND status = 'running' LIMIT 1`;
      return rows.length > 0;
    }
    const { rows } = await sql`SELECT 1 FROM client_gmb WHERE client_slug = ${slug} AND status = 'running' LIMIT 1`;
    return rows.length > 0;
  } catch { return false; }
}

async function lopendeDocumenten(slug: string): Promise<Klus | null> {
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n, MAX(updated_at) AS laatst, MIN(created_at) AS eerst
      FROM page_doc_runs WHERE client_slug = ${slug} AND status = 'running'`;
    const n = Number(rows[0]?.n || 0);
    if (!n) return null;
    const bijgewerkt = iso(rows[0]?.laatst);
    const stil = bijgewerkt && Date.now() - new Date(bijgewerkt).getTime() > STIL_MS;
    return {
      ...MOTOREN.documenten,
      status: stil ? "vastgelopen" : "bezig",
      stap: 0, stappen: 0,
      label: n === 1 ? "Eén document wordt geschreven" : `${n} documenten worden geschreven`,
      error: "", gestart: iso(rows[0]?.eerst), bijgewerkt,
    };
  } catch { return null; }
}

/**
 * Alles wat op dit moment loopt voor deze klant: de eigen klussen én de vier
 * motoren met hun eigen tabel. Dit voedt het klusje in de kop van de cockpit,
 * dat op elk tabblad zichtbaar blijft.
 */
export async function lopendeKlussen(slug: string): Promise<Klus[]> {
  await ensureSchema();
  await ensureTable();

  const [eigen, prio, opruim, links, gmb, docs] = await Promise.all([
    getKlussen(slug).catch(() => [] as Klus[]),
    draaitEr("prio", slug),
    draaitEr("opruim", slug),
    draaitEr("links", slug),
    draaitEr("gmb", slug),
    lopendeDocumenten(slug),
  ]);

  const uit: Klus[] = eigen.filter((k) => k.status === "bezig" || k.status === "vastgelopen");

  // Alleen de zware lees-functies aanroepen voor wat écht draait.
  if (prio) {
    const { getPrioriteitenScan } = await import("./prioriteiten-scan");
    const st = await getPrioriteitenScan(slug).catch(() => null);
    if (st?.status === "running") {
      uit.push({
        ...MOTOREN.prioriteiten, status: st.cronStil ? "vastgelopen" : "bezig",
        stap: st.stap, stappen: st.stappen, label: st.stapLabel, error: "",
        gestart: null, bijgewerkt: st.updatedAt,
      });
    }
  }
  if (opruim) {
    const { getCannibalAnalysis } = await import("./cannibal-redirect");
    const st = await getCannibalAnalysis(slug).catch(() => null);
    if (st?.status === "running") {
      uit.push({
        ...MOTOREN.opruimen, status: st.cronStil ? "vastgelopen" : "bezig",
        stap: st.stap, stappen: st.stappen, label: st.stapLabel, error: "",
        gestart: null, bijgewerkt: st.updatedAt,
      });
    }
  }
  if (links) {
    // Met de echte tijden erbij: een run zonder hartslag hoort als vastgelopen in
    // beeld te komen, niet als een eeuwig draaiend rondje.
    const { getInternalLinksState } = await import("./internal-links");
    const st = await getInternalLinksState(slug).catch(() => null);
    if (st?.status === "running") {
      uit.push({
        ...MOTOREN.internelinks, status: "bezig", stap: 0, stappen: 0,
        label: st.fase || "De interne links worden doorgemeten",
        error: "", gestart: st.updatedAt, bijgewerkt: st.updatedAt,
      });
    }
  }
  if (gmb) {
    uit.push({ ...MOTOREN.googleprofiel, status: "bezig", stap: 0, stappen: 0, label: "De Google-bedrijfsprofielen worden opgezocht en gemeten", error: "", gestart: null, bijgewerkt: null });
  }
  if (docs) uit.push(docs);

  return uit;
}
