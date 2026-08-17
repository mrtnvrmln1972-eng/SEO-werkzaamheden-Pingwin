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
export type ClientFocus = { html: string; prioHtml: string; koersHtml: string; links: FocusLink[] };

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

function schoneLinks(links: unknown): FocusLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l): l is FocusLink => !!l && typeof l === "object" && typeof (l as FocusLink).url === "string" && (l as FocusLink).url.trim() !== "")
    .map((l) => ({ label: String(l.label || "").trim().slice(0, 120), url: String(l.url).trim().slice(0, 500) }));
}

export async function getFocus(slug: string): Promise<ClientFocus> {
  await ensureSchema();
  const { rows } = await sql`SELECT data FROM client_focus WHERE client_slug = ${slug} LIMIT 1`;
  const d = rows[0]?.data as { html?: string; prioHtml?: string; koersHtml?: string; keywords?: FocusKeyword[]; links?: FocusLink[] } | undefined;
  if (!d) return { html: "", prioHtml: "", koersHtml: "", links: [] };
  const html = typeof d.html === "string" ? d.html : legacyToHtml(d);
  // De losse linkkolom is nieuw sinds deze wijziging. Een rij van vóór "html"
  // bestond (de oude, ongemigreerde vorm) had zijn links al in legacyToHtml
  // verwerkt; die niet nog een keer als aparte kolom tonen.
  const links = typeof d.html === "string" ? schoneLinks(d.links) : [];
  return {
    html: sanitize(html),
    prioHtml: sanitize(typeof d.prioHtml === "string" ? d.prioHtml : ""),
    koersHtml: sanitize(typeof d.koersHtml === "string" ? d.koersHtml : ""),
    links,
  };
}

// ── Vangnet: de vorige inhoud bewaren vóór elke overschrijving ──
// Dit veld had geen geschiedenis. Toen op 11 augustus 2026 een sleepfout
// inhoud buiten het tekstvak zette, schreef de automatische opslag een
// half leeg veld weg en was de rest voorgoed kwijt. Nu schuift elke opslag de
// vorige versie in de geschiedenis, zodat terugzetten altijd kan.
const HISTORIE_PER_VELD = 20;

export type FocusVersie = { id: number; veld: string; html: string; bewaardOp: string };

async function bewaarVorige(slug: string, veld: "html" | "prioHtml" | "koersHtml", vorige: string): Promise<void> {
  // Een lege of ongewijzigde inhoud levert geen bruikbaar herstelpunt op.
  if (!vorige.trim()) return;
  try {
    await sql`
      INSERT INTO client_focus_historie (client_slug, veld, html)
      VALUES (${slug}, ${veld}, ${vorige})`;
    // Alleen de laatste versies aanhouden; dit veld wordt tijdens het typen
    // automatisch opgeslagen, dus zonder opschonen groeit dit hard.
    await sql`
      DELETE FROM client_focus_historie
      WHERE client_slug = ${slug} AND veld = ${veld} AND id NOT IN (
        SELECT id FROM client_focus_historie
        WHERE client_slug = ${slug} AND veld = ${veld}
        ORDER BY bewaard_op DESC LIMIT ${HISTORIE_PER_VELD}
      )`;
  } catch {
    // Het vangnet mag het opslaan zelf nooit tegenhouden.
  }
}

export async function getFocusHistorie(slug: string): Promise<FocusVersie[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, veld, html, bewaard_op FROM client_focus_historie
    WHERE client_slug = ${slug} ORDER BY bewaard_op DESC LIMIT 40`;
  return rows.map((r) => ({
    id: Number(r.id), veld: String(r.veld), html: String(r.html),
    bewaardOp: new Date(r.bewaard_op as string).toISOString(),
  }));
}

export async function saveFocus(slug: string, focus: Partial<ClientFocus>): Promise<ClientFocus> {
  await ensureSchema();
  // Alleen bijwerken wat er meegestuurd wordt. Drie blokken delen deze rij (de
  // zoekwoorden, de top prio's en de linkkolom), en die slaan allebei automatisch
  // op tijdens het typen. Zou een opslag altijd het hele blokje overschrijven,
  // dan wist het ene veld het andere zodra je erin typte.
  const huidig = await getFocus(slug);
  const html = sanitize(typeof focus.html === "string" ? focus.html : huidig.html);
  const prioHtml = sanitize(typeof focus.prioHtml === "string" ? focus.prioHtml : huidig.prioHtml);
  const koersHtml = sanitize(typeof focus.koersHtml === "string" ? focus.koersHtml : huidig.koersHtml);
  const links = Array.isArray(focus.links) ? schoneLinks(focus.links) : huidig.links;
  // Verandert een tekstveld écht, bewaar dan eerst wat er stond.
  if (html !== huidig.html) await bewaarVorige(slug, "html", huidig.html);
  if (prioHtml !== huidig.prioHtml) await bewaarVorige(slug, "prioHtml", huidig.prioHtml);
  if (koersHtml !== huidig.koersHtml) await bewaarVorige(slug, "koersHtml", huidig.koersHtml);
  const json = JSON.stringify({ html, prioHtml, koersHtml, links });
  await sql`
    INSERT INTO client_focus (client_slug, data, updated_at)
    VALUES (${slug}, ${json}::jsonb, now())
    ON CONFLICT (client_slug) DO UPDATE SET data = ${json}::jsonb, updated_at = now()`;
  return { html, prioHtml, koersHtml, links };
}
