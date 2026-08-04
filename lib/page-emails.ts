import { sql, ensureSchema } from "./db";
import { urlKey } from "./url-key";
import { HARD_BEWIJS } from "./constants";
import { getClientBySlug } from "./clients";
import { getPagePlan, getPageSummary, getClientUrls } from "./site-urls";
import { getStepLinks } from "./page-doc-run";
import { msStatus, msSearchMail, msGetThread, msListAttachments, msGetAttachment, type LiveEmail } from "./ms-graph";
import { eigenTekst, isRuisMail } from "./mail-tekst";
import { callClaude, anthropicConfigured, LIGHT_MODEL } from "./anthropic";
import { leesAangeleverdDocument, proposeVersion } from "./doc-versions";
import { logActiviteit } from "./activiteit";

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
  bijlageNamen: string[];
  kern: string;
};

// Score-drempels. Onder BEWAAR_VANAF wordt een treffer weggegooid: liever geen
// mail dan een verkeerde. Vanaf HARD_BEWIJS mag hij in de samenvatting genoemd
// worden, ook zonder dat Maarten hem heeft vastgepind.
const BEWAAR_VANAF = 2;
export { HARD_BEWIJS };

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
  // Namen van de bijlagen: vaak het echte bewijs waar een mail over gaat, en
  // nodig om in de tijdlijn te kunnen tonen wát er is teruggestuurd.
  await sql`ALTER TABLE page_emails ADD COLUMN IF NOT EXISTS bijlage_namen TEXT`;
  // Eén zin over wat er in deze mail gebeurde, geschreven door de zeef. Dit is
  // de regel die als stap in de tijdlijn op de kaart komt.
  await sql`ALTER TABLE page_emails ADD COLUMN IF NOT EXISTS kern TEXT`;
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
    bijlageNamen: String(r.bijlage_namen || "").split(" | ").map((x) => x.trim()).filter(Boolean),
    kern: (r.kern as string) || "",
  };
}

/** De gekoppelde mails van één pagina, nieuwste eerst. Weggeklikte niet. */
export async function getPaginaMails(slug: string, url: string): Promise<PaginaMail[]> {
  await ensureSchema();
  await ensureTable();
  const k = urlKey(url);
  const { rows } = await sql`
    SELECT id, message_id, onderwerp, van_naam, van_adres, ontvangen_op, web_link,
           superhuman_link, preview, heeft_bijlagen, bijlage_namen, kern, bron, score, reden
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

// ── Tot welke mail is deze pagina bijgewerkt? ──
// Niet "wanneer zochten we voor het laatst", maar "welke mail was toen de
// nieuwste". Dat verschil is de hele crux: het tijdstip van de laatste zoekronde
// verspringt bij élke keer dat je een kaart opent, dus een mail die vlak dáárvoor
// binnenkwam viel permanent buiten de boot. Met de mail zelf als peilmerk kan dat
// niet meer: is er klantmail nieuwer dan het peilmerk, dan wordt er precies één
// keer opnieuw gezocht.
// Elke keer dat de manier van zoeken of scoren verbetert, gaat dit getal omhoog.
// Een pagina die met een oudere versie is gescand wordt dan één keer opnieuw
// bekeken. Zonder dit blijft een verbetering onzichtbaar op precies de pagina's
// waarvoor hij bedoeld was: het systeem denkt "ik ben bij", terwijl die stand
// met de oude, te smalle zoekregels is vastgelegd.
const SCAN_VERSIE = 4;

async function ensureScanTabel(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS page_mail_scans (
      client_slug TEXT NOT NULL,
      url_key     TEXT NOT NULL,
      tot_mail    TIMESTAMPTZ,
      gescand_op  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, url_key)
    )`;
  await sql`ALTER TABLE page_mail_scans ADD COLUMN IF NOT EXISTS versie INT NOT NULL DEFAULT 1`;
}

async function nieuwsteKlantMail(slug: string): Promise<Date | null> {
  const { rows } = await sql`SELECT max(received_at) AS m FROM client_emails WHERE client_slug = ${slug}`;
  return rows[0]?.m ? new Date(rows[0].m as string) : null;
}

async function scanPeilmerk(slug: string, k: string): Promise<Date | null | undefined> {
  const { rows } = await sql`SELECT tot_mail, versie FROM page_mail_scans WHERE client_slug = ${slug} AND url_key = ${k} LIMIT 1`;
  if (!rows.length) return undefined;                       // nog nooit gescand
  // Met een oudere zoekversie gescand? Dan telt die stand niet: behandel de
  // pagina alsof hij nog nooit langs de postbus is geweest.
  if (Number(rows[0].versie || 1) < SCAN_VERSIE) return undefined;
  return rows[0].tot_mail ? new Date(rows[0].tot_mail as string) : null;
}

async function zetPeilmerk(slug: string, k: string, tot: Date | null): Promise<void> {
  await sql`
    INSERT INTO page_mail_scans (client_slug, url_key, tot_mail, gescand_op, versie)
    VALUES (${slug}, ${k}, ${tot ? tot.toISOString() : null}, now(), ${SCAN_VERSIE})
    ON CONFLICT (client_slug, url_key) DO UPDATE
      SET tot_mail = EXCLUDED.tot_mail, gescand_op = now(), versie = EXCLUDED.versie`;
}

// ── Zoektermen afleiden uit de pagina ──
// Het pad is het sterkste signaal: mensen plakken links in mail. Daarna de titel
// en het hoofdzoekwoord uit het plan. Stopwoorden en te korte delen vallen af,
// anders zoek je op "de" en krijg je de hele postbus terug.
const STOP = new Set(["de", "het", "een", "en", "van", "voor", "met", "over", "bij", "op", "in", "te", "test", "pagina"]);

export type Zoekterm = { term: string; gewicht: number };

// ── Waar de KAART over gaat, als zoekterm ──
//
// Het pad is het sterkste signaal, maar niet altijd het signaal waarmee mensen
// mailen. Op /lensimplantatie/edof-lenzen/ lag een kaart over de toeslag op de
// "EDOF Speciality" lens; in die mailwisseling staat het pad nergens, wel de
// productnaam. Zochten we alleen op het pad en de slug, dan bleef precies de
// correspondentie die bij de klus hoorde onvindbaar, terwijl een ander traject
// op diezelfde pagina (dat het pad wél noemde) de kaart overnam.
//
// We pakken uit de kaart alleen de EIGENNAMEN: twee of meer aaneengesloten
// woorden met een hoofdletter, plus wat tussen aanhalingstekens staat. Dat zijn
// product- en projectnamen, precies wat in een mail terugkomt. Losse woorden uit
// de kaarttekst laten we met rust; die leveren de halve postbus op.
const KAART_RUIS = /^(update|nieuw|nieuwe|copy|blauwdruk|analyse|bouw|meta|title|description|alt|teksten|tekst|pagina|structured|data|seo|google)$/i;

async function kaarttermenVoorPagina(slug: string, k: string): Promise<string[]> {
  const { rows } = await sql`
    SELECT taak, toelichting, url FROM client_weekplan
    WHERE client_slug = ${slug} AND status <> 'klaar' AND url IS NOT NULL AND url <> ''`;
  const uit: string[] = [];
  const zien = new Set<string>();
  for (const r of rows) {
    // urlKey-matching in JS, nooit in SQL: anders mis je een kaart door een www'tje.
    if (urlKey(String(r.url || "")) !== k) continue;
    // Titel eerst: dáár staat waar de klus over gaat. De toelichting noemt ook de
    // trajecten eromheen, en die mogen de titel niet uit de lijst duwen.
    for (const bron of [String(r.taak || ""), String(r.toelichting || "")]) {
      if (!bron.trim()) continue;
      for (const m of bron.matchAll(/"([^"\n]{4,40})"|\b([A-ZÀ-Ý][\wÀ-ÿ]*(?:[ -][A-ZÀ-Ý][\wÀ-ÿ]*)+)\b/g)) {
        // "Mail Nicoline Trap 31-7" levert de persoon op, niet het onderwerp; de
        // aanloop eraf, dan houd je over waar het echt over gaat.
        const term = (m[1] || m[2] || "").trim().toLowerCase().replace(/^(?:mail(?:tje)?|reactie|antwoord)\s+(?:van\s+|aan\s+)?/, "");
        if (term.length < 5 || term.length > 40 || zien.has(term)) continue;
        const woorden = term.split(/[\s-]+/).filter(Boolean);
        if (woorden.every((w) => KAART_RUIS.test(w))) continue;
        zien.add(term);
        uit.push(term);
      }
    }
  }
  return uit;
}

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
    // Mét koppeltekens én als losse woorden. Mensen schrijven "de CRP-test" in
    // een mail, precies zoals de slug. Zochten we alleen op "crp test", dan werd
    // dat door de mailzoeker als twee losse woorden behandeld en gleed "CRP-test"
    // er doorheen; dat is één van de manieren waarop een mail onvindbaar bleef.
    voegToe(laatste, 3);
    voegToe(laatste.replace(/-/g, " "), 2);
    // Losse betekenisvolle woorden uit de slug, voor mails die het pad niet noemen.
    for (const w of laatste.split("-")) voegToe(w, 1);
  }

  // 3. Titel van de pagina en het hoofdzoekwoord uit het plan.
  const [urls, plan, samenvatting, kaarttermen] = await Promise.all([
    getClientUrls(slug).catch(() => []),
    getPagePlan(slug, url).catch(() => ""),
    getPageSummary(slug, url).catch(() => null),
    kaarttermenVoorPagina(slug, urlKey(url)).catch(() => [] as string[]),
  ]);
  // De eigennamen uit de kaart komen vóór de titel en het plan: dit is waar de
  // klus over gaat, en dus waar de mail over gaat.
  for (const t of kaarttermen.slice(0, 3)) voegToe(t, 2);
  const zelf = urls.find((u) => urlKey(u.url) === urlKey(url));
  if (zelf?.title) voegToe(zelf.title.split(/[|\-–—]/)[0], 2);
  const planEersteZin = (plan || "").split(/[.\n]/)[0] || "";
  const kernwoord = /(?:zoekwoord|zoekterm)[:\s]+"?([^".\n]{3,40})"?/i.exec(plan || "");
  if (kernwoord) voegToe(kernwoord[1], 2);
  else if (planEersteZin.length < 60) voegToe(planEersteZin, 1);
  if (samenvatting?.doel && samenvatting.doel.length < 60) voegToe(samenvatting.doel, 1);

  // Zes in plaats van vijf: de eigennamen uit de kaart komen er nu bij, en anders
  // zouden die precies de paginatitel eruit duwen.
  return termen.sort((a, b) => b.gewicht - a.gewicht).slice(0, 6);
}

// ── Scoren ──
//
// ALLEEN op wat de afzender zelf schreef, plus de namen van de bijlagen. Reden:
// onder elke reply hangt de hele thread, dus wie de volledige body leest ziet in
// élke mail van een thread het pad en de documentlinks staan. Zo belandde een
// mail over de SOA-test en een belafspraak als "hard bewijs" bij de CRP-pagina.
//
// Andersom net zo belangrijk: de mail waarin de klant zijn geredigeerde teksten
// terugstuurt zegt vaak alleen "de teksten zijn aangepast" en noemt het onderwerp
// niet. Het bewijs zit dan in de bijlagenaam (Tekst CRP-waarde 21-07-2026.pdf).
// Hoeveel betekenisvolle woorden van een pad komen terug in een bestandsnaam?
// Streepjes, punten en cijfers doen er niet toe: "Tekst CRP-waarde
// 21-07-2026.pdf" tegenover "/crp-waarde-testen" levert twee treffers (crp,
// waarde). Datums en extensies tellen nooit mee.
export function bijlageOverlap(bestandsnaam: string, pad: string): number {
  // BEWUST ZONDER STOPWOORDEN. Die lijst is er voor zóéktermen ("de", "van",
  // "test" als los woord levert de halve postbus op). Maar in een pad is "test"
  // juist betekenisvol: /crp-test/ kromp daardoor tot het ene woord "crp", en
  // dan haalde geen enkele bijlage de drempel van twee. Zo bleef de teruggestuurde
  // tekst "Tekst CRP-test 21-07-2026.pdf" onaangeraakt liggen, terwijl de mail
  // ernaast wél gekoppeld was.
  const delen = (s: string) => s.toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, "")                 // extensie eraf
    .replace(/\d{1,4}[-.]\d{1,2}[-.]\d{2,4}/g, " ")   // datums eraf
    .split(/[^a-zà-ÿ0-9]+/i)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));

  const uitPad = new Set(delen(pad));
  if (!uitPad.size) return 0;
  const uitNaam = new Set(delen(bestandsnaam));
  // Ook de aan elkaar geschreven variant, want zo heten bestanden vaak:
  // "OneDayClinicvoorstelcrptestpagina.docx" bevat geen enkel scheidingsteken,
  // maar gaat overduidelijk over deze pagina.
  const plat = [...uitNaam].join("");
  let n = 0;
  for (const w of uitPad) if (uitNaam.has(w) || plat.includes(w)) n++;
  return n;
}

function scoreMail(
  mail: { subject: string | null; bodyHtml: string | null; preview: string | null; fromAddress: string | null },
  pad: string,
  docLinks: string[],
  termen: Zoekterm[],
  klantDomein: string,
  bijlageNamen: string[] = [],
): { score: number; reden: string } {
  const onderwerp = (mail.subject || "").toLowerCase();
  const eigen = eigenTekst(mail.bodyHtml || "", mail.preview || "", 4000).toLowerCase();
  const bijlagen = bijlageNamen.join(" ").toLowerCase();
  const eigenPlusOnderwerp = `${onderwerp} ${eigen} ${bijlagen}`;
  let score = 0;
  const redenen: string[] = [];

  if (pad && pad.length > 3 && eigenPlusOnderwerp.includes(pad.toLowerCase())) {
    score += HARD_BEWIJS;
    redenen.push(`noemt zelf het pad ${pad}`);
  }
  // De slug zonder schuine streep telt net zo hard: "de CRP-test is aangepast"
  // is even ondubbelzinnig als het volledige pad, en zo schrijft iedereen het in
  // een mail. Alleen bij een slug die specifiek genoeg is, dus met een streepje
  // erin of minstens acht tekens; anders zou "diensten" hele postbussen vangen.
  const slug = (pad.split("/").filter(Boolean).pop() || "").toLowerCase();
  if (score < HARD_BEWIJS && slug && (slug.includes("-") || slug.length >= 8) && eigenPlusOnderwerp.includes(slug)) {
    score += HARD_BEWIJS;
    redenen.push(`noemt de pagina bij naam (${slug})`);
  }
  if (score < HARD_BEWIJS) {
    for (const link of docLinks) {
      // Google Docs-links vergelijken op het document-id, niet op de hele URL:
      // dezelfde link komt met en zonder ?usp=sharing voorbij.
      const id = /\/d\/([a-z0-9_-]{20,})/i.exec(link)?.[1];
      if (id && eigen.includes(id.toLowerCase())) {
        score += HARD_BEWIJS;
        redenen.push("stuurt een document van deze pagina mee");
        break;
      }
    }
  }
  // Een bijlage die het onderwerp van de pagina in de naam heeft is even hard
  // bewijs als het pad: dat is de teruggestuurde tekst.
  //
  // Op WOORDNIVEAU vergelijken, niet als hele zin. "Tekst CRP-waarde
  // 21-07-2026.pdf" hoort bij /crp-waarde-testen/, maar bevat de letterlijke
  // frase "crp waarde testen" niet. Daar liep het eerder op stuk, precies bij de
  // mail waarin de klant zijn teksten terugstuurde.
  if (score < HARD_BEWIJS && bijlageNamen.length) {
    const beste = Math.max(0, ...bijlageNamen.map((n) => bijlageOverlap(n, pad)));
    if (beste >= 2) {
      score += HARD_BEWIJS;
      redenen.push("bijlage met de naam van deze pagina");
    }
  }
  if (score < HARD_BEWIJS) {
    for (const t of termen) {
      if (onderwerp.includes(t.term)) { score += 2; redenen.push(`"${t.term}" in het onderwerp`); break; }
    }
    for (const t of termen) {
      if (eigen.includes(t.term)) { score += 2; redenen.push(`schrijft zelf over "${t.term}"`); break; }
    }
  }
  // "Van de klant" is alleen een bonus BOVENOP een inhoudelijke treffer, nooit
  // een reden op zich. Anders haalt elke klantmail in de thread de drempel.
  const van = (mail.fromAddress || "").toLowerCase();
  if (score >= BEWAAR_VANAF && klantDomein && van.endsWith(`@${klantDomein}`)) {
    score += 1;
    redenen.push("van de klant");
  }

  return { score, reden: redenen.join(", ") };
}

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ── Tweede zeef: begrijpt waar een mail over gaat ──
//
// De puntentelling hierboven is stevig maar dom: hij herkent woorden, geen
// betekenis. Deze stap legt alle kandidaten in ÉÉN korte vraag voor: hoort deze
// mail bij deze pagina, en wat is er in één zin gebeurd? Die zin is meteen de
// regel die in de tijdlijn op de kaart komt.
//
// Eén aanroep per pagina, niet per mail, en hooguit eens per week. Valt hij uit
// (geen sleutel, storing, onleesbaar antwoord), dan blijft de puntentelling
// gewoon gelden: de zeef mag het koppelen nooit blokkeren.
type Oordeel = { hoort: boolean; kern: string };

async function beoordeelMails(
  slug: string,
  pad: string,
  paginaTitel: string,
  kandidaten: { id: string; subject: string | null; fromName: string | null; eigen: string; bijlagen: string[]; datum: string }[],
): Promise<Map<string, Oordeel>> {
  const uit = new Map<string, Oordeel>();
  if (!kandidaten.length || !anthropicConfigured()) return uit;

  const systeem = `Je helpt een SEO-bureau bepalen welke e-mails écht over één specifieke webpagina gaan.

DE PAGINA: ${pad}${paginaTitel ? ` (${paginaTitel})` : ""}

Je krijgt e-mails met alleen het deel dat de afzender ZELF schreef (de geciteerde geschiedenis is er al afgehaald).

Beoordeel per mail:
- "hoort": true als deze mail inhoudelijk over DEZE pagina gaat: de tekst ervan, de opzet, correcties erop, of een afspraak die specifiek deze pagina betreft. false als de mail over een ander onderwerp gaat (een andere pagina, een belafspraak in het algemeen, een factuur, een rapportage), ook al zat hij in dezelfde mailwisseling.
- "kern": in één korte zin wat er in deze mail gebeurde, in gewone taal, vanuit het bureau gezien. Bijvoorbeeld "Amit stuurde de aangepaste teksten terug als pdf" of "jij stelde de nieuwe opzet voor met een apart doel per pagina". Geen datum erin, die staat er al voor. Maximaal 14 woorden.

Antwoord met UITSLUITEND geldige JSON: een array met per mail {"id": "<exact het meegegeven id>", "hoort": true/false, "kern": "<zin>"}. Geen tekst eromheen.`;

  const lijst = kandidaten.map((k) => [
    `--- id: ${k.id}`,
    `datum: ${k.datum}`,
    `van: ${k.fromName || "onbekend"}`,
    `onderwerp: ${k.subject || "(geen)"}`,
    k.bijlagen.length ? `bijlagen: ${k.bijlagen.join(", ")}` : "",
    `eigen tekst: ${k.eigen.slice(0, 700) || "(niets eigen geschreven)"}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  try {
    const raw = await callClaude(systeem, [{ role: "user", content: lijst }], 1200, { slug, action: "mail-zeef" }, LIGHT_MODEL);
    const schoon = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const van = schoon.indexOf("["), tot = schoon.lastIndexOf("]");
    if (van === -1 || tot <= van) return uit;
    const rijen = JSON.parse(schoon.slice(van, tot + 1)) as { id?: string; hoort?: boolean; kern?: string }[];
    for (const r of Array.isArray(rijen) ? rijen : []) {
      const id = String(r.id || "").trim();
      if (!id) continue;
      uit.set(id, { hoort: r.hoort !== false, kern: String(r.kern || "").replace(/\s+/g, " ").trim().slice(0, 160) });
    }
  } catch {
    /* onleesbaar antwoord of storing: de puntentelling beslist */
  }
  return uit;
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
    // Eén ronde op de klant zelf (vangt de lopende thread) en per zoekterm een
    // ronde binnen die correspondentie. De quotes horen HIER, want msSearchMail
    // krijgt een complete KQL-uitdrukking.
    //
    // De klantronde is bewust RUIM (veertig in plaats van twintig): hij is het
    // anker waar de rest op leunt. Vindt hij de mail met het pad niet, dan is er
    // ook geen gesprek om compleet op te halen, en blijft een pagina leeg.
    //
    // En er gaat een ronde op de ZOEKTERM ALLEEN mee. De koppeling zat eerst
    // altijd vast aan het klantadres, maar precies de mails die ertoe doen gaan
    // vaak níet naar dat adres: jij mailt de contactpersoon rechtstreeks, of de
    // sitebouwer, en dan komt "info@klant.nl" nergens in de mail voor. Zo'n mail
    // werd dan alleen gevonden als hij toevallig in een gesprek zat dat al
    // gekoppeld was. De score en de zeef daarna bepalen of hij echt hierbij
    // hoort, dus ruimer zoeken kost geen precisie.
    const rondes = [
      `"${klantQuery}"`,
      ...termen.slice(0, 3).map((t) => `"${klantQuery}" AND "${t.term}"`),
      ...termen.slice(0, 2).map((t) => `"${t.term}"`),
    ];
    for (const q of rondes) {
      const res = await msSearchMail(q, status.account || "", 40, klantQuery).catch(() => null);
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

  // Automatische meldingen zijn nooit een gesprek over een pagina.
  let bruikbaar = [...kandidaten.values()].filter((m) => !isRuisMail(m));

  // ── Van losse mails naar het GESPREK ──
  //
  // Zoeken geeft de nieuwste zoveel mails terug. Juist de oudste mail van een
  // thread, waarin het verzoek staat met het pad en de documentlinks, viel daar
  // telkens buiten: bij One Day Clinic werd de mail van 14 juli nooit gevonden,
  // terwijl die het hele verhaal draagt.
  //
  // Daarom: zodra ÉÉN mail hard bewijs bevat, is het hele gesprek relevant en
  // halen we het compleet op via het gespreks-kenmerk. Dat is exact en niet
  // afhankelijk van een gok op zoekwoorden.
  if (status.connected) {
    const relevanteThreads = new Set<string>();
    for (const m of bruikbaar) {
      if (!m.conversationId) continue;
      if (relevanteThreads.has(m.conversationId)) continue;
      const { score } = scoreMail(m, pad, docLinks, termen, klantDomein, []);
      if (score >= HARD_BEWIJS) relevanteThreads.add(m.conversationId);
    }
    for (const cid of [...relevanteThreads].slice(0, 4)) {
      const thread = await msGetThread(cid, status.account || "", 40, klantQuery).catch(() => null);
      for (const m of thread || []) if (!kandidaten.has(m.id)) kandidaten.set(m.id, m);
    }
    bruikbaar = [...kandidaten.values()].filter((m) => !isRuisMail(m));
  }

  // Bijlagenamen ophalen voor de mails die bijlagen hebben. Vaak zit juist daar
  // het bewijs ("Tekst CRP-waarde 21-07-2026.pdf"), terwijl de mail zelf alleen
  // "de teksten zijn aangepast" zegt. Begrensd, want dit is een extra aanroep
  // per mail; mails met bijlagen zijn zeldzaam genoeg om dat te dragen.
  const namenPerMail = new Map<string, string[]>();
  const metBijlagen = bruikbaar.filter((m) => m.hasAttachments).slice(0, 8);
  for (const m of metBijlagen) {
    const lijst = await msListAttachments(m.id).catch(() => null);
    if (lijst) namenPerMail.set(m.id, lijst.map((a) => a.naam));
  }

  // Welke gesprekken gaan over deze pagina? Eén mail met hard bewijs maakt het
  // hele gesprek relevant.
  const relevanteThreads = new Set<string>();
  for (const m of bruikbaar) {
    const { score } = scoreMail(m, pad, docLinks, termen, klantDomein, namenPerMail.get(m.id) || []);
    if (score >= HARD_BEWIJS && m.conversationId) relevanteThreads.add(m.conversationId);
  }

  // Binnen een relevant gesprek telt een mail mee als hij iets TOEVOEGT: het
  // verzoek zelf, een bijlage, of eigen tekst over deze pagina. Een "prima, doen
  // we" of een belafspraak voegt niets toe en valt af, ook al zit hij in dezelfde
  // thread. Dat is precies het verschil dat eerder ontbrak.
  const geslaagd = bruikbaar
    .map((m) => ({ m, namen: namenPerMail.get(m.id) || [] }))
    .map((x) => {
      const s = scoreMail(x.m, pad, docLinks, termen, klantDomein, x.namen);
      const inThread = !!x.m.conversationId && relevanteThreads.has(x.m.conversationId);
      if (s.score < BEWAAR_VANAF && inThread && x.m.hasAttachments) {
        // Een bijlage in een gesprek dat over deze pagina gaat is bijna altijd de
        // teruggestuurde tekst; dat is de mail die je juist wilt zien.
        return { ...x, score: HARD_BEWIJS, reden: "bijlage in het gesprek over deze pagina" };
      }
      return { ...x, ...s, inThread };
    })
    .filter((x) => x.score >= BEWAAR_VANAF);

  const urls2 = await getClientUrls(slug).catch(() => []);
  const titel = urls2.find((u) => urlKey(u.url) === k)?.title || "";
  const oordelen = await beoordeelMails(slug, pad, titel, geslaagd.map((x) => ({
    id: x.m.id,
    subject: x.m.subject,
    fromName: x.m.fromName,
    eigen: eigenTekst(x.m.bodyHtml || "", x.m.preview || "", 700),
    bijlagen: x.namen,
    datum: x.m.receivedAt ? new Date(x.m.receivedAt).toLocaleDateString("nl-NL") : "",
  })));

  let bewaard = 0;
  const gehouden: string[] = [];
  for (const { m, namen, score, reden } of geslaagd) {
    const oordeel = oordelen.get(m.id);
    // De zeef mag alleen afwijzen, nooit toevoegen. Weet hij het niet (geen
    // antwoord voor deze mail), dan blijft de puntentelling leidend.
    if (oordeel && !oordeel.hoort) continue;
    const kern = oordeel?.kern || "";
    // Bewaar het EIGEN deel als preview: dat is wat er in de tijdlijn en in de
    // samenvatting terechtkomt. De geciteerde thread eronder zou daar alleen maar
    // een oud verhaal herhalen.
    const preview = (eigenTekst(m.bodyHtml || "", m.preview || "", 600) || stripHtml(m.bodyHtml || "")).slice(0, 600);
    await sql`
      INSERT INTO page_emails (client_slug, url_key, url, message_id, conversation_id, onderwerp,
                               van_naam, van_adres, ontvangen_op, web_link, superhuman_link, preview,
                               heeft_bijlagen, bijlage_namen, kern, bron, score, reden, gevonden_op)
      VALUES (${slug}, ${k}, ${url}, ${m.id}, ${m.conversationId || null}, ${(m.subject || "").slice(0, 300)},
              ${(m.fromName || "").slice(0, 120)}, ${(m.fromAddress || "").slice(0, 200)},
              ${m.receivedAt || null}, ${m.webLink || null}, ${m.superhumanLink || null}, ${preview},
              ${!!m.hasAttachments}, ${namen.join(" | ").slice(0, 500) || null}, ${kern || null},
              'auto', ${score}, ${reden.slice(0, 300)}, now())
      ON CONFLICT (client_slug, url_key, message_id) DO UPDATE
        SET score = EXCLUDED.score, reden = EXCLUDED.reden, gevonden_op = now(),
            preview = EXCLUDED.preview,
            kern = COALESCE(EXCLUDED.kern, page_emails.kern),
            web_link = COALESCE(EXCLUDED.web_link, page_emails.web_link),
            superhuman_link = COALESCE(EXCLUDED.superhuman_link, page_emails.superhuman_link),
            heeft_bijlagen = EXCLUDED.heeft_bijlagen,
            bijlage_namen = COALESCE(EXCLUDED.bijlage_namen, page_emails.bijlage_namen)
        WHERE page_emails.bron = 'auto'`;
    gehouden.push(m.id);
    bewaard++;
  }

  // Wat er eerder automatisch bij is gezet maar deze ronde niet meer voldoet,
  // gaat weg. Zonder dit blijven mails staan die met een oudere, ruimere regel
  // zijn gevonden; precies de reden dat er mails over de SOA-test bij de
  // CRP-pagina bleven hangen. Vastgepind en weggeklikt blijven met rust.
  //
  // TWEE VANGRAILS, met bloed geschreven. Hier stond eerder: leverde de ronde
  // niets op, gooi dan ALLES weg. Eén ronde die niet doorkwam (Graph even
  // onbereikbaar, een time-out, de zeef die niets teruggaf) wiste daarmee het
  // hele maildossier van een pagina, en dat is precies wat er gebeurde: zes
  // gekoppelde mails weg na één lege ronde.
  //
  // 1. Levert een ronde niets op, dan verandert er niets. Een lege uitkomst is
  //    bijna altijd een mislukte ronde, nooit bewijs dat er niets is.
  // 2. Alleen mails die deze ronde LANGS ZIJN GEKOMEN en afvielen gaan weg. Een
  //    mail die de zoekopdracht deze keer niet teruggaf, is niet weerlegd en
  //    blijft dus gewoon staan.
  const gezien = bruikbaar.map((m) => m.id);
  if (gehouden.length && gezien.length) {
    // Lijsten als tekst met scheidingsteken: de sql-helper accepteert geen array
    // als parameter, en een message-id bevat nooit een verticale streep.
    const houd = "|" + gehouden.join("|") + "|";
    const zag = "|" + gezien.join("|") + "|";
    await sql`
      DELETE FROM page_emails
      WHERE client_slug = ${slug} AND url_key = ${k} AND bron = 'auto'
        AND position('|' || message_id || '|' in ${zag}) > 0
        AND position('|' || message_id || '|' in ${houd}) = 0`;
  }

  // Teksten die de klant terugstuurde meteen klaarzetten, zodat ze op de kaart
  // aanklikbaar staan zonder omweg via de mailbox.
  await haalBijlagenBinnen(slug, url).catch(() => { /* nooit blokkerend */ });

  return { gevonden: bruikbaar.length, bewaard };
}

/**
 * Zet tekstbijlagen uit de gekoppelde mails van een pagina automatisch klaar als
 * klantversie. Dat scheelt de omweg via Superhuman: downloaden, terugvinden en
 * weer inslepen.
 *
 * Alleen bijlagen waarvan de NAAM bij deze pagina past worden opgepakt. Een mail
 * kan de teksten voor twee pagina's bevatten (Tekst CRP-waarde en Tekst CRP-test);
 * die horen dan elk bij hun eigen pagina en niet allebei bij allebei.
 *
 * Er wordt niets verwerkt: het komt als voorstel klaar te staan, zichtbaar op de
 * kaart, en Maarten beslist.
 */
export async function haalBijlagenBinnen(slug: string, url: string): Promise<{ klaar: string[] }> {
  const klaar: string[] = [];
  let pad = "";
  try { pad = new URL(url).pathname.replace(/\/+$/, ""); } catch { return { klaar }; }

  const mails = await getPaginaMails(slug, url).catch(() => [] as PaginaMail[]);
  const metBijlagen = mails.filter((m) => m.heeftBijlagen && (m.bron === "pin" || m.score >= HARD_BEWIJS));
  if (!metBijlagen.length) return { klaar };

  // Wat staat er al klaar of is al verwerkt? Nooit twee keer hetzelfde bestand.
  const { rows: bestaand } = await sql`
    SELECT naam FROM page_doc_versions WHERE client_slug = ${slug} AND url = ${url}`;
  const alBinnen = new Set(bestaand.map((r) => String(r.naam || "").toLowerCase()));

  for (const m of metBijlagen.slice(0, 5)) {
    const lijst = await msListAttachments(m.messageId).catch(() => null);
    if (!lijst) continue;
    for (const a of lijst) {
      if (!/\.(docx|pdf|txt|md)$/i.test(a.naam)) continue;
      if (alBinnen.has(a.naam.toLowerCase())) continue;
      // Hoort deze bijlage bij DEZE pagina? Anders laten liggen voor de pagina
      // waar hij wel bij hoort.
      if (bijlageOverlap(a.naam, pad) < 2) continue;

      const bin = await msGetAttachment(m.messageId, a.id).catch(() => null);
      if (!bin) continue;
      const lees = await leesAangeleverdDocument(slug, url, bin.naam, bin.buffer).catch(() => null);
      if (!lees?.ok || !lees.tekst) continue;
      await proposeVersion(slug, url, bin.naam, lees.tekst, lees.driveLink || "").catch(() => null);
      alBinnen.add(a.naam.toLowerCase());
      klaar.push(a.naam);
      await logActiviteit({
        slug, soort: "copy", bron: "mail-bijlage", bronId: `${m.messageId}:${a.id}`,
        url, wie: "Pingwin", zichtbaar: false,
        intern: `Klantversie uit de mail van ${m.vanNaam || m.vanAdres}: ${a.naam}`,
        bewijs: m.superhumanLink || m.webLink || null,
      }).catch(() => null);
    }
  }
  return { klaar };
}

/**
 * Zoekt als er nog niets is, als de laatste ronde oud is, of, en dat is het
 * belangrijkste, als er sindsdien nieuwe klantmail binnen is.
 *
 * De poort stond op een week. Dat betekende in de praktijk: je mailt vanochtend
 * met de klant over precies deze pagina, en de kaart weet daar dagenlang niets
 * van. Terwijl juist de laatste mail bepaalt of het werk klaar is om door te
 * zetten of dat je nog op een antwoord wacht. Eén nieuwe mail in de postbus is
 * dus voortaan reden genoeg om opnieuw te kijken; dat kost een DB-query, geen
 * mailronde, want de mailset van de klant staat al in de database.
 */
export async function zoekMailsIndienNodig(slug: string, url: string, maxDagen = 7): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await ensureScanTabel();
  const k = urlKey(url);

  const [peil, nieuwste] = await Promise.all([scanPeilmerk(slug, k), nieuwsteKlantMail(slug)]);
  const nooitGescand = peil === undefined;
  const nieuweMail = !!nieuwste && (!peil || nieuwste.getTime() > peil.getTime());

  if (!nooitGescand && !nieuweMail) {
    const laatste = await laatsteZoekronde(slug, k);
    // Staat er geen enkele mail bij deze pagina, dan valt er niets te verliezen
    // en proberen we het gewoon opnieuw (met tien minuten ertussen, anders zou
    // elke keer dat je een kaart opent een mailronde starten). Zonder deze regel
    // bleef een pagina die door een mislukte ronde leeg raakte dagenlang leeg.
    if (!laatste) {
      const { rows } = await sql`SELECT count(*)::int AS n FROM page_emails WHERE client_slug = ${slug} AND url_key = ${k}`;
      if (!Number(rows[0]?.n || 0)) {
        const rust = await sql`SELECT gescand_op FROM page_mail_scans WHERE client_slug = ${slug} AND url_key = ${k} LIMIT 1`;
        const laatsteScan = rust.rows[0]?.gescand_op ? new Date(rust.rows[0].gescand_op as string) : null;
        if (laatsteScan && Date.now() - laatsteScan.getTime() < 6e5) return;
      } else return;
    } else if (Date.now() - laatste.getTime() < maxDagen * 864e5) return;
    // Alleen nog de oude tijdsklep, zodat een pagina waarvan de zoektermen zijn
    // veranderd toch af en toe opnieuw langs de postbus gaat.
  }

  await zoekMailsVoorPagina(slug, url).catch(() => { /* zoeken mag het dossier nooit breken */ });
  await zetPeilmerk(slug, k, nieuwste).catch(() => { /* peilmerk is een versnelling, geen must */ });
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

/**
 * Alle mails die aan een pagina van deze klant hangen, per bericht-id.
 * Gebruikt door de chat: een mail die aan een pagina is vastgepind hoort altijd
 * mee te wegen, ook als hij ver buiten de laatste tien valt. Precies daar zat
 * het gat: een thread van twee maanden geleden met de teruggestuurde teksten
 * verdween uit beeld zodra er nieuwere mail binnenkwam.
 */
export async function getGekoppeldeMails(slug: string): Promise<Map<string, { url: string; bron: MailBron; score: number }>> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT message_id, url, bron, score FROM page_emails
    WHERE client_slug = ${slug} AND bron <> 'weg'`;
  const uit = new Map<string, { url: string; bron: MailBron; score: number }>();
  for (const r of rows) {
    const id = String(r.message_id || "");
    const bestaand = uit.get(id);
    const nieuw = { url: String(r.url || ""), bron: (r.bron as MailBron) || "auto", score: Number(r.score || 0) };
    // Vastgepind wint van een gewone treffer.
    if (!bestaand || (nieuw.bron === "pin" && bestaand.bron !== "pin")) uit.set(id, nieuw);
  }
  return uit;
}

/** Eén mail ophalen (voor het binnenhalen van een bijlage). */
export async function getPaginaMail(slug: string, id: number): Promise<(PaginaMail & { url: string }) | null> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`
    SELECT id, url, message_id, onderwerp, van_naam, van_adres, ontvangen_op, web_link,
           superhuman_link, preview, heeft_bijlagen, bijlage_namen, kern, bron, score, reden
    FROM page_emails WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return { ...rowToMail(rows[0]), url: String(rows[0].url || "") };
}
