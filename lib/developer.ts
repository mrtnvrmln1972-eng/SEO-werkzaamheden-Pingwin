import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// DEVELOPER OVERVIEW (alle dev-taken over alle klanten heen)
// ═══════════════════════════════════════════════════════════
// Verzamelt alle taken met wie = "Dev" uit client_tasks, met de klantnaam
// erbij. Maarten kan ze handmatig op volgorde slepen (prioriteit) en per
// taak een uitvoerdatum zetten.
//
// Waarom een aparte tabel? client_tasks wordt per klant bij elke opslag
// volledig gewist en herschreven (replaceTasks), dus de rij-id's zijn niet
// stabiel. De prioriteit-volgorde en uitvoerdatum slaan we daarom op in
// developer_overview, gekoppeld op een inhoudssleutel (klant + taaknaam),
// die de herschrijving overleeft.
// ═══════════════════════════════════════════════════════════

export type DevTask = {
  clientSlug: string;
  clientName: string;
  taskKey: string;
  taak: string;        // rauwe HTML (kan inline links bevatten)
  toelichting: string; // Opm. developer (rauwe HTML, kan inline links bevatten)
  uren: number | null;
  status: string;
  maand: string;
  link: string;
  fase: string;
  execDate: string;    // "" of "YYYY-MM-DD"
  position: number | null;
  devDone: boolean;    // door de developer afgevinkt als klaar
  devNote: string;     // terugkoppeling van de developer
};

function stripTags(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// Stabiele inhoudssleutel: klant + genormaliseerde taaknaam.
function makeKey(slug: string, taak: string): string {
  return slug + "::" + stripTags(taak).toLowerCase().replace(/\s+/g, " ").trim();
}

async function ensureDevTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS developer_overview (
      client_slug TEXT NOT NULL,
      task_key    TEXT NOT NULL,
      position    INTEGER,
      exec_date   TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, task_key)
    )`;
  // Developer kan een taak afvinken als klaar en terugkoppeling achterlaten.
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS dev_done BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS dev_note TEXT`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ`;
}

export async function getDeveloperTasks(): Promise<DevTask[]> {
  await ensureSchema();
  await ensureDevTable();

  const { rows } = await sql`
    SELECT t.client_slug, t.taak, t.toelichting, t.uren, t.status, t.maand, t.link, t.fase,
           c.name AS client_name
    FROM client_tasks t
    LEFT JOIN clients c ON c.slug = t.client_slug
    WHERE lower(coalesce(t.status, '')) = 'naar dev'
    ORDER BY t.sort_order ASC, t.id ASC`;

  const meta = await sql`SELECT client_slug, task_key, position, exec_date, dev_done, dev_note FROM developer_overview`;
  const metaMap = new Map<string, { position: number | null; execDate: string; devDone: boolean; devNote: string }>();
  for (const m of meta.rows) {
    metaMap.set((m.client_slug as string) + "|" + (m.task_key as string), {
      position: m.position === null ? null : Number(m.position),
      execDate: (m.exec_date as string) || "",
      devDone: !!m.dev_done,
      devNote: (m.dev_note as string) || "",
    });
  }

  const list: DevTask[] = rows.map((r) => {
    const slug = r.client_slug as string;
    const taak = (r.taak as string) ?? "";
    const key = makeKey(slug, taak);
    const mm = metaMap.get(slug + "|" + key);
    return {
      clientSlug: slug,
      clientName: (r.client_name as string) ?? slug,
      taskKey: key,
      taak,
      toelichting: (r.toelichting as string) ?? "",
      uren: r.uren === null ? null : Number(r.uren),
      status: (r.status as string) ?? "",
      maand: (r.maand as string) ?? "",
      link: (r.link as string) ?? "",
      fase: (r.fase as string) ?? "",
      execDate: mm?.execDate ?? "",
      position: mm?.position ?? null,
      devDone: mm?.devDone ?? false,
      devNote: mm?.devNote ?? "",
    };
  });

  // Ontdubbel op (klant, taaknaam): identieke dev-taken één keer tonen.
  const seen = new Set<string>();
  const deduped = list.filter((t) => {
    const k = t.clientSlug + "|" + t.taskKey;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Sorteren: per klant gegroepeerd; binnen een klant op handmatige positie.
  deduped.sort((a, b) => {
    const byClient = a.clientName.localeCompare(b.clientName);
    if (byClient !== 0) return byClient;
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return 0;
  });

  return deduped;
}

// Slaat de volledige zichtbare lijst op: de array-volgorde wordt de prioriteit
// (position = index) en per taak de uitvoerdatum. Upsert op (klant, taaksleutel).
export async function saveDeveloperOrder(
  items: { clientSlug: string; taskKey: string; execDate: string }[],
): Promise<number> {
  await ensureSchema();
  await ensureDevTable();
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.clientSlug || !it.taskKey) continue;
    await sql`
      INSERT INTO developer_overview (client_slug, task_key, position, exec_date, updated_at)
      VALUES (${it.clientSlug}, ${it.taskKey}, ${i}, ${it.execDate || null}, now())
      ON CONFLICT (client_slug, task_key)
      DO UPDATE SET position = ${i}, exec_date = ${it.execDate || null}, updated_at = now()`;
    n++;
  }
  return n;
}

// Zet de developer-status (klaar/niet klaar) + terugkoppeling van één taak.
// Raakt de volgorde/uitvoerdatum niet aan (aparte kolommen).
export async function setDeveloperStatus(
  clientSlug: string, taskKey: string, done: boolean, note: string,
): Promise<void> {
  await ensureSchema();
  await ensureDevTable();
  if (!clientSlug || !taskKey) return;
  await sql`
    INSERT INTO developer_overview (client_slug, task_key, dev_done, dev_note, done_at, updated_at)
    VALUES (${clientSlug}, ${taskKey}, ${done}, ${note || null}, ${done ? new Date().toISOString() : null}, now())
    ON CONFLICT (client_slug, task_key)
    DO UPDATE SET dev_done = ${done}, dev_note = ${note || null}, done_at = ${done ? new Date().toISOString() : null}, updated_at = now()`;
}
