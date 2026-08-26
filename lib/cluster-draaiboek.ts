// ═══════════════════════════════════════════════════════════
// HET DRAAIBOEK VAN EEN BLOK WERK
// ═══════════════════════════════════════════════════════════
// Een blok werk (cluster) is geen knop maar een route. Bij "Amsterdam" moet er
// van alles in de goede volgorde gebeuren, en sommige stappen mogen pas als een
// eerdere af is: een omleiding zetten vóórdat de tekst is overgezet gooit precies
// weg wat je wilde behouden.
//
// TWEE HARDE UITGANGSPUNTEN, ALLEBEI VAN MAARTEN
// ══════════════════════════════════════════════
// 1. HIJ ZET ELKE STAP ZELF AAN. Ook de stappen die de machine kan doen, zoals
//    omleidingen. Zijn woorden: "ik wil eerst kunnen verifiëren of alles precies
//    gaat en staat zoals ik het wil hebben". Daarom heeft elke stap een modus,
//    en die staat standaard op `handmatig`. Gaat het een tijdje goed, dan zet hij
//    een stap op `automatisch` en vuurt die vanzelf zodra zijn slot opengaat.
// 2. DE COPY BEOORDEELT HIJ ALTIJD ZELF. Die stap kan niet op automatisch, ooit.
//    `magAutomatisch: false` is daar geen instelling maar een eigenschap.
//
// HET SLOT
// ════════
// Elke stap noemt waar hij van afhangt. Zolang die niet klaar is, staat de stap
// op `wacht` en is de knop uit, mét de reden erbij ("wacht op: de bouwer zet het
// live"). Dat is bewust geen foutmelding achteraf maar een knop die nog niet kan.
//
// Dit bestand kent alleen de route en de standen. Wat een stap dóét staat er
// niet in: sommige stappen starten een bestaande motor (analyse, blauwdruk en
// copy draaien op `page_doc_runs`), sommige rekenen iets uit, en sommige zijn
// gewoon werk van een mens dat je afvinkt.

import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

export type StapSleutel =
  | "inventaris" | "analyse" | "termverdeling" | "verdict"
  | "blauwdruk" | "copy" | "beoordelen" | "linkplan" | "bouwpakket"
  | "implementatie" | "meta" | "redirects" | "nameten";

/** Wie aan zet is. Bepaalt de kleur van de regel en of er een startknop staat. */
export type Wie = "machine" | "pingwin" | "maarten" | "bouwer";

export const WIE_LABEL: Record<Wie, string> = {
  machine: "het dashboard", pingwin: "Claude", maarten: "jij", bouwer: "de bouwer",
};

export type Stand = "wacht" | "klaar-om-te-starten" | "bezig" | "klaar" | "overgeslagen" | "mislukt";

export const STAND_LABEL: Record<Stand, string> = {
  wacht: "wacht", "klaar-om-te-starten": "kan starten", bezig: "bezig",
  klaar: "klaar", overgeslagen: "overgeslagen", mislukt: "mislukt",
};

export type Modus = "handmatig" | "automatisch";

export type StapDefinitie = {
  sleutel: StapSleutel;
  nummer: number;
  naam: string;
  wie: Wie;
  uitleg: string;
  /** Deze stappen moeten klaar (of overgeslagen) zijn voordat deze mag starten. */
  hangtAf: StapSleutel[];
  /** Mag deze stap ooit vanzelf gaan? Bij het beoordelen van copy: nee, nooit. */
  magAutomatisch: boolean;
  /** Alleen nodig als er in dit blok pagina's samengevoegd of opgeruimd worden. */
  alleenBijSamenvoegen?: boolean;
};

// De route. Dertien stappen, in de enige volgorde die klopt.
export const STAPPEN: StapDefinitie[] = [
  {
    sleutel: "inventaris", nummer: 1, naam: "Kijken wat er nu op de pagina's staat", wie: "machine",
    uitleg: "Per pagina de koppen, de secties en het aantal woorden ophalen. Zonder dit kun je nooit zeggen welke alinea verhuist en welke sectie blijft staan; dan wordt elke keuze een gok.",
    hangtAf: [], magAutomatisch: true,
  },
  {
    sleutel: "analyse", nummer: 2, naam: "Analyse per pagina", wie: "pingwin",
    uitleg: "Wat verdient deze pagina nu (posities, klikken, verwijzende domeinen) en welke criteria haalt hij niet. Draait op de bestaande analyse-motor, één run per pagina.",
    hangtAf: ["inventaris"], magAutomatisch: true,
  },
  {
    sleutel: "termverdeling", nummer: 3, naam: "Verdelen wie welke zoekterm krijgt", wie: "machine",
    uitleg: "Per pagina: deze termen zijn van jou, deze sta je af. Dit besluit valt één keer voor het hele blok, vóór er een letter geschreven wordt. Zonder dit schrijven twee pagina's over hetzelfde.",
    hangtAf: ["analyse"], magAutomatisch: true,
  },
  {
    sleutel: "verdict", nummer: 4, naam: "Bepalen wat er met elke pagina gebeurt", wie: "machine",
    uitleg: "Aanvullen, gericht herschrijven, volledig herschrijven, een term afstaan of weg. Volgt uit de analyse plus de termverdeling. Een pagina met autoriteit of posities wordt nooit volledig herschreven.",
    hangtAf: ["termverdeling"], magAutomatisch: true,
  },
  {
    sleutel: "blauwdruk", nummer: 5, naam: "Blauwdruk per blijvende pagina", wie: "pingwin",
    uitleg: "De opzet van elke pagina die blijft, mét de termverdeling als kader, zodat pagina A weet wat pagina B heeft losgelaten.",
    hangtAf: ["verdict"], magAutomatisch: true,
  },
  {
    sleutel: "copy", nummer: 6, naam: "Copy schrijven", wie: "pingwin",
    uitleg: "Per pagina de tekst, als wijziging op wat er staat en niet als nieuwe pagina. Inclusief welke passages van welke pagina meeverhuizen.",
    hangtAf: ["blauwdruk"], magAutomatisch: true,
  },
  {
    sleutel: "beoordelen", nummer: 7, naam: "Copy nalezen en goedkeuren", wie: "maarten",
    uitleg: "Jij leest de teksten na voordat er iets naar de bouwer gaat. Deze stap kan niet op automatisch, en dat is met opzet.",
    hangtAf: ["copy"], magAutomatisch: false,
  },
  {
    sleutel: "linkplan", nummer: 8, naam: "Interne links uitwerken", wie: "machine",
    uitleg: "Van welke pagina, met welke ankertekst, naar welke pagina. Over en weer. Dit hoort bij het blok en niet bij één pagina, en daarom lukt het los per pagina nooit.",
    hangtAf: ["beoordelen"], magAutomatisch: true,
  },
  {
    sleutel: "bouwpakket", nummer: 9, naam: "Bouwpakket samenstellen", wie: "machine",
    uitleg: "Alles in één document dat de bouwer van boven naar beneden kan afwerken: per pagina de titel, de description, wat eruit gaat, wat erin komt, welke links en welke omleiding.",
    hangtAf: ["linkplan"], magAutomatisch: true,
  },
  {
    sleutel: "implementatie", nummer: 10, naam: "De bouwer zet het live", wie: "bouwer",
    uitleg: "De teksten en de interne links gaan de site op. Vink deze stap pas af als het er echt staat; de omleidingen hieronder wachten erop.",
    hangtAf: ["bouwpakket"], magAutomatisch: false,
  },
  {
    sleutel: "meta", nummer: 11, naam: "Titels, descriptions en structured data doorzetten", wie: "machine",
    uitleg: "Gaat rechtstreeks naar WordPress. Pas nadat de nieuwe tekst live staat, anders belooft de titel iets wat er nog niet is.",
    hangtAf: ["implementatie"], magAutomatisch: true,
  },
  {
    sleutel: "redirects", nummer: 12, naam: "Omleidingen zetten", wie: "machine",
    uitleg: "De samengevoegde en opgeruimde pagina's wijzen door naar de hoofdpagina. Dit is bewust de laatste ingreep: een omleiding vóór de tekst is overgezet gooit weg wat je wilde behouden.",
    hangtAf: ["implementatie"], magAutomatisch: true, alleenBijSamenvoegen: true,
  },
  {
    sleutel: "nameten", nummer: 13, naam: "Nameten", wie: "machine",
    uitleg: "Twee en zes weken later kijken wat de posities en klikken doen, zodat je weet of het geholpen heeft.",
    hangtAf: ["redirects", "meta"], magAutomatisch: true,
  },
];

export const STAP_VAN_SLEUTEL = new Map(STAPPEN.map((s) => [s.sleutel, s]));

// ═══════════════════════════════════════════════════════════
// DE STAND
// ═══════════════════════════════════════════════════════════

export type StapStand = {
  sleutel: StapSleutel;
  stand: Stand;
  modus: Modus;
  gestartOp: string;
  klaarOp: string;
  resultaat: string;
  notitie: string;
};

export type Draaiboek = {
  cluster: string;
  stappen: (StapDefinitie & StapStand & {
    /** Waarom deze stap nog niet kan, in gewone taal. Leeg als hij wel kan. */
    wachtOp: string;
    /** Niet van toepassing op dit blok (bijvoorbeeld omleidingen zonder samenvoeging). */
    nvt: boolean;
  })[];
  /** Hoeveel stappen af zijn, van de stappen die van toepassing zijn. */
  klaar: number;
  totaal: number;
  /** De eerstvolgende stap die kan starten, of null als alles af is. */
  volgende: StapSleutel | null;
};

const LEEG: Omit<StapStand, "sleutel"> = {
  stand: "wacht", modus: "handmatig", gestartOp: "", klaarOp: "", resultaat: "", notitie: "",
};

/**
 * Legt de standen over de route heen en rekent per stap uit of hij kan starten.
 * Puur rekenwerk zonder database, zodat `proeven/cluster-draaiboek.proef.ts` het
 * met echte gevallen kan narekenen.
 */
export function bouwDraaiboek(
  cluster: string,
  opgeslagen: StapStand[],
  opties: { heeftSamenvoeging: boolean } = { heeftSamenvoeging: true },
): Draaiboek {
  const perSleutel = new Map(opgeslagen.map((s) => [s.sleutel, s]));

  const nvtVan = (d: StapDefinitie) => !!d.alleenBijSamenvoegen && !opties.heeftSamenvoeging;

  // Een stap telt als "voorbij" als hij klaar is, overgeslagen is, of niet van
  // toepassing. Anders houdt één niet-relevante stap de hele route tegen.
  const voorbij = (sleutel: StapSleutel): boolean => {
    const def = STAP_VAN_SLEUTEL.get(sleutel);
    if (def && nvtVan(def)) return true;
    const s = perSleutel.get(sleutel);
    return s?.stand === "klaar" || s?.stand === "overgeslagen";
  };

  const stappen = STAPPEN.map((def) => {
    const opgeslagenStand = perSleutel.get(def.sleutel);
    const nvt = nvtVan(def);
    const basis: StapStand = { sleutel: def.sleutel, ...LEEG, ...(opgeslagenStand || {}) };

    const open = def.hangtAf.filter((h) => !voorbij(h));
    const wachtOp = open.length
      ? `wacht op: ${open.map((h) => (STAP_VAN_SLEUTEL.get(h)?.naam || h).toLowerCase()).join(" en ")}`
      : "";

    // De opgeslagen stand wint zodra er echt iets gebeurd is; is er nog niets,
    // dan volgt de stand uit het slot.
    let stand: Stand = basis.stand;
    if (stand !== "bezig" && stand !== "klaar" && stand !== "overgeslagen" && stand !== "mislukt") {
      stand = open.length ? "wacht" : "klaar-om-te-starten";
    }

    return { ...def, ...basis, stand, wachtOp, nvt, magAutomatisch: def.magAutomatisch };
  });

  const meetellend = stappen.filter((s) => !s.nvt);
  const volgende = stappen.find((s) => !s.nvt && s.stand === "klaar-om-te-starten")?.sleutel || null;

  return {
    cluster,
    stappen,
    klaar: meetellend.filter((s) => s.stand === "klaar" || s.stand === "overgeslagen").length,
    totaal: meetellend.length,
    volgende,
  };
}

/**
 * Mag deze stap nu starten? Geeft de reden terug als het niet mag, want een knop
 * die niets doet zonder uitleg is erger dan geen knop.
 */
export function magStarten(draaiboek: Draaiboek, sleutel: StapSleutel): { ok: boolean; reden: string } {
  const stap = draaiboek.stappen.find((s) => s.sleutel === sleutel);
  if (!stap) return { ok: false, reden: "Die stap bestaat niet." };
  if (stap.nvt) return { ok: false, reden: "Deze stap is niet van toepassing op dit blok." };
  if (stap.stand === "bezig") return { ok: false, reden: "Deze stap loopt al." };
  if (stap.stand === "klaar") return { ok: false, reden: "Deze stap is al klaar." };
  if (stap.wachtOp) return { ok: false, reden: stap.wachtOp };
  return { ok: true, reden: "" };
}

// ═══════════════════════════════════════════════════════════
// OPSLAG
// ═══════════════════════════════════════════════════════════

const SCHEMA_VERSIE = "cluster_draaiboek-aff918ed";

function ensureTable(): Promise<void> {
  return eenmalig("cluster_draaiboek", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_cluster_stappen (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      cluster     TEXT NOT NULL,
      stap        TEXT NOT NULL,
      stand       TEXT NOT NULL DEFAULT 'wacht',
      modus       TEXT NOT NULL DEFAULT 'handmatig',
      gestart_op  TIMESTAMPTZ,
      klaar_op    TIMESTAMPTZ,
      resultaat   TEXT NOT NULL DEFAULT '',
      notitie     TEXT NOT NULL DEFAULT '',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_cluster_stap ON client_cluster_stappen (client_slug, cluster, stap)`;
}

export async function getStanden(slug: string, cluster: string): Promise<StapStand[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT stap, stand, modus, gestart_op, klaar_op, resultaat, notitie
    FROM client_cluster_stappen WHERE client_slug = ${slug} AND cluster = ${cluster}`;
  return rows.map((r) => ({
    sleutel: r.stap as StapSleutel,
    stand: (r.stand as Stand) || "wacht",
    modus: (r.modus as Modus) || "handmatig",
    gestartOp: r.gestart_op ? new Date(r.gestart_op as string).toISOString() : "",
    klaarOp: r.klaar_op ? new Date(r.klaar_op as string).toISOString() : "",
    resultaat: (r.resultaat as string) || "",
    notitie: (r.notitie as string) || "",
  }));
}

/** Alle standen van alle blokken van een klant, voor de voortgangsstreep op de kaarten. */
export async function getAlleStanden(slug: string): Promise<Record<string, StapStand[]>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT cluster, stap, stand, modus, gestart_op, klaar_op, resultaat, notitie
    FROM client_cluster_stappen WHERE client_slug = ${slug}`;
  const uit: Record<string, StapStand[]> = {};
  for (const r of rows) {
    const c = r.cluster as string;
    if (!uit[c]) uit[c] = [];
    uit[c].push({
      sleutel: r.stap as StapSleutel,
      stand: (r.stand as Stand) || "wacht",
      modus: (r.modus as Modus) || "handmatig",
      gestartOp: r.gestart_op ? new Date(r.gestart_op as string).toISOString() : "",
      klaarOp: r.klaar_op ? new Date(r.klaar_op as string).toISOString() : "",
      resultaat: (r.resultaat as string) || "",
      notitie: (r.notitie as string) || "",
    });
  }
  return uit;
}

export async function zetStand(
  slug: string, cluster: string, stap: StapSleutel,
  patch: { stand?: Stand; modus?: Modus; resultaat?: string; notitie?: string },
): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const nu = new Date().toISOString();
  const gestart = patch.stand === "bezig" ? nu : null;
  const klaar = patch.stand === "klaar" || patch.stand === "overgeslagen" ? nu : null;
  await sql`
    INSERT INTO client_cluster_stappen (client_slug, cluster, stap, stand, modus, gestart_op, klaar_op, resultaat, notitie)
    VALUES (${slug}, ${cluster}, ${stap}, ${patch.stand || "wacht"}, ${patch.modus || "handmatig"},
            ${gestart}, ${klaar}, ${patch.resultaat || ""}, ${patch.notitie || ""})
    ON CONFLICT (client_slug, cluster, stap) DO UPDATE SET
      stand      = COALESCE(${patch.stand || null}, client_cluster_stappen.stand),
      modus      = COALESCE(${patch.modus || null}, client_cluster_stappen.modus),
      gestart_op = COALESCE(${gestart}, client_cluster_stappen.gestart_op),
      klaar_op   = CASE WHEN ${klaar}::timestamptz IS NOT NULL THEN ${klaar}::timestamptz
                        WHEN ${patch.stand || null} IN ('wacht','klaar-om-te-starten','bezig') THEN NULL
                        ELSE client_cluster_stappen.klaar_op END,
      resultaat  = COALESCE(${patch.resultaat ?? null}, client_cluster_stappen.resultaat),
      notitie    = COALESCE(${patch.notitie ?? null}, client_cluster_stappen.notitie),
      updated_at = now()`;
}

/** Alles van dit blok terug naar het begin. */
export async function wisDraaiboek(slug: string, cluster: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`DELETE FROM client_cluster_stappen WHERE client_slug = ${slug} AND cluster = ${cluster}`;
}
