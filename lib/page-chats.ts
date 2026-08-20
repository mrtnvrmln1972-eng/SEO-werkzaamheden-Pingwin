import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { urlKey } from "./url-key";

// Bewaart chats per pagina (of ze nu wel of niet zijn overgenomen), zodat je ze
// terug kunt lezen en met een kruisje kunt verwijderen.

export type ChatMsg = { role: "user" | "assistant"; content: string };
// `createdAt` staat er vanaf 20-08-2026 bij. De kolom bestond al, maar reisde
// niet mee naar het scherm, en zonder die twee data is een gesprek van vandaag
// niet te onderscheiden van een gesprek van vijf weken terug. Dat is precies
// het verschil dat bepaalt welke strategie nog geldt.
export type ChatSummary = { id: number; title: string; updatedAt: string; createdAt: string; count: number };

// Eén keer per serverinstantie (gecachet), scheelt CREATE TABLE per verzoek.
// De tabellen worden één keer gebouwd per database, niet bij elke koude
// server opnieuw. Zie lib/schema-stand.ts. Verander je iets aan doEnsureTable(),
// hoog dan het cijfer in de versie hieronder op; anders komt het er nooit in.
const SCHEMA_VERSIE = "page-chats-527d6618";

async function ensureTable(): Promise<void> {
  return eenmalig("page-chats", SCHEMA_VERSIE, doEnsureTable);
}
async function doEnsureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_chats (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      title       TEXT,
      messages    JSONB NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

// Eén rij uit page_chats naar het overzicht op het scherm. Stond twee keer
// woordelijk uitgeschreven (hieronder en in listChatsForKey), en toen de datum
// erbij moest was dat meteen twee plekken; vandaar deze ene vorm.
function naarSummary(r: Record<string, unknown>): ChatSummary {
  // Titel altijd uit de eerste vraag afleiden (volledig), zodat oude chats die
  // met een kortere titel zijn opgeslagen ook de hele vraag tonen.
  const msgs = (r.messages as ChatMsg[]) || [];
  const firstUser = msgs.find((m) => m.role === "user")?.content || "";
  const derived = firstUser.replace(/\s+/g, " ").trim().slice(0, 400);
  const iso = (v: unknown) => { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? "" : d.toISOString(); };
  return {
    id: Number(r.id),
    title: derived || (r.title as string) || "(chat)",
    updatedAt: iso(r.updated_at),
    createdAt: iso(r.created_at),
    count: Number(r.n || 0),
  };
}

export async function listChats(slug: string, url: string): Promise<ChatSummary[]> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`
    SELECT id, title, messages, created_at, updated_at, jsonb_array_length(messages) AS n
    FROM page_chats WHERE client_slug = ${slug} AND url = ${url} ORDER BY updated_at DESC`;
  return rows.map(naarSummary);
}

// Zelfde lijst, vergelijkend op de genormaliseerde sleutel (www/trailing slash
// doen er niet toe). De tabel bewaart de rauwe URL, dus zonder dit mist het
// paginadossier chats die onder een net andere schrijfwijze zijn opgeslagen.
export async function listChatsForKey(slug: string, url: string): Promise<ChatSummary[]> {
  await ensureSchema(); await ensureTable();
  const k = urlKey(url);
  const { rows } = await sql`
    SELECT id, url, title, messages, created_at, updated_at, jsonb_array_length(messages) AS n
    FROM page_chats WHERE client_slug = ${slug} ORDER BY updated_at DESC LIMIT 200`;
  return rows.filter((r) => urlKey(String(r.url || "")) === k).map(naarSummary);
}

// Eén chat mét zijn data: het scherm dat een gesprek opent (de projectkaart)
// haalt hem hierlangs op en moet er de datum bij kunnen zetten.
export async function getChat(id: number): Promise<{ id: number; messages: ChatMsg[]; updatedAt: string; createdAt: string } | null> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`SELECT id, messages, created_at, updated_at FROM page_chats WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  const iso = (v: unknown) => { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? "" : d.toISOString(); };
  return {
    id: Number(rows[0].id),
    messages: (rows[0].messages as ChatMsg[]) || [],
    updatedAt: iso(rows[0].updated_at),
    createdAt: iso(rows[0].created_at),
  };
}

export async function saveChat(slug: string, url: string, id: number | null, messages: ChatMsg[]): Promise<number> {
  await ensureSchema(); await ensureTable();
  const firstUser = messages.find((m) => m.role === "user")?.content || "";
  // De hele vraag geldt als titel (ruim begrensd tegen extreem lange invoer).
  const title = firstUser.replace(/\s+/g, " ").trim().slice(0, 400);
  if (id) {
    await sql`UPDATE page_chats SET messages = ${JSON.stringify(messages)}, title = ${title || null}, updated_at = now() WHERE id = ${id}`;
    return id;
  }
  const ins = await sql`INSERT INTO page_chats (client_slug, url, title, messages) VALUES (${slug}, ${url}, ${title || null}, ${JSON.stringify(messages)}) RETURNING id`;
  return Number(ins.rows[0].id);
}

// De klant (slug) waar een chat bij hoort, zodat de aanroeper de toegang kan
// toetsen voordat hij verwijdert.
export async function getChatSlug(id: number): Promise<string | null> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`SELECT client_slug FROM page_chats WHERE id = ${id} LIMIT 1`;
  return rows[0] ? (rows[0].client_slug as string) : null;
}

export async function deleteChat(id: number): Promise<void> {
  await ensureSchema(); await ensureTable();
  await sql`DELETE FROM page_chats WHERE id = ${id}`;
}
