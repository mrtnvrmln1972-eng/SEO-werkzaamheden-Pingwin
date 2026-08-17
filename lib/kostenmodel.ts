import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";

// ═══════════════════════════════════════════════════════════
// HET KOSTENMODEL: WELKE KOSTEN HOREN BIJ WELKE OMZET
// ═══════════════════════════════════════════════════════════
// Pingwin heeft geen kostenpost per klant, maar drie manieren waarop kosten aan
// omzet vastzitten. Die staan hier als regels, en een regel past zichzelf toe.
// Dat is met opzet: een bedrag dat je per klant met de hand invult, is de dag
// nadat je een tarief wijzigt alweer verkeerd, en niemand die het merkt.
//
//   1. EEN PERCENTAGE VAN DE OMZET. De klanten van Multimedia Concepts worden
//      door Pingwin gefactureerd, maar MMC doet de uitvoering en factureert
//      daarvoor ongeveer 70% terug. Wijzig je het maandbedrag van zo'n klant,
//      dan beweegt de kostenkant vanzelf mee. Precies het soort regel dat je
//      nooit meer hoeft bij te werken.
//   2. EEN LEVERANCIER VERDELEN OVER EEN GROEP KLANTEN. De maandfactuur van de
//      linkbuilder dekt de linkbuilding van alle eigen SEO-klanten samen, zonder
//      uitsplitsing op de factuur. Het bedrag is bekend, de verdeling niet, dus
//      verdelen we naar rato van wat er per klant aan linkbuilding begroot is.
//   3. EEN LEVERANCIER ALS VASTE MAANDPOST. Hosting (Greenbug) en Google Ads
//      (Gladior) horen bij omzet die niet per klant in het dashboard staat.
//      Toerekenen aan een klant zou de marge van die klant vertekenen, want de
//      omzet die ertegenover staat telt hier niet mee. Dus: als maandpost, wél
//      in het totaal, niet toegerekend.
//
// ÉÉN REGEL VOORKOMT DUBBELTELLEN
// ───────────────────────────────
// Een klant die door een kostenregel gedekt wordt, gebruikt die regel. Een klant
// zonder regel gebruikt zijn eigen linkbuildingbedrag uit de klantrij. Nooit
// allebei. "Overige kosten" bij een klant tellen altijd op, want die vult
// Maarten met de hand en dat is een bewuste keuze.
// ═══════════════════════════════════════════════════════════

export const KOSTEN_SOORTEN = ["percentage", "verdeel", "vast"] as const;
export type KostenSoort = (typeof KOSTEN_SOORTEN)[number];

/**
 * Op wie een regel slaat.
 *  - "mmc"           klanten in de groep Multimedia Concepts
 *  - "eigen"         eigen Pingwin-klanten (geen groep)
 *  - "alle"          alle klanten
 *  - "namen:a,b"     klanten waarvan de naam een van deze woorden bevat
 * Bij soort "vast" doet de doelgroep niets: die kosten worden niet toegerekend.
 */
export type Doelgroep = string;

export type KostenRegel = {
  id: number;
  naam: string;
  soort: KostenSoort;
  /** Naam van de leverancier in de boekhouding (voor "verdeel" en "vast"). */
  leverancier: string;
  /** Percentage van de omzet, alleen bij soort "percentage". */
  percentage: number;
  /** Maandbedrag, alleen bij "verdeel" en "vast". Wordt uit Moneybird gevuld. */
  bedrag: number;
  doelgroep: Doelgroep;
  actief: boolean;
  /** Waar het bedrag vandaan komt, in gewone taal. */
  bron: string;
};

type Row = {
  id: number; naam: string; soort: string; leverancier: string | null;
  percentage: string | number; bedrag: string | number; doelgroep: string | null;
  actief: boolean; bron: string | null;
};

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "kostenmodel-715f1e58";

function ensureTable(): Promise<void> {
  return eenmalig("kostenmodel", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS prognose_kostenregel (
      id           SERIAL PRIMARY KEY,
      naam         TEXT NOT NULL,
      soort        TEXT NOT NULL DEFAULT 'vast',
      leverancier  TEXT,
      percentage   NUMERIC NOT NULL DEFAULT 0,
      bedrag       NUMERIC NOT NULL DEFAULT 0,
      doelgroep    TEXT,
      actief       BOOLEAN NOT NULL DEFAULT true,
      bron         TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_kostenregel_naam ON prognose_kostenregel (naam)`;
}

// De regels zoals Pingwin ze op 15 augustus 2026 beschreef. Ze worden één keer
// neergezet en daarna nooit meer overschreven: past Maarten een percentage aan,
// dan blijft dat staan. Zo hoeft hij niets aan te vinken om te beginnen, maar
// is het wel van hem zodra hij er iets aan verandert.
const STANDAARD: Omit<KostenRegel, "id">[] = [
  {
    naam: "Uitvoering Multimedia Concepts",
    soort: "percentage",
    leverancier: "Multimedia Concepts",
    percentage: 70,
    bedrag: 0,
    doelgroep: "mmc",
    actief: true,
    bron: "MMC doet de uitvoering en factureert daarvoor een deel van wat jij die klanten factureert terug.",
  },
  {
    naam: "Linkbuilding eigen SEO-klanten",
    soort: "verdeel",
    leverancier: "Win Win",
    percentage: 0,
    bedrag: 0,
    doelgroep: "eigen",
    actief: true,
    bron: "De maandfactuur van de linkbuilder dekt alle eigen SEO-klanten samen; verdeeld naar rato van het linkbuildingbudget per klant.",
  },
  {
    naam: "Hosting en updateservice",
    soort: "vast",
    leverancier: "Greenbug",
    percentage: 0,
    bedrag: 0,
    doelgroep: "",
    actief: true,
    bron: "Staat tegenover de hosting- en updatefacturen. Bewust niet per klant uitgesplitst.",
  },
  {
    naam: "Google Ads",
    soort: "vast",
    leverancier: "Gladior",
    percentage: 0,
    bedrag: 0,
    doelgroep: "",
    actief: true,
    bron: "Staat tegenover de Ads-facturatie. Niet toegerekend aan een klant, want die Ads-omzet staat niet als maandbedrag in het dashboard.",
  },
];

function toRegel(r: Row): KostenRegel {
  return {
    id: r.id,
    naam: r.naam,
    soort: (KOSTEN_SOORTEN as readonly string[]).includes(r.soort) ? (r.soort as KostenSoort) : "vast",
    leverancier: r.leverancier || "",
    percentage: Number(r.percentage) || 0,
    bedrag: Number(r.bedrag) || 0,
    doelgroep: r.doelgroep || "",
    actief: r.actief !== false,
    bron: r.bron || "",
  };
}

/** De regels, met de standaardset erin als er nog niets stond. */
export async function listKostenregels(): Promise<KostenRegel[]> {
  await ensureTable();
  for (const s of STANDAARD) {
    await sql`
      INSERT INTO prognose_kostenregel (naam, soort, leverancier, percentage, bedrag, doelgroep, actief, bron)
      VALUES (${s.naam}, ${s.soort}, ${s.leverancier}, ${s.percentage}, ${s.bedrag}, ${s.doelgroep}, ${s.actief}, ${s.bron})
      ON CONFLICT (naam) DO NOTHING`;
  }
  const { rows } = await sql<Row>`SELECT * FROM prognose_kostenregel ORDER BY id`;
  return rows.map(toRegel);
}

export async function saveKostenregel(id: number, p: { percentage?: number; bedrag?: number; actief?: boolean; leverancier?: string; doelgroep?: string }): Promise<void> {
  await ensureTable();
  const { rows } = await sql<Row>`SELECT * FROM prognose_kostenregel WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) throw new Error("Die kostenregel bestaat niet.");
  const h = toRegel(rows[0]);
  await sql`
    UPDATE prognose_kostenregel SET
      percentage  = ${p.percentage !== undefined ? Math.min(100, Math.max(0, p.percentage)) : h.percentage},
      bedrag      = ${p.bedrag !== undefined ? Math.max(0, p.bedrag) : h.bedrag},
      actief      = ${p.actief !== undefined ? !!p.actief : h.actief},
      leverancier = ${p.leverancier !== undefined ? p.leverancier.trim() : h.leverancier},
      doelgroep   = ${p.doelgroep !== undefined ? p.doelgroep.trim() : h.doelgroep}
    WHERE id = ${id}`;
}

// ── De regels toepassen ──

/** Eén kostenregel op één klant, met de naam erbij zodat het scherm het uitlegt. */
export type KostenLijn = { naam: string; bedrag: number };

type KlantBron = {
  slug: string; name: string; fase: string; grp: string | null;
  budget: { maandbudget: number; linkbuilding: number };
};

/** Valt deze klant onder de doelgroep van een regel? */
export function inDoelgroep(klant: KlantBron, doelgroep: Doelgroep): boolean {
  const d = (doelgroep || "").trim().toLowerCase();
  if (!d) return false;
  if (d === "alle") return true;
  if (d === "eigen") return !klant.grp;
  if (d.startsWith("namen:")) {
    const woorden = d.slice(6).split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    const naam = klant.name.toLowerCase();
    return woorden.some((w) => w.length >= 3 && naam.includes(w));
  }
  return (klant.grp || "").toLowerCase() === d;
}

export type ToegepastKostenmodel = {
  /** Per klant de kostenregels die op hem slaan. Leeg = de klantrij is leidend. */
  perKlant: Map<string, KostenLijn[]>;
  /** Kosten die niet aan een klant worden toegerekend, één keer per maand. */
  vast: KostenLijn[];
  /** Waarschuwingen voor op het scherm, bijvoorbeeld een regel zonder bedrag. */
  meldingen: string[];
};

/**
 * Zet de regels om in bedragen per klant en per maand.
 *
 * Alleen klanten (geen leads) krijgen kosten uit dit model. Een lead heeft nog
 * geen leverancier die factureert, en zijn kosten worden in de prognose al met
 * zijn kans gewogen; die twee door elkaar halen geeft een bedrag dat niemand
 * kan navertellen.
 */
export function pasKostenmodelToe(klanten: KlantBron[], regels: KostenRegel[]): ToegepastKostenmodel {
  const perKlant = new Map<string, KostenLijn[]>();
  const vast: KostenLijn[] = [];
  const meldingen: string[] = [];
  const zet = (slug: string, lijn: KostenLijn) => {
    const lijst = perKlant.get(slug) || [];
    lijst.push(lijn);
    perKlant.set(slug, lijst);
  };

  for (const r of regels) {
    if (!r.actief) continue;

    if (r.soort === "vast") {
      if (r.bedrag > 0) vast.push({ naam: `${r.naam} (${r.leverancier})`, bedrag: r.bedrag });
      else meldingen.push(`${r.naam}: nog geen maandbedrag, haal het op uit de boekhouding.`);
      continue;
    }

    const doel = klanten.filter((k) => k.fase === "klant" && inDoelgroep(k, r.doelgroep));
    if (doel.length === 0) {
      meldingen.push(`${r.naam}: geen klanten in deze groep, de regel doet niets.`);
      continue;
    }

    if (r.soort === "percentage") {
      for (const k of doel) zet(k.slug, { naam: `${r.naam} (${r.percentage}%)`, bedrag: (k.budget.maandbudget * r.percentage) / 100 });
      continue;
    }

    // Verdelen naar rato van het linkbuildingbudget per klant. Staat dat nergens
    // ingevuld, dan is gelijk verdelen de eerlijkste aanname die we kunnen doen,
    // en dat wordt erbij gezegd in plaats van stilzwijgend gedaan.
    if (r.bedrag <= 0) {
      meldingen.push(`${r.naam}: nog geen maandbedrag, haal het op uit de boekhouding.`);
      continue;
    }
    const totaalSleutel = doel.reduce((s, k) => s + Math.max(0, k.budget.linkbuilding), 0);
    if (totaalSleutel > 0) {
      for (const k of doel) {
        const deel = Math.max(0, k.budget.linkbuilding) / totaalSleutel;
        if (deel > 0) zet(k.slug, { naam: r.naam, bedrag: r.bedrag * deel });
      }
    } else {
      meldingen.push(`${r.naam}: bij geen enkele klant staat een linkbuildingbedrag, dus gelijk verdeeld over ${doel.length} klanten.`);
      for (const k of doel) zet(k.slug, { naam: `${r.naam} (gelijk verdeeld)`, bedrag: r.bedrag / doel.length });
    }
  }

  return { perKlant, vast, meldingen };
}
