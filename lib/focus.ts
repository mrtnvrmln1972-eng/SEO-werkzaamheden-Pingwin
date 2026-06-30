import { sql, ensureSchema } from "./db";

// ═══════════════════════════════════════════════════════════
// FOCUS-BLOK PER KLANT
// ═══════════════════════════════════════════════════════════
// Afgesproken zoekwoorden met hun landingpagina, plus snelle links
// (linkbuilding-sheets, Google Search Console, Analytics). Eén JSON-rij
// per klant. Bewerkbaar in de cockpit, getoond onder "Open punten uit mail".
// ═══════════════════════════════════════════════════════════

export type FocusKeyword = { kw: string; url: string };
export type FocusLink = { label: string; url: string };
export type ClientFocus = { keywords: FocusKeyword[]; links: FocusLink[] };

function clean(focus: Partial<ClientFocus>): ClientFocus {
  const keywords = (focus.keywords ?? [])
    .map((k) => ({ kw: (k.kw || "").trim(), url: (k.url || "").trim() }))
    .filter((k) => k.kw || k.url);
  const links = (focus.links ?? [])
    .map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() }))
    .filter((l) => l.label || l.url);
  return { keywords, links };
}

export async function getFocus(slug: string): Promise<ClientFocus> {
  await ensureSchema();
  const { rows } = await sql`SELECT data FROM client_focus WHERE client_slug = ${slug} LIMIT 1`;
  const d = rows[0]?.data as Partial<ClientFocus> | undefined;
  return { keywords: d?.keywords ?? [], links: d?.links ?? [] };
}

export async function saveFocus(slug: string, focus: Partial<ClientFocus>): Promise<ClientFocus> {
  await ensureSchema();
  const data = clean(focus);
  const json = JSON.stringify(data);
  await sql`
    INSERT INTO client_focus (client_slug, data, updated_at)
    VALUES (${slug}, ${json}::jsonb, now())
    ON CONFLICT (client_slug) DO UPDATE SET data = ${json}::jsonb, updated_at = now()`;
  return data;
}
