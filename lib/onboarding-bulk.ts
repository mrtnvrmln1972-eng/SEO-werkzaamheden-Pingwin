import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { listClients } from "./clients";
import { getAhrefsSubscriptionUsage, ahrefsConfigured } from "./ahrefs";
import { getOnboardingStand, wisSignaalCache } from "./onboarding";
import { GOLVEN, GOLF_STAPPEN, GOLF_UNITS, GOLF_CENT, BODEM_UNITS, isGolf, type Golf, type Rij, type BulkStand, type Raming } from "./onboarding-golven";
import { draaiOnboardingRun, startOnboardingRun, getOnboardingRun } from "./onboarding-run";

// ═══════════════════════════════════════════════════════════
// ALLE KLANTEN ONBOARDEN, ZONDER DE MAAND LEEG TE TREKKEN
// ═══════════════════════════════════════════════════════════
// Achttien klanten met de hand langslopen is zonde van de tijd, maar ze allemaal
// tegelijk starten kan niet: een volledige onboarding kost ongeveer 80.000
// Ahrefs-units per klant, dus achttien klanten is 1,4 miljoen. Dat is bijna vier
// maanden budget, en meer dan er in een heel kwartaal verbruikt is.
//
// Vandaar drie dingen die hier samen in zitten:
//
//  1. GOLVEN. De onderdelen zijn gesorteerd op prijs. Golf 1 is bijna gratis en
//     is precies de basis waar alle andere scans op wachten. De dure onderdelen
//     zitten in latere golven, die je bewust aanzet.
//  2. EEN WACHTRIJ, GEEN ZWERM. Eén klant tegelijk. Achttien onboardings naast
//     elkaar leggen de server om en je ziet niet meer waar je bent.
//  3. EEN REM. Vóór elke klant wordt bij Ahrefs opgevraagd hoeveel er nog over
//     is. Zakt dat onder de bodem, dan stopt de rij zichzelf en zegt waarom.
//     Zo kan een bulkrun je maand nooit leegtrekken.
//
// De tarieven hieronder zijn niet uit de handleiding maar afgelezen uit het
// echte API-verbruik-log van 6 augustus 2026. De handleiding suggereert "rijen
// keer kolommen"; in de praktijk rekent Ahrefs fors meer per rij.
// ═══════════════════════════════════════════════════════════

// De golven, prijzen en typen staan in lib/onboarding-golven.ts, omdat het
// bulkscherm in de browser draait en dit bestand de database aanraakt. Hier
// alleen doorgeven, nooit een tweede kopie.
export * from "./onboarding-golven";

let tabelKlaar = false;
// De tabel wordt één keer gebouwd per database, niet bij elke aanroep
// opnieuw. Zie lib/schema-stand.ts. Verander je iets aan bouwEnsureTable(), hoog
// dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const ONBOARDING_BULK_VERSIE = "onboarding-bulk-b6bbc218";

function ensureTable(): Promise<void> {
  return eenmalig("onboarding-bulk", ONBOARDING_BULK_VERSIE, bouwEnsureTable);
}

async function bouwEnsureTable(): Promise<void> {
  if (tabelKlaar) return;
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS onboarding_bulk (
      client_slug TEXT PRIMARY KEY,
      golf        TEXT NOT NULL DEFAULT 'basis',
      status      TEXT NOT NULL DEFAULT 'wacht',
      error       TEXT,
      started_at  TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  tabelKlaar = true;
}

// ── Wat is er nog over bij Ahrefs ──
export async function tegoed(): Promise<{ over: number | null; limiet: number | null }> {
  if (!ahrefsConfigured()) return { over: null, limiet: null };
  const u = await getAhrefsSubscriptionUsage().catch(() => null);
  if (!u || u.limit == null || u.used == null) return { over: null, limiet: u?.limit ?? null };
  return { over: Math.max(0, u.limit - u.used), limiet: u.limit };
}

/**
 * De raming vóór de start: welke klanten hebben deze golf nog nodig, wat kost dat
 * bij elkaar, en past het in wat er nog over is. Dit is wat het scherm toont
 * voordat Maarten op start drukt; nooit een verrassing achteraf.
 */
export async function raming(golf: Golf, slugs?: string[]): Promise<Raming> {
  const klanten = (await listClients()).filter((c) => c.fase !== "lead" && (!slugs || slugs.includes(c.slug)));
  const uit: Raming["klanten"] = [];
  for (const c of klanten) {
    const stand = await getOnboardingStand(c.slug).catch(() => null);
    // Nodig zolang er in deze golf nog een stap open staat. Wat al staat wordt
    // overgeslagen, dus een klant die vorige week gedraaid heeft kost niets.
    const open = (stand?.stappen || []).filter((s) => (GOLF_STAPPEN[golf] as string[]).includes(s.key) && s.staat !== "af" && s.staat !== "bezig");
    // Klanten die Multimedia Concepts beheert doen we niet zelf; die staan wel
    // in de lijst (je moet ze kunnen aanvinken als je toch wilt), maar ze staan
    // niet standaard aan. Anders vink je ze elke ronde opnieuw af.
    uit.push({
      slug: c.slug, naam: c.name,
      nodig: open.length > 0,
      mist: open.map((s) => s.label),
      beheerdDoorAnder: (c.grp || "").trim().toLowerCase() === "mmc",
    });
  }
  const nodig = uit.filter((k) => k.nodig);
  const t = await tegoed();
  const units = nodig.length * GOLF_UNITS[golf];
  return {
    golf,
    klanten: uit,
    aantal: nodig.length,
    units,
    dollar: Math.round((nodig.length * GOLF_CENT[golf]) / 100 * 100) / 100,
    over: t.over,
    past: t.over == null ? true : t.over - units >= BODEM_UNITS,
    bodem: BODEM_UNITS,
  };
}

// ── De rij vullen ──
export async function zetInDeRij(golf: Golf, slugs: string[]): Promise<number> {
  await ensureTable();
  if (!slugs.length) return 0;
  // Een nieuwe rij vervangt de vorige: anders blijven mislukte pogingen van
  // vorige week meedraaien zonder dat iemand daarom vroeg.
  await sql`DELETE FROM onboarding_bulk WHERE status IN ('klaar', 'mislukt', 'afgebroken')`;
  let n = 0;
  for (const slug of slugs) {
    await sql`
      INSERT INTO onboarding_bulk (client_slug, golf, status, error, started_at, updated_at)
      VALUES (${slug}, ${golf}, 'wacht', NULL, NULL, now())
      ON CONFLICT (client_slug) DO UPDATE SET golf = ${golf}, status = 'wacht', error = NULL, started_at = NULL, updated_at = now()`;
    n++;
  }
  return n;
}

export async function stopDeRij(): Promise<number> {
  await ensureTable();
  const { rowCount } = await sql`UPDATE onboarding_bulk SET status = 'afgebroken', updated_at = now() WHERE status IN ('wacht', 'bezig')`;
  return rowCount || 0;
}

export async function getBulkStand(): Promise<BulkStand> {
  await ensureTable();
  const [uitDeTabel, t, namen] = await Promise.all([
    sql`SELECT client_slug, golf, status, error, started_at, updated_at FROM onboarding_bulk ORDER BY updated_at ASC`,
    tegoed(),
    listClients().then((cs) => new Map(cs.map((c) => [c.slug, c.name]))).catch(() => new Map<string, string>()),
  ]);
  let rows = uitDeTabel.rows;
  // Een klant die niet (meer) bestaat hoort niet in de rij te staan. Zo'n regel
  // bleef als "mislukt, deze klant bestaat niet" in beeld hangen terwijl er
  // niets meer te doen valt, en dat leest als werk dat nog open staat. Hij gaat
  // hier weg uit beeld én uit de tabel, zodat hij niet elke ronde terugkomt.
  // Alleen doen als de klantenlijst echt geladen is: bij een storing is `namen`
  // leeg, en dan zou dit de hele rij wissen.
  if (namen.size > 0) {
    const spoken = rows.map((r) => String(r.client_slug)).filter((s) => !namen.has(s));
    if (spoken.length) {
      rows = rows.filter((r) => namen.has(String(r.client_slug)));
      for (const slug of spoken) {
        await sql`DELETE FROM onboarding_bulk WHERE client_slug = ${slug}`;
      }
    }
  }
  const rijen: Rij[] = rows.map((r) => ({
    slug: String(r.client_slug),
    naam: namen.get(String(r.client_slug)) || String(r.client_slug),
    golf: isGolf(r.golf) ? r.golf : "basis",
    status: String(r.status) as Rij["status"],
    error: String(r.error || ""),
    gestart: r.started_at ? new Date(r.started_at as string).toISOString() : null,
    bijgewerkt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  }));
  const gestopt = rijen.find((r) => r.status === "afgebroken" && r.error)?.error || "";
  return {
    actief: rijen.some((r) => r.status === "wacht" || r.status === "bezig"),
    rijen,
    tegoed: { over: t.over, limiet: t.limiet, bodem: BODEM_UNITS },
    gestopt,
  };
}

// ═══════════════════════════════════════════════════════════
// DE WERKER
// ═══════════════════════════════════════════════════════════
// Pakt één klant, draait die af, en stopt. Wie hem aanroept (de knop via
// waitUntil, of de cron elke vijf minuten) bepaalt het tempo. Eén klant per tik
// betekent: je ziet altijd waar je bent, en een afgekapt serverless-venster kost
// hooguit één klant in plaats van de hele rij.

const STIL_MS = 45 * 60 * 1000; // een klant die drie kwartier "bezig" staat is doodgelopen

export async function verwerkVolgende(): Promise<{ gedaan: string | null; reden: string }> {
  await ensureTable();

  // Een blijven hangen klant eerst vrijgeven, anders blokkeert hij de rij.
  await sql`UPDATE onboarding_bulk SET status = 'mislukt', error = 'De rit is halverwege afgebroken; zet hem opnieuw in de rij.', updated_at = now()
            WHERE status = 'bezig' AND updated_at < now() - interval '45 minutes'`;

  const { rows: bezig } = await sql`SELECT client_slug FROM onboarding_bulk WHERE status = 'bezig' LIMIT 1`;
  if (bezig.length) return { gedaan: null, reden: `${bezig[0].client_slug} is nog bezig.` };

  const { rows } = await sql`SELECT client_slug, golf FROM onboarding_bulk WHERE status = 'wacht' ORDER BY updated_at ASC LIMIT 1`;
  if (!rows.length) return { gedaan: null, reden: "De rij is leeg." };
  const slug = String(rows[0].client_slug);
  const golf: Golf = isGolf(rows[0].golf) ? rows[0].golf : "basis";

  // ── De rem: past deze klant nog binnen het tegoed? ──
  const t = await tegoed();
  if (t.over != null && t.over - GOLF_UNITS[golf] < BODEM_UNITS) {
    const reden = `Gestopt om je Ahrefs-tegoed te sparen: er is nog ${t.over.toLocaleString("nl-NL")} over en deze golf kost ongeveer ${GOLF_UNITS[golf].toLocaleString("nl-NL")} per klant. De ondergrens staat op ${BODEM_UNITS.toLocaleString("nl-NL")}.`;
    await sql`UPDATE onboarding_bulk SET status = 'afgebroken', error = ${reden}, updated_at = now() WHERE status = 'wacht'`;
    return { gedaan: null, reden };
  }

  await sql`UPDATE onboarding_bulk SET status = 'bezig', started_at = now(), updated_at = now() WHERE client_slug = ${slug}`;

  try {
    // De bestaande onboarding-rit doet precies het goede: hij slaat over wat al
    // staat. Golf 2 en 3 komen daar vanzelf uit, want de scans die nog niet
    // gedraaid hebben worden gestart zodra hun voorwaarden kloppen.
    await startOnboardingRun(slug);
    await draaiOnboardingRun(slug, GOLF_STAPPEN[golf]);
    const run = await getOnboardingRun(slug).catch(() => null);
    const mislukt = run?.status === "error";
    await sql`UPDATE onboarding_bulk SET status = ${mislukt ? "mislukt" : "klaar"}, error = ${mislukt ? run?.error || "" : null}, updated_at = now() WHERE client_slug = ${slug}`;
    wisSignaalCache();
    return { gedaan: slug, reden: mislukt ? run?.error || "mislukt" : "klaar" };
  } catch (e) {
    await sql`UPDATE onboarding_bulk SET status = 'mislukt', error = ${(e as Error).message}, updated_at = now() WHERE client_slug = ${slug}`;
    return { gedaan: slug, reden: (e as Error).message };
  }
}

/** Meerdere klanten achter elkaar, tot het venster op raakt of de rij leeg is. */
export async function verwerkRij(maxKlanten = 3): Promise<{ gedaan: string[]; reden: string }> {
  const gedaan: string[] = [];
  let reden = "";
  for (let i = 0; i < maxKlanten; i++) {
    const r = await verwerkVolgende();
    reden = r.reden;
    if (!r.gedaan) break;
    gedaan.push(r.gedaan);
  }
  return { gedaan, reden };
}

export { STIL_MS };
