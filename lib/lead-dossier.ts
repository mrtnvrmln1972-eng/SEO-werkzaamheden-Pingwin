import { sql, ensureSchema } from "./db";
import { callClaude, LIGHT_MODEL } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// HET DOSSIER VAN EEN LEAD (en later van een klant)
// ═══════════════════════════════════════════════════════════
// Eén plek waar ALLES landt wat we over een bedrijf weten: aangeleverde
// documenten (een Ads-analyse van een collega, een Ahrefs-uitdraai, hun
// propositie of huisstijl), eigen metingen, en losse notities die Maarten in de
// chat laat vallen ("budget mag 1500", "vindt duurzaamheid belangrijk").
//
// Twee regels die dit bruikbaar houden naarmate het groeit:
//
//  1. APPEND-ONLY. Er wordt nooit iets overschreven. Een herziening komt
//     ernaast met een eigen datum, zodat je altijd kunt terugkijken. Nieuwste
//     wint bij tegenstrijdigheid, maar het oude blijft leesbaar.
//  2. SAMENVATTING IN DE CONTEXT, INHOUD OP VERZOEK. De chat krijgt alleen een
//     inhoudsopgave mee (één regel per stuk). De volledige tekst haalt hij zelf
//     op met zoek_dossier/lees_dossier. Zonder die regel groeit de context bij
//     elke vraag mee en wordt elk antwoord trager, duurder en slechter.
// ═══════════════════════════════════════════════════════════

export const DOSSIER_SOORTEN = ["notitie", "document", "analyse", "meting", "voorstel", "overig"] as const;
export type DossierSoort = (typeof DOSSIER_SOORTEN)[number];

export const SOORT_LABEL: Record<string, string> = {
  notitie: "Notitie",
  document: "Aangeleverd document",
  analyse: "Analyse",
  meting: "Meting",
  voorstel: "Voorstel",
  overig: "Overig",
};

export type DossierItem = {
  id: number;
  soort: string;
  titel: string;
  samenvatting: string;
  bron: string;
  driveLink: string;
  createdAt: string;
};
export type DossierItemFull = DossierItem & { inhoud: string };

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS lead_dossier (
      id           SERIAL PRIMARY KEY,
      client_slug  TEXT NOT NULL,
      soort        TEXT NOT NULL DEFAULT 'notitie',
      titel        TEXT NOT NULL,
      samenvatting TEXT,
      inhoud       TEXT,
      bron         TEXT,
      drive_link   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ix_lead_dossier_slug ON lead_dossier (client_slug, created_at DESC)`;
}

function normSoort(v: string | null | undefined): DossierSoort {
  const t = String(v || "").trim().toLowerCase();
  return (DOSSIER_SOORTEN as readonly string[]).includes(t) ? (t as DossierSoort) : "overig";
}

// Laat de AI een korte titel en een samenvatting van twee tot vier regels maken.
// Faalt dit (geen sleutel, storing), dan valt het terug op de eerste regels van
// de tekst: aanleveren mag nooit stuklopen op de samenvatter.
async function vatSamen(
  slug: string,
  tekst: string,
  gegevenTitel: string,
): Promise<{ titel: string; samenvatting: string; soort: DossierSoort }> {
  const kort = tekst.replace(/\s+/g, " ").trim();
  const terugval = {
    titel: gegevenTitel || kort.slice(0, 70) || "Naamloos",
    samenvatting: kort.slice(0, 300),
    soort: "document" as DossierSoort,
  };
  if (!kort) return terugval;
  const system = `Je krijgt een stuk tekst dat bij het dossier van een bedrijf hoort (een aangeleverd document, een analyse, of een notitie).
Antwoord met UITSLUITEND geldige JSON, exact dit formaat, niets eromheen:
{"titel":"<korte herkenbare titel, maximaal 70 tekens>","samenvatting":"<2 tot 4 korte regels: waar gaat dit over en wat is de kern. Noem concrete cijfers, bedragen en namen als die erin staan, want daar wordt later op gezocht.>","soort":"notitie|document|analyse|meting|voorstel|overig"}
Schrijf in het Nederlands, nuchter en zonder verkooptaal. Gebruik geen emoji en geen los liggend streepje als zinsscheiding.`;
  try {
    const raw = await callClaude(
      system,
      [{ role: "user", content: (gegevenTitel ? `Aangeleverd als: ${gegevenTitel}\n\n` : "") + tekst.slice(0, 12000) }],
      600,
      { slug, action: "dossier-samenvatting" },
      LIGHT_MODEL,
    );
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    return {
      titel: String(parsed.titel || "").trim().slice(0, 120) || terugval.titel,
      samenvatting: String(parsed.samenvatting || "").trim().slice(0, 1200) || terugval.samenvatting,
      soort: normSoort(parsed.soort),
    };
  } catch {
    return terugval;
  }
}

// Voegt een stuk toe aan het dossier. Titel en samenvatting worden automatisch
// gemaakt als ze ontbreken; bij een korte handmatige notitie is de tekst zelf al
// de samenvatting en slaan we de AI-ronde over (scheelt tijd en verbruik).
export async function addDossierItem(
  slug: string,
  input: { inhoud: string; titel?: string; soort?: string; bron?: string; driveLink?: string; samenvatting?: string },
): Promise<DossierItem> {
  await ensureTable();
  const inhoud = (input.inhoud || "").trim();
  if (!inhoud) throw new Error("Niets om te bewaren.");

  let titel = (input.titel || "").trim();
  let samenvatting = (input.samenvatting || "").trim();
  let soort = normSoort(input.soort);

  const isKorteNotitie = soort === "notitie" && inhoud.length <= 400;
  if (isKorteNotitie) {
    if (!titel) titel = inhoud.slice(0, 70);
    if (!samenvatting) samenvatting = inhoud;
  } else if (!titel || !samenvatting) {
    const v = await vatSamen(slug, inhoud, titel);
    titel = titel || v.titel;
    samenvatting = samenvatting || v.samenvatting;
    if (!input.soort) soort = v.soort;
  }

  const { rows } = await sql<Row>`
    INSERT INTO lead_dossier (client_slug, soort, titel, samenvatting, inhoud, bron, drive_link)
    VALUES (${slug}, ${soort}, ${titel.slice(0, 200)}, ${samenvatting}, ${inhoud},
            ${(input.bron || "").trim() || null}, ${(input.driveLink || "").trim() || null})
    RETURNING id, soort, titel, samenvatting, bron, drive_link, created_at`;
  return toItem(rows[0]);
}

type Row = { id: number; soort: string; titel: string; samenvatting: string | null; inhoud?: string | null; bron: string | null; drive_link: string | null; created_at: string };
function toItem(r: Row): DossierItem {
  return {
    id: r.id,
    soort: r.soort,
    titel: r.titel,
    samenvatting: r.samenvatting || "",
    bron: r.bron || "",
    driveLink: r.drive_link || "",
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
  };
}

// De lijst voor op het scherm: zonder de volledige inhoud, nieuwste eerst.
export async function listDossier(slug: string): Promise<DossierItem[]> {
  await ensureTable();
  const { rows } = await sql<Row>`
    SELECT id, soort, titel, samenvatting, bron, drive_link, created_at
    FROM lead_dossier WHERE client_slug = ${slug} ORDER BY created_at DESC, id DESC LIMIT 200`;
  return rows.map(toItem);
}

export async function getDossierItem(slug: string, id: number): Promise<DossierItemFull | null> {
  await ensureTable();
  const { rows } = await sql<Row>`
    SELECT id, soort, titel, samenvatting, inhoud, bron, drive_link, created_at
    FROM lead_dossier WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { ...toItem(rows[0]), inhoud: rows[0].inhoud || "" };
}

export async function deleteDossierItem(slug: string, id: number): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await sql`DELETE FROM lead_dossier WHERE client_slug = ${slug} AND id = ${id}`;
  return !!rowCount && rowCount > 0;
}

// Zoeken op trefwoord in titel, samenvatting en volledige inhoud. Geeft de
// gevonden stukken mét inhoud terug (begrensd), zodat de chat er meteen mee
// verder kan zonder een tweede ronde.
export async function searchDossier(slug: string, term: string, limit = 4): Promise<DossierItemFull[]> {
  await ensureTable();
  const q = `%${(term || "").trim()}%`;
  const { rows } = await sql<Row>`
    SELECT id, soort, titel, samenvatting, inhoud, bron, drive_link, created_at
    FROM lead_dossier
    WHERE client_slug = ${slug}
      AND (titel ILIKE ${q} OR samenvatting ILIKE ${q} OR inhoud ILIKE ${q})
    ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...toItem(r), inhoud: r.inhoud || "" }));
}

// De inhoudsopgave die in de chat-context meereist: één regel per stuk. Bewust
// kort; de chat haalt de volledige inhoud zelf op als hij hem nodig heeft.
export async function dossierIndexText(slug: string): Promise<string> {
  const items = await listDossier(slug).catch(() => [] as DossierItem[]);
  if (!items.length) return "";
  const regels = items.slice(0, 60).map((i) => {
    const datum = i.createdAt ? new Date(i.createdAt).toLocaleDateString("nl-NL") : "";
    const sam = i.samenvatting.replace(/\s+/g, " ").trim().slice(0, 220);
    return `- [#${i.id}] ${SOORT_LABEL[i.soort] || i.soort}, ${datum}: ${i.titel}${sam ? ` — ${sam}` : ""}`;
  });
  return regels.join("\n");
}

// Alles wat we van dit bedrijf weten, als één tekst, voor het schrijven van een
// document. Hier mag de inhoud wél mee (begrensd), want dit draait één keer per
// document en niet bij elk chatbericht.
export async function dossierVolledigText(slug: string, maxChars = 30000): Promise<string> {
  await ensureTable();
  const { rows } = await sql<Row>`
    SELECT id, soort, titel, samenvatting, inhoud, bron, drive_link, created_at
    FROM lead_dossier WHERE client_slug = ${slug} ORDER BY created_at DESC, id DESC LIMIT 40`;
  const delen: string[] = [];
  let totaal = 0;
  for (const r of rows) {
    const item = toItem(r);
    const datum = item.createdAt ? new Date(item.createdAt).toLocaleDateString("nl-NL") : "";
    const kop = `### ${SOORT_LABEL[item.soort] || item.soort}: ${item.titel} (${datum})`;
    const body = (r.inhoud || item.samenvatting || "").trim();
    const stuk = `${kop}\n${body.slice(0, 6000)}`;
    if (totaal + stuk.length > maxChars) break;
    delen.push(stuk);
    totaal += stuk.length;
  }
  return delen.join("\n\n");
}
