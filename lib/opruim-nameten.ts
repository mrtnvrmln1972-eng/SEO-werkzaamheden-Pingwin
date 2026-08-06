import { sql, ensureSchema } from "./db";
import { getGscForPage } from "./google";

// ═══════════════════════════════════════════════════════════
// KLOPTE HET? DE OMLEIDING METEN NA 30 EN 90 DAGEN
// ═══════════════════════════════════════════════════════════
// Alles hiervoor is een voorspelling. "Deze pagina zit die pagina in de weg, dus
// als je hem omleidt wordt de winnaar sterker" is een redenering, geen feit, en
// tot nu toe keek er nooit iemand terug of het uitkwam. Dat is precies hoe een
// werkwijze jarenlang kan blijven bestaan zonder dat iemand weet of hij werkt.
//
// Daarom: op het moment dat een omleiding echt op de site komt te staan, leggen
// we vast hoe de winnaar er dán voor staat. Na 30 dagen en na 90 dagen meten we
// hetzelfde opnieuw. Het verschil is het antwoord.
//
// Twee dingen bewust zo:
// - De nulmeting wordt op het moment van doorvoeren vastgelegd, niet achteraf
//   gereconstrueerd. Achteraf is Search Console-data al verschoven en meet je iets
//   anders dan je denkt.
// - 30 dagen is te vroeg voor een oordeel en dat staat er ook bij. Google heeft
//   weken nodig om een omleiding te verwerken; een daling na 30 dagen is normaal,
//   een daling na 90 dagen is een signaal.
// ═══════════════════════════════════════════════════════════

export type Meting = { klikken: number; vertoningen: number; positie: number | null; op: string };

export type Nameting = {
  van: string;
  naar: string;
  doorgevoerdOp: string;
  basis: Meting | null;
  na30: Meting | null;
  na90: Meting | null;
  /** Hoeveel dagen geleden is dit doorgevoerd. Bepaalt wat er te verwachten valt. */
  dagen: number;
  /** Het oordeel in gewone taal, of de reden dat er nog geen oordeel is. */
  oordeel: string;
  /** Gestegen, gedaald, gelijk, of nog niets te zeggen. */
  richting: "beter" | "slechter" | "gelijk" | "te vroeg";
};

const padVan = (u: string) => { try { return new URL(u).pathname; } catch { return (u || "").trim(); } };

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) ready = doEnsure().catch((e) => { ready = null; throw e; });
  return ready;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_opruim_metingen (
      client_slug     TEXT NOT NULL,
      van             TEXT NOT NULL,
      naar            TEXT NOT NULL,
      doorgevoerd_op  TIMESTAMPTZ NOT NULL DEFAULT now(),
      basis           TEXT,
      na30            TEXT,
      na90            TEXT,
      PRIMARY KEY (client_slug, van)
    )`;
}

function lees(v: unknown): Meting | null {
  if (!v) return null;
  try { return JSON.parse(String(v)) as Meting; } catch { return null; }
}

/** De huidige stand van één pagina: wat haalt hij binnen, en op welke plek. */
async function meetPagina(domain: string, pad: string): Promise<Meting | null> {
  const bare = (domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!bare) return null;
  const url = pad.startsWith("http") ? pad : `https://${bare}${pad.startsWith("/") ? "" : "/"}${pad}`;
  const rijen = await getGscForPage(domain, url, 28).catch(() => []);
  if (!rijen.length) return { klikken: 0, vertoningen: 0, positie: null, op: new Date().toISOString() };
  let klikken = 0, vertoningen = 0, beste: number | null = null;
  for (const r of rijen) {
    klikken += r.clicks; vertoningen += r.impressions;
    if (beste == null || r.position < beste) beste = r.position;
  }
  return { klikken, vertoningen, positie: beste != null ? Math.round(beste * 10) / 10 : null, op: new Date().toISOString() };
}

/**
 * Vastleggen dat een omleiding live is gegaan, mét de nulmeting van de winnaar.
 * Bestaat de regel al, dan blijft de eerste nulmeting staan: opnieuw doorvoeren
 * van dezelfde omleiding is geen nieuw experiment.
 */
export async function legNulmetingVast(slug: string, domain: string, van: string, naar: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const v = padVan(van), n = padVan(naar);
  if (!v || !n) return;
  const basis = await meetPagina(domain, n).catch(() => null);
  await sql`
    INSERT INTO client_opruim_metingen (client_slug, van, naar, doorgevoerd_op, basis)
    VALUES (${slug}, ${v}, ${n}, now(), ${basis ? JSON.stringify(basis) : null})
    ON CONFLICT (client_slug, van) DO NOTHING`;
}

/** Hoeveel metingen we per tik doen. Elke meting is één Search Console-opvraag;
    de rest komt de volgende tik aan de beurt, want er is geen haast bij. */
const PER_TIK = 10;

/**
 * De metingen die aan de beurt zijn uitvoeren. Idempotent: een meting die er al
 * staat wordt nooit overschreven, want dan zou het getal meebewegen met wanneer
 * je toevallig kijkt.
 */
export async function meetOpenstaande(slug: string, domain: string): Promise<{ gemeten: number }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT van, naar, doorgevoerd_op, na30, na90
    FROM client_opruim_metingen
    WHERE client_slug = ${slug}
      AND ((na30 IS NULL AND doorgevoerd_op < now() - interval '30 days')
        OR (na90 IS NULL AND doorgevoerd_op < now() - interval '90 days'))
    ORDER BY doorgevoerd_op ASC LIMIT ${PER_TIK}`;

  let gemeten = 0;
  for (const r of rows) {
    const naar = String(r.naar);
    const van = String(r.van);
    const dagen = (Date.now() - new Date(r.doorgevoerd_op as string).getTime()) / 86400000;
    const m = await meetPagina(domain, naar).catch(() => null);
    if (!m) continue;
    if (dagen >= 90 && !r.na90) {
      await sql`UPDATE client_opruim_metingen SET na90 = ${JSON.stringify(m)} WHERE client_slug = ${slug} AND van = ${van}`;
      gemeten++;
    }
    if (dagen >= 30 && !r.na30) {
      await sql`UPDATE client_opruim_metingen SET na30 = ${JSON.stringify(m)} WHERE client_slug = ${slug} AND van = ${van}`;
      gemeten++;
    }
  }
  return { gemeten };
}

/** Een positie is beter als hij LAGER is; dat blijft verwarrend, dus het staat hier
    één keer en nergens anders. Een verschil van minder dan één plek is ruis. */
function beoordeel(basis: Meting | null, later: Meting | null, dagen: number): { richting: Nameting["richting"]; oordeel: string } {
  if (dagen < 30) {
    return { richting: "te vroeg", oordeel: `Doorgevoerd, ${Math.round(dagen)} ${Math.round(dagen) === 1 ? "dag" : "dagen"} geleden. De eerste meting volgt na 30 dagen; eerder zegt het niets, want Google heeft weken nodig om een omleiding te verwerken.` };
  }
  if (!basis || !later) {
    return { richting: "te vroeg", oordeel: "De meting is nog niet uitgevoerd, of er waren geen Search Console-cijfers voor deze pagina." };
  }
  const klikVerschil = later.klikken - basis.klikken;
  const posVerschil = basis.positie != null && later.positie != null ? basis.positie - later.positie : null;
  const wat = [
    `Klikken: ${basis.klikken} naar ${later.klikken}.`,
    basis.positie != null && later.positie != null ? `Beste plek: ${basis.positie} naar ${later.positie}.` : "",
    `Vertoningen: ${basis.vertoningen} naar ${later.vertoningen}.`,
  ].filter(Boolean).join(" ");

  const omhoog = klikVerschil > 0 || (posVerschil != null && posVerschil >= 1);
  const omlaag = klikVerschil < 0 && (posVerschil == null || posVerschil <= -1);

  if (omhoog) return { richting: "beter", oordeel: `De winnaar is sterker geworden. ${wat} Dat is waar deze omleiding voor bedoeld was.` };
  if (omlaag) {
    return {
      richting: "slechter", oordeel: `De winnaar is niet sterker geworden. ${wat} ` + (dagen < 90
        ? "Na 30 dagen is dat nog geen conclusie; de meting na 90 dagen telt. Blijft het dan zo, dan is de omleiding het bekijken waard."
        : "Na 90 dagen is dat wél een signaal: mogelijk was de opgeheven pagina niet overbodig, of past hij niet bij de bezoeker die daar terechtkomt."),
    };
  }
  return { richting: "gelijk", oordeel: `Er is weinig veranderd. ${wat} Dat is geen slecht nieuws: de site is een pagina lichter geworden zonder verlies.` };
}

export async function getNametingen(slug: string): Promise<Nameting[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT van, naar, doorgevoerd_op, basis, na30, na90
    FROM client_opruim_metingen WHERE client_slug = ${slug} ORDER BY doorgevoerd_op DESC LIMIT 200`;
  return rows.map((r) => {
    const doorgevoerdOp = new Date(r.doorgevoerd_op as string);
    const dagen = (Date.now() - doorgevoerdOp.getTime()) / 86400000;
    const basis = lees(r.basis);
    const na30 = lees(r.na30);
    const na90 = lees(r.na90);
    // Het verste meetpunt telt: na 90 dagen is de meting van 30 dagen achterhaald.
    const { richting, oordeel } = beoordeel(basis, na90 || na30, dagen);
    return {
      van: String(r.van), naar: String(r.naar),
      doorgevoerdOp: doorgevoerdOp.toISOString(),
      basis, na30, na90, dagen: Math.round(dagen), richting, oordeel,
    };
  });
}

/** Eén regel samenvatting voor bovenaan de kaart, in gewone taal. */
export function nametingSamenvatting(rijen: Nameting[]): string {
  if (!rijen.length) return "";
  const gemeten = rijen.filter((r) => r.richting !== "te vroeg");
  if (!gemeten.length) {
    return `${rijen.length} ${rijen.length === 1 ? "omleiding staat" : "omleidingen staan"} live en ${rijen.length === 1 ? "wacht" : "wachten"} op de eerste meting na 30 dagen.`;
  }
  const beter = gemeten.filter((r) => r.richting === "beter").length;
  const slechter = gemeten.filter((r) => r.richting === "slechter").length;
  const gelijk = gemeten.length - beter - slechter;
  return `Van de ${gemeten.length} gemeten ${gemeten.length === 1 ? "omleiding" : "omleidingen"} ${beter === 1 ? "is er 1" : `zijn er ${beter}`} beter gaan lopen, ${gelijk === 1 ? "bleef er 1" : `bleven er ${gelijk}`} gelijk en ${slechter === 1 ? "ging er 1" : `gingen er ${slechter}`} achteruit.`;
}
