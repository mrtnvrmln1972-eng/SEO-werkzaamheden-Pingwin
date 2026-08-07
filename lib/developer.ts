import { sql, ensureSchema } from "./db";
import { meldingToevoegen, meldingIntrekken } from "./meldingen";

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
  /**
   * Maartens eigen vinkje, los van devDone. De developer kan een taak al op
   * "Klaar" hebben gezet (groen), maar dat is niet hetzelfde als dat Maarten
   * hem gecontroleerd en afgesloten heeft. Staat dit aan, dan verhuist de taak
   * naar het dichtgeklapte "Afgerond"-blok van die klant.
   */
  ownerDone: boolean;
  /**
   * De documenten die bij deze taak horen: de copy die verwerkt moet worden, de
   * blauwdruk, en de teksten die de klant terugstuurde. Zonder deze kreeg de
   * sitebouwer een opdracht als "zet de nieuwe copy live" zonder de copy erbij,
   * en moest hij die alsnog per mail opvragen.
   */
  docs: { label: string; url: string }[];
  /** Met de hand aangemaakt in het developer-scherm (staat in geen andere tabel). */
  eigen?: boolean;
  /** De tekst is met de hand bijgesteld ten opzichte van de oorspronkelijke taak. */
  bewerkt?: boolean;
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
  // Maartens eigen "Afgerond"-vinkje, los van het vinkje van de developer.
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS owner_done BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS owner_done_at TIMESTAMPTZ`;
  // Wie afvinkte. De sessie wist dit al, maar het werd niet bewaard; daardoor kon
  // het dashboard niet melden dat er iets af was en moest de sitebouwer mailen.
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS done_by TEXT`;
  // Zelf aangemaakte taken en handmatige aanpassingen. Waarom hier en niet in
  // client_tasks: die tabel wordt bij elke opslag per klant gewist en herschreven,
  // dus alles wat je daar zet is de volgende opslag weer weg. developer_overview
  // hangt aan de inhoudssleutel en overleeft dat.
  //  - eigen = deze rij IS de taak (met de hand aangemaakt), geen bijschrift bij
  //    een taak uit de weekplanning of de werkzaamheden.
  //  - taak_edit / toel_edit / link_edit = de bewerkte versie; leeg betekent
  //    "gebruik de oorspronkelijke tekst".
  //  - extra_docs = documenten en bestanden die Maarten zelf aan de taak hangt,
  //    bovenop de documenten die het dashboard al bij de pagina vindt.
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS eigen BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS taak_edit TEXT`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS toel_edit TEXT`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS link_edit TEXT`;
  await sql`ALTER TABLE developer_overview ADD COLUMN IF NOT EXISTS extra_docs JSONB`;
}

/**
 * De regels uit een kaarttekst die over de bouw gaan.
 *
 * De hele toelichting doorzetten leverde een blok van tien regels op met cijfers,
 * cannibalisatie-nuance en de aanpak van analyse tot copy. Voor de sitebouwer is
 * dat ruis: die moet weten welke tekst waar moet komen. Vindt hij niets specifieks,
 * dan valt hij terug op de eerste paar regels, zodat er nooit een lege opdracht staat.
 */
export function devSturing(toelichting: string): string {
  const regels = (toelichting || "").split("\n").map((r) => r.trim()).filter(Boolean);
  const bouw = regels.filter((r) => /^-?\s*(bouw|publicatie|publiceer|dev|alt[- ]?tekst|interne links?|structured data|schema)\s*:/i.test(r));
  if (bouw.length) return bouw.map((r) => r.replace(/^-\s*/, "")).join("\n");
  const zonderKopjes = regels.filter((r) => !/^[A-ZÀ-Ž][^:]{1,40}:$/.test(r));
  return zonderKopjes.slice(0, 3).map((r) => r.replace(/^-\s*/, "")).join("\n");
}

/**
 * De documenten die bij één pagina horen, in de volgorde waarin een sitebouwer
 * ze nodig heeft: eerst de tekst die verwerkt moet worden, dan de onderbouwing.
 *
 * De teruggekregen klantversie staat bewust vóór onze eigen copy: als de klant
 * de tekst nog heeft geredigeerd, is dát de tekst die de site in moet.
 */
export async function docsVoorPagina(slug: string, url: string): Promise<{ label: string; url: string }[]> {
  if (!url) return [];
  const uit: { label: string; url: string }[] = [];
  const gezien = new Set<string>();
  const voegToe = (label: string, link: string) => {
    const l = (link || "").trim();
    if (!l || gezien.has(l)) return;
    gezien.add(l);
    uit.push({ label, url: l });
  };

  // De pagina zelf staat vooraan en is de standaardkeuze: de sitebouwer moet
  // altijd weten wáár de tekst naartoe moet, en die link stond nergens in de
  // doorgezette taak.
  voegToe("De pagina", url);

  try {
    const { rows } = await sql`
      SELECT naam, drive_link, status, source FROM page_doc_versions
      WHERE client_slug = ${slug} AND url = ${url} AND drive_link IS NOT NULL AND drive_link <> ''
      ORDER BY created_at DESC LIMIT 8`;
    // Ontdubbeld op BESTANDSNAAM, niet op link. Hetzelfde document komt vaak twee
    // keer binnen (dezelfde bijlage in twee mails van hetzelfde gesprek), elke
    // keer met een eigen Drive-link. In de lijst stond hij dan twee keer met
    // exact dezelfde naam, en dan lijkt het alsof er twee versies zijn.
    const perNaam = new Set<string>();
    for (const r of rows) {
      const naam = String(r.naam || "Document");
      const sleutel = naam.trim().toLowerCase();
      if (perNaam.has(sleutel)) continue;
      perNaam.add(sleutel);
      const klant = String(r.source || "") === "klant" || String(r.status || "") === "voorstel";
      voegToe(klant ? `${naam} (van de klant)` : naam, String(r.drive_link));
    }
  } catch { /* zonder klantversies verder */ }

  try {
    const { getStepLinks } = await import("./page-doc-run");
    const s = await getStepLinks(slug, url);
    voegToe("Copy", s.copy);
    voegToe("Blauwdruk", s.blauwdruk);
    voegToe("Analyse", s.analyse);
  } catch { /* zonder pijplijn-documenten verder */ }

  return uit.slice(0, 6);
}

export async function getDeveloperTasks(): Promise<DevTask[]> {
  await ensureSchema();
  await ensureDevTable();

  // Open dev-taken (status 'naar dev') PLUS de door de developer afgeronde taken
  // (status intussen 'klaar' met een dev_done-markering), zodat afgevinkte taken
  // groen in beeld blijven i.p.v. te verdwijnen.
  const { rows } = await sql`
    SELECT t.client_slug, t.taak, t.toelichting, t.uren, t.status, t.maand, t.link, t.fase,
           c.name AS client_name
    FROM client_tasks t
    LEFT JOIN clients c ON c.slug = t.client_slug
    WHERE lower(coalesce(t.status, '')) = 'naar dev'
       OR (lower(coalesce(t.status, '')) = 'klaar'
           AND t.client_slug IN (SELECT client_slug FROM developer_overview WHERE dev_done = true OR owner_done = true))
    ORDER BY t.sort_order ASC, t.id ASC`;

  const meta = await sql`
    SELECT client_slug, task_key, position, exec_date, dev_done, dev_note, owner_done,
           eigen, taak_edit, toel_edit, link_edit, extra_docs
    FROM developer_overview`;
  type Meta = {
    position: number | null; execDate: string; devDone: boolean; devNote: string; ownerDone: boolean;
    eigen: boolean; taakEdit: string; toelEdit: string; linkEdit: string;
    extraDocs: { label: string; url: string }[];
  };
  const metaMap = new Map<string, Meta>();
  for (const m of meta.rows) {
    metaMap.set((m.client_slug as string) + "|" + (m.task_key as string), {
      position: m.position === null ? null : Number(m.position),
      execDate: (m.exec_date as string) || "",
      devDone: !!m.dev_done,
      devNote: (m.dev_note as string) || "",
      ownerDone: !!m.owner_done,
      eigen: !!m.eigen,
      taakEdit: (m.taak_edit as string) || "",
      toelEdit: (m.toel_edit as string) || "",
      linkEdit: (m.link_edit as string) || "",
      extraDocs: Array.isArray(m.extra_docs) ? (m.extra_docs as { label: string; url: string }[]) : [],
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
      ownerDone: mm?.ownerDone ?? false,
      docs: [],
    };
  });

  // Kaarten uit de weekplanning die naar de developer zijn doorgezet. Die staan in
  // een andere tabel dan de oude taken, dus ze moeten er apart bij; anders blijft de
  // developerpagina hangen op werk van vóór de overstap.
  const wp = await sql`
    SELECT w.id, w.client_slug, w.taak, w.toelichting, w.url, w.week_year, w.week_no, w.status,
           w.dev_taak, w.dev_toelichting, w.dev_docs,
           c.name AS client_name
    FROM client_weekplan w
    LEFT JOIN clients c ON c.slug = w.client_slug
    WHERE w.naar_dev = true
    ORDER BY w.week_year, w.week_no, w.sort_order`.then((r) => r.rows).catch(() => [] as Record<string, unknown>[]);
  for (const r of wp) {
    const slug = r.client_slug as string;
    const key = `wp:${Number(r.id)}`;
    const mm = metaMap.get(slug + "|" + key);
    list.push({
      clientSlug: slug,
      clientName: (r.client_name as string) ?? slug,
      taskKey: key,
      // De doorgeefversie wint: die heeft Maarten bij het doorzetten zelf
      // bijgesteld. Staat die er niet, dan de kaart zelf.
      taak: (r.dev_taak as string) || (r.taak as string) || "",
      // Alleen de sturing voor de bouw, niet het hele verhaal. De kaart bevat
      // achtergrond, cijfers en de aanpak per fase; een sitebouwer heeft daar niets
      // aan en moet gewoon weten wát hij moet doen.
      toelichting: (r.dev_toelichting as string) || devSturing((r.toelichting as string) ?? ""),
      uren: null,
      // Een doorgezette kaart telt als open dev-werk, tenzij de developer hem afvinkte.
      status: mm?.devDone ? "klaar" : "naar dev",
      maand: r.week_no ? `week ${r.week_no}` : "",
      link: (r.url as string) ?? "",
      fase: "",
      execDate: mm?.execDate ?? "",
      position: mm?.position ?? null,
      devDone: mm?.devDone ?? false,
      devNote: mm?.devNote ?? "",
      ownerDone: mm?.ownerDone ?? false,
      // Handmatig gekozen documenten gaan voor: bij een herziene tekst van de
      // klant moet die de site op, niet onze eigen copy. Is er niets gekozen,
      // dan alles wat bij de pagina hoort.
      docs: Array.isArray(r.dev_docs) && (r.dev_docs as unknown[]).length
        ? (r.dev_docs as { label: string; url: string }[])
        : await docsVoorPagina(slug, (r.url as string) || ""),
    });
  }

  // Zelf aangemaakte taken: die staan in geen enkele andere tabel, dus ze komen
  // hier rechtstreeks uit developer_overview. Ze gedragen zich verder precies als
  // de andere taken (afvinken, inplannen, documenten eraan hangen).
  const eigenRijen = meta.rows.filter((m) => !!m.eigen);
  if (eigenRijen.length) {
    const namen = new Map<string, string>();
    const { rows: cl } = await sql`SELECT slug, name FROM clients`;
    for (const c of cl) namen.set(c.slug as string, (c.name as string) || (c.slug as string));
    for (const m of eigenRijen) {
      const slug = m.client_slug as string;
      const mm = metaMap.get(slug + "|" + (m.task_key as string))!;
      list.push({
        clientSlug: slug,
        clientName: namen.get(slug) || slug,
        taskKey: m.task_key as string,
        taak: mm.taakEdit,
        toelichting: mm.toelEdit,
        uren: null,
        status: mm.devDone ? "klaar" : "naar dev",
        maand: "",
        link: mm.linkEdit,
        fase: "",
        execDate: mm.execDate,
        position: mm.position,
        devDone: mm.devDone,
        devNote: mm.devNote,
        ownerDone: mm.ownerDone,
        docs: [],
        eigen: true,
      });
    }
  }

  // De handmatige laag over alle taken heen: bewerkte tekst wint van de
  // oorspronkelijke, en zelf toegevoegde documenten komen achter de documenten
  // die het dashboard al bij de pagina vond.
  for (const t of list) {
    const mm = metaMap.get(t.clientSlug + "|" + t.taskKey);
    if (!mm || t.eigen) continue;
    if (mm.taakEdit) t.taak = mm.taakEdit;
    if (mm.toelEdit) t.toelichting = mm.toelEdit;
    if (mm.linkEdit) t.link = mm.linkEdit;
    t.bewerkt = !!(mm.taakEdit || mm.toelEdit || mm.linkEdit);
  }
  for (const t of list) {
    const extra = metaMap.get(t.clientSlug + "|" + t.taskKey)?.extraDocs || [];
    if (!extra.length) continue;
    const gezien = new Set(t.docs.map((d) => d.url));
    for (const d of extra) if (d && d.url && !gezien.has(d.url)) { gezien.add(d.url); t.docs.push(d); }
  }

  // Alleen echt relevante rijen: open ('naar dev'), door de developer afgevinkt,
  // of door Maarten zelf afgerond (die laatste blijft zichtbaar in het
  // "Afgerond"-blok, ook als de onderliggende status intussen weer wijzigt).
  // Een 'klaar'-taak die niet dev-afgevinkt is (andere klaar-taak) valt hiermee weg.
  const relevant = list.filter((t) => t.status.toLowerCase() === "naar dev" || t.devDone || t.ownerDone);

  // Ontdubbel op (klant, taaknaam): identieke dev-taken één keer tonen.
  const seen = new Set<string>();
  const deduped = relevant.filter((t) => {
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
  // Wie het afvinkte. Was er wel (de sessie weet het), maar werd weggegooid,
  // waardoor de sitebouwer moest mailen dat ze klaar was: het dashboard deed er
  // niets mee. Ontbreekt het, dan is het Maarten zelf.
  door?: { naam: string; isOwner: boolean } | null,
): Promise<void> {
  await ensureSchema();
  await ensureDevTable();
  if (!clientSlug || !taskKey) return;
  const wie = (door?.naam || "").trim() || (door?.isOwner ? "Maarten" : "");
  await sql`
    INSERT INTO developer_overview (client_slug, task_key, dev_done, dev_note, done_at, done_by, updated_at)
    VALUES (${clientSlug}, ${taskKey}, ${done}, ${note || null}, ${done ? new Date().toISOString() : null}, ${done ? (wie || null) : null}, now())
    ON CONFLICT (client_slug, task_key)
    DO UPDATE SET dev_done = ${done}, dev_note = ${note || null}, done_at = ${done ? new Date().toISOString() : null},
                  done_by = ${done ? (wie || null) : null}, updated_at = now()`;

  // Het belletje voor Maarten. Alleen als iemand ánders afvinkt: van zijn eigen
  // vinkje hoeft hij geen melding. Ontvinken trekt de melding weer in, anders
  // blijft er een onwaarheid staan.
  const taakTekst = taskKey.split("|").slice(1).join("|").trim() || taskKey;
  if (!door?.isOwner) {
    if (done) {
      await meldingToevoegen({
        soort: "dev-af",
        titel: `${wie || "De sitebouwer"} heeft een taak afgerond`,
        regel: `${clientSlug}: ${taakTekst}${note ? ` — ${note.trim()}` : ""}`,
        link: `/admin/developer`,
        wie: wie || "Sitebouwer",
        bron: "developer_overview",
        bronId: `${clientSlug}::${taskKey}`,
      });
    } else {
      await meldingIntrekken("developer_overview", `${clientSlug}::${taskKey}`, "dev-af");
    }
  }

  // Afvinken verandert ook de ECHTE taakstatus: 'Klaar' (uit de Naar-Dev-lijst en
  // zichtbaar in Werkzaamheden), of terug naar 'Naar Dev' bij ontvinken. We matchen
  // op de inhoudssleutel (rij-id's zijn instabiel), de status zelf overleeft.
  const { rows } = await sql`SELECT id, taak FROM client_tasks WHERE client_slug = ${clientSlug}`;
  const ids = rows.filter((r) => makeKey(clientSlug, (r.taak as string) || "") === taskKey).map((r) => Number(r.id));
  const target = done ? "Klaar" : "Naar Dev";
  for (const id of ids) {
    await sql`UPDATE client_tasks SET status = ${target}, updated_at = now() WHERE id = ${id}`;
  }
}

// Maartens eigen "Afgerond"-vinkje, los van het vinkje van de developer. Dat
// vinkje betekent "de developer is klaar" en zet de echte taakstatus om; dit
// vinkje betekent "ik heb het gecontroleerd en gesloten" en verplaatst de taak
// naar het dichtgeklapte Afgerond-blok van die klant. Raakt de echte
// taakstatus niet aan en levert geen melding op: het is Maartens eigen actie.
export async function setOwnerDone(clientSlug: string, taskKey: string, done: boolean): Promise<void> {
  await ensureSchema();
  await ensureDevTable();
  if (!clientSlug || !taskKey) return;
  await sql`
    INSERT INTO developer_overview (client_slug, task_key, owner_done, owner_done_at, updated_at)
    VALUES (${clientSlug}, ${taskKey}, ${done}, ${done ? new Date().toISOString() : null}, now())
    ON CONFLICT (client_slug, task_key)
    DO UPDATE SET owner_done = ${done}, owner_done_at = ${done ? new Date().toISOString() : null}, updated_at = now()`;
}

// ═══════════════════════════════════════════════════════════
// ZELF TAKEN AANMAKEN EN BIJWERKEN
// ═══════════════════════════════════════════════════════════
// Tot nu toe kon een dev-taak alleen ONTSTAAN uit een kaart in de weekplanning of
// een rij in Werkzaamheden. Een los klusje ("favicon vervangen", "formulier op de
// contactpagina werkt niet") paste daar niet in en ging dus per mail, buiten het
// dashboard om. Deze functies maken die taak wél in het dashboard, bij de juiste
// klant, met dezelfde velden als de andere taken.

/** Een lege, veilige documentenlijst uit ruwe invoer. */
function schoneDocs(input: unknown): { label: string; url: string }[] {
  if (!Array.isArray(input)) return [];
  const uit: { label: string; url: string }[] = [];
  for (const d of input) {
    const o = d as { label?: unknown; url?: unknown };
    const url = String(o?.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    uit.push({ label: String(o?.label || url).trim().slice(0, 160) || url, url: url.slice(0, 2000) });
    if (uit.length >= 20) break;
  }
  return uit;
}

/** Maakt een nieuwe, zelf bedachte taak voor de developer bij één klant. */
export async function nieuweDevTaak(
  clientSlug: string,
  velden: { taak: string; toelichting?: string; link?: string; execDate?: string },
): Promise<string> {
  await ensureSchema();
  await ensureDevTable();
  const key = `eigen:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await sql`
    INSERT INTO developer_overview
      (client_slug, task_key, eigen, taak_edit, toel_edit, link_edit, exec_date, position, updated_at)
    VALUES (${clientSlug}, ${key}, true, ${velden.taak}, ${velden.toelichting || null},
            ${velden.link || null}, ${velden.execDate || null}, NULL, now())`;
  return key;
}

/**
 * Bewerkt de taaktekst, de opmerking of de paginalink van een taak. Werkt voor
 * zelf aangemaakte taken én voor taken die uit de weekplanning of Werkzaamheden
 * komen: daar is dit een laag erbovenop, zodat de bijstelling niet verdwijnt als
 * die tabellen worden herschreven.
 */
export async function bewerkDevTaak(
  clientSlug: string,
  taskKey: string,
  velden: { taak?: string; toelichting?: string; link?: string },
): Promise<void> {
  await ensureSchema();
  await ensureDevTable();
  if (!clientSlug || !taskKey) return;
  const taak = velden.taak === undefined ? null : velden.taak;
  const toel = velden.toelichting === undefined ? null : velden.toelichting;
  const link = velden.link === undefined ? null : velden.link;
  await sql`
    INSERT INTO developer_overview (client_slug, task_key, taak_edit, toel_edit, link_edit, updated_at)
    VALUES (${clientSlug}, ${taskKey}, ${taak}, ${toel}, ${link}, now())
    ON CONFLICT (client_slug, task_key) DO UPDATE SET
      taak_edit = COALESCE(${taak}, developer_overview.taak_edit),
      toel_edit = COALESCE(${toel}, developer_overview.toel_edit),
      link_edit = COALESCE(${link}, developer_overview.link_edit),
      updated_at = now()`;
}

/** Alle zelf toegevoegde documenten van één taak (links en geüploade bestanden). */
async function eigenDocs(clientSlug: string, taskKey: string): Promise<{ label: string; url: string }[]> {
  const { rows } = await sql`
    SELECT extra_docs FROM developer_overview
    WHERE client_slug = ${clientSlug} AND task_key = ${taskKey}`;
  const d = rows[0]?.extra_docs;
  return Array.isArray(d) ? (d as { label: string; url: string }[]) : [];
}

/** Hangt een document of bestand aan een taak (een Drive-link, een zip, een URL). */
export async function voegDevDocToe(
  clientSlug: string, taskKey: string, doc: { label: string; url: string },
): Promise<{ label: string; url: string }[]> {
  await ensureSchema();
  await ensureDevTable();
  const schoon = schoneDocs([doc]);
  if (!schoon.length) throw new Error("Dit is geen geldige link (begin met https://).");
  const huidig = await eigenDocs(clientSlug, taskKey);
  const nieuw = schoneDocs([...huidig.filter((d) => d.url !== schoon[0].url), schoon[0]]);
  await sql`
    INSERT INTO developer_overview (client_slug, task_key, extra_docs, updated_at)
    VALUES (${clientSlug}, ${taskKey}, ${JSON.stringify(nieuw)}::jsonb, now())
    ON CONFLICT (client_slug, task_key)
    DO UPDATE SET extra_docs = ${JSON.stringify(nieuw)}::jsonb, updated_at = now()`;
  return nieuw;
}

/** Haalt een zelf toegevoegd document weer van de taak af (het bestand zelf blijft staan). */
export async function verwijderDevDoc(
  clientSlug: string, taskKey: string, url: string,
): Promise<{ label: string; url: string }[]> {
  await ensureSchema();
  await ensureDevTable();
  const nieuw = (await eigenDocs(clientSlug, taskKey)).filter((d) => d.url !== url);
  await sql`
    UPDATE developer_overview SET extra_docs = ${JSON.stringify(nieuw)}::jsonb, updated_at = now()
    WHERE client_slug = ${clientSlug} AND task_key = ${taskKey}`;
  return nieuw;
}

/**
 * Verwijdert een zelf aangemaakte taak. Taken die uit de weekplanning of
 * Werkzaamheden komen worden hier NIET verwijderd: die horen thuis in hun eigen
 * scherm, anders zou je hier iets weggooien dat daar gewoon blijft staan.
 */
export async function verwijderDevTaak(clientSlug: string, taskKey: string): Promise<boolean> {
  await ensureSchema();
  await ensureDevTable();
  const { rowCount } = await sql`
    DELETE FROM developer_overview
    WHERE client_slug = ${clientSlug} AND task_key = ${taskKey} AND eigen = true`;
  return (rowCount || 0) > 0;
}
