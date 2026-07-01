import { sql, ensureSchema } from "./db";

// Bewaart chats per pagina (of ze nu wel of niet zijn overgenomen), zodat je ze
// terug kunt lezen en met een kruisje kunt verwijderen.

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ChatSummary = { id: number; title: string; updatedAt: string; count: number };

async function ensureTable(): Promise<void> {
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

export async function listChats(slug: string, url: string): Promise<ChatSummary[]> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`
    SELECT id, title, updated_at, jsonb_array_length(messages) AS n
    FROM page_chats WHERE client_slug = ${slug} AND url = ${url} ORDER BY updated_at DESC`;
  return rows.map((r) => ({ id: Number(r.id), title: (r.title as string) || "(chat)", updatedAt: new Date(r.updated_at as string).toISOString(), count: Number(r.n || 0) }));
}

export async function getChat(id: number): Promise<{ id: number; messages: ChatMsg[] } | null> {
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`SELECT id, messages FROM page_chats WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), messages: (rows[0].messages as ChatMsg[]) || [] };
}

export async function saveChat(slug: string, url: string, id: number | null, messages: ChatMsg[]): Promise<number> {
  await ensureSchema(); await ensureTable();
  const firstUser = messages.find((m) => m.role === "user")?.content || "";
  const title = firstUser.replace(/\s+/g, " ").trim().slice(0, 90);
  if (id) {
    await sql`UPDATE page_chats SET messages = ${JSON.stringify(messages)}, title = ${title || null}, updated_at = now() WHERE id = ${id}`;
    return id;
  }
  const ins = await sql`INSERT INTO page_chats (client_slug, url, title, messages) VALUES (${slug}, ${url}, ${title || null}, ${JSON.stringify(messages)}) RETURNING id`;
  return Number(ins.rows[0].id);
}

export async function deleteChat(id: number): Promise<void> {
  await ensureSchema(); await ensureTable();
  await sql`DELETE FROM page_chats WHERE id = ${id}`;
}
