import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { getClientBySlug } from "./clients";
import { getPagePlan, getPageSummary, getClientUrls } from "./site-urls";
import { getStepLinks } from "./page-doc-run";
import { msStatus, msSearchMail, type LiveEmail } from "./ms-graph";

// ═══════════════════════════════════════════════════════════
// MAIL PER PAGINA
// ═══════════════════════════════════════════════════════════
// Mail hing tot nu toe alleen aan de KLANT: het dashboard pakte de laatste
// vijftien mails op het klantdomein. Nergens stond "deze mail gaat over
// /crp-waarde-testen/". Daardoor kon een kaart niet vertellen dat de klant de
// teksten voor die pagina al had teruggestuurd.
//
// Drie manieren om een mail aan een pagina te hangen, in volgorde van hardheid:
//   1. HARD BEWIJS: de mail noemt het pad van de pagina of een documentlink die
//      bij die pagina hoort. Dan gaat hij er aantoonbaar over.
//   2. ZOEKEN: op de kernwoorden van de pagina, binnen de correspondentie met
//      deze klant. Levert een voorstel op, geen zekerheid.
//   3. VASTPINNEN: Maarten bevestigt. Die blijft er voorgoed bij staan.
//
// Alleen 1 en 3 mogen in de geschreven samenvatting genoemd worden; een gok mag
// nooit als feit in beeld komen.
// ═══════════════════════════════════════════════════════════

export type MailBron = "auto" | "pin" | "weg";

export type PaginaMail = {
  id: number;
  messageId: string;
  onderwerp: string;
  vanNaam: string;
  vanAdres: string;
  ontvangenOp: string | null;
  webLink: string;
  superhumanLink: string;
  preview: string;
  bron: MailBron;
  score: number;
  reden: string;
  heeftBijlagen: boolean;
};

// Score-drempels. Onder BEWAAR_VANAF wordt een treffer weggegooid: liever geen
// mail dan een verkeerde. Vanaf HARD_BEWIJS mag hij in de samenvatting genoemd
// worden, ook zonder dat Maarten hem heeft vastgepind.
const BEWAAR_VANAF = 2;
export const HARD_BEWIJS = 3;

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_emails (
      id              SERIAL PRIMARY KEY,
      client_slug     TEXT NOT NULL,
      url_key         TEXT NOT NULL,
      url             TEXT NOT NULL,
      message_id      TEXT NOT NULL,
      conversation_id TEXT,
      onderwerp       TEXT,
      van_naam        TEXT,
      van_adres       TEXT,
      ontvangen_op    TIMESTAMPTZ,
      web_link        TEXT,
      superhuman_link TEXT,
      preview         TEXT,
      heeft_bijlagen  BOOLEAN NOT NULL DEFAULT false,
      bron            TEXT NOT NULL DEFAULT 'auto',
      score           INT NOT NULL DEFAULT 0,
      reden           TEXT,
      gevonden_op     TIMESTAMPTZ NOT NULL DEFAULT now(),
      bevestigd_op    TIMESTAMPTZ,
      UNIQUE (client_slug, url_key, message_id)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS ix_page_emails_pagina ON page_emails (client_slug, url_key)`;
}

function rowToMail(r: Record<string, unknown>): PaginaMail {
  return {
    id: Number(r.id),
    messageId: String(r.message_id || ""),
    onderwerp: (r.onderwerp as string) || "(geen onderwerp)",
    vanNaam: (r.van_naam as string) || "",
    vanAdres: (r.van_adres as string) || "",
    ontvangenOp: r.ontvangen_op ? new Date(r.ontvangen_op as string).toISOString() : null,
    webLink: (r.web_link as string) || "",
    superhumanLink: (r.superhuman_link as string) || "",
    preview: (r.preview as string) || "",
    bron: ((r.bron as string) || "auto") as MailBron,
    score: Number(r.score || 0),
    reden: (r.reden as string) || "",
    heeftBijlagen: !!r.heeft_bijlagen,
  };
}

/** De gekoppelde mails van één pagina, nieuwste eerst. Weggeklikte niet. */
export async function getPaginaMails(slug: string, url: string): Promise<PaginaMail[]> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const { rows } = await sql`
    SELECT id, message_id, onderwerp, van_naam, van_adres, ontvangen_op, web_link,
           superhuman_link, preview, heeft_bijlagen, bron, score, reden
    FROM page_emails
    WHERE client_slug = ${slug} AND url_key = ${k} AND bron <> 'weg'
    ORDER BY (bron = 'pin') DESC, score DESC, ontvangen_op DESC NULLS LAST
    LIMIT 25`;
  return rows.map(rowToMail);
}

/** Hoe oud is de laatste automatische zoekronde voor deze pagina? */
async function laatsteZoekronde(slug: string, k: string): Promise<Date | null> {
  const { rows } = await sql`
    SELECT max(gevonden_op) AS m FROM page_emails
    WHERE client_slug = ${slug} AND url_key = ${k}`;
  return rows[0]?.m ? new Date(rows[0].m as string) : null;
}

// ── Zoektermen afleiden uit de pagina ──
// Het pad is het sterkste signaal: mensen plakken links in mail. Daarna de titel
// en het hoofdzoekwoord uit het plan. Stopwoorden en te korte delen vallen af,
// anders zoek je op "de" en krijg je de hele postbus terug.
const STOP = new Set(["de", "het", "een", "en", "van", "voor", "met", "over", "bij", "op", "in", "te", "test", "pagina"]);

export type Zoekterm = { term: string; gewicht: number };

export async function zoektermenVoorPagina(slug: string, url: string): Promise<Zoekterm[]> {
  const termen: Zoekterm[] = [];
  const zien = new Set<string>();
  const voegToe = (t: string, gewicht: number) => {
    const s = (t || "").trim().toLowerCase();
    if (s.length < 4 || STOP.has(s) || zien.has(s)) return;
    zien.add(s);
    termen.push({ term: s, gewicht });
  };

  // 1. Het pad zelf, en de volledige URL.
  let pad = "";
  try { pad = new URL(url).pathname.replace(/\/+$/, ""); } catch { pad = url; }
  if (pad && pad !== "/") voegToe(pad, 3);

  // 2. Het laatste padsegment als woorden ("crp-waarde-testen" → "crp waarde testen").
  const laatste = pad.split("/").filter(Boolean).pop() || "";
  if (laatste) {
    voegToe(laatste.replace(/-/g, " "), 2);
    // Losse betekenisvolle woorden uit de slug, voor mails die het pad niet noemen.
    for (const w of laatste.split("-")) voegToe(w, 1);
  }

  // 3. Titel van de pagina en het hoofdzoekwoord uit het plan.
  const [urls, plan, samenvatting] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getPagePlan(slug, url).catch(() => ""),
    getPageSummary(slug, url).catch(() => null),
  ]);
  const zelf = urls.find((u) => urlKey(u.url) === urlKey(url));
  if (zelf?.title) voegToe(zelf.title.split(/[|\-–—]/)[0], 2);
  const planEersteZin = (plan || "").split(/[.\n]/)[0] || "";
  const kernwoord = /(?:zoekwoord|zoekterm)[:\s]+"?([^".\n]{3,40})"?/i.exec(plan || "");
  if (kernwoord) voegToe(kernwoord[1], 2);
  else if (planEersteZin.length < 60) voegToe(planEersteZin, 1);
  if (samenvatting?.doel && samenvatting.doel.length < 60) voegToe(samenvatting.doel, 1);

  return termen.sort((a, b) => b.gewicht - a.gewicht).slice(0, 5);
}

// ── Scoren ──
// Hard bewijs (pad of documentlink letterlijk in de mail) telt zwaar; een term in
// het onderwerp telt middelzwaar; alleen in de body telt licht.
function scoreMail(
  mail: { subject: string | null; bodyHtml: string | null; preview: string | null; fromAddress: string | null },
  pad: string,
  docLinks: string[],
  termen: Zoekterm[],
  klantDomein: string,
): { score: number; reden: string } {
  const onderwerp = (mail.subject || "").toLowerCase();
  const body = `${mail.bodyHtml || ""} ${mail.preview || ""}`.toLowerCase();
  const alles = `${onderwerp} ${body}`;
  let score = 0;
  const redenen: string[] = [];

  if (pad && pad.length > 3 && alles.includes(pad.toLowerCase())) {
    score += HARD_BEWIJS;
    redenen.push(`noemt het pad ${pad}`);
  }
  for (const link of docLinks) {
    // Google Docs-links vergelijken op het document-id, niet op de hele URL:
    // dezelfde link komt met en zonder ?usp=sharing voorbij.
    const id = /\/d\/([a-z0-9_-]{20,})/i.exec(link)?.[1];
    if (id && alles.includes(id.toLowerCase())) {
      score += HARD_BEWIJS;
      redenen.push("noemt een document van deze pagina");
      break;
    }
  }
  if (score < HARD_BEWIJS) {
    for (const t of termen) {
      if (onderwerp.includes(t.term)) { score += 2; redenen.push(`"${t.term}" in het onderwerp`); break; }
    }
    for (const t of termen) {
      if (body.includes(t.term)) { score += 1; redenen.push(`"${t.term}" in de mail`); break; }
    }
  }
  const van = (mail.fromAddress || "").toLowerCase();
  if (klantDomein && van.endsWith(`@${klantDomein}`)) { score += 1; redenen.push("van de klant"); }

  return { score, reden: redenen.join(", ") };
}

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Zoekt mails die over deze pagina gaan en bewaart de treffers.
 * Vastgepinde en weggeklikte mails worden nooit overschreven.
 */
export async function zoekMailsVoorPagina(slug: string, url: string): Promise<{ gevonden: number; bewaard: number }> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const client = await getClientBySlug(slug);
  if (!client) return { gevonden: 0, bewaard: 0 };

  const klantDomein = (client.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const klantQuery = (client.email || client.domain || "").trim();
  if (!klantQuery) return { gevonden: 0, bewaard: 0 };

  const status = await msStatus();
  const [termen, stepLinks] = await Promise.all([
    zoektermenVoorPagina(slug, url),
    getStepLinks(slug, url).catch(() => ({ analyse: "", blauwdruk: "", copy: "" } as Record<string, string>)),
  ]);
  const docLinks = Object.values(stepLinks).filter(Boolean);
  let pad = "";
  try { pad = new URL(url).pathname.replace(/\/+$/, ""); } catch { pad = ""; }

  // Kandidaten verzamelen: per zoekterm één ronde binnen de klantcorrespondentie,
  // plus een ronde op de klant zelf (die vangt de lopende thread).
  const kandidaten = new Map<string, LiveEmail>();
  if (status.connected) {
    const rondes = [klantQuery, ...termen.slice(0, 3).map((t) => `${klantQuery} AND "${t.term}"`)];
    for (const q of rondes) {
      const res = await msSearchMail(q, status.account || "", 15, klantQuery).catch(() => null);
      for (const m of res || []) if (!kandidaten.has(m.id)) kandidaten.set(m.id, m);
    }
  }

  // Terugval en aanvulling: de opgeslagen mails van deze klant doorzoeken. Werkt
  // ook als de mailkoppeling uit staat.
  const likeTermen = [pad, ...termen.map((t) => t.term)].filter((t) => t && t.length > 3);
  for (const t of likeTermen.slice(0, 5)) {
    const pat = `%${t}%`;
    const { rows } = await sql`
      SELECT id, subject, from_name, from_address, received_at, preview, web_link, superhuman_link, body_html, direction
      FROM client_emails
      WHERE client_slug = ${slug}
        AND (lower(subject) LIKE ${pat} OR lower(preview) LIKE ${pat} OR lower(body_html) LIKE ${pat})
      ORDER BY received_at DESC NULLS LAST LIMIT 15`;
    for (const r of rows) {
      const id = String(r.id);
      if (kandidaten.has(id)) continue;
      kandidaten.set(id, {
        id,
        subject: (r.subject as string) || null,
        fromName: (r.from_name as string) || null,
        fromAddress: (r.from_address as string) || null,
        receivedAt: r.received_at ? new Date(r.received_at as string).toISOString() : null,
        preview: (r.preview as string) || null,
        webLink: (r.web_link as string) || null,
        superhumanLink: (r.superhuman_link as string) || null,
        bodyHtml: (r.body_html as string) || null,
        direction: (r.direction as string) || null,
        toAddresses: [],
      });
    }
  }

  // Nieuwsbrieven van tools zijn nooit een gesprek over een pagina.
  const bruikbaar = [...kandidaten.values()].filter((m) => !/@(ahrefs|semrush|google)\.com$/i.test((m.fromAddress || "").trim()));

  let bewaard = 0;
  for (const m of bruikbaar) {
    const { score, reden } = scoreMail(m, pad, docLinks, termen, klantDomein);
    if (score < BEWAAR_VANAF) continue;
    const preview = (m.preview || stripHtml(m.bodyHtml || "")).slice(0, 400);
    await sql`
      INSERT INTO page_emails (client_slug, url_key, url, message_id, conversation_id, onderwerp,
                               van_naam, van_adres, ontvangen_op, web_link, superhuman_link, preview,
                               heeft_bijlagen, bron, score, reden, gevonden_op)
      VALUES (${slug}, ${k}, ${url}, ${m.id}, ${m.conversationId || null}, ${(m.subject || "").slice(0, 300)},
              ${(m.fromName || "").slice(0, 120)}, ${(m.fromAddress || "").slice(0, 200)},
              ${m.receivedAt || null}, ${m.webLink || null}, ${m.superhumanLink || null}, ${preview},
              ${!!m.hasAttachments}, 'auto', ${score}, ${reden.slice(0, 300)}, now())
      ON CONFLICT (client_slug, url_key, message_id) DO UPDATE
        SET score = EXCLUDED.score, reden = EXCLUDED.reden, gevonden_op = now(),
            web_link = COALESCE(EXCLUDED.web_link, page_emails.web_link),
            superhuman_link = COALESCE(EXCLUDED.superhuman_link, page_emails.superhuman_link),
            heeft_bijlagen = EXCLUDED.heeft_bijlagen
        WHERE page_emails.bron = 'auto'`;
    bewaard++;
  }
  return { gevonden: bruikbaar.length, bewaard };
}

/** Zoekt alleen als er nog niets is of de laatste ronde ouder is dan een week. */
export async function zoekMailsIndienNodig(slug: string, url: string, maxDagen = 7): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const laatste = await laatsteZoekronde(slug, k);
  if (laatste && Date.now() - laatste.getTime() < maxDagen * 864e5) return;
  await zoekMailsVoorPagina(slug, url).catch(() => { /* zoeken mag het dossier nooit breken */ });
}

/** Vastpinnen: deze mail hoort bij deze pagina, punt. */
export async function pinMail(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE page_emails SET bron = 'pin', bevestigd_op = now() WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Losmaken: terug naar een gewone treffer. */
export async function losMail(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE page_emails SET bron = 'auto', bevestigd_op = NULL WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Wegklikken: hoort hier niet, en komt nooit terug als voorstel. */
export async function wegMail(slug: string, id: number): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`UPDATE page_emails SET bron = 'weg' WHERE client_slug = ${slug} AND id = ${id}`;
}

/** Eén mail ophalen (voor het binnenhalen van een bijlage). */
export async function getPaginaMail(slug: string, id: number): Promise<(PaginaMail & { url: string }) | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, url, message_id, onderwerp, van_naam, van_adres, ontvangen_op, web_link,
           superhuman_link, preview, heeft_bijlagen, bron, score, reden
    FROM page_emails WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { ...rowToMail(rows[0]), url: String(rows[0].url || "") };
}
