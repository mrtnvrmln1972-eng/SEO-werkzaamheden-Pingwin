import { sql, ensureSchema } from "./db";
import { sanitizeHtml as sanitize, escapeHtml as esc } from "./veilige-html";

// ═══════════════════════════════════════════════════════════
// FOCUS-BLOK PER KLANT
// ═══════════════════════════════════════════════════════════
// Afgesproken zoekwoorden met hun landingpagina, plus snelle links
// (linkbuilding-sheets, Google Search Console, Analytics). Eén JSON-rij
// per klant. Bewerkbaar in de cockpit, getoond onder "Open punten uit mail".
// ═══════════════════════════════════════════════════════════

// Het focus-blok is nu één vrij opmaakbaar tekstveld (HTML): vet, bullets,
// genummerde lijsten en gelinkte woorden. Oudere data (losse zoekwoorden/links)
// wordt automatisch omgezet naar opgemaakte HTML, zodat niets verloren gaat.
export type FocusKeyword = { kw: string; url: string };
export type FocusLink = { label: string; url: string };
export type ClientFocus = { html: string; prioHtml: string };

function legacyToHtml(d: { keywords?: FocusKeyword[]; links?: FocusLink[] }): string {
  let h = "";
  if (d.keywords?.length) {
    h += "<p><strong>Afgesproken zoekwoorden &rarr; pagina</strong></p><ul>";
    for (const k of d.keywords) h += `<li>${esc(k.kw)}${k.url ? `: <a href="${esc(k.url)}">${esc(k.url)}</a>` : ""}</li>`;
    h += "</ul>";
  }
  if (d.links?.length) {
    h += "<p><strong>Snelle links</strong></p><ul>";
    for (const l of d.links) h += `<li><a href="${esc(l.url)}">${esc(l.label || l.url)}</a></li>`;
    h += "</ul>";
  }
  return h;
}

export async function getFocus(slug: string): Promise<ClientFocus> {
  await ensureSchema();
  const { rows } = await sql`SELECT data FROM client_focus WHERE client_slug = ${slug} LIMIT 1`;
  const d = rows[0]?.data as { html?: string; prioHtml?: string; keywords?: FocusKeyword[]; links?: FocusLink[] } | undefined;
  if (!d) return { html: "", prioHtml: "" };
  const html = typeof d.html === "string" ? d.html : legacyToHtml(d);
  return { html: sanitize(html), prioHtml: sanitize(typeof d.prioHtml === "string" ? d.prioHtml : "") };
}

export async function saveFocus(slug: string, focus: Partial<ClientFocus>): Promise<ClientFocus> {
  await ensureSchema();
  // Alleen bijwerken wat er meegestuurd wordt. Twee blokken delen deze rij (de
  // zoekwoorden en de top prio's), en die slaan allebei automatisch op tijdens het
  // typen. Zou een opslag altijd het hele blokje overschrijven, dan wist het ene
  // veld het andere zodra je erin typte.
  const huidig = await getFocus(slug);
  const html = sanitize(typeof focus.html === "string" ? focus.html : huidig.html);
  const prioHtml = sanitize(typeof focus.prioHtml === "string" ? focus.prioHtml : huidig.prioHtml);
  const json = JSON.stringify({ html, prioHtml });
  await sql`
    INSERT INTO client_focus (client_slug, data, updated_at)
    VALUES (${slug}, ${json}::jsonb, now())
    ON CONFLICT (client_slug) DO UPDATE SET data = ${json}::jsonb, updated_at = now()`;
  return { html, prioHtml };
}
