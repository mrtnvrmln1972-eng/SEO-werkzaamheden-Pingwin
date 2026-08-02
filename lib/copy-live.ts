// ═══════════════════════════════════════════════════════════
// STAAT DE GESCHREVEN COPY OOK ECHT OP DE SITE?
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: het dashboard noemde een pagina "gedaan" zodra er een
// copy-document was. Dat is niet hetzelfde als doorgevoerd. De fase "Bouw en
// publicatie" had helemaal geen automatische bron (overview.ts zette hem hard op
// false) en wachtte op een handmatig vinkje, dus in de praktijk klopte het
// overzicht van wat er live staat nooit.
//
// Hoe we het meten: we halen de live pagina op en leggen de H1 en de tussenkoppen
// uit ons copy-document ernaast. Komt het merendeel overeen, dan staat de nieuwe
// tekst er aantoonbaar op. Zelfde aanpak als verifyDevWorklist doet voor meta's en
// alt-teksten: meten in plaats van vragen.
//
// Bewust op koppen en niet op de lopende tekst: de sitebouwer mag alinea's
// herschikken of een zin aanpassen, dat maakt de copy niet "niet doorgevoerd".
// Koppen zijn de ruggengraat en veranderen zelden ongemerkt.

import { sql, ensureSchema } from "./db";
import { fetchPageContent } from "./page-content";
import { logActiviteit } from "./activiteit";
import { urlKey } from "./url-key";

// Vanaf dit aandeel gevonden koppen noemen we de copy doorgevoerd. Niet 100%:
// een sitebouwer laat weleens één kop weg of splitst er een.
const DREMPEL = 0.6;

export type CopyLiveRij = {
  url: string;
  gemeten: string | null;
  status: number | null;
  totaal: number;
  gevonden: number;
  percentage: number;
  doorgevoerd: boolean;
  // Konden we de pagina überhaupt lezen? Een site die ons blokkeert (403) of een
  // pagina die niet laadt is iets ANDERS dan copy die niet is doorgevoerd. Zonder
  // dit onderscheid zou het dashboard beweren dat er niets live staat zodra een
  // klantsite ons even weigert, en dat is precies het soort onwaarheid dat het
  // overzicht onbruikbaar maakt.
  meetbaar: boolean;
};

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_copy_live (
      client_slug TEXT NOT NULL,
      url         TEXT NOT NULL,
      checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      status      INTEGER,
      total       INTEGER NOT NULL DEFAULT 0,
      found       INTEGER NOT NULL DEFAULT 0,
      live        BOOLEAN NOT NULL DEFAULT false,
      PRIMARY KEY (client_slug, url)
    )`;
  // Zelfhelend, zoals de rest van het schema: een nieuwe kolom is één regel erbij.
  await sql`ALTER TABLE page_copy_live ADD COLUMN IF NOT EXISTS measured BOOLEAN NOT NULL DEFAULT false`;
}

// Vergelijkbaar maken: kleine letters, geen leestekens, geen dubbele spaties.
// Ook het "H2 — "-label eraf, want dat staat in ons document en niet op de site.
function norm(s: string): string {
  return (s || "")
    .replace(/^\s*h[1-3]\s*[—–-]\s*/i, "")
    .toLowerCase()
    .replace(/[’'"“”„]/g, "")
    .replace(/[^a-z0-9à-ÿ]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * De koppen uit een copy-document: de H1 en alle H2's. Het document is markdown
 * (# / ## / ###), maar soms staat het niveau al als label in de kop zelf
 * ("H2 — Onze werkwijze"); copyNaarSecties in copy-doc-klant.ts schrijft dat zo.
 * Beide vormen komen hier binnen, dus beide worden herkend.
 */
export function koppenUitCopy(content: string): string[] {
  const uit: string[] = [];
  for (const raw of (content || "").split("\n")) {
    const r = raw.trim();
    const md = /^(#{1,2})\s+(.+)$/.exec(r);
    if (md) { uit.push(md[2]); continue; }
    const label = /^\*{0,2}H[12]\s*[—–-]\s*(.+?)\*{0,2}$/i.exec(r);
    if (label) uit.push(label[1]);
  }
  // Dedupliceren op de genormaliseerde vorm; lege koppen vallen af.
  const gezien = new Set<string>();
  return uit.filter((k) => {
    const n = norm(k);
    if (!n || gezien.has(n)) return false;
    gezien.add(n);
    return true;
  });
}

/**
 * Eén pagina meten. Geeft altijd een rij terug, ook als de pagina niet leesbaar
 * is; dan is doorgevoerd simpelweg false en zie je aan de status waarom.
 */
export async function meetCopyLive(url: string, copyContent: string): Promise<Omit<CopyLiveRij, "gemeten">> {
  const doel = koppenUitCopy(copyContent);
  const leeg = { url, status: null as number | null, totaal: doel.length, gevonden: 0, percentage: 0, doorgevoerd: false, meetbaar: false };
  // Geen koppen in ons document: er valt niets te vergelijken. Dat is geen
  // mislukte meting van de pagina, dus meetbaar blijft hier bewust false.
  if (!doel.length) return leeg;

  const pagina = await fetchPageContent(url).catch(() => null);
  if (!pagina) return leeg;
  if (pagina.status !== null && pagina.status >= 400) return { ...leeg, status: pagina.status };

  const liveKoppen = [pagina.h1, ...pagina.headings].map(norm).filter(Boolean);
  // Pagina laadt wel maar geeft geen enkele kop terug (JavaScript-site, of we
  // kregen een blokkeerpagina): niet meetbaar, geen oordeel.
  if (!liveKoppen.length) return { ...leeg, status: pagina.status };

  // Een kop telt als gevonden bij een exacte match, of als de ene de andere
  // bevat. Dat vangt kleine redactionele aanpassingen van de sitebouwer op
  // zonder dat een compleet andere kop meetelt.
  let gevonden = 0;
  for (const k of doel) {
    const n = norm(k);
    if (!n) continue;
    if (liveKoppen.some((l) => l === n || (n.length > 12 && (l.includes(n) || n.includes(l))))) gevonden++;
  }
  const percentage = Math.round((gevonden / doel.length) * 100);
  return { url, status: pagina.status, totaal: doel.length, gevonden, percentage, doorgevoerd: gevonden > 0 && gevonden / doel.length >= DREMPEL, meetbaar: true };
}

/**
 * Meet alle pagina's van deze klant waarvoor een copy-document bestaat en bewaart
 * de uitkomst. Dit is wat de knop "Controleer de site" doet.
 */
export async function runCopyLiveCheck(slug: string): Promise<{ gemeten: number; meetbaar: number; doorgevoerd: number; onleesbaar: number; rijen: CopyLiveRij[] }> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url, content FROM page_doc_outputs WHERE client_slug = ${slug} AND kind = 'copy' AND content IS NOT NULL AND content <> ''`;
  const werk = rows.map((r) => ({ url: String(r.url), content: String(r.content || "") }));
  const uit: CopyLiveRij[] = [];
  const gemetenOp = new Date().toISOString();
  // Zes tegelijk: zelfde ritme als verifyDevWorklist, snel genoeg zonder de site
  // van de klant te overvallen.
  for (let i = 0; i < werk.length; i += 6) {
    const deel = await Promise.all(werk.slice(i, i + 6).map((w) => meetCopyLive(w.url, w.content).catch(() => null)));
    for (const m of deel) {
      if (!m) continue;
      await sql`
        INSERT INTO page_copy_live (client_slug, url, checked_at, status, total, found, live, measured)
        VALUES (${slug}, ${m.url}, now(), ${m.status}, ${m.totaal}, ${m.gevonden}, ${m.doorgevoerd}, ${m.meetbaar})
        ON CONFLICT (client_slug, url) DO UPDATE
          SET checked_at = now(), status = ${m.status}, total = ${m.totaal}, found = ${m.gevonden}, live = ${m.doorgevoerd}, measured = ${m.meetbaar}`;
      // Staat de copy aantoonbaar live, dan is dat een mijlpaal voor deze pagina.
      // Eén regel per pagina: de herkomst is de URL, dus een volgende controle
      // levert geen tweede regel op.
      if (m.doorgevoerd) {
        await logActiviteit({
          slug, soort: "copy-live", bron: "page_copy_live", bronId: m.url, url: m.url,
        });
      }
      uit.push({ ...m, gemeten: gemetenOp });
    }
  }
  const meetbaar = uit.filter((r) => r.meetbaar);
  const doorgevoerd = meetbaar.filter((r) => r.doorgevoerd).length;
  return {
    gemeten: uit.length,
    meetbaar: meetbaar.length,
    doorgevoerd,
    onleesbaar: uit.length - meetbaar.length,
    rijen: uit,
  };
}

/** De laatst gemeten stand per pagina (op urlKey), voor de fases en het werkplan. */
export async function getCopyLiveAll(slug: string): Promise<Record<string, CopyLiveRij>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT url, checked_at, status, total, found, live, measured FROM page_copy_live WHERE client_slug = ${slug}`;
  const uit: Record<string, CopyLiveRij> = {};
  for (const r of rows) {
    const url = String(r.url);
    const totaal = Number(r.total) || 0;
    const gevonden = Number(r.found) || 0;
    uit[urlKey(url)] = {
      url,
      gemeten: r.checked_at ? new Date(r.checked_at as string).toISOString() : null,
      status: r.status == null ? null : Number(r.status),
      totaal,
      gevonden,
      percentage: totaal ? Math.round((gevonden / totaal) * 100) : 0,
      doorgevoerd: r.live === true,
      meetbaar: r.measured === true,
    };
  }
  return uit;
}
