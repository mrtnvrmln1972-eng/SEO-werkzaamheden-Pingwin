import { sql, ensureSchema } from "./db";
import { getOrgData } from "./org-data";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// STRUCTURED DATA-KENNISBANK PER KLANT (Klant-tab)
// ═══════════════════════════════════════════════════════════
// De centrale verzamelbak: Maarten dropt er alles in (documenten, gegevens over
// artsen/opto's met BIG en LinkedIn, bestaande schema-code) en het dashboard
// structureert dat tot entiteiten: organisatie, personen, locaties, diensten.
// Append-only: bevestigde entiteiten vervangen hun voorganger als "actueel",
// maar de oude rij blijft bewaard (status "vervangen"). Een drop is eerst een
// VOORSTEL; pas na Maartens klik op "Verwerk" wordt de kennisbank bijgewerkt.
// De kennisbank is dé bron voor alle structured data van de klant, en het rode
// lijstje "Nog aan te leveren" toont wat er voor dit soort bedrijf nog mist.
// ═══════════════════════════════════════════════════════════

export const KENNIS_CATEGORIEEN = ["organisatie", "persoon", "locatie", "dienst", "overig"] as const;
export const CAT_LABEL: Record<string, string> = { organisatie: "Organisatie", persoon: "Personen", locatie: "Locaties", dienst: "Diensten", overig: "Overig" };

export type KennisEntiteit = { id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string };
export type KennisVoorstel = {
  id: number; bron: string; samenvatting: string;
  entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: "nieuw" | "aanvulling" | "ouder" }[];
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_schema_knowledge (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      soort       TEXT NOT NULL DEFAULT 'entiteit',
      categorie   TEXT,
      naam        TEXT,
      velden      JSONB,
      bron        TEXT,
      samenvatting TEXT,
      status      TEXT NOT NULL DEFAULT 'actueel',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_csk_slug ON client_schema_knowledge (client_slug, status)`;
}

export async function listKnowledge(slug: string): Promise<KennisEntiteit[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, categorie, naam, velden, bron, created_at FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'entiteit' AND status = 'actueel'
    ORDER BY categorie, naam`;
  return rows.map((r) => ({
    id: r.id as number, categorie: (r.categorie as string) || "overig", naam: (r.naam as string) || "",
    velden: (r.velden as Record<string, string>) || {}, bron: (r.bron as string) || "",
    updatedAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  }));
}

export async function getOpenProposal(slug: string): Promise<KennisVoorstel | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, bron, samenvatting, velden FROM client_schema_knowledge
    WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel' ORDER BY id DESC LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  const v = (r.velden as { entiteiten?: KennisVoorstel["entiteiten"] }) || {};
  return { id: r.id as number, bron: (r.bron as string) || "", samenvatting: (r.samenvatting as string) || "", entiteiten: v.entiteiten || [] };
}

// Drop → AI structureert naar entiteiten en vergelijkt met wat er al staat.
export async function proposeKnowledge(slug: string, bron: string, tekst: string): Promise<KennisVoorstel> {
  await ensureSchema();
  await ensureTable();
  const huidig = await listKnowledge(slug);
  const huidigTekst = huidig.map((e) => `- [${e.categorie}] ${e.naam}: ${JSON.stringify(e.velden)}`).join("\n") || "(kennisbank is nog leeg)";
  const sys = `Je bent structured data-specialist bij SEO-bureau Pingwin. Je krijgt aangeleverd materiaal over een klant (documenten, gegevens over artsen/medewerkers, schema-code, wat dan ook) en structureert dat tot entiteiten voor de structured data-kennisbank.
Regels:
- Categorieën: organisatie | persoon | locatie | dienst | overig. Eén entiteit per persoon, per locatie, per dienst.
- "velden" is een plat object met korte veldnamen en waarden, alleen wat er ECHT in het materiaal staat: bijv. functie, specialisatie, big (BIG-nummer), linkedin, foto, profielUrl, adres, telefoon, openingstijden, omschrijving. NOOIT iets verzinnen of aanvullen uit eigen kennis.
- Vergelijk met de huidige kennisbank en geef per entiteit een "oordeel": nieuw (stond er nog niet) | aanvulling (bestaat al, dit voegt velden toe of wijzigt ze) | ouder (dit lijkt verouderde informatie t.o.v. wat er staat).
- "samenvatting": 2-3 zinnen in gewone taal: wat dit materiaal is en wat het toevoegt.
Antwoord met UITSLUITEND geldige JSON: {"samenvatting":"...","entiteiten":[{"categorie":"...","naam":"...","velden":{...},"oordeel":"nieuw|aanvulling|ouder"}]}`;
  const user = `Bron: ${bron}\n\nAANGELEVERD MATERIAAL:\n${(tekst || "").slice(0, 14000)}\n\nHUIDIGE KENNISBANK:\n${huidigTekst.slice(0, 6000)}`;
  const raw = await callClaude(sys, [{ role: "user", content: user }], 4000, { slug, action: "kennisbank-structureren" });
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { samenvatting?: string; entiteiten?: KennisVoorstel["entiteiten"] };
  const entiteiten = (parsed.entiteiten || []).filter((e) => e && e.naam && (KENNIS_CATEGORIEEN as readonly string[]).includes(e.categorie)).slice(0, 60);
  if (!entiteiten.length) throw new Error("Geen herkenbare gegevens gevonden in het aangeleverde materiaal.");
  const samenvatting = (parsed.samenvatting || "Aangeleverd materiaal.").trim();
  // Eventueel ouder open voorstel sluiten: er is altijd maar één voorstel open.
  await sql`UPDATE client_schema_knowledge SET status = 'genegeerd' WHERE client_slug = ${slug} AND soort = 'drop' AND status = 'voorstel'`;
  const { rows } = await sql`
    INSERT INTO client_schema_knowledge (client_slug, soort, bron, samenvatting, velden, status)
    VALUES (${slug}, 'drop', ${bron}, ${samenvatting}, ${JSON.stringify({ entiteiten })}, 'voorstel')
    RETURNING id`;
  return { id: rows[0].id as number, bron, samenvatting, entiteiten };
}

// Verwerken: entiteiten samenvoegen in de kennisbank (append-only, oude rij blijft).
export async function confirmKnowledge(slug: string, id: number): Promise<{ ok: boolean; error?: string; verwerkt?: number }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT velden FROM client_schema_knowledge WHERE client_slug = ${slug} AND id = ${id} AND soort = 'drop' AND status = 'voorstel' LIMIT 1`;
  if (!rows[0]) return { ok: false, error: "Voorstel niet gevonden (misschien al verwerkt)." };
  const entiteiten = ((rows[0].velden as { entiteiten?: KennisVoorstel["entiteiten"] })?.entiteiten) || [];
  const huidig = await listKnowledge(slug);
  const key = (c: string, n: string) => `${c}|${n.trim().toLowerCase()}`;
  const byKey = new Map(huidig.map((e) => [key(e.categorie, e.naam), e]));
  let verwerkt = 0;
  for (const e of entiteiten) {
    const bestaand = byKey.get(key(e.categorie, e.naam));
    // Samenvoegen: nieuwe waarden winnen per veld, bestaande velden zonder nieuwe waarde blijven.
    const velden = { ...(bestaand?.velden || {}), ...Object.fromEntries(Object.entries(e.velden || {}).filter(([, v]) => String(v || "").trim())) };
    if (bestaand) await sql`UPDATE client_schema_knowledge SET status = 'vervangen' WHERE client_slug = ${slug} AND id = ${bestaand.id}`;
    await sql`
      INSERT INTO client_schema_knowledge (client_slug, soort, categorie, naam, velden, bron, status)
      VALUES (${slug}, 'entiteit', ${e.categorie}, ${e.naam.trim()}, ${JSON.stringify(velden)}, ${`voorstel #${id}`}, 'actueel')`;
    verwerkt++;
  }
  await sql`UPDATE client_schema_knowledge SET status = 'verwerkt' WHERE client_slug = ${slug} AND id = ${id}`;
  return { ok: true, verwerkt };
}

export async function ignoreKnowledge(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE client_schema_knowledge SET status = 'genegeerd' WHERE client_slug = ${slug} AND id = ${id} AND status = 'voorstel'`;
}

// ─── Rood lijstje "Nog aan te leveren": wat mist er voor dit soort bedrijf ───

export async function knowledgeGaps(slug: string): Promise<string[]> {
  const [org, entiteiten] = await Promise.all([getOrgData(slug), listKnowledge(slug)]);
  const d = org.data;
  const gaps: string[] = [];
  const leeg = (v: unknown) => !String(v || "").trim();
  // Basis (elk bedrijf): de bouwstenen van het site-brede identiteitsblok.
  if (leeg(d.bedrijfstype)) gaps.push("Bedrijfstype (kliniek, webshop, dienstverlener, lokaal of informatief) is nog niet gekozen.");
  if (leeg(d.kvk)) gaps.push("KvK-nummer ontbreekt.");
  if (leeg(d.telefoon)) gaps.push("Telefoonnummer ontbreekt.");
  if (leeg(d.straat) && !d.geenBezoekadres) gaps.push("Bezoekadres ontbreekt (of vink 'geen bezoekadres' aan).");
  if (leeg(d.logoUrl)) gaps.push("Logo-URL ontbreekt.");
  if (!Array.isArray(d.sameAs) || !d.sameAs.length) gaps.push("Social/profiel-links (sameAs) ontbreken, bijv. LinkedIn of Facebook van het bedrijf.");
  if (leeg(d.openingstijden) && (d.bedrijfstype === "kliniek" || d.bedrijfstype === "lokaal")) gaps.push("Openingstijden ontbreken.");
  // Personen (vooral kliniek/zorg): credentials maken het E-E-A-T-verhaal.
  const personen = entiteiten.filter((e) => e.categorie === "persoon");
  const artsenForm = Array.isArray(d.artsen) ? d.artsen.filter((a) => String(a?.naam || "").trim()) : [];
  if (d.bedrijfstype === "kliniek") {
    if (!personen.length && !artsenForm.length) gaps.push("Nog geen artsen of behandelaars aangeleverd (naam, functie, BIG-nummer, LinkedIn).");
    for (const p of personen) {
      const ontbreekt: string[] = [];
      if (leeg(p.velden.big)) ontbreekt.push("BIG-nummer");
      if (leeg(p.velden.linkedin) && leeg(p.velden.profielUrl)) ontbreekt.push("LinkedIn of profielpagina");
      if (leeg(p.velden.functie)) ontbreekt.push("functie");
      if (ontbreekt.length) gaps.push(`${p.naam}: ${ontbreekt.join(", ")} ontbreekt.`);
    }
  }
  // Locaties: zonder adres en openingstijden geen LocalBusiness-node.
  for (const l of entiteiten.filter((e) => e.categorie === "locatie")) {
    const ontbreekt: string[] = [];
    if (leeg(l.velden.adres)) ontbreekt.push("adres");
    if (leeg(l.velden.openingstijden)) ontbreekt.push("openingstijden");
    if (ontbreekt.length) gaps.push(`Locatie ${l.naam}: ${ontbreekt.join(" en ")} ontbreken.`);
  }
  // Diensten zonder omschrijving zijn een lege Service-node.
  for (const s of entiteiten.filter((e) => e.categorie === "dienst")) {
    if (leeg(s.velden.omschrijving)) gaps.push(`Dienst ${s.naam}: korte omschrijving ontbreekt.`);
  }
  if (d.bedrijfstype === "webshop" && leeg(d.retourUrl) && leeg(d.retourTermijn)) gaps.push("Retourinformatie ontbreekt (nodig voor product-schema).");
  return gaps.slice(0, 25);
}

// Platte tekst van de kennisbank voor de schema-prompt (per pagina-run).
export async function knowledgeText(slug: string): Promise<string> {
  const entiteiten = await listKnowledge(slug).catch(() => [] as KennisEntiteit[]);
  if (!entiteiten.length) return "";
  const perCat = new Map<string, string[]>();
  for (const e of entiteiten) {
    const regel = `- ${e.naam}: ${Object.entries(e.velden).map(([k, v]) => `${k}=${v}`).join("; ")}`;
    perCat.set(e.categorie, [...(perCat.get(e.categorie) || []), regel]);
  }
  return [...perCat.entries()].map(([c, regels]) => `${CAT_LABEL[c] || c}:\n${regels.join("\n")}`).join("\n\n").slice(0, 6000);
}
