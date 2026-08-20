import { sql, ensureSchema } from "./db";
import { listClients, deleteClient, type ClientConfig } from "./clients";
import { faseVan } from "./klant-groepen";

// ═══════════════════════════════════════════════════════════
// TWEE KEER HETZELFDE BEDRIJF: HERKENNEN EN SAMENVOEGEN
// ═══════════════════════════════════════════════════════════
// Op 20-08-2026 kwamen de HubSpot-leads binnen naast leads die er met de hand
// al stonden: "Spijker en Prins" en "Hoveniersbedrijf Spijker & Prins",
// "Tudor Kozijnen" en "TUDOR", "Art Verde" en "Art-Verde Luxury Gardens". Twee
// rijen voor één bedrijf, elk met een deel van het verhaal: de handmatige rij
// heeft de bedragen en de kans, de opgehaalde rij de HubSpot-koppeling en de
// opvolgdatum.
//
// DE REGEL DIE DIT VEILIG HOUDT: er gaat nooit iets verloren. De rij die je
// bewaart wint op elk veld dat hij zelf gevuld heeft; alles wat daar leeg is
// wordt aangevuld uit de andere rij, en alles wat aan de andere rij hangt
// (dossier, documenten, mail, taken, de HubSpot-koppeling) verhuist mee. Pas
// daarna verdwijnt de lege huls.
//
// Het herkennen is met opzet voorzichtig: het stelt paren vóór, het voegt nooit
// vanzelf samen. Een verkeerde samenvoeging is niet terug te draaien, dus de
// keuze blijft bij Maarten.
// ═══════════════════════════════════════════════════════════

/** Woorden die niets zeggen over wélk bedrijf het is. */
const RUIS = new Set([
  "de", "het", "een", "en", "van", "der", "den", "bv", "b", "v", "nv", "vof", "cv",
  "holding", "groep", "group", "nederland", "nl", "com", "the", "and",
  "hoveniersbedrijf", "hoveniers", "bedrijf", "onderneming", "handelsonderneming",
]);

/** Naam naar losse, betekenisvolle woorden: "Art-Verde Luxury" → [artverde? nee] */
function woorden(naam: string): string[] {
  return String(naam || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !RUIS.has(w));
}

/** Alles aan elkaar, zonder tekens: "Art-Verde" → "artverde". */
function plat(naam: string): string {
  return String(naam || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

function domein(d: string | null): string {
  return String(d || "").toLowerCase().replace(/^www\./, "").replace(/\/+$/, "").trim();
}

/**
 * Lijken deze twee bedrijven op elkaar? Alleen ja bij een echt signaal:
 * hetzelfde webadres, dezelfde naam aan elkaar geschreven, of alle
 * betekenisvolle woorden van de korte naam komen terug in de lange.
 */
export function lijktOpElkaar(a: ClientConfig, b: ClientConfig): string {
  const da = domein(a.domain);
  const db = domein(b.domain);
  if (da && db && da === db) return "zelfde website";

  const pa = plat(a.name);
  const pb = plat(b.name);
  if (pa && pb && pa === pb) return "zelfde naam";
  if (pa && pb && (pa.startsWith(pb) || pb.startsWith(pa))) return "naam begint hetzelfde";

  const wa = woorden(a.name);
  const wb = woorden(b.name);
  if (!wa.length || !wb.length) return "";
  const kort = wa.length <= wb.length ? wa : wb;
  const lang = wa.length <= wb.length ? wb : wa;
  const allemaal = kort.every((w) => lang.includes(w));
  // Eén gedeeld woord is te weinig als dat woord de branche is ("badkamers");
  // twee gedeelde woorden, of één woord dat ook nog eens de hele korte naam is,
  // is wél een signaal.
  if (allemaal && kort.length >= 2) return `zelfde woorden: ${kort.join(" ")}`;
  if (allemaal && kort.length === 1 && lang.includes(kort[0]) && kort[0].length >= 4) {
    return `${kort[0]} komt in beide namen voor`;
  }
  return "";
}

export type DubbelPaar = {
  /** De rij die blijft staan (met de bedragen), en de rij die erin opgaat. */
  behoud: { slug: string; naam: string; domein: string | null; bedrag: number; fase: string };
  weg: { slug: string; naam: string; domein: string | null; bedrag: number; fase: string };
  waarom: string;
  /** Wat de weg-rij meebrengt, in gewone taal. */
  meeneemt: string[];
};

/** Hoeveel "eigen werk" zit er in deze rij? Die met het meeste blijft staan. */
function gewicht(c: ClientConfig): number {
  return (c.budget.maandbudget > 0 ? 100 : 0)
    + (c.budget.linkbuilding > 0 ? 10 : 0)
    + (c.loginEnabled ? 50 : 0)
    + (c.cockpit.notes ? 5 : 0)
    + (c.domain ? 1 : 0);
}

/**
 * Zoekt paren die hetzelfde bedrijf lijken te zijn. Alleen binnen leads en
 * afgesloten leads; een lopende klant raken we hier niet aan.
 */
export async function vindDubbelen(): Promise<DubbelPaar[]> {
  await ensureSchema();
  const klanten = await listClients();
  const kandidaten = klanten.filter((k) => {
    const f = faseVan(k);
    return f === "lead" || f === "verloren";
  });

  const [dossier, docs] = await Promise.all([
    tellPerSlug("lead_dossier").catch(() => new Map<string, number>()),
    tellPerSlug("lead_docs").catch(() => new Map<string, number>()),
  ]);
  const koppeling = await slugsMetHubspot().catch(() => new Set<string>());

  const gezien = new Set<string>();
  const paren: DubbelPaar[] = [];
  for (let i = 0; i < kandidaten.length; i++) {
    for (let j = i + 1; j < kandidaten.length; j++) {
      const a = kandidaten[i];
      const b = kandidaten[j];
      if (gezien.has(a.slug) || gezien.has(b.slug)) continue;
      const waarom = lijktOpElkaar(a, b);
      if (!waarom) continue;
      const [behoud, weg] = gewicht(a) >= gewicht(b) ? [a, b] : [b, a];
      gezien.add(a.slug); gezien.add(b.slug);
      const meeneemt: string[] = [];
      if (koppeling.has(weg.slug)) meeneemt.push("de HubSpot-koppeling en de opvolgdatum");
      if (!behoud.domain && weg.domain) meeneemt.push(`de website ${weg.domain}`);
      if (!behoud.email && weg.email) meeneemt.push(`het mailadres ${weg.email}`);
      const d = dossier.get(weg.slug) || 0;
      if (d) meeneemt.push(`${d} stuk${d === 1 ? "" : "ken"} uit het dossier`);
      const dc = docs.get(weg.slug) || 0;
      if (dc) meeneemt.push(`${dc} document${dc === 1 ? "" : "en"}`);
      paren.push({
        behoud: { slug: behoud.slug, naam: behoud.name, domein: behoud.domain, bedrag: behoud.budget.maandbudget, fase: faseVan(behoud) },
        weg: { slug: weg.slug, naam: weg.name, domein: weg.domain, bedrag: weg.budget.maandbudget, fase: faseVan(weg) },
        waarom,
        meeneemt,
      });
    }
  }
  return paren;
}

async function tellPerSlug(tabel: string): Promise<Map<string, number>> {
  const { rows } = await sql.query<{ client_slug: string; n: number }>(
    `SELECT client_slug, COUNT(*)::int AS n FROM ${tabel} GROUP BY client_slug`,
  );
  return new Map(rows.map((r) => [r.client_slug, Number(r.n)]));
}

async function slugsMetHubspot(): Promise<Set<string>> {
  const { rows } = await sql<{ client_slug: string }>`SELECT client_slug FROM hubspot_lead`;
  return new Set(rows.map((r) => r.client_slug));
}

/** Elke tabel in deze database die een client_slug heeft. */
async function tabellenMetSlug(): Promise<string[]> {
  const { rows } = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'client_slug'
    ORDER BY table_name`;
  // Alleen echte, veilige tabelnamen; deze naam gaat in de querytekst en mag
  // dus nooit iets anders kunnen zijn dan letters, cijfers en liggende streepjes.
  return rows.map((r) => r.table_name).filter((t) => /^[a-z0-9_]+$/.test(t));
}

export type SamenvoegUitkomst = {
  ok: boolean;
  melding: string;
  verplaatst: number;
  tabellen: number;
};

/**
 * Voegt twee bedrijven samen: alles van `wegSlug` verhuist naar `behoudSlug`,
 * lege velden op de behouden rij worden aangevuld, en daarna verdwijnt de lege
 * rij. Onomkeerbaar, dus dit gebeurt alleen op een knop.
 */
export async function voegSamen(behoudSlug: string, wegSlug: string): Promise<SamenvoegUitkomst> {
  await ensureSchema();
  if (!behoudSlug || !wegSlug || behoudSlug === wegSlug) {
    return { ok: false, melding: "Twee verschillende bedrijven nodig.", verplaatst: 0, tabellen: 0 };
  }
  const klanten = await listClients();
  const behoud = klanten.find((k) => k.slug === behoudSlug);
  const weg = klanten.find((k) => k.slug === wegSlug);
  if (!behoud || !weg) {
    return { ok: false, melding: "Een van de twee bestaat niet meer.", verplaatst: 0, tabellen: 0 };
  }

  // 1. Lege velden op de behouden rij aanvullen uit de rij die weggaat.
  await sql`
    UPDATE clients SET
      domain               = COALESCE(NULLIF(domain, ''), ${weg.domain || null}),
      email                = COALESCE(NULLIF(email, ''), ${weg.email || null}),
      opvolg_datum         = COALESCE(opvolg_datum, ${weg.opvolgDatum || null}),
      seo_profile          = COALESCE(NULLIF(seo_profile, ''), ${weg.seoProfile || null}),
      ahrefs_project_id    = COALESCE(NULLIF(ahrefs_project_id, ''), ${weg.ahrefsProjectId || null}),
      moneybird_contact_id = COALESCE(NULLIF(moneybird_contact_id, ''), ${weg.moneybirdContactId || null}),
      backend_url          = COALESCE(NULLIF(backend_url, ''), ${weg.backendUrl || null}),
      notes                = COALESCE(NULLIF(notes, ''), ${weg.cockpit.notes || null})
    WHERE slug = ${behoudSlug}`;

  // 2. Alles wat aan de weg-rij hangt verhuist. Botst het (een tabel die maar
  //    één rij per bedrijf toestaat, zoals de prognose-regel of de
  //    HubSpot-koppeling), dan wint wat er al bij de behouden rij stond en gaat
  //    de dubbele weg; dat is precies de bedoeling van "de behouden rij wint".
  const tabellen = await tabellenMetSlug();
  let verplaatst = 0;
  for (const t of tabellen) {
    try {
      const r = await sql.query(`UPDATE ${t} SET client_slug = $1 WHERE client_slug = $2`, [behoudSlug, wegSlug]);
      verplaatst += r.rowCount || 0;
    } catch {
      try { await sql.query(`DELETE FROM ${t} WHERE client_slug = $1`, [wegSlug]); } catch { /* tabel bestaat niet meer */ }
    }
  }

  // 3. De lege huls weg.
  await deleteClient(wegSlug);

  return {
    ok: true,
    melding: `${weg.name} is opgegaan in ${behoud.name}.`,
    verplaatst,
    tabellen: tabellen.length,
  };
}
