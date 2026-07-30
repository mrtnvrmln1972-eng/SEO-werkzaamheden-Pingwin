import { sql, ensureSchema } from "./db";
import { monthFromISOWeek } from "./weekplan";

// ═══════════════════════════════════════════════════════════
// WERKZAAMHEDEN PER KLANT (in het dashboard, niet in Google Sheets)
// ═══════════════════════════════════════════════════════════
// SEO- en Dev-taken samen. Bewerkbaar in de cockpit; het klant-dashboard
// toont alleen rijen met klant_zichtbaar = true.
// ═══════════════════════════════════════════════════════════

export type TaskRow = {
  id?: number;
  categorie: string;
  taak: string;
  toelichting: string;        // Toelichting Developer (intern)
  klantToelichting?: string;  // korte uitleg voor de klant ("?"-tooltip)
  uren: number | null;
  status: string;
  maand: string;
  link: string;
  wie: string;            // "SEO" | "Dev"
  klantZichtbaar: boolean;
  gemaild?: boolean;      // naar developer gemaild → blijft oranje tot 'Klaar'
  fase?: string;          // "" | "Bouwen" | "Herbedraden" | "Opschonen"
  cluster?: string;       // label voor gegroepeerde import (bv. "SOA-test cluster")
  geblokkeerd?: boolean;  // wacht op een andere taak (bv. redirect wacht op bouw)
  blokkadeReden?: string; // waarop wordt gewacht
  pageUrl?: string;       // pagina waar de taak bij hoort
  stepKind?: string;      // pijplijn-stap: "analyse_doc" | "blauwdruk_doc" | "copy_doc"
  docLink?: string;       // technisch document (Drive-link) bij deze stap (intern/dev)
  clientDocLink?: string; // klantversie-document (Drive-link) voor het klantdashboard
  weekYear?: number;      // ISO-jaar van de geplande week (0 = ongepland)
  weekNo?: number;        // ISO-weeknummer van de geplande week (0 = ongepland)
  thread?: string;        // bird's eye-onderwerp waar de taak uit rolde
};

// Inhoudssleutel van een taak: twee rijen met exact dezelfde inhoud (taak,
// toelichting, uren, status, maand, link, wie) zijn duplicaten. Gebruikt om
// per ongeluk verdubbelde rijen te ontdubbelen bij inlezen en opslaan.
function taskKey(t: TaskRow): string {
  return [
    (t.taak || "").trim(),
    (t.toelichting || "").trim(),
    t.uren ?? "",
    (t.status || "").trim().toLowerCase(),
    (t.maand || "").trim().toLowerCase(),
    (t.link || "").trim(),
    (t.wie || "").trim().toLowerCase(),
  ].join(String.fromCharCode(1)); // velden gescheiden door een controlteken dat niet in tekst voorkomt
}

// Houdt de eerste van elke set inhoudelijk identieke rijen; gooit de rest weg.
function dedupeTasks(tasks: TaskRow[]): TaskRow[] {
  const seen = new Set<string>();
  const out: TaskRow[] = [];
  for (const t of tasks) {
    const k = taskKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

// Ontdubbelt pagina-/pijplijn-taken: dezelfde ZICHTBARE titel op dezelfde pagina is
// een duplicaat (bv. de analyse/blauwdruk/copy-taak die per doc-run opnieuw is
// aangemaakt met een nieuwe Drive-link, dus net andere HTML). Houd de nieuwste (laatste)
// over; taken zonder pagina blijven ongemoeid.
function dedupePageTasks(tasks: TaskRow[]): TaskRow[] {
  const stripTags = (s: string) => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const normUrl = (u: string) => (u || "").replace(/\/+$/, "").toLowerCase();
  const lastIdx = new Map<string, number>();
  tasks.forEach((t, i) => { const k = t.pageUrl ? `${normUrl(t.pageUrl)}|${stripTags(t.taak)}` : `__row${i}`; lastIdx.set(k, i); });
  const keep = new Set(lastIdx.values());
  return tasks.filter((_, i) => keep.has(i));
}

// Haalt de kale (al ge-escapete) taaktitel uit de opgeslagen taak-HTML: link-groepen
// zoals "(intern)", "(klantversie)", "(link)" eraf, en als de titel zelf een link was,
// pak de linktekst. Zo houden we de titel over zonder dubbel te escapen.
function stepTaskTitleHtml(taak: string): string {
  let s = String(taak || "");
  s = s.replace(/\s*\(\s*<a\b[^>]*>.*?<\/a>\s*\)/gi, "");
  s = s.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
  return s.trim();
}

// Terugwerkende opmaak: oude auto-taken ("Titel (intern) (klantversie)" of een titel
// die zelf een link is) omzetten naar "Titel (link)" met de klantversie-link erachter.
// Zelfbeperkend: rijen die de nieuwe "(link)" al hebben worden overgeslagen.
async function migrateStepTaskLinks(slug: string): Promise<void> {
  const { rows } = await sql`
    SELECT id, taak, doc_link, client_doc_link FROM client_tasks
    WHERE client_slug = ${slug} AND step_kind IS NOT NULL
      AND taak LIKE '%<a %' AND taak NOT LIKE '%>link</a>%'`;
  if (rows.length === 0) return;
  const a = (href: string, label: string) => `<a href="${escHtml(href)}" target="_blank" rel="noreferrer">${escHtml(label)}</a>`;
  for (const r of rows) {
    let href = String(r.client_doc_link || r.doc_link || "").trim();
    if (!href) {
      const m = String(r.taak || "").match(/href="([^"]+)"/i);
      if (m) href = m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    const title = stepTaskTitleHtml(r.taak as string);
    const taak = href ? `${title} (${a(href, "link")})` : title;
    await sql`UPDATE client_tasks SET taak = ${taak}, updated_at = now() WHERE id = ${r.id}`;
  }
}

export async function getTasks(slug: string): Promise<TaskRow[]> {
  await ensureSchema();
  await migrateStepTaskLinks(slug).catch(() => { /* niet kritisch */ });
  // Weekplanning-kaarten (step_kind 'weekplan…') leven in het weekbord (getWeekplan),
  // niet in de maand-takenlijst. Sluit ze hier uit zodat de maandweergave niet volloopt.
  const { rows } = await sql`
    SELECT id, categorie, taak, toelichting, klant_toelichting, uren, status, maand, link, wie, klant_zichtbaar, gemaild,
           fase, cluster, geblokkeerd, blokkade_reden, page_url, step_kind, doc_link, client_doc_link, week_year, week_no, thread
    FROM client_tasks
    WHERE client_slug = ${slug} AND (step_kind IS NULL OR step_kind NOT LIKE 'weekplan%')
    ORDER BY sort_order ASC, id ASC`;
  const mapped = rows.map((r) => ({
    id: r.id as number,
    categorie: r.categorie ?? "",
    taak: r.taak ?? "",
    toelichting: r.toelichting ?? "",
    klantToelichting: r.klant_toelichting ?? "",
    uren: r.uren === null ? null : Number(r.uren),
    status: r.status ?? "",
    maand: r.maand ?? "",
    link: r.link ?? "",
    wie: r.wie ?? "",
    klantZichtbaar: !!r.klant_zichtbaar,
    gemaild: !!r.gemaild,
    fase: r.fase ?? "",
    cluster: r.cluster ?? "",
    geblokkeerd: !!r.geblokkeerd,
    blokkadeReden: r.blokkade_reden ?? "",
    pageUrl: r.page_url ?? "",
    stepKind: r.step_kind ?? "",
    docLink: r.doc_link ?? "",
    clientDocLink: r.client_doc_link ?? "",
    weekYear: Number(r.week_year ?? 0),
    weekNo: Number(r.week_no ?? 0),
    thread: r.thread ?? "",
  }));
  return dedupePageTasks(dedupeTasks(mapped));
}

// Voegt taken achteraan toe zonder de bestaande te wissen (voor de import).
// Geeft de id's van de toegevoegde taken terug (voor highlighten/koppelen).
export async function appendTasks(slug: string, tasks: Partial<TaskRow>[]): Promise<number[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM client_tasks WHERE client_slug = ${slug}`;
  let order = Number(rows[0]?.m ?? -1) + 1;
  const ids: number[] = [];
  for (const t of tasks) {
    if (!t.taak || !t.taak.trim()) continue;
    const wy = Number(t.weekYear ?? 0) || 0;
    const wn = Number(t.weekNo ?? 0) || 0;
    // Maand voor de klant-rollup: expliciet meegegeven maand wint; anders leiden we
    // hem af uit de geplande week ("week voor jou, maand voor klant").
    const maand = (t.maand || "").toLowerCase() || (wn > 0 ? monthFromISOWeek(wy, wn) : null);
    const res = await sql`
      INSERT INTO client_tasks (client_slug, sort_order, categorie, taak, toelichting, klant_toelichting, uren, status, maand, link, wie, klant_zichtbaar,
                                fase, cluster, geblokkeerd, blokkade_reden, page_url, week_year, week_no, thread, updated_at)
      VALUES (${slug}, ${order}, ${t.categorie || null}, ${t.taak.trim()}, ${t.toelichting || null}, ${t.klantToelichting || null}, ${t.uren ?? null}, ${t.status || "Gepland"}, ${maand}, ${t.link || null}, ${t.wie || null}, ${t.klantZichtbaar !== false},
              ${t.fase || null}, ${t.cluster || null}, ${!!t.geblokkeerd}, ${t.blokkadeReden || null}, ${t.pageUrl || null}, ${wy}, ${wn}, ${t.thread || null}, now())
      RETURNING id`;
    if (res.rows[0]?.id != null) ids.push(Number(res.rows[0].id));
    order++;
  }
  return ids;
}

function escHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Eén werkzaamheid per pijplijn-stap per pagina (analyse/blauwdruk/copy). De TITEL
// linkt naar het Drive-document; het "Opm. developer"-veld (toelichting) laat het
// dashboard LEEG (dat vullen jullie zelf); de klant-toelichting (het ?-veld) krijgt
// een korte, begrijpelijke uitleg. Bestaat de taak al, dan updaten we alleen de
// titel/link + klant-toelichting; jouw planning (uren, status, maand, wie) en de
// eigen developer-notitie blijven met rust. Geeft het id terug.
export async function upsertStepTask(
  slug: string,
  step: { pageUrl: string; stepKind: string; title: string; link?: string; clientLink?: string; klantToelichting?: string; fase?: string; wie?: string; klantZichtbaar?: boolean; dualVersion?: boolean },
): Promise<number> {
  await ensureSchema();
  const a = (href: string, label: string) => `<a href="${escHtml(href)}" target="_blank" rel="noreferrer">${escHtml(label)}</a>`;
  // Eenduidige opmaak: de taaktitel als platte tekst, met daarachter "(link)" die naar
  // het document wijst. Bij een klant- én interne versie tonen we de klantversie-link
  // (de klant ziet toch alleen client_doc_link; intern blijft in doc_link bewaard).
  const href = step.clientLink || step.link || "";
  const taak = href ? `${escHtml(step.title)} (${a(href, "link")})` : escHtml(step.title);
  const { rows: found } = await sql`
    SELECT id FROM client_tasks WHERE client_slug = ${slug} AND page_url = ${step.pageUrl} AND step_kind = ${step.stepKind} LIMIT 1`;
  if (found[0]?.id != null) {
    const id = Number(found[0].id);
    // Toelichting (Opm. developer) NIET aanraken bij update: dat is de eigen notitie.
    await sql`
      UPDATE client_tasks
      SET taak = ${taak}, doc_link = ${step.link || null}, client_doc_link = ${step.clientLink || null}, klant_toelichting = ${step.klantToelichting || null}, updated_at = now()
      WHERE id = ${id}`;
    return id;
  }
  const { rows: ord } = await sql`SELECT COALESCE(MAX(sort_order), -1) AS m FROM client_tasks WHERE client_slug = ${slug}`;
  const order = Number(ord[0]?.m ?? -1) + 1;
  // toelichting bewust NULL: het "Opm. developer"-veld vult het dashboard nooit.
  const res = await sql`
    INSERT INTO client_tasks (client_slug, sort_order, taak, toelichting, klant_toelichting, status, wie, klant_zichtbaar, fase, page_url, step_kind, doc_link, client_doc_link, updated_at)
    VALUES (${slug}, ${order}, ${taak}, ${null}, ${step.klantToelichting || null}, 'Gepland', ${step.wie || "SEO"}, ${step.klantZichtbaar !== false}, ${step.fase || "Bouwen"}, ${step.pageUrl}, ${step.stepKind}, ${step.link || null}, ${step.clientLink || null}, now())
    RETURNING id`;
  return Number(res.rows[0].id);
}

// Verwijdert specifieke taken (op id) van een klant. Gebruikt voor het opruimen
// van de oude losse subtaken die geen pijplijn-stap zijn.
export async function deleteTasksByIds(slug: string, ids: number[]): Promise<number> {
  await ensureSchema();
  const clean = ids.filter((n) => Number.isInteger(n));
  let removed = 0;
  for (const id of clean) {
    const res = await sql`DELETE FROM client_tasks WHERE client_slug = ${slug} AND id = ${id}`;
    removed += res.rowCount ?? 0;
  }
  return removed;
}

// Koppelt de klantversie-link aan de stap-werkzaamheid (per pagina + stap), zodat
// die in het klantdashboard verschijnt. Geeft terug of er een rij is bijgewerkt.
export async function setClientDocLink(slug: string, pageUrl: string, stepKind: string, link: string): Promise<boolean> {
  await ensureSchema();
  const res = await sql`
    UPDATE client_tasks SET client_doc_link = ${link || null}, updated_at = now()
    WHERE client_slug = ${slug} AND page_url = ${pageUrl} AND step_kind = ${stepKind}`;
  return (res.rowCount ?? 0) > 0;
}

export async function hasTasks(slug: string): Promise<boolean> {
  await ensureSchema();
  const { rows } = await sql`SELECT 1 FROM client_tasks WHERE client_slug = ${slug} LIMIT 1`;
  return rows.length > 0;
}

// Vervangt alle werkzaamheden van een klant door de meegegeven lijst.
// De volgorde in de array bepaalt sort_order (slepen/sorteren).
export async function replaceTasks(slug: string, tasks: TaskRow[]): Promise<number> {
  await ensureSchema();
  // Alleen de maand-taken vervangen; de weekplanning-kaarten (step_kind 'weekplan…')
  // worden door het weekbord beheerd en mogen door de autosave NIET gewist worden.
  await sql`DELETE FROM client_tasks WHERE client_slug = ${slug} AND (step_kind IS NULL OR step_kind NOT LIKE 'weekplan%')`;
  const clean = dedupeTasks(tasks);
  let n = 0;
  for (let i = 0; i < clean.length; i++) {
    const t = clean[i];
    if (!t.taak || !t.taak.trim()) continue;
    const uren = t.uren === null || t.uren === undefined || Number.isNaN(Number(t.uren)) ? null : Number(t.uren);
    await sql`
      INSERT INTO client_tasks (client_slug, sort_order, categorie, taak, toelichting, klant_toelichting, uren, status, maand, link, wie, klant_zichtbaar, gemaild,
                                fase, cluster, geblokkeerd, blokkade_reden, page_url, step_kind, doc_link, client_doc_link, week_year, week_no, thread, updated_at)
      VALUES (${slug}, ${i}, ${t.categorie || null}, ${t.taak.trim()}, ${t.toelichting || null}, ${t.klantToelichting || null}, ${uren},
              ${t.status || null}, ${(t.maand || "").toLowerCase() || null}, ${t.link || null}, ${t.wie || null}, ${!!t.klantZichtbaar}, ${!!t.gemaild},
              ${t.fase || null}, ${t.cluster || null}, ${!!t.geblokkeerd}, ${t.blokkadeReden || null}, ${t.pageUrl || null},
              ${t.stepKind || null}, ${t.docLink || null}, ${t.clientDocLink || null}, ${Number(t.weekYear ?? 0) || 0}, ${Number(t.weekNo ?? 0) || 0}, ${t.thread || null}, now())`;
    n++;
  }
  return n;
}
