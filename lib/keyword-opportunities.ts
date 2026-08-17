import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { getClientBySlug } from "./clients";
import { getAhrefsKeywords } from "./ahrefs-keywords";
import { getKeywordIdeas, getSiteOrganicKeywords, ahrefsConfigured } from "./ahrefs";
import { getCompetitors } from "./competitors";
import { callClaude, anthropicConfigured } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// ZOEKWOORD-KANSEN: relevante zoekwoorden waar de site NOG NIET op rankt
// ═══════════════════════════════════════════════════════════
// Bron: keyword-ideas rond de eigen kernthema's + (later) concurrenten-gap.
// Filter: Claude beoordeelt per kandidaat of hij ECHT relevant is voor deze
// klant (past bij de dienst, commercieel interessant), niet alleen semantisch
// dichtbij. Zo houden we van "duizenden" alleen de relevante kansen over.
// ═══════════════════════════════════════════════════════════

export type Opportunity = {
  keyword: string; volume: number | null; difficulty: number | null;
  source: string; reason: string;
};

// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsure(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "keyword-opportunities-102eeb56";

async function ensureTable(): Promise<void> {
  return eenmalig("keyword-opportunities", SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_keyword_opportunities (
      client_slug TEXT NOT NULL,
      keyword     TEXT NOT NULL,
      volume      INTEGER,
      difficulty  INTEGER,
      source      TEXT,
      reason      TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, keyword)
    )`;
}

export async function getOpportunities(slug: string): Promise<Opportunity[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT keyword, volume, difficulty, source, reason
    FROM client_keyword_opportunities WHERE client_slug = ${slug}
    ORDER BY volume DESC NULLS LAST`;
  return rows.map((r) => ({
    keyword: r.keyword as string,
    volume: r.volume == null ? null : Number(r.volume),
    difficulty: r.difficulty == null ? null : Number(r.difficulty),
    source: (r.source as string) || "",
    reason: (r.reason as string) || "",
  }));
}

const norm = (s: string) => s.trim().toLowerCase();

// Claude beoordeelt in batches welke kandidaten echt relevant zijn. Geeft per
// relevante kandidaat een korte reden terug. Robuuste JSON-parsing.
async function filterRelevantWithClaude(
  clientName: string, profile: string, themeSeeds: string[], candidates: { keyword: string }[],
): Promise<Map<string, string>> {
  const keep = new Map<string, string>();
  const system = `Je bent een SEO-strateeg. Je krijgt een klant met kernthema's en een lijst kandidaat-zoekwoorden. Bepaal welke zoekwoorden ECHT relevant zijn voor deze klant: passen bij de dienst/het aanbod en zijn commercieel of inhoudelijk interessant om op gevonden te worden. Sluit uit: off-topic, merknamen van anderen, te generiek/niet-koopgericht, of duidelijk buiten het vakgebied.
Antwoord met UITSLUITEND geldige JSON: een array van de RELEVANTE zoekwoorden, elk als {"keyword": "<exact zoals gegeven>", "reason": "<max 8 woorden waarom relevant>"}. Geen tekst eromheen. Laat niet-relevante zoekwoorden gewoon weg.`;
  const batchSize = 70;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const user = `KLANT: ${clientName}\nKLANTPROFIEL: ${profile || "(geen)"}\nKERNTHEMA'S (zaad-zoekwoorden): ${themeSeeds.join(", ")}\n\nKANDIDAAT-ZOEKWOORDEN:\n${batch.map((c) => `- ${c.keyword}`).join("\n")}`;
    try {
      const raw = await callClaude(system, [{ role: "user", content: user }], 3000, { action: "kansen" });
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const first = cleaned.indexOf("["); const last = cleaned.lastIndexOf("]");
      const jsonText = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (p && typeof p.keyword === "string" && p.keyword.trim()) keep.set(norm(p.keyword), typeof p.reason === "string" ? p.reason : "");
        }
      }
    } catch { /* batch overslaan bij parse-fout */ }
  }
  return keep;
}

// Verzamelt kansen: keyword-ideas rond de eigen kernthema's, minus wat de site al
// rankt, daarna Claude-relevantiefilter. Slaat de relevante kansen op.
export async function collectOpportunities(slug: string): Promise<{ ok: boolean; error?: string; total?: number }> {
  if (!ahrefsConfigured()) return { ok: false, error: "Ahrefs is niet gekoppeld." };
  if (!anthropicConfigured()) return { ok: false, error: "De relevantiefilter heeft een ANTHROPIC_API_KEY nodig in Vercel." };
  const client = await getClientBySlug(slug);
  if (!client?.domain) return { ok: false, error: "Deze klant heeft nog geen domein ingevuld." };

  const own = await getAhrefsKeywords(slug);
  if (own.length === 0) return { ok: false, error: "Haal eerst de Ahrefs-zoekwoorden op; die vormen de kernthema's voor de kansen-zoektocht." };

  // Zaad-thema's: de sterkste eigen niet-merk-zoekwoorden.
  const seeds = own.filter((k) => !k.branded).slice(0, 8).map((k) => k.keyword);
  const ownSet = new Set(own.map((k) => norm(k.keyword)));

  // Kandidaten: (1) keyword-ideas rond de zaden, (2) concurrenten-gap. Ontdubbeld
  // en zonder wat de site al rankt. Bron per kandidaat onthouden.
  const cand = new Map<string, { keyword: string; volume: number | null; difficulty: number | null; source: string }>();
  for (const seed of seeds) {
    let ideas: { keyword: string; volume: number | null; difficulty: number | null }[] = [];
    try { ideas = await getKeywordIdeas(seed, "nl", 40); } catch { ideas = []; }
    for (const it of ideas) {
      const k = norm(it.keyword);
      if (!k || ownSet.has(k) || cand.has(k)) continue;
      if ((it.volume || 0) < 50) continue; // minimale vraag
      cand.set(k, { keyword: it.keyword, volume: it.volume, difficulty: it.difficulty, source: "ideas" });
    }
  }

  // Concurrenten-gap: waar zij wel scoren en de klant nog niet.
  const competitors = await getCompetitors(slug).catch(() => []);
  for (const comp of competitors) {
    let rows: { keyword: string; volume: number | null; position: number | null; branded: boolean }[] = [];
    try { rows = await getSiteOrganicKeywords(comp, "nl", 300); } catch { rows = []; }
    for (const r of rows) {
      const k = norm(r.keyword);
      if (!k || r.branded || ownSet.has(k) || cand.has(k)) continue;
      if ((r.volume || 0) < 50) continue;
      cand.set(k, { keyword: r.keyword, volume: r.volume, difficulty: null, source: "concurrent" });
    }
  }

  const candidates = [...cand.values()];
  if (candidates.length === 0) return { ok: true, total: 0 };

  const keep = await filterRelevantWithClaude(client.name, client.seoProfile || "", seeds, candidates);

  await ensureSchema();
  await ensureTable();
  await sql`DELETE FROM client_keyword_opportunities WHERE client_slug = ${slug}`;
  let stored = 0;
  for (const c of candidates) {
    const reason = keep.get(norm(c.keyword));
    if (reason === undefined) continue; // niet relevant volgens Claude
    await sql`
      INSERT INTO client_keyword_opportunities (client_slug, keyword, volume, difficulty, source, reason, updated_at)
      VALUES (${slug}, ${c.keyword}, ${c.volume}, ${c.difficulty}, ${c.source}, ${reason || null}, now())
      ON CONFLICT (client_slug, keyword) DO UPDATE SET volume = ${c.volume}, difficulty = ${c.difficulty}, source = ${c.source}, reason = ${reason || null}, updated_at = now()`;
    stored++;
  }
  return { ok: true, total: stored };
}
