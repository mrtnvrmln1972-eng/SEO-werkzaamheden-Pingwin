// ═══════════════════════════════════════════════════════════
// WEEKPLANNING: taken uit een bird's eye-onderwerp, verdeeld over weken
// ═══════════════════════════════════════════════════════════
// Los van de maand-takenlijst (client_tasks). Elke taak hangt aan een week
// (ISO-weeknummer + jaar) en aan het onderwerp (thread) waar hij uit rolde.
// Slepen = de week bijwerken. Uitvoeren/mailen komt via de kaart in de UI.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";

export type WeekplanTask = {
  /** Maartens eigen aantekeningen; geen automatische stap raakt dit veld aan. */
  notitie: string;
  id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; naarDev?: boolean;
  taaktype: string; copyUrl: string; bronMail: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
  /** De gekozen dag als "2026-08-06", of "" als er alleen een week bekend is. */
  datum: string;
  /** Heeft Maarten deze titel zelf getypt? Dan hernoemt geen enkele automaat hem. */
  taakHandmatig?: boolean;
  /** Hoeveel er in het archief van deze kaart staat (voor het label in de kaart). */
  archiefAantal?: number;
  /** Kant-en-klare inhoud (bijv. een contentagenda): toelichting toont ongewijzigd
      als markdown, niet via de Achtergrond/Aanpak-per-fase-indeling. */
  ruw?: boolean;
  /** Geschatte duur in minuten (werkplanning-proef), null als niet ingeschat. */
  estimateMin: number | null;
  /** Bewust laten staan zonder te doen: eigen stand naast "klaar" (taak-stand.ts). */
  genegeerd: boolean;
  /** Datum waarop genegeerd is gezet, "2026-08-06" of "" als niet van toepassing. */
  genegeerdOp: string;
};

// ISO-8601-weeknummer (maandag als eerste dag). Server en client berekenen dit
// los, dus geen afhankelijkheid nodig.
export function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;                 // maandag=0 … zondag=6
  date.setUTCDate(date.getUTCDate() - dayNr + 3);           // donderdag van deze week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNr + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: date.getUTCFullYear(), week };
}

export async function getWeekplan(slug: string): Promise<WeekplanTask[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, thread, taak, toelichting, notitie, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order, naar_dev,
           taak_handmatig, ruw, COALESCE(jsonb_array_length(archief), 0) AS archief_aantal,
           to_char(datum, 'YYYY-MM-DD') AS datum,
           estimate_min, genegeerd, to_char(genegeerd_op, 'YYYY-MM-DD') AS genegeerd_op
    FROM client_weekplan WHERE client_slug = ${slug}
    ORDER BY week_year, week_no, sort_order, id`;
  return rows.map((r) => ({
    id: r.id as number, thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    notitie: (r.notitie as string) || "",
    naarDev: r.naar_dev === true,
    wie: (r.wie as string) || "SEO", url: (r.url as string) || "",
    taaktype: (r.taaktype as string) || "", copyUrl: (r.copy_url as string) || "", bronMail: (r.bron_mail as string) || "",
    weekYear: r.week_year as number, weekNo: r.week_no as number,
    status: (r.status as string) || "gepland", sortOrder: r.sort_order as number,
    datum: (r.datum as string) || "",
    taakHandmatig: r.taak_handmatig === true,
    archiefAantal: Number(r.archief_aantal || 0),
    ruw: r.ruw === true,
    estimateMin: r.estimate_min == null ? null : Number(r.estimate_min),
    genegeerd: r.genegeerd === true,
    genegeerdOp: (r.genegeerd_op as string) || "",
  }));
}

/**
 * Alle weekplanning-taken van meerdere klanten in één keer, met de klantnaam
 * erbij. Voor het overzicht over alle klanten: dat vraagt niet "wat ligt er bij
 * deze klant" maar "wat ligt er vandaag en de komende weken", en dat is één
 * lijst die toevallig over negentien klanten heen loopt.
 *
 * Bewust één query in plaats van negentien keer getWeekplan: negentien losse
 * rondjes naar de database maken het overzicht traag terwijl het altijd dezelfde
 * tabel is.
 */
export async function getWeekplanAlleKlanten(
  slugs: string[] | null,
): Promise<(WeekplanTask & { slug: string; klant: string; klantMail: string })[]> {
  await ensureSchema();
  // slugs === null betekent "geen beperking" (de eigenaar). Een gast krijgt zijn
  // eigen lijst mee; een lege lijst hoort dus ook echt niets op te leveren.
  if (slugs && slugs.length === 0) return [];
  const mag = slugs ? new Set(slugs.map((s) => s.trim().toLowerCase())) : null;
  const { rows } = await sql`
    SELECT w.id, w.client_slug, c.name AS klant, c.email AS klant_mail, w.thread, w.taak, w.toelichting, w.notitie, w.wie, w.url, w.taaktype,
           w.copy_url, w.bron_mail, w.week_year, w.week_no, w.status, w.sort_order, w.naar_dev,
           w.taak_handmatig, w.ruw, COALESCE(jsonb_array_length(w.archief), 0) AS archief_aantal,
           to_char(w.datum, 'YYYY-MM-DD') AS datum,
           w.estimate_min, w.genegeerd, to_char(w.genegeerd_op, 'YYYY-MM-DD') AS genegeerd_op
    FROM client_weekplan w LEFT JOIN clients c ON c.slug = w.client_slug
    ORDER BY w.datum NULLS LAST, w.week_year, w.week_no, w.sort_order, w.id`;
  return rows.filter((r) => !mag || mag.has(String(r.client_slug || "").toLowerCase())).map((r) => ({
    id: r.id as number,
    slug: (r.client_slug as string) || "",
    klant: (r.klant as string) || (r.client_slug as string) || "",
    klantMail: (r.klant_mail as string) || "",
    thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    notitie: (r.notitie as string) || "",
    naarDev: r.naar_dev === true,
    wie: (r.wie as string) || "SEO", url: (r.url as string) || "",
    taaktype: (r.taaktype as string) || "", copyUrl: (r.copy_url as string) || "", bronMail: (r.bron_mail as string) || "",
    weekYear: r.week_year as number, weekNo: r.week_no as number,
    status: (r.status as string) || "gepland", sortOrder: r.sort_order as number,
    datum: (r.datum as string) || "",
    taakHandmatig: r.taak_handmatig === true,
    archiefAantal: Number(r.archief_aantal || 0),
    ruw: r.ruw === true,
    estimateMin: r.estimate_min == null ? null : Number(r.estimate_min),
    genegeerd: r.genegeerd === true,
    genegeerdOp: (r.genegeerd_op as string) || "",
  }));
}

// Normaliseert een toelichting-regel voor dedup: trim, lowercase, leidend '- ' weg.
function lineKey(s: string): string {
  return s.trim().toLowerCase().replace(/^-\s*/, "");
}

// ═══════════════════════════════════════════════════════════
// HET ARCHIEF VAN EEN KAART
// ═══════════════════════════════════════════════════════════
// Alles wat van de kaart af gaat, gaat hierheen: een oude titel, een oude
// kaarttekst voordat hij herschreven wordt, en regels die niet meer pasten.
// Zo raakt er niets kwijt en blijft de kaart toch leesbaar.
//
// Aanleiding (6 augustus 2026): twee van de drie Kamsteeg-kaarten stonden op
// precies 4000 tekens, de grens die de code zichzelf oplegde. De database kent
// die grens niet. Er verdween dus al informatie zonder dat iemand het zag, en
// het opruimen overschreef de tekst zonder terugweg.

export type ArchiefSoort = "titel" | "notities" | "overloop";
export type ArchiefItem = { op: string; soort: ArchiefSoort; tekst: string };

/** Zo lang mag de leesbare kaarttekst zijn. Het archief kent geen grens. */
export const TOELICHTING_MAX = 8000;
const ARCHIEF_MAX = 40;

export async function getArchief(slug: string, id: number): Promise<ArchiefItem[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT archief FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const a = rows[0]?.archief;
  return Array.isArray(a) ? (a as ArchiefItem[]) : [];
}

/** Zet iets in het archief, nieuwste eerst. Lege of identieke tekst slaat over. */
export async function voegArchief(slug: string, id: number, soort: ArchiefSoort, tekst: string): Promise<void> {
  const t = (tekst || "").trim();
  if (!t) return;
  const huidig = await getArchief(slug, id);
  if (huidig[0]?.soort === soort && huidig[0]?.tekst === t) return;
  const nieuw: ArchiefItem[] = [{ op: new Date().toISOString(), soort, tekst: t }, ...huidig].slice(0, ARCHIEF_MAX);
  await sql`UPDATE client_weekplan SET archief = ${JSON.stringify(nieuw)}::jsonb WHERE client_slug = ${slug} AND id = ${id}`;
}

/**
 * De kaarttekst binnen de grens brengen ZONDER stil af te kappen.
 *
 * Past hij niet, dan gaan de oudste regels naar het archief en blijven de
 * nieuwste staan. Eerder kapte `slice(0, 4000)` er gewoon het staartje af, en
 * dat is precies het soort grens dat geen foutmelding geeft maar wel informatie
 * kost. Elke plek die de toelichting schrijft gaat via deze functie.
 */
export async function pasInToelichting(slug: string, id: number, tekst: string): Promise<string> {
  const heel = (tekst || "").trim();
  if (heel.length <= TOELICHTING_MAX) return heel;
  const regels = heel.split("\n");
  const weg: string[] = [];
  let rest = regels;
  while (rest.join("\n").length > TOELICHTING_MAX && rest.length > 1) {
    weg.push(rest[0]);
    rest = rest.slice(1);
  }
  if (weg.length) await voegArchief(slug, id, "overloop", weg.join("\n"));
  return rest.join("\n").trim();
}

// Voegt taken toe. Eén pagina = één projectkaart: bestaat er al een niet-klare
// kaart voor dezelfde pagina (ongeacht week), dan wordt de nieuwe taak daarin
// gemerged (titel + toelichting als bullets, met regel-dedup) in plaats van een
// tweede kaart te maken. De kaart houdt zijn week (waar Maarten hem sleepte).
export async function addWeekplanTasks(slug: string, thread: string, tasks: { taak: string; toelichting?: string; wie?: string; url?: string; taaktype?: string; copyUrl?: string; bronMail?: string; ruw?: boolean; week: { year: number; week: number } }[]): Promise<{ added: number; merged: number; mergedIds: number[]; nieuweIds: number[] }> {
  await ensureSchema();
  const { urlKey } = await import("./url-key");
  // Bestaande niet-klare pagina-kaarten, op urlKey (JS-matching, niet in SQL te doen).
  const { rows: existing } = await sql`
    SELECT id, url, taak, toelichting, taaktype, copy_url, bron_mail FROM client_weekplan
    WHERE client_slug = ${slug} AND status <> 'klaar' AND url IS NOT NULL AND url <> ''`;
  const byPage = new Map<string, { id: number; taak: string; toelichting: string; taaktype: string; copyUrl: string; bronMail: string }>();
  for (const r of existing) {
    byPage.set(urlKey(String(r.url)), {
      id: r.id as number, taak: (r.taak as string) || "", toelichting: (r.toelichting as string) || "",
      taaktype: (r.taaktype as string) || "", copyUrl: (r.copy_url as string) || "", bronMail: (r.bron_mail as string) || "",
    });
  }
  let added = 0, merged = 0;
  // Welke bestaande kaarten iets kregen aangeplakt. De aanroeper laat die daarna
  // opruimen (lib/weekplan-tidy.ts): samenvoegen hoort een denkstap te zijn, niet
  // een plakstap, anders groeit dezelfde constatering in tien formuleringen aan.
  const mergedIds = new Set<number>();
  // De id's van de kaarten die hier écht nieuw zijn aangemaakt. Nodig om er
  // meteen een dag aan te kunnen hangen als je hem vanuit "Vandaag" toevoegt.
  const nieuweIds: number[] = [];
  for (const t of tasks) {
    const taak = (t.taak || "").trim();
    if (!taak) continue;
    const url = (t.url || "").trim().slice(0, 400) || null;
    const toel = (t.toelichting || "").trim().slice(0, TOELICHTING_MAX) || null;
    const taaktype = (t.taaktype || "").trim().slice(0, 40) || null;
    const copyUrl = (t.copyUrl || "").trim().slice(0, 600) || null;
    const bronMail = (t.bronMail || "").trim().slice(0, 600) || null;
    const wie = /dev/i.test(t.wie || "") ? "Dev" : "SEO";

    const bestaand = url ? byPage.get(urlKey(url)) : undefined;
    if (bestaand) {
      // Mergen in de bestaande projectkaart: nieuwe regels als bullets erbij,
      // identieke regels overslaan. Lege koppelingen aanvullen, week ongemoeid.
      const had = new Set(bestaand.toelichting.split("\n").map(lineKey).filter(Boolean));
      had.add(lineKey(bestaand.taak));
      const nieuw: string[] = [];
      // De nieuwe taaktitel alleen als bullet toevoegen als hij echt iets nieuws
      // zegt (geen herhaling van de kaarttitel, dat is ruis in het info-blok).
      if (!had.has(lineKey(taak))) { nieuw.push(`- ${taak}`); had.add(lineKey(taak)); }
      for (const regel of (toel || "").split("\n")) {
        const k = lineKey(regel);
        if (!k || had.has(k)) continue;
        nieuw.push(regel.trim().startsWith("-") ? regel.trim() : `- ${regel.trim()}`);
        had.add(k);
      }
      if (nieuw.length || (!bestaand.taaktype && taaktype) || (!bestaand.copyUrl && copyUrl) || (!bestaand.bronMail && bronMail)) {
        // Past het niet meer? Dan schuiven de OUDSTE regels naar het archief, niet
        // stil de nieuwste eraf. Zie pasInToelichting.
        const toelNieuw = await pasInToelichting(slug, bestaand.id, `${bestaand.toelichting}\n${nieuw.join("\n")}`.trim());
        await sql`
          UPDATE client_weekplan SET
            toelichting = ${toelNieuw},
            taaktype = COALESCE(NULLIF(taaktype, ''), ${taaktype}),
            copy_url = COALESCE(NULLIF(copy_url, ''), ${copyUrl}),
            bron_mail = COALESCE(NULLIF(bron_mail, ''), ${bronMail}),
            updated_at = now()
          WHERE client_slug = ${slug} AND id = ${bestaand.id}`;
        bestaand.toelichting = toelNieuw;
        mergedIds.add(bestaand.id);
        merged++;
      }
      continue;
    }

    // Dedup: dezelfde taak in dezelfde week voor deze klant niet nog eens toevoegen
    // (vangnet voor kaarten zonder pagina bij herhaald doorzetten).
    const { rows: dup } = await sql`
      SELECT 1 FROM client_weekplan
      WHERE client_slug = ${slug} AND week_year = ${t.week.year} AND week_no = ${t.week.week}
        AND lower(taak) = lower(${taak.slice(0, 400)}) LIMIT 1`;
    if (dup.length) continue;
    const { rows: verse } = await sql`
      INSERT INTO client_weekplan (client_slug, thread, taak, toelichting, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order, ruw, updated_at)
      VALUES (${slug}, ${thread || null}, ${taak.slice(0, 400)}, ${toel}, ${wie}, ${url}, ${taaktype}, ${copyUrl}, ${bronMail}, ${t.week.year}, ${t.week.week}, 'gepland', ${added}, ${!!t.ruw}, now())
      RETURNING id`;
    if (verse[0]) nieuweIds.push(verse[0].id as number);
    if (url) {
      const { rows: ins } = await sql`SELECT id FROM client_weekplan WHERE client_slug = ${slug} AND url = ${url} AND status <> 'klaar' ORDER BY id DESC LIMIT 1`;
      if (ins[0]) byPage.set(urlKey(url), { id: ins[0].id as number, taak: taak.slice(0, 400), toelichting: toel || "", taaktype: taaktype || "", copyUrl: copyUrl || "", bronMail: bronMail || "" });
    }
    added++;
  }
  return { added, merged, mergedIds: [...mergedIds], nieuweIds };
}

/**
 * Een afgevinkte taak hoort in "Wat we doen" te staan.
 *
 * De oude maand-takenlijst (client_tasks) deed dat al, de planning niet: vink je
 * hier een taak af, dan verdween hij van het scherm en stond er nergens meer dat
 * hij gebeurd is, laat staan wannéér. Precies het antwoord dat je later nodig
 * hebt, voor de verantwoording naar de klant en voor de eigen urenvraag.
 *
 * Stil bij een fout, en idempotent op het taak-id: nog een keer afvinken (of
 * terugzetten en opnieuw afvinken) levert één regel op, geen tweede.
 */
async function logAfgevinkteTaak(slug: string, id: number): Promise<void> {
  try {
    const { logActiviteit } = await import("./activiteit");
    const { rows } = await sql`
      SELECT taak, url, updated_at FROM client_weekplan
      WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
    const r = rows[0];
    if (!r) return;
    const tekst = String(r.taak || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!tekst) return;
    await logActiviteit({
      slug, soort: "taak", bron: "client_weekplan", bronId: id,
      url: (r.url as string) || null,
      intern: `Taak afgerond: ${tekst}`,
      klant: tekst,
    });
  } catch {
    /* stil: het logboek mag het afvinken zelf nooit laten mislukken */
  }
}

export async function updateWeekplanTask(slug: string, id: number, patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number; datum?: string | null }): Promise<void> {
  await ensureSchema();
  const weekYear = patch.weekYear ?? null;
  const weekNo = patch.weekNo ?? null;
  const status = patch.status ?? null;
  const sortOrder = patch.sortOrder ?? null;
  // De datum kan ook LEEGgemaakt worden, en dat kan COALESCE niet: daar is null
  // "niet meegestuurd". Vandaar de aparte vlag.
  const datumZetten = patch.datum !== undefined;
  const datum = patch.datum ? patch.datum : null;
  await sql`
    UPDATE client_weekplan SET
      week_year  = COALESCE(${weekYear}, week_year),
      week_no    = COALESCE(${weekNo}, week_no),
      status     = COALESCE(${status}, status),
      sort_order = COALESCE(${sortOrder}, sort_order),
      datum      = CASE WHEN ${datumZetten} THEN ${datum}::date ELSE datum END,
      updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
  if (status === "klaar") await logAfgevinkteTaak(slug, id);
}

// Herschreven kaarttekst opslaan (de "Ruim op"-knop; altijd door Maarten getriggerd).
/**
 * Zet een kaart op de developerpagina, of haalt hem er weer af.
 *
 * Die pagina werd alleen gevoed door de OUDE takentabel (client_tasks met status
 * "naar dev"). De weekplanning schreef daar niets in, ook niet als een kaart op Dev
 * stond, dus na de overstap was mailen het enige wat er nog over was. Dit hangt de
 * draad terug.
 */
/**
 * Welke titel de sitebouwer ziet.
 *
 * Bij het doorzetten mag je de opdracht anders formuleren dan op de kaart staat
 * ("Locaties aanhaken" op de kaart, "GMB vestigingen maken voor 1e 5 vestigingen"
 * voor de bouwer). Die eigen formulering hoort te blijven staan, want daar is
 * over nagedacht.
 *
 * Maar hij hoort niet te blijven staan als de kaart intussen iets ánders is
 * geworden. Dat was wél zo: de aantekeningen liepen mee (die worden live gelezen)
 * en de titel niet, dus je paste de kaart aan en de developer bleef de oude
 * formulering zien, zonder dat iets dat verraadde (gemeld 20-08-2026).
 *
 * Daarom onthouden we bij het doorzetten de kaarttitel van dat moment. Is de
 * kaart sindsdien veranderd, dan is de eigen formulering ingehaald en wint de
 * kaart weer. Formuleer je opnieuw, dan wint die weer, want dan schuift de basis
 * mee. Zonder basis (doorgezet van vóór deze regel) blijft het zoals het was.
 */
export function devTaakNu(kaartTaak: string, devTaak: string, basis: string): string {
  const kaart = String(kaartTaak || "").trim();
  const eigen = String(devTaak || "").trim();
  if (!eigen) return kaart;
  const b = String(basis || "").trim();
  if (b && b !== kaart) return kaart;   // de kaart is opgeschoven, de eigen tekst is ingehaald
  return eigen;
}

export async function setWeekplanNaarDev(
  slug: string,
  id: number,
  naarDev: boolean,
  dev?: { taak?: string; toelichting?: string; docs?: { label: string; url: string }[]; punten?: string[];
    /** De kaarttitel op het moment van doorzetten (zie dev_taak_basis). */
    kaartTaak?: string },
): Promise<void> {
  await ensureSchema();
  await sql`UPDATE client_weekplan SET naar_dev = ${naarDev}, naar_dev_at = ${naarDev ? new Date().toISOString() : null}, updated_at = now()
            WHERE client_slug = ${slug} AND id = ${id}`;
  if (!dev) return;
  // De doorgeefversie: alleen zetten wat is meegegeven, zodat je later één veld
  // kunt bijstellen zonder de rest kwijt te raken.
  const taak = dev.taak === undefined ? null : dev.taak.trim().slice(0, 300);
  // De kaarttitel van dit moment erbij: daar is de doorgeefversie op gebaseerd.
  // Verandert de kaarttitel later, dan weten we dat die eigen formulering is
  // ingehaald en tonen we weer de kaart (zie devTaakNu hieronder).
  const basis = dev.taak === undefined ? null : String(dev.kaartTaak || "").trim().slice(0, 300);
  const toel = dev.toelichting === undefined ? null : dev.toelichting.trim().slice(0, 4000);
  const docs = dev.docs === undefined ? null : JSON.stringify(dev.docs.slice(0, 8));
  const punten = dev.punten === undefined ? null : JSON.stringify(dev.punten.slice(0, 8));
  await sql`
    UPDATE client_weekplan SET
      dev_taak        = COALESCE(${taak}, dev_taak),
      dev_taak_basis  = COALESCE(${basis}, dev_taak_basis),
      dev_toelichting = COALESCE(${toel}, dev_toelichting),
      dev_docs        = COALESCE(${docs}::jsonb, dev_docs),
      dev_punten      = COALESCE(${punten}::jsonb, dev_punten),
      updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Wat er op dit moment naar de developer zou gaan (voor het doorzet-venster). */
export async function getWeekplanDev(slug: string, id: number): Promise<{ taak: string; toelichting: string; docs: { label: string; url: string }[]; punten: string[] } | null> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT taak, toelichting, dev_taak, dev_taak_basis, dev_toelichting, dev_docs, dev_punten
    FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    taak: devTaakNu(r.taak as string, r.dev_taak as string, r.dev_taak_basis as string),
    toelichting: String(r.dev_toelichting || ""),
    docs: Array.isArray(r.dev_docs) ? (r.dev_docs as { label: string; url: string }[]) : [],
    punten: Array.isArray(r.dev_punten) ? (r.dev_punten as string[]) : [],
  };
}

/**
 * De kaarttekst vervangen. De vórige tekst gaat eerst naar het archief, want
 * deze weg wordt ook gebruikt door het opruimen, en dat herschrijft in één keer
 * alles. Zonder dit vangnet kon een opruimbeurt zesendertig regels vervangen
 * zonder enige terugweg.
 */
export async function updateWeekplanToelichting(slug: string, id: number, toelichting: string): Promise<void> {
  await ensureSchema();
  const { rows } = await sql`SELECT toelichting FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const oud = String(rows[0]?.toelichting || "").trim();
  const nieuw = await pasInToelichting(slug, id, toelichting);
  if (oud && oud !== nieuw) await voegArchief(slug, id, "notities", oud);
  await sql`UPDATE client_weekplan SET toelichting = ${nieuw}, updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
}

// De titel (en de pagina) van een bestaande kaart bijstellen. Gebruikt door de
// terugwerkende splitsing: een kaart die over twee pagina's ging wordt de kaart
// van één pagina, met de opdracht ongewijzigd.
//
// `handmatig` betekent: Maarten heeft deze titel zelf getypt. Vanaf dat moment
// blijft hij staan; geen enkele automaat hernoemt hem nog. Zonder die vlag zou
// de eerstvolgende keer dat de planning geladen wordt zijn titel overschrijven.
export async function setWeekplanKaart(slug: string, id: number, kaart: { taak: string; url?: string; handmatig?: boolean }): Promise<void> {
  await ensureSchema();
  const url = (kaart.url || "").trim().slice(0, 400) || null;
  await sql`
    UPDATE client_weekplan
    SET taak = ${kaart.taak.trim().slice(0, 300)},
        url = COALESCE(${url}, url),
        taak_handmatig = ${kaart.handmatig === true} OR taak_handmatig,
        updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

export async function deleteWeekplanTask(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Maartens eigen aantekeningen bij een kaart opslaan. */
export async function setWeekplanNotitie(slug: string, id: number, notitie: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE client_weekplan SET notitie = ${(notitie || "").slice(0, 20000)}, updated_at = now()
            WHERE client_slug = ${slug} AND id = ${id}`;
}

// ═══════════════════════════════════════════════════════════
// WERKPLANNING-PROEF: tijdsinschatting, negeren, cluster vooraan zetten
// ═══════════════════════════════════════════════════════════
// Drie kleine, losstaande uitbreidingen op de bestaande weekplanning. Geen van
// drieën raakt de status-vertaling in taak-stand.ts: "genegeerd" is een eigen
// vlag naast status/naar_dev, net zoals naar_dev dat zelf ook is.

/** Geschatte duur in minuten opslaan, of leegmaken met null. */
export async function setWeekplanEstimate(slug: string, id: number, min: number | null): Promise<void> {
  await ensureSchema();
  const waarde = min == null || !Number.isFinite(min) ? null : Math.max(0, Math.round(min));
  await sql`UPDATE client_weekplan SET estimate_min = ${waarde}, updated_at = now()
            WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Een taak negeren (blijft bestaan, doorgestreept) of terugzetten. */
export async function setWeekplanGenegeerd(slug: string, id: number, genegeerd: boolean): Promise<void> {
  await ensureSchema();
  await sql`UPDATE client_weekplan SET genegeerd = ${genegeerd}, genegeerd_op = ${genegeerd ? new Date().toISOString() : null},
            updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
}

/**
 * Alle taken van één cluster (thread) vooraan zetten, zelfde truc als
 * zetPrioriteit in lib/tweaks.ts: onder de laagste bestaande sort_order gaan
 * staan, zodat de kaart bovenaan sorteert zonder alle andere kaarten te
 * hoeven verschuiven.
 */
export async function boostThread(slug: string, thread: string): Promise<void> {
  await ensureSchema();
  const { rows } = await sql`SELECT COALESCE(MIN(sort_order), 10) - 10 AS nieuw FROM client_weekplan WHERE client_slug = ${slug}`;
  const basis = Number(rows[0]?.nieuw ?? 0);
  await sql`
    UPDATE client_weekplan SET sort_order = ${basis} + (id - (SELECT MIN(id) FROM client_weekplan WHERE client_slug = ${slug} AND thread = ${thread})), updated_at = now()
    WHERE client_slug = ${slug} AND thread = ${thread} AND status <> 'klaar' AND genegeerd = false`;
}
