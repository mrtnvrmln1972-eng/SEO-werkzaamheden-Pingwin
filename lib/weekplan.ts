// ═══════════════════════════════════════════════════════════
// WEEKPLANNING: taken uit een bird's eye-onderwerp, verdeeld over weken
// ═══════════════════════════════════════════════════════════
// Los van de maand-takenlijst (client_tasks). Elke taak hangt aan een week
// (ISO-weeknummer + jaar) en aan het onderwerp (thread) waar hij uit rolde.
// Slepen = de week bijwerken. Uitvoeren/mailen komt via de kaart in de UI.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";

export type WeekplanTask = {
  id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; naarDev?: boolean;
  taaktype: string; copyUrl: string; bronMail: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
  /** De gekozen dag als "2026-08-06", of "" als er alleen een week bekend is. */
  datum: string;
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
    SELECT id, thread, taak, toelichting, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order, naar_dev,
           to_char(datum, 'YYYY-MM-DD') AS datum
    FROM client_weekplan WHERE client_slug = ${slug}
    ORDER BY week_year, week_no, sort_order, id`;
  return rows.map((r) => ({
    id: r.id as number, thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    naarDev: r.naar_dev === true,
    wie: (r.wie as string) || "SEO", url: (r.url as string) || "",
    taaktype: (r.taaktype as string) || "", copyUrl: (r.copy_url as string) || "", bronMail: (r.bron_mail as string) || "",
    weekYear: r.week_year as number, weekNo: r.week_no as number,
    status: (r.status as string) || "gepland", sortOrder: r.sort_order as number,
    datum: (r.datum as string) || "",
  }));
}

// Normaliseert een toelichting-regel voor dedup: trim, lowercase, leidend '- ' weg.
function lineKey(s: string): string {
  return s.trim().toLowerCase().replace(/^-\s*/, "");
}

// Voegt taken toe. Eén pagina = één projectkaart: bestaat er al een niet-klare
// kaart voor dezelfde pagina (ongeacht week), dan wordt de nieuwe taak daarin
// gemerged (titel + toelichting als bullets, met regel-dedup) in plaats van een
// tweede kaart te maken. De kaart houdt zijn week (waar Maarten hem sleepte).
export async function addWeekplanTasks(slug: string, thread: string, tasks: { taak: string; toelichting?: string; wie?: string; url?: string; taaktype?: string; copyUrl?: string; bronMail?: string; week: { year: number; week: number } }[]): Promise<{ added: number; merged: number; mergedIds: number[] }> {
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
  for (const t of tasks) {
    const taak = (t.taak || "").trim();
    if (!taak) continue;
    const url = (t.url || "").trim().slice(0, 400) || null;
    const toel = (t.toelichting || "").trim().slice(0, 4000) || null;
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
        const toelNieuw = `${bestaand.toelichting}\n${nieuw.join("\n")}`.trim().slice(0, 4000);
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
    await sql`
      INSERT INTO client_weekplan (client_slug, thread, taak, toelichting, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order, updated_at)
      VALUES (${slug}, ${thread || null}, ${taak.slice(0, 400)}, ${toel}, ${wie}, ${url}, ${taaktype}, ${copyUrl}, ${bronMail}, ${t.week.year}, ${t.week.week}, 'gepland', ${added}, now())`;
    if (url) {
      const { rows: ins } = await sql`SELECT id FROM client_weekplan WHERE client_slug = ${slug} AND url = ${url} AND status <> 'klaar' ORDER BY id DESC LIMIT 1`;
      if (ins[0]) byPage.set(urlKey(url), { id: ins[0].id as number, taak: taak.slice(0, 400), toelichting: toel || "", taaktype: taaktype || "", copyUrl: copyUrl || "", bronMail: bronMail || "" });
    }
    added++;
  }
  return { added, merged, mergedIds: [...mergedIds] };
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
export async function setWeekplanNaarDev(
  slug: string,
  id: number,
  naarDev: boolean,
  dev?: { taak?: string; toelichting?: string; docs?: { label: string; url: string }[] },
): Promise<void> {
  await ensureSchema();
  await sql`UPDATE client_weekplan SET naar_dev = ${naarDev}, naar_dev_at = ${naarDev ? new Date().toISOString() : null}, updated_at = now()
            WHERE client_slug = ${slug} AND id = ${id}`;
  if (!dev) return;
  // De doorgeefversie: alleen zetten wat is meegegeven, zodat je later één veld
  // kunt bijstellen zonder de rest kwijt te raken.
  const taak = dev.taak === undefined ? null : dev.taak.trim().slice(0, 300);
  const toel = dev.toelichting === undefined ? null : dev.toelichting.trim().slice(0, 4000);
  const docs = dev.docs === undefined ? null : JSON.stringify(dev.docs.slice(0, 8));
  await sql`
    UPDATE client_weekplan SET
      dev_taak        = COALESCE(${taak}, dev_taak),
      dev_toelichting = COALESCE(${toel}, dev_toelichting),
      dev_docs        = COALESCE(${docs}::jsonb, dev_docs),
      updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Wat er op dit moment naar de developer zou gaan (voor het doorzet-venster). */
export async function getWeekplanDev(slug: string, id: number): Promise<{ taak: string; toelichting: string; docs: { label: string; url: string }[] } | null> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT taak, toelichting, dev_taak, dev_toelichting, dev_docs
    FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    taak: String(r.dev_taak || r.taak || ""),
    toelichting: String(r.dev_toelichting || ""),
    docs: Array.isArray(r.dev_docs) ? (r.dev_docs as { label: string; url: string }[]) : [],
  };
}

export async function updateWeekplanToelichting(slug: string, id: number, toelichting: string): Promise<void> {
  await ensureSchema();
  await sql`UPDATE client_weekplan SET toelichting = ${toelichting.trim().slice(0, 4000)}, updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
}

// De titel (en de pagina) van een bestaande kaart bijstellen. Gebruikt door de
// terugwerkende splitsing: een kaart die over twee pagina's ging wordt de kaart
// van één pagina, met de opdracht ongewijzigd.
export async function setWeekplanKaart(slug: string, id: number, kaart: { taak: string; url?: string }): Promise<void> {
  await ensureSchema();
  const url = (kaart.url || "").trim().slice(0, 400) || null;
  await sql`
    UPDATE client_weekplan
    SET taak = ${kaart.taak.trim().slice(0, 300)}, url = COALESCE(${url}, url), updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

export async function deleteWeekplanTask(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id}`;
}
