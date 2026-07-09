import { sql, ensureSchema } from "./db";
import { callClaude } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// SITE-WIDE STRATEGIE-SESSIES (uit de SEO-assistent-chat)
// ═══════════════════════════════════════════════════════════
// Een gesprek in de SEO-assistent kan met één knop worden vastgelegd als
// strategie-sessie: een beschrijvende titel, de conclusie/terugkoppeling en het
// volledige gesprek, plus de concrete actiepunten die eruit voortvloeien.
// De sessies verschijnen als toggles bovenaan het Taken-tabblad; actiepunten
// kunnen daar met één klik als taak (zonder maand) worden toegevoegd.
// ═══════════════════════════════════════════════════════════

export type StrategyAction = { taak: string; wie: string; fase: string; taskId?: number };
export type StrategySession = {
  id: number;
  title: string;
  summary: string;      // markdown: de conclusie/terugkoppeling van het gesprek
  transcript: string;   // markdown: het volledige gesprek
  actions: StrategyAction[];
  createdAt: string;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_strategy_sessions (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      title       TEXT NOT NULL,
      summary     TEXT NOT NULL DEFAULT '',
      transcript  TEXT NOT NULL DEFAULT '',
      actions     JSONB NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(r: any): StrategySession {
  let actions: StrategyAction[] = [];
  try { const a = typeof r.actions === "string" ? JSON.parse(r.actions) : r.actions; if (Array.isArray(a)) actions = a; } catch { /* leeg laten */ }
  return {
    id: Number(r.id),
    title: (r.title as string) || "",
    summary: (r.summary as string) || "",
    transcript: (r.transcript as string) || "",
    actions,
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}

export async function getStrategySessions(slug: string): Promise<StrategySession[]> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT * FROM client_strategy_sessions WHERE client_slug = ${slug} ORDER BY id DESC`;
  return rows.map(rowToSession);
}

export async function deleteStrategySession(slug: string, id: number): Promise<boolean> {
  await ensureSchema();
  await ensureTable();
  const { rowCount } = await sql`DELETE FROM client_strategy_sessions WHERE client_slug = ${slug} AND id = ${id}`;
  return (rowCount || 0) > 0;
}

// Zet het taak-id bij een actiepunt zodra het als taak is toegevoegd (vinkje in de UI).
export async function markActionAdded(slug: string, id: number, actionIndex: number, taskId: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT actions FROM client_strategy_sessions WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  if (!rows[0]) return;
  let actions: StrategyAction[] = [];
  try { const a = typeof rows[0].actions === "string" ? JSON.parse(rows[0].actions) : rows[0].actions; if (Array.isArray(a)) actions = a; } catch { /* leeg */ }
  if (!actions[actionIndex]) return;
  actions[actionIndex] = { ...actions[actionIndex], taskId };
  await sql`UPDATE client_strategy_sessions SET actions = ${JSON.stringify(actions)} WHERE client_slug = ${slug} AND id = ${id}`;
}

// Maakt van een chatgesprek een strategie-sessie: beschrijvende titel, de
// conclusie/terugkoppeling als nette samenvatting, en de concrete actiepunten.
export async function createStrategySession(slug: string, messages: { role: string; content: string }[], clientName: string): Promise<StrategySession> {
  await ensureSchema();
  await ensureTable();
  const transcript = messages
    .map((m) => `${m.role === "user" ? "**Maarten:**" : "**SEO-assistent:**"}\n${(m.content || "").trim()}`)
    .join("\n\n---\n\n");

  const system = `Je bent een senior SEO-strateeg bij bureau Pingwin. Hieronder staat een gesprek uit de SEO-assistent over de site van ${clientName || slug}. Leg dit vast als site-wide strategie-sessie.
Geef UITSLUITEND geldige JSON in dit formaat, zonder tekst eromheen:
{"titel": "korte beschrijvende titel van het besproken onderwerp (max 60 tekens, geen aanhalingstekens erin)", "samenvatting": "de conclusie en terugkoppeling van het gesprek als nette markdown: wat is besproken, wat is de strategie/aanpak, en waarom (kopjes en bullets waar dat helpt; compleet maar geen herhaling van het hele gesprek)", "acties": [{"taak": "concrete taak/stap in één regel", "wie": "SEO of Dev", "fase": "Bouwen, Herbedraden, Opschonen of leeg"}]}
- De titel beschrijft het ONDERWERP (bijv. "Interne linkstructuur blog herzien"), niet "chatgesprek".
- In "acties" alleen concrete, uitvoerbare taken/stappen/werkzaamheden die uit het gesprek voortvloeien (geen vaagheden); geen acties besproken, dan een lege lijst.
- Geen em-dash of en-dash; gebruik komma, dubbele punt of een nieuwe zin. Geen emoji.`;

  const raw = await callClaude(system, [{ role: "user", content: `Het gesprek:\n\n${transcript.slice(0, 60000)}` }], 4000, { slug, action: "strategie_sessie" });
  let title = "Strategie-sessie";
  let summary = "";
  let actions: StrategyAction[] = [];
  try {
    const p = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (typeof p.titel === "string" && p.titel.trim()) title = p.titel.trim().slice(0, 80);
    if (typeof p.samenvatting === "string") summary = p.samenvatting.trim();
    if (Array.isArray(p.acties)) {
      actions = p.acties
        .filter((a: Record<string, unknown>) => a && typeof a.taak === "string" && (a.taak as string).trim())
        .map((a: Record<string, unknown>) => ({
          taak: String(a.taak).trim(),
          wie: String(a.wie || "SEO").trim() === "Dev" ? "Dev" : "SEO",
          fase: ["Bouwen", "Herbedraden", "Opschonen"].includes(String(a.fase || "").trim()) ? String(a.fase).trim() : "",
        }));
    }
  } catch {
    // Zonder geldige JSON leggen we het gesprek toch vast, met het laatste
    // assistent-antwoord als samenvatting.
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    summary = (lastAssistant?.content || "").trim();
  }

  const { rows } = await sql`
    INSERT INTO client_strategy_sessions (client_slug, title, summary, transcript, actions)
    VALUES (${slug}, ${title}, ${summary}, ${transcript}, ${JSON.stringify(actions)})
    RETURNING *`;
  return rowToSession(rows[0]);
}
