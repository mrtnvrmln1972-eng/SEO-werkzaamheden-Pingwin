import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { callClaude } from "./anthropic";
import { buildPingwinDoc, type DocSection, type DocSpec } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { ensureFolderFor } from "./drive-map";
import { dossierVolledigText, addDossierItem } from "./lead-dossier";
import { PINGWIN_WERKWIJZE, PINGWIN_SCHRIJFREGELS, PINGWIN_DATA_VOORBEHOUD } from "./pingwin-methode";

// ═══════════════════════════════════════════════════════════
// DE PLANK: documenten die we voor een lead maken
// ═══════════════════════════════════════════════════════════
// Elk document bestaat uit twee helften: de klantspecifieke inhoud (uit het
// dossier van deze lead) en de Pingwin-methodiek (uit lib/pingwin-methode.ts).
// Juist die combinatie maakt het verschil tussen generieke AI-tekst en iets dat
// leest alsof een ervaren Pingwin-consultant het schreef.
//
// Twee ontwerpkeuzes die hier vastliggen:
//
//  1. HET SJABLOON BEPAALT DE HOOFDSTUKKEN, NIET DE TEKST. Zo is elk voorstel
//     herkenbaar Pingwin en toch uniek. Maarten hoeft niets in een structuur te
//     passen; hij typt vrij wat hij wil, en dat wint van de standaardaanpak.
//  2. DE OPDRACHT WORDT BEWAARD BIJ HET DOCUMENT. "Budget 1500, accent
//     duurzaamheid" hoort bij dít voorstel, niet blijvend bij de lead. Zo kan
//     later "zelfde voorstel maar met 2500" zonder alles opnieuw te typen.
//
// De inhoud wordt één keer vastgelegd als blokken (kopjes, alinea's, tabellen)
// en daaruit rolt het document. Wil je er later ook een rijk opgemaakt rapport
// uit laten rollen, dan hoeft alleen de rendering erbij; de inhoud staat al los.
// ═══════════════════════════════════════════════════════════

export type Sjabloon = {
  key: string;
  naam: string;
  omschrijving: string;
  rapporttype: string;
  // De vaste hoofdstukken, in volgorde. De AI vult ze; de structuur ligt vast.
  hoofdstukken: { kop: string; wat: string }[];
};

export const SJABLONEN: Sjabloon[] = [
  {
    key: "seo-voorstel",
    naam: "SEO-voorstel",
    omschrijving: "Wat we gaan doen, hoe we werken, wat het kost. Dit stuur je naar de lead om de deal te maken.",
    rapporttype: "Voorstel",
    hoofdstukken: [
      { kop: "Waar het nu staat", wat: "Kort en eerlijk: wat zagen we op hun website en in de cijfers. Noem concrete pagina's, zoekwoorden en getallen als die in het dossier staan. Geen algemeenheden, geen bangmakerij. Maximaal een half A4." },
      { kop: "Wat er te winnen valt", wat: "De kans, zo concreet mogelijk: welke zoekwoorden en pagina's laten nu omzet liggen, en waarom is dat realistisch haalbaar. Als er cijfers zijn, gebruik ze; als ze er niet zijn, zeg dan wat we nog moeten meten." },
      { kop: "Onze aanpak", wat: "De vier stappen van de Pingwin-werkwijze per pagina, in gewone taal en toegepast op dít bedrijf. Niet de methodiek overschrijven, maar laten zien wat het voor hen betekent." },
      { kop: "Wat we in de eerste maanden doen", wat: "Een realistische volgorde over de eerste drie tot vier maanden. Wat pakken we eerst en waarom. Sluit aan bij het verwachtingsmanagement uit de methodiek." },
      { kop: "Wat je van ons mag verwachten", wat: "Verwachtingsmanagement en samenwerking: wat leveren we, hoe volgt de klant het (dashboard), wat hebben we van hen nodig, en wanneer zijn de eerste resultaten realistisch." },
      { kop: "Investering", wat: "Het budget zoals Maarten dat in de opdracht meegeeft, met wat daarvoor gebeurt. Staat er geen budget in de opdracht, benoem dan de bandbreedte uit de methodiek en zet er duidelijk bij dat het bedrag nog bepaald wordt. Verzin nooit een bedrag." },
      { kop: "De volgende stap", wat: "Eén concrete, makkelijke vervolgstap. Kort, uitnodigend, zonder druk." },
    ],
  },
];

export function getSjabloon(key: string): Sjabloon | null {
  return SJABLONEN.find((s) => s.key === key) || null;
}

export type LeadDoc = {
  id: number;
  sjabloon: string;
  titel: string;
  opdracht: string;
  driveLink: string;
  createdAt: string;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await ensureSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS lead_docs (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      sjabloon    TEXT NOT NULL,
      titel       TEXT NOT NULL,
      opdracht    TEXT,
      drive_link  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ix_lead_docs_slug ON lead_docs (client_slug, created_at DESC)`;
}

type DocRow = { id: number; sjabloon: string; titel: string; opdracht: string | null; drive_link: string | null; created_at: string };
function toDoc(r: DocRow): LeadDoc {
  return {
    id: r.id,
    sjabloon: r.sjabloon,
    titel: r.titel,
    opdracht: r.opdracht || "",
    driveLink: r.drive_link || "",
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
  };
}

export async function listLeadDocs(slug: string): Promise<LeadDoc[]> {
  await ensureTable();
  const { rows } = await sql<DocRow>`
    SELECT id, sjabloon, titel, opdracht, drive_link, created_at
    FROM lead_docs WHERE client_slug = ${slug} ORDER BY created_at DESC, id DESC LIMIT 100`;
  return rows.map(toDoc);
}

export async function deleteLeadDoc(slug: string, id: number): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await sql`DELETE FROM lead_docs WHERE client_slug = ${slug} AND id = ${id}`;
  return !!rowCount && rowCount > 0;
}

// Markdown naar documentblokken. Zelfde vertaling als bij de klantdocumenten:
// "## " wordt een hoofdstuk, "### " een tussenkopje, "- " een bullet, en een
// tabel met pipes een echte tabel.
function mdToSections(md: string): DocSection[] {
  const sections: DocSection[] = [];
  let cur: DocSection | null = null;
  let bullets: string[] = [];
  let tbl: string[][] = [];
  const ensure = () => { if (!cur) { cur = { heading: "", blocks: [] }; sections.push(cur); } };
  const flushBullets = () => { if (bullets.length) { ensure(); cur!.blocks.push({ type: "bullets", items: bullets }); bullets = []; } };
  const flushTable = () => {
    if (tbl.length >= 2) {
      ensure();
      const headers = tbl[0];
      const rows = tbl.slice(1).filter((r) => !r.every((c) => /^-{2,}:?$|^:?-{2,}:?$/.test(c.trim())));
      if (rows.length) cur!.blocks.push({ type: "table", headers, rows });
    }
    tbl = [];
  };
  const flushAll = () => { flushBullets(); flushTable(); };
  for (const raw of (md || "").split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("## ")) { flushAll(); cur = { heading: l.replace(/^##\s+/, "").trim(), blocks: [] }; sections.push(cur); continue; }
    if (l.startsWith("|") && l.endsWith("|")) { flushBullets(); tbl.push(l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())); continue; }
    flushTable();
    if (l.startsWith("### ")) { flushBullets(); ensure(); cur!.blocks.push({ type: "subheading", text: l.replace(/^###\s+/, "").trim() }); continue; }
    if (/^[-*]\s+/.test(l)) { bullets.push(l.replace(/^[-*]\s+/, "").trim()); continue; }
    const boldOnly = l.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) { flushBullets(); ensure(); cur!.blocks.push({ type: "subheading", text: boldOnly[1].trim() }); continue; }
    flushBullets(); ensure(); cur!.blocks.push({ type: "paragraph", text: l });
  }
  flushAll();
  return sections.filter((s) => (s.blocks || []).length > 0);
}

function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}

// De Drive-map van dit bedrijf. Die wordt automatisch aangemaakt als hij er nog
// niet is; valt terug op de hoofdmap zodat een document altijd ergens landt in
// plaats van te mislukken op een ontbrekende map.

export type MaakDocResultaat = {
  ok: boolean;
  doc?: LeadDoc;
  markdown?: string;
  driveError?: string;
  error?: string;
};

// Maakt één document vanuit een sjabloon. De opdracht is wat Maarten op dat
// moment meegeeft (budget, accenten, welke pagina), en die wint van de
// standaardaanpak.
export async function maakLeadDocument(
  slug: string,
  sjabloonKey: string,
  opdracht: string,
): Promise<MaakDocResultaat> {
  await ensureTable();
  const sjabloon = getSjabloon(sjabloonKey);
  if (!sjabloon) return { ok: false, error: "Onbekend sjabloon." };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Bedrijf niet gevonden." };

  const dossier = await dossierVolledigText(slug).catch(() => "");

  const structuur = sjabloon.hoofdstukken
    .map((h, i) => `${i + 1}. ## ${h.kop}\n   ${h.wat}`)
    .join("\n");

  const system = `Je bent een ervaren SEO-consultant van bureau Pingwin en schrijft een ${sjabloon.naam.toLowerCase()} voor een potentiële klant.

${PINGWIN_SCHRIJFREGELS}

HARDE REGELS OVER DE INHOUD:
- Verzin NOOIT cijfers, posities, zoekvolumes of bedragen. Gebruik alleen wat in het dossier of in de opdracht staat. Ontbreekt een cijfer, schrijf dan wat we nog gaan meten in plaats van iets te verzinnen.
- Gebruik het dossier van dit bedrijf als bron voor alles wat klantspecifiek is. Verwijs concreet naar hun pagina's, zoekwoorden en situatie.
- Verwerk de Pingwin-methodiek waar die past, maar schrijf hem niet over: vertaal hem naar wat het voor dít bedrijf betekent.
- De opdracht van Maarten hieronder is leidend en wint van de standaardaanpak.
- Noem het voorbehoud over de herkomst van de cijfers één keer, kort, op een logische plek: "${PINGWIN_DATA_VOORBEHOUD}"

OPMAAK:
- Antwoord in markdown. Gebruik "## " voor elk hoofdstuk, "### " voor een tussenkopje, "- " voor bullets, en waar het echt helpt een tabel met pipes.
- Houd de exacte hoofdstukken en volgorde aan die hieronder staan. Voeg geen hoofdstukken toe en laat er geen weg.
- Geen inleidende zin vooraf en geen afsluitende opmerking achteraf; begin direct met het eerste hoofdstuk.

DE HOOFDSTUKKEN (exact deze koppen, in deze volgorde):
${structuur}

DE PINGWIN-METHODIEK:
${PINGWIN_WERKWIJZE}`;

  const user = `BEDRIJF: ${client.name}${client.domain ? ` (${client.domain})` : ""}

OPDRACHT VAN MAARTEN VOOR DIT DOCUMENT (leidend):
${opdracht.trim() || "(geen bijzondere instructies; volg de standaardaanpak)"}

HET DOSSIER VAN DIT BEDRIJF (alles wat we weten; nieuwste eerst):
${dossier || "(het dossier is nog leeg; baseer je op wat in de opdracht staat en benoem eerlijk wat we nog moeten uitzoeken)"}`;

  let markdown = "";
  try {
    markdown = await callClaude(system, [{ role: "user", content: user }], 6000, { slug, action: "lead-document" });
  } catch (e) {
    return { ok: false, error: "Schrijven mislukte: " + (e as Error).message };
  }
  if (!markdown.trim()) return { ok: false, error: "De AI gaf geen tekst terug." };

  const datum = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const titel = `${sjabloon.naam}: ${client.name}`;
  const sections = mdToSections(markdown);
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: sjabloon.rapporttype,
    titel,
    ondertitel: `Opgesteld door Pingwin${client.domain ? ` voor ${client.domain}` : ""}`,
    meta: { "Opgesteld door": "Pingwin", Bedrijf: client.name, Datum: datum },
    sections: sections.length ? sections : [{ heading: sjabloon.naam, blocks: [{ type: "paragraph", text: markdown }] }],
  };

  let buffer: Buffer;
  try { buffer = await buildPingwinDoc(spec); }
  catch (e) { return { ok: false, error: "Document opmaken mislukte: " + (e as Error).message }; }

  let dest = "";
  try { dest = (await ensureFolderFor(slug, "")) || ""; } catch { /* geen map, dan de hoofdmap */ }
  let driveLink = "", driveError = "";
  try {
    const up = await uploadDocx(dest || "root", `${safeName(client.name)}-${safeName(sjabloon.naam)}.docx`, buffer);
    driveLink = up.link;
  } catch (e) { driveError = (e as Error).message; }

  const { rows } = await sql<DocRow>`
    INSERT INTO lead_docs (client_slug, sjabloon, titel, opdracht, drive_link)
    VALUES (${slug}, ${sjabloon.key}, ${titel}, ${opdracht.trim() || null}, ${driveLink || null})
    RETURNING id, sjabloon, titel, opdracht, drive_link, created_at`;

  // Het document gaat ook het dossier in, zodat een volgend document weet wat we
  // al voorgesteld hebben (en met welk budget).
  await addDossierItem(slug, {
    soort: "voorstel",
    titel,
    inhoud: markdown,
    bron: `Gemaakt met het sjabloon ${sjabloon.naam}${opdracht.trim() ? `. Opdracht: ${opdracht.trim().slice(0, 500)}` : ""}`,
    driveLink,
  }).catch(() => null);

  return { ok: true, doc: toDoc(rows[0]), markdown, driveError };
}
