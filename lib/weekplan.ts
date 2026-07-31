// ═══════════════════════════════════════════════════════════
// WEEKPLANNING: taken uit een bird's eye-onderwerp, verdeeld over weken
// ═══════════════════════════════════════════════════════════
// Los van de maand-takenlijst (client_tasks). Elke taak hangt aan een week
// (ISO-weeknummer + jaar) en aan het onderwerp (thread) waar hij uit rolde.
// Slepen = de week bijwerken. Uitvoeren/mailen komt via de kaart in de UI.
// ═══════════════════════════════════════════════════════════

import { sql, ensureSchema } from "./db";

export type WeekplanTask = {
  id: number; thread: string; taak: string; toelichting: string; wie: string; url: string;
  taaktype: string; copyUrl: string; bronMail: string;
  weekYear: number; weekNo: number; status: string; sortOrder: number;
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
    SELECT id, thread, taak, toelichting, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order
    FROM client_weekplan WHERE client_slug = ${slug}
    ORDER BY week_year, week_no, sort_order, id`;
  return rows.map((r) => ({
    id: r.id as number, thread: (r.thread as string) || "", taak: (r.taak as string) || "",
    toelichting: (r.toelichting as string) || "",
    wie: (r.wie as string) || "SEO", url: (r.url as string) || "",
    taaktype: (r.taaktype as string) || "", copyUrl: (r.copy_url as string) || "", bronMail: (r.bron_mail as string) || "",
    weekYear: r.week_year as number, weekNo: r.week_no as number,
    status: (r.status as string) || "gepland", sortOrder: r.sort_order as number,
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
export async function addWeekplanTasks(slug: string, thread: string, tasks: { taak: string; toelichting?: string; wie?: string; url?: string; taaktype?: string; copyUrl?: string; bronMail?: string; week: { year: number; week: number } }[]): Promise<{ added: number; merged: number }> {
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
  return { added, merged };
}

export async function updateWeekplanTask(slug: string, id: number, patch: { weekYear?: number; weekNo?: number; status?: string; sortOrder?: number }): Promise<void> {
  await ensureSchema();
  const weekYear = patch.weekYear ?? null;
  const weekNo = patch.weekNo ?? null;
  const status = patch.status ?? null;
  const sortOrder = patch.sortOrder ?? null;
  await sql`
    UPDATE client_weekplan SET
      week_year  = COALESCE(${weekYear}, week_year),
      week_no    = COALESCE(${weekNo}, week_no),
      status     = COALESCE(${status}, status),
      sort_order = COALESCE(${sortOrder}, sort_order),
      updated_at = now()
    WHERE client_slug = ${slug} AND id = ${id}`;
}

export async function deleteWeekplanTask(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id}`;
}
