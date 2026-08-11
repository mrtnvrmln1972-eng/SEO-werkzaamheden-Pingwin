import { sql, ensureSchema } from "./db";
import { eenmalig } from "./schema-stand";
import { logActiviteit } from "./activiteit";
import { getClientBySlug } from "./clients";
import { getClientUrls, getPageDriveFolder } from "./site-urls";
import { getPages } from "./snapshots";
import { getStepLinksAll } from "./page-doc-run";
import { measurePage, type PageMeasurement } from "./page-measure";
import { metaHardIssues } from "./meta-rules";
import { saveMetaPageState } from "./meta-ctr";
import { callClaude, callClaudeImages, beeldGeschikt, LIGHT_MODEL } from "./anthropic";
import { buildPingwinDoc, type DocSection } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { isoWeek } from "./weekplan";
import { urlKey } from "./url-key";
import { classifyImage, pasHandmatigToe, normFile, type ImageSoort } from "./image-classify";

// ═══════════════════════════════════════════════════════════
// WERKLIJST SITEBOUWER (site-breed, één document + één Dev-kaart)
// ═══════════════════════════════════════════════════════════
// Meta's en alt-teksten ontbreken op tientallen pagina's tegelijk; dat wordt
// nooit een stapel losse kaartjes. Deze motor crawlt de live pagina's, schrijft
// per probleempagina kant-en-klare meta's (of verwijst naar het copydocument)
// en plakbare alt-teksten per afbeelding, signaleert afbeeldingen die op
// meerdere pagina's terugkomen (zelfde alt overal = klopt maar op één plek),
// en levert dat als één net Pingwin-document in Drive plus één verzamelkaart
// "Werklijst sitebouwer" in de weekplanning (Dev, met de doc-link erop).
// ═══════════════════════════════════════════════════════════

export type DevWorklistState = { status: "idle" | "running" | "done" | "error"; docLink: string; result: string; error: string; updatedAt: string | null };

// De opgeslagen puntjes voor de afwerkpagina: per pagina de kant-en-klare
// meta's en per afbeelding de alt-tekst. Sleutels zijn stabiel over runs heen.
// Per afbeelding bewaren we naast de alt-tekst ook waar hij staat en wat voor
// soort het is (vast onderdeel, gedeelde foto, uniek, decoratief), zodat de
// lijst niet meer blind "maak uniek" roept bij een logo. `dubbel` blijft staan
// en betekent nu precies één ding: dit punt is geblokkeerd tot de foto uniek is.
export type WorklistAlt = {
  file: string; src: string; alt: string; dubbel: boolean;
  soort: ImageSoort; reden: string; altNodig: boolean;
  paginas: number; paths: string[];
  // Heeft de AI de foto echt bekeken, of alleen de bestandsnaam gelezen?
  gezien?: boolean;
  // Wat is er te zien, in een paar woorden. Komt uit het kijken naar de foto en
  // is de basis voor de vraag "passen de foto's bij het onderwerp van de pagina".
  onderwerp?: string;
};
// Waarom staat er geen voorstel? Zonder deze stand vult het scherm een leeg vak
// met "(zelf beschrijven wat erop staat)", en dat leest als een opdracht terwijl
// wij er simpelweg niet aan toe zijn gekomen.
// "voorstel" = er ligt een goedgekeurde tekst klaar om te plaatsen.
// "goed"     = de huidige meta voldoet, hier is niets te doen.
// "copydoc"  = de nieuwe tekst staat in het copydocument van deze pagina.
// "wacht"    = de meta deugt niet, maar er is nog niets goedgekeurd in Meta & CTR.
// "mislukt"  = alleen nog in oude, opgeslagen lijsten; betekende hetzelfde als "wacht".
export type MetaStand = "voorstel" | "goed" | "copydoc" | "wacht" | "mislukt";
export type WorklistPage = {
  url: string; path: string;
  curTitle: string; curDesc: string;
  newTitle: string; newDesc: string;
  copyDoc: string;
  titleStand?: MetaStand; descStand?: MetaStand;
  // Passen de foto's bij het onderwerp? beeldTotaal = contentfoto's op deze
  // pagina, beeldRaak = daarvan die het onderwerp van de pagina laten zien.
  beeldTotaal?: number; beeldRaak?: number; beeldOnderwerp?: string;
  alts?: WorklistAlt[]; // alleen nog voor oude, opgeslagen lijsten
};
export type WorklistMark = { done: boolean; doneBy: string; verified: boolean };
// Wat is er buiten de grenzen gevallen? Nooit meer stil overslaan.
export type WorklistOverslag = { altBeeld: number; paginas: number; perPagina: number };
/**
 * Een paginakaart die is doorgezet naar de sitebouwer.
 *
 * Waarom die hier staat: doorgezette kaarten belandden op een scherm achter de
 * adminlogin, terwijl de sitebouwer alleen deze deelbare lijst heeft (zonder
 * inlog). Zijn paginawerk stond dus op een plek waar hij niet komt, en dan
 * gebeurt het niet. Eén adres voor alles wat hij moet doen.
 */
export type PaginaKlus = {
  id: number;
  url: string;
  pad: string;
  taak: string;
  toelichting: string;
  docs: { label: string; url: string }[];
  /** Wat er meetbaar af moet zijn, in gewone taal. */
  punten: string[];
};

export type WorklistData = {
  state: DevWorklistState;
  pages: WorklistPage[];
  /** Doorgezette paginakaarten; leeg als er niets openstaat. */
  paginaklussen: PaginaKlus[];
  /** De alt-teksten, één regel per afbeelding (zo slaat WordPress het ook op). */
  images: WorklistAlt[];
  dubbel: { file: string; src: string; paths: string[] }[];
  gemeten: number;
  soorten: Record<string, ImageSoort>;
  shareToken: string;
  marks: Record<string, WorklistMark>;
  overslag: WorklistOverslag;
};

// Stabiele sleutels: m|<pagina>|title, m|<pagina>|desc, a|<bestand>.
//
// De alt-sleutel hing eerst aan de pagina (a|<pagina>|<bestand>). Dat was fout:
// WordPress bewaart één alt-tekst per afbeelding, dus een logo op veertig
// pagina's gaf veertig regels die je veertig keer moest afvinken. De sleutel
// hangt nu aan het bestand. Oude vinkjes gaan niet verloren: die worden bij het
// lezen samengevouwen (zie legacyAltKeys).
export const metaKey = (url: string, veld: "title" | "desc") => `m|${urlKeyOf(url)}|${veld}`;
export const altKey = (file: string) => `a|${normFile(file)}`;
/** Sleutel zoals hij vóór de omslag was; alleen nog om oude vinkjes te lezen. */
export const altKeyLegacy = (url: string, file: string) => `a|${urlKeyOf(url)}|${normFile(file)}`;
// Handmatige indeling van een afbeelding staat los van de pagina: één keuze per
// bestand, site-breed, precies zoals de alt-tekst zelf ook site-breed is.
export const soortKey = (file: string) => `i|${normFile(file)}`;
function urlKeyOf(u: string): string { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, "").toLowerCase(); } catch { return (u || "").toLowerCase(); } }

// Grenzen. Ze blijven bestaan (elke alt-tekst kost een AI-aanroep), maar ze zijn
// niet langer stil: wat erbuiten valt wordt geteld en in beeld gemeld, met een
// knop om de rest alsnog te doen. Zie WorklistOverslag.
const CRAWL_LIMIT = 60;    // maximaal zoveel live pagina's meten
const ALT_IMAGE_LIMIT = 120; // voor zoveel afbeeldingen schrijven we een alt-tekst
const ALT_PER_PAGE = 40;   // maximaal zoveel afbeeldingen per pagina
const BEELD_PER_CALL = 6;  // zoveel foto's tegelijk aan het model laten zien

// Hooguit één keer per database opbouwen, niet bij elke koude server. Zie
// lib/schema-stand.ts; het versienummer wordt bewaakt door
// proeven/schema-versie.proef.ts.
export const DEV_WORKLIST_SCHEMA_VERSIE = "dw1-98958699";
function ensureTable(): Promise<void> {
  return eenmalig("dev-worklist", DEV_WORKLIST_SCHEMA_VERSIE, doEnsure);
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_dev_worklist (
      client_slug TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'idle',
      doc_link    TEXT,
      result      TEXT,
      error       TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Werklijst 2.0: elk puntje wordt bewaard (voor de deelbare afwerkpagina),
  // plus de dubbel-gebruikte afbeeldingen en een deel-token voor de sitebouwer.
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS items JSONB`;
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS dubbel JSONB`;
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS share_token TEXT`;
  // Hoeveel live pagina's er gemeten zijn; nodig om te bepalen of een afbeelding
  // "op vrijwel alle pagina's" staat en dus een vast onderdeel is.
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS gemeten INTEGER`;
  // Alt-teksten per afbeelding (site-breed), los van de pagina's. Plus wat er
  // buiten de grenzen viel, zodat het scherm dat kan melden in plaats van een
  // leeg vak te tonen dat op een opdracht lijkt.
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS images JSONB`;
  await sql`ALTER TABLE client_dev_worklist ADD COLUMN IF NOT EXISTS overslag JSONB`;
  // Vinkjes los van de lijst, zodat een nieuwe run ze niet wist: done = door een
  // mens afgevinkt, verified = door het dashboard live gecontroleerd.
  await sql`
    CREATE TABLE IF NOT EXISTS dev_worklist_marks (
      client_slug TEXT NOT NULL,
      item_key    TEXT NOT NULL,
      done        BOOLEAN NOT NULL DEFAULT false,
      done_by     TEXT,
      done_at     TIMESTAMPTZ,
      verified    BOOLEAN NOT NULL DEFAULT false,
      verified_at TIMESTAMPTZ,
      PRIMARY KEY (client_slug, item_key)
    )`;
  // Handmatige indeling per afbeelding (sleutel i|<bestand>): zet de automatische
  // indeling opzij en overleeft een nieuwe run, net als de vinkjes.
  await sql`ALTER TABLE dev_worklist_marks ADD COLUMN IF NOT EXISTS soort TEXT`;
}

export async function getDevWorklist(slug: string): Promise<DevWorklistState> {
  await ensureSchema();
  await ensureTable();
  const { rows } = await sql`SELECT status, doc_link, result, error, updated_at FROM client_dev_worklist WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  if (!r) return { status: "idle", docLink: "", result: "", error: "", updatedAt: null };
  return {
    status: (r.status as DevWorklistState["status"]) || "idle",
    docLink: (r.doc_link as string) || "",
    result: (r.result as string) || "",
    error: (r.error as string) || "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}

async function setState(slug: string, status: string, docLink: string, result: string, error: string): Promise<void> {
  await sql`
    INSERT INTO client_dev_worklist (client_slug, status, doc_link, result, error, updated_at)
    VALUES (${slug}, ${status}, ${docLink || null}, ${result || null}, ${error || null}, now())
    ON CONFLICT (client_slug) DO UPDATE SET status = ${status}, doc_link = ${docLink || null}, result = ${result || null}, error = ${error || null}, updated_at = now()`;
}

function pagePath(u: string): string { try { return new URL(u).pathname || "/"; } catch { return u; } }
// normFile (responsive-varianten zoals foto-300x200.jpg tellen als dezelfde
// afbeelding) komt uit lib/image-classify.ts, zodat motor en indeling nooit
// uiteenlopen.
const safeName = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "site";

type PageWork = {
  url: string;
  path: string;
  m: PageMeasurement;
  titleIssues: string[];
  descIssues: string[];
  copyDoc: string;              // link naar aangeleverd copydocument (meta staat daar al in)
  newTitle: string;
  newDesc: string;
  missingAlts: { file: string; src: string; alt: string }[]; // alt = voorstel
};

// De werklijst schrijft zelf GEEN meta's meer.
//
// Dat deed hij wel, met een eigen AI-aanroep per acht pagina's. Daardoor kon
// dezelfde pagina twee verschillende voorstellen hebben: één hier en één in
// Meta & CTR. En de versie die hier ontstond was de zwakste van de twee (geen
// klantprofiel, geen zoekwoord, geen nameting op pixelbreedte, geen goedkeuring
// door een mens), terwijl juist die kant-en-klaar bij de sitebouwer belandde.
//
// Nu is Meta & CTR de enige plek waar een meta ontstaat en beoordeeld wordt, en
// haalt de werklijst op wat daar is goedgekeurd en nog niet live staat. Wat wij
// zelf via de WordPress-koppeling doorzetten, komt hier dus nooit te staan.
async function goedgekeurdeMetas(slug: string): Promise<Map<string, { title: string; desc: string }>> {
  const uit = new Map<string, { title: string; desc: string }>();
  const { rows } = await sql`
    SELECT page_url, prop_title, prop_desc, title_status, desc_status
    FROM meta_proposals
    WHERE client_slug = ${slug} AND status <> 'doorgevoerd' AND live_at IS NULL`.catch(() => ({ rows: [] as Record<string, unknown>[] }));
  for (const r of rows) {
    const title = r.title_status === "goedgekeurd" ? String(r.prop_title || "").trim() : "";
    const desc = r.desc_status === "goedgekeurd" ? String(r.prop_desc || "").trim() : "";
    if (title || desc) uit.set(urlKey(String(r.page_url)), { title, desc });
  }
  return uit;
}

// ── Alt-teksten, per afbeelding en op basis van de foto zelf ──
//
// Waarom dit anders is dan eerst: de oude versie vroeg om een tekst die
// beschrijft wat er "waarschijnlijk" op staat, want het model kreeg alleen de
// bestandsnaam. Dat is per definitie gokken en levert vage teksten op.
//
// Nu kijkt het model naar de foto. En omdat WordPress één alt-tekst per
// afbeelding bewaart, beschrijft die tekst wát er te zien is en niet waar één
// pagina over gaat. Dat is niet vager maar juist concreter: niet "tuin", maar
// "grijze betonklinkers in keperverband op een oprit". Zo klopt hij op elke
// pagina waar de foto staat, en valt er niets meer te blokkeren.

type ImageWork = {
  file: string;      // genormaliseerde bestandsnaam
  src: string;       // volledige URL
  paths: string[];   // op welke pagina's hij staat
  alt: string;       // het voorstel
  onderwerp: string; // wat er te zien is, in een paar woorden
  gezien: boolean;   // heeft het model de foto echt bekeken?
};

const ALT_SYS =
  "Je bent SEO-copywriter bij bureau Pingwin. Je krijgt afbeeldingen te zien, elk met zijn bestandsnaam ervoor.\n" +
  "Schrijf per afbeelding een korte, natuurlijke Nederlandse alt-tekst (maximaal ongeveer 12 woorden) die beschrijft WAT ER OP DE FOTO TE ZIEN IS.\n" +
  "Belangrijk: beschrijf de foto, niet het onderwerp van de website. Dezelfde foto kan op meerdere pagina's staan, dus de tekst moet overal kloppen.\n" +
  "Wees concreet: niet 'tuin' maar 'grijze betonklinkers in keperverband op een oprit'. Geen keyword-stuffing, begin niet met 'afbeelding van'.\n" +
  "Geef daarnaast het onderwerp van de foto in maximaal drie woorden.\n" +
  "Antwoord PRECIES zo, één regel per afbeelding, niets eromheen:\n" +
  "bestandsnaam => alt-tekst | onderwerp";

/** Leest de regels 'bestand => alt | onderwerp' terug in de afbeeldingen. */
function leesAltRegels(text: string, groep: ImageWork[], gezien: boolean): void {
  const map = new Map<string, { alt: string; onderwerp: string }>();
  for (const line of text.split("\n")) {
    const m = /^(.+?)\s*=>\s*(.+)$/.exec(line.trim());
    if (!m) continue;
    const rest = m[2].trim();
    const pipe = rest.lastIndexOf("|");
    map.set(normFile(m[1].trim()), {
      alt: (pipe > 0 ? rest.slice(0, pipe) : rest).trim(),
      onderwerp: pipe > 0 ? rest.slice(pipe + 1).trim() : "",
    });
  }
  for (const i of groep) {
    const v = map.get(normFile(i.file));
    if (!v?.alt) continue;
    i.alt = v.alt;
    i.onderwerp = v.onderwerp;
    i.gezien = gezien;
  }
}

/**
 * Schrijft alt-teksten voor één groepje afbeeldingen. Eerst mét de foto's erbij;
 * lukt dat niet (een 404, een formaat dat de API niet aankan, een te groot
 * bestand), dan valt hij terug op alleen de bestandsnamen. Terugvallen is beter
 * dan niets opleveren, maar het wordt wel vastgelegd: `gezien` blijft dan false,
 * zodat het scherm eerlijk kan tonen dat die tekst een gok is.
 */
async function proposeAltsVoorGroep(slug: string, groep: ImageWork[]): Promise<void> {
  if (!groep.length) return;
  const context = groep.map((i) => `${i.file} (staat op: ${i.paths.slice(0, 3).join(", ") || "onbekend"})`).join("\n");
  const opdracht = `Schrijf nu voor elk van de ${groep.length} afbeeldingen hierboven de alt-tekst.\n\nDe bestandsnamen op een rij:\n${context}`;

  const metBeeld = groep.filter((i) => beeldGeschikt(i.src));
  if (metBeeld.length) {
    try {
      const text = await callClaudeImages(
        ALT_SYS,
        opdracht,
        metBeeld.map((i) => ({ url: i.src, label: `Bestandsnaam: ${i.file}` })),
        1500,
        { slug, action: "dev-worklist-alt-beeld" },
        LIGHT_MODEL,
      );
      leesAltRegels(text, metBeeld, true);
    } catch { /* stil: hieronder volgt de terugval zonder beeld */ }
  }

  // Alles wat nog geen tekst heeft (geen bruikbare URL, of het kijken mislukte)
  // krijgt alsnog een voorstel op basis van de bestandsnaam.
  const rest = groep.filter((i) => !i.alt);
  if (!rest.length) return;
  const sysTekst = ALT_SYS.replace("Je krijgt afbeeldingen te zien, elk met zijn bestandsnaam ervoor.", "Je krijgt alleen bestandsnamen; de foto's zelf kun je niet zien. Leid af wat er waarschijnlijk op staat.");
  const text = await callClaude(
    sysTekst,
    [{ role: "user", content: `Afbeeldingen:\n${rest.map((i) => `${i.file} (staat op: ${i.paths.slice(0, 3).join(", ") || "onbekend"})`).join("\n")}` }],
    1500,
    { slug, action: "dev-worklist-alt" },
    LIGHT_MODEL,
  ).catch(() => "");
  leesAltRegels(text, rest, false);
}

// ── Passen de foto's bij het onderwerp van de pagina? ──
//
// Een ruw signaal, bewust simpel gehouden: we vergelijken de woorden uit het
// onderwerp van de foto met die uit de H1 van de pagina. Het is bedoeld om je
// ergens naar te laten kíjken, niet als oordeel. Daarom staat er in beeld een
// cijfer ("9 foto's, waarvan 2 over bestrating") en geen waarschuwing.

const STOPWOORDEN = new Set(["de", "het", "een", "en", "of", "in", "op", "van", "voor", "met", "aan", "bij", "te", "door", "uit", "naar", "je", "uw", "ons", "onze", "die", "dat", "is", "zijn", "wordt", "worden", "laten", "meer", "beste", "goede", "nieuw", "nieuwe"]);

function kernwoorden(tekst: string): string[] {
  return (tekst || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/)
    .filter((w) => w.length >= 4 && !STOPWOORDEN.has(w));
}

/** Deelt de foto een kernwoord met het onderwerp van de pagina? */
function beeldPastBijPagina(onderwerp: string, paginaWoorden: string[]): boolean {
  if (!onderwerp || !paginaWoorden.length) return false;
  const foto = kernwoorden(onderwerp);
  // Stam-vergelijking op de eerste zes letters, zodat "bestrating" en
  // "bestraten" elkaar vinden zonder dat we een woordenboek nodig hebben.
  const stam = (w: string) => w.slice(0, 6);
  const pagina = new Set(paginaWoorden.map(stam));
  return foto.some((w) => pagina.has(stam(w)));
}

export async function runDevWorklist(slug: string): Promise<{ ok: boolean; docLink?: string; error?: string }> {
  await ensureSchema();
  await ensureTable();
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  await setState(slug, "running", "", "", "");
  try {
    // 1. Live pagina's meten (batches, begrensd).
    const urls = (await getClientUrls(slug)).filter((u) => u.status === 200).slice(0, CRAWL_LIMIT);
    if (!urls.length) throw new Error("Geen live pagina's bekend; draai eerst een sitescan.");
    const copyLinks = await getStepLinksAll(slug).catch(() => ({} as Record<string, { analyse: string; blauwdruk: string; copy: string }>));
    const measured: PageWork[] = [];
    for (let i = 0; i < urls.length; i += 6) {
      const batch = await Promise.all(urls.slice(i, i + 6).map(async (u) => {
        const m = await measurePage(u.url, { staticOnly: true }).catch(() => null);
        if (!m || !m.ok) return null;
        return { url: u.url, path: pagePath(u.url), m, titleIssues: [], descIssues: [], copyDoc: copyLinks[urlKey(u.url)]?.copy || "", newTitle: "", newDesc: "", missingAlts: [] } as PageWork;
      }));
      measured.push(...(batch.filter(Boolean) as PageWork[]));
    }

    // 2. Problemen bepalen: meta buiten de regels, afbeeldingen zonder alt.
    //    De gemeten meta gaat meteen naar Meta & CTR: die motor heeft precies
    //    deze meting nodig om te weten wat er nu staat, en hier is hij gratis.
    for (const p of measured) {
      await saveMetaPageState(slug, p.url, p.m.metaTitle || "", p.m.metaDescription || "").catch(() => { /* logboek van de meting is aanvulling */ });
      p.titleIssues = p.m.metaTitle ? metaHardIssues("meta_title", p.m.metaTitle) : ["ontbreekt volledig"];
      p.descIssues = p.m.metaDescription ? metaHardIssues("meta_description", p.m.metaDescription) : ["ontbreekt volledig"];
      const seen = new Set<string>();
      for (const img of p.m.images) {
        const k = normFile(img.file);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        if (!img.hasAlt || !img.alt.trim()) p.missingAlts.push({ file: img.file, src: img.src || "", alt: "" });
      }
      p.missingAlts = p.missingAlts.slice(0, ALT_PER_PAGE);
    }

    // 3. Elke afbeelding indelen: vast onderdeel, gedeelde foto, uniek of puur
    //    versiering. Alleen een échte gedeelde contentfoto moet uniek worden;
    //    het logo en de vaste header horen juist overal hetzelfde te zijn.
    const usage = new Map<string, { file: string; src: string; paths: Set<string> }>();
    for (const p of measured) {
      const perPage = new Map<string, string>();
      for (const i of p.m.images) { const k = normFile(i.file); if (k && !perPage.has(k)) perPage.set(k, i.src || ""); }
      for (const [k, src] of perPage) {
        const e = usage.get(k) || { file: k, src: "", paths: new Set<string>() };
        if (!e.src && src) e.src = src;
        e.paths.add(p.path);
        usage.set(k, e);
      }
    }
    const handmatig = await getSoortOverrides(slug);
    const oordeelVan = (file: string) => {
      const k = normFile(file);
      const e = usage.get(k);
      return pasHandmatigToe(
        classifyImage({ file: k, src: e?.src || "", paginas: e?.paths.size || 1, totaalPaginas: measured.length }),
        handmatig[k] || null,
      );
    };
    // "Stap 1: maak uniek" bevat voortaan uitsluitend wat écht uniek moet worden.
    const dubbel = [...usage.values()].filter((e) => oordeelVan(e.file).moetUniek).sort((a, b) => b.paths.size - a.paths.size).slice(0, 25);

    // 4. De goedgekeurde meta's uit Meta & CTR ophalen. Alleen wat daar door een
    //    mens is goedgekeurd en nog niet live staat, komt op de lijst van de
    //    bouwer; de rest is geen opdracht maar ruis.
    const goedgekeurd = await goedgekeurdeMetas(slug).catch(() => new Map<string, { title: string; desc: string }>());
    for (const p of measured) {
      const g = goedgekeurd.get(urlKey(p.url));
      if (g) { p.newTitle = g.title; p.newDesc = g.desc; }
    }

    // Een pagina hoort op de lijst als er een goedgekeurde meta klaarligt of als
    // er alt-teksten ontbreken. Een kapotte meta zonder goedgekeurde tekst is
    // werk voor Meta & CTR, niet voor de bouwer.
    const altProbleem = measured.filter((p) => p.missingAlts.length);
    const metaKlaar = measured.filter((p) => p.newTitle || p.newDesc);
    const probleem = measured.filter((p) => p.newTitle || p.newDesc || p.missingAlts.length);
    if (!probleem.length) {
      await setState(slug, "done", "", "Er staat niets klaar voor de bouwer: alle alt-teksten zijn er, en er zijn geen goedgekeurde meta's die nog geplaatst moeten worden.", "");
      return { ok: true };
    }
    // 5. Alt-teksten schrijven, per AFBEELDING en niet per pagina. WordPress
    //    bewaart één alt-tekst per afbeelding, dus een logo op veertig pagina's
    //    is één regel werk, geen veertig. Dat scheelt honderden regels.
    const missendeBestanden = new Set<string>();
    for (const p of measured) for (const a of p.missingAlts) missendeBestanden.add(normFile(a.file));

    const alleBeelden: ImageWork[] = [...usage.values()]
      .filter((e) => missendeBestanden.has(e.file) && oordeelVan(e.file).altNodig)
      .map((e) => ({ file: e.file, src: e.src, paths: [...e.paths], alt: "", onderwerp: "", gezien: false }));

    // Volgorde naar belang: een foto op een pagina die bezoek trekt gaat voor.
    // Zonder Search Console-cijfers valt hij terug op "op de meeste pagina's".
    // Eerder werd hier simpelweg de eerste dertig genomen in scanvolgorde, dus
    // welke pagina's bediend werden was toeval.
    const verkeer = new Map<string, number>();
    for (const pg of await getPages(slug, 200).catch(() => [])) {
      verkeer.set(pagePath(pg.url), Math.max(pg.clicks || 0, (pg.impressions || 0) / 20));
    }
    const gewicht = (i: ImageWork) => Math.max(0, ...i.paths.map((p) => verkeer.get(p) || 0));
    alleBeelden.sort((a, b) => (gewicht(b) - gewicht(a)) || (b.paths.length - a.paths.length));

    const teDoen = alleBeelden.slice(0, ALT_IMAGE_LIMIT);
    const overslag: WorklistOverslag = {
      altBeeld: Math.max(0, alleBeelden.length - teDoen.length),
      paginas: Math.max(0, (await getClientUrls(slug)).filter((u) => u.status === 200).length - urls.length),
      perPagina: measured.filter((p) => p.missingAlts.length >= ALT_PER_PAGE).length,
    };
    for (let i = 0; i < teDoen.length; i += BEELD_PER_CALL * 3) {
      const blok = teDoen.slice(i, i + BEELD_PER_CALL * 3);
      const groepen: ImageWork[][] = [];
      for (let j = 0; j < blok.length; j += BEELD_PER_CALL) groepen.push(blok.slice(j, j + BEELD_PER_CALL));
      await Promise.all(groepen.map((g) => proposeAltsVoorGroep(slug, g).catch(() => { /* deze groep blijft leeg */ })));
    }
    const beeldPerBestand = new Map(teDoen.map((i) => [i.file, i]));
    // De alt-tekst terugschrijven naar de pagina's, zodat het document en de
    // live-controle er ook bij kunnen.
    for (const p of measured) for (const a of p.missingAlts) a.alt = beeldPerBestand.get(normFile(a.file))?.alt || "";

    // 6. Het document bouwen (Pingwin-huisstijl) en naar Drive zetten.
    const totAlt = altProbleem.reduce((n, p) => n + p.missingAlts.length, 0);
    const sections: DocSection[] = [];
    sections.push({
      heading: "Hoe je deze lijst gebruikt",
      blocks: [
        { type: "paragraph", text: `Deze werklijst dekt de ${probleem.length} pagina's van ${client.name} waar de meta's of alt-teksten nog niet op orde zijn (gemeten op ${measured.length} live pagina's). Per pagina staan de nieuwe meta-title en meta-description kant-en-klaar om te plakken, plus per afbeelding een voorgestelde alt-tekst.` },
        { type: "bullets", items: [
          "Meta's: vervang de huidige title en description door de voorstellen hieronder (tekenaantal staat erbij).",
          "Alt-teksten: die staan in één lijst, één regel per afbeelding. Zet hem in de mediabibliotheek bij de afbeelding zelf, dan staat hij meteen goed op elke pagina waar die foto voorkomt.",
          "Staat bij een pagina een verwijzing naar het copydocument, dan staan de meta's dáár al kant-en-klaar in.",
        ] },
        { type: "highlight", text: "De alt-tekst beschrijft wat er op de foto te zien is, niet waar de pagina over gaat. Dat is bewust: WordPress bewaart één alt-tekst per afbeelding, dus een tekst die bij één pagina hoort klopt niet op de andere. Zo klopt hij overal, en hoeft er niets geblokkeerd te worden." },
      ],
    });
    // De alt-teksten: één lijst voor de hele site, elke afbeelding één keer.
    // Dit is de grootste opschoning: dezelfde foto op veertig pagina's was
    // veertig regels, terwijl het in WordPress één handeling is.
    const altRijen = alleBeelden.map((i) => {
      const gedaan = beeldPerBestand.get(i.file);
      const tekst = gedaan?.alt || "(nog niet geschreven, zie de opmerking onderaan)";
      const waar = i.paths.slice(0, 4).join(", ") + (i.paths.length > 4 ? `, en nog ${i.paths.length - 4}` : "");
      return [i.file, tekst, `${i.paths.length}x: ${waar}`];
    });
    if (altRijen.length) {
      sections.push({
        heading: `Alt-teksten (${altRijen.length} afbeeldingen)`,
        blocks: [
          { type: "paragraph", text: "Eén regel per afbeelding. Zet de tekst in de mediabibliotheek bij de afbeelding zelf; dan staat hij in één keer goed op elke pagina waar die foto voorkomt." },
          { type: "table", headers: ["Afbeelding", "Alt-tekst", "Waar hij staat"], rows: altRijen },
          ...(overslag.altBeeld
            ? [{ type: "highlight" as const, text: `Let op: voor ${overslag.altBeeld} afbeeldingen is nog geen alt-tekst geschreven. Dat is een grens in ons dashboard (maximaal ${ALT_IMAGE_LIMIT} per keer), geen oordeel over die foto's. De drukste pagina's zijn als eerste gedaan; de rest volgt in een volgende ronde.` }]
            : []),
        ],
      });
    }
    if (dubbel.length) {
      sections.push({
        heading: "Foto's die beter een eigen foto konden zijn",
        blocks: [
          { type: "paragraph", text: "Dit zijn contentfoto's die op meerdere pagina's terugkomen. Dat is geen fout en het houdt niets tegen: de alt-tekst hierboven klopt er gewoon op. Een eigen foto per pagina werkt alleen beter, voor de bezoeker en voor Google. Zie het als een suggestie. Vaste onderdelen zoals het logo staan hier bewust niet bij." },
          { type: "table", headers: ["Afbeelding", "Aantal", "Pagina's"], rows: dubbel.map((d) => [d.file, String(d.paths.size), [...d.paths].slice(0, 6).join(", ") + (d.paths.size > 6 ? `, en nog ${d.paths.size - 6}` : "")]) },
        ],
      });
    }
    for (const p of probleem) {
      const blocks: DocSection["blocks"] = [];
      // Alleen goedgekeurde teksten komen in het document. Wat nog niet is
      // goedgekeurd is werk voor Meta & CTR en hoort de bouwer niet te zien.
      if (p.newTitle || p.newDesc) {
        const rows: string[][] = [];
        if (p.newTitle) rows.push(["Meta-title", p.newTitle, `${p.newTitle.length} tekens`]);
        if (p.newDesc) rows.push(["Meta-description", p.newDesc, `${p.newDesc.length} tekens`]);
        blocks.push({ type: "table", headers: ["Element", "Nieuwe tekst", "Lengte"], rows });
        if (p.copyDoc) blocks.push({ type: "paragraph", text: `Deze tekst hoort bij de nieuwe copy van deze pagina: ${p.copyDoc}` });
      }
      // De alt-teksten staan bewust NIET meer per pagina: ze staan in één lijst
      // hierboven, want in WordPress hangen ze aan de afbeelding. Hier alleen
      // nog een verwijzing, zodat je weet dat er beeldwerk ligt.
      if (p.missingAlts.length) {
        blocks.push({ type: "paragraph", text: `Op deze pagina missen ${p.missingAlts.length} afbeeldingen een alt-tekst. Die staan in de lijst "Alt-teksten" hierboven, op bestandsnaam.` });
      }
      if (!blocks.length) continue;
      sections.push({ heading: p.path, blocks });
    }
    const buffer = await buildPingwinDoc({
      klant: client.name,
      rapporttype: "Werklijst sitebouwer",
      titel: "Meta's en alt-teksten, kant-en-klaar",
      ondertitel: `${probleem.length} pagina's, ${metaKlaar.length} met meta-werk, ${totAlt} afbeeldingen zonder alt-tekst`,
      sections,
    });
    // Doelmap: de eerste pagina met een gekoppelde Drive-map (voorkeur: kortste pad).
    let docLink = "";
    const opVolgorde = [...measured].sort((a, b) => a.path.length - b.path.length);
    for (const p of opVolgorde) {
      const folder = await getPageDriveFolder(slug, p.url).catch(() => null);
      if (folder?.folderId) {
        try { ({ link: docLink } = await uploadDocx(folder.folderId, `${safeName(client.name)}-werklijst-sitebouwer.docx`, buffer)); } catch { /* zonder link verder */ }
        if (docLink) break;
      }
    }

    // 6b. Elk puntje bewaren voor de deelbare afwerkpagina + deel-token.

    // Wat is er op elke foto te zien? Voor de foto's die we net bekeken hebben
    // weten we dat; voor foto's die al een alt-tekst hadden gebruiken we die
    // tekst, want dat is precies wat hij hoort te beschrijven.
    const onderwerpVan = new Map<string, string>();
    for (const p of measured) for (const img of p.m.images) {
      const k = normFile(img.file);
      if (k && img.alt?.trim() && !onderwerpVan.has(k)) onderwerpVan.set(k, img.alt.trim());
    }
    for (const i of teDoen) {
      const t = i.onderwerp || i.alt;
      if (t) onderwerpVan.set(i.file, t);
    }

    // Ligt er een goedgekeurde tekst, dan is dat de opdracht, ook als de huidige
    // meta technisch voldoet (een herschrijving voor meer klikken hoort er ook
    // op). Anders: voldoet hij, dan niets te doen; ligt er een copydocument, dan
    // staat de tekst daar; en anders wacht deze pagina nog op Meta & CTR.
    const standVan = (issues: string[], voorstel: string, copyDoc: string): MetaStand =>
      voorstel ? "voorstel" : !issues.length ? "goed" : copyDoc ? "copydoc" : "wacht";

    const pages: WorklistPage[] = probleem.map((p) => {
      // Alleen echte contentfoto's tellen mee; een logo of een icoontje hoort
      // niet over het onderwerp van de pagina te gaan.
      const content = [...new Set(p.m.images.map((i) => normFile(i.file)).filter(Boolean))]
        .filter((k) => { const o = oordeelVan(k); return o.altNodig && o.soort !== "sitebreed"; });
      const woorden = kernwoorden(`${p.m.h1.join(" ")} ${p.m.metaTitle}`);
      const raak = content.filter((k) => beeldPastBijPagina(onderwerpVan.get(k) || "", woorden));
      return {
        url: p.url, path: p.path,
        curTitle: p.m.metaTitle, curDesc: p.m.metaDescription,
        newTitle: p.newTitle, newDesc: p.newDesc, copyDoc: p.copyDoc,
        titleStand: standVan(p.titleIssues, p.newTitle, p.copyDoc),
        descStand: standVan(p.descIssues, p.newDesc, p.copyDoc),
        beeldTotaal: content.length, beeldRaak: raak.length,
        beeldOnderwerp: woorden.slice(0, 2).join(" ") || p.path,
      };
    });

    // De afbeeldingenlijst: élke afbeelding precies één keer, ook de ones die
    // buiten de grens vielen (die krijgen alt "" en worden apart geteld, in
    // plaats van stil te verdwijnen achter een zin die op een opdracht lijkt).
    const images: WorklistAlt[] = alleBeelden.map((i) => {
      const o = oordeelVan(i.file);
      const gedaan = beeldPerBestand.get(i.file);
      return {
        file: i.file, src: i.src, alt: gedaan?.alt || "",
        dubbel: false, // niets blokkeert nog: de tekst beschrijft de foto, dus hij klopt overal
        soort: o.soort, reden: o.reden, altNodig: o.altNodig,
        paginas: i.paths.length, paths: i.paths.slice(0, 6),
        gezien: !!gedaan?.gezien, onderwerp: gedaan?.onderwerp || "",
      };
    });

    const dubbelLijst = dubbel.map((d) => ({ file: d.file, src: d.src, paths: [...d.paths] }));
    const { randomBytes } = await import("crypto");
    const { rows: tokRows } = await sql`SELECT share_token FROM client_dev_worklist WHERE client_slug = ${slug} LIMIT 1`;
    const shareToken = (tokRows[0]?.share_token as string) || randomBytes(18).toString("base64url");
    await sql`
      UPDATE client_dev_worklist SET items = ${JSON.stringify(pages)}, images = ${JSON.stringify(images)}, overslag = ${JSON.stringify(overslag)}, dubbel = ${JSON.stringify(dubbelLijst)}, share_token = ${shareToken}, gemeten = ${measured.length}
      WHERE client_slug = ${slug}`;
    const afwerkLink = `/share/werklijst/${shareToken}`;

    // 7. Eén verzamelkaart in de weekplanning (upsert op vaste titel, nooit dubbel).
    const KAART = "Werklijst sitebouwer: meta's en alt-teksten site-breed";
    const toel = [
      "Achtergrond:",
      `- ${metaKlaar.length} pagina's met een goedgekeurde meta-title of meta-description die nog geplaatst moet worden.`,
      `- ${totAlt} afbeeldingen zonder alt-tekst, verdeeld over ${altProbleem.length} pagina's.`,
      dubbel.length ? `- ${dubbel.length} contentfoto's moeten eerst uniek gemaakt worden (zelfde alt overal, klopt maar op één plek); vaste onderdelen zoals het logo staan hier bewust niet bij.` : "",
      "Aanpak per fase:",
      `- Bouw: werk de afwerkpagina af (${afwerkLink}); daar staat alles klikbaar en afvinkbaar klaar voor de sitebouwer.`,
      docLink ? `- Bouw: hetzelfde overzicht als document: ${docLink}` : "",
    ].filter(Boolean).join("\n");
    const { rows: bestaand } = await sql`SELECT id FROM client_weekplan WHERE client_slug = ${slug} AND taak = ${KAART} AND status <> 'klaar' ORDER BY id DESC LIMIT 1`;
    if (bestaand[0]) {
      await sql`UPDATE client_weekplan SET toelichting = ${toel}, copy_url = ${docLink || null}, updated_at = now() WHERE client_slug = ${slug} AND id = ${bestaand[0].id}`;
    } else {
      const w = isoWeek(new Date());
      await sql`
        INSERT INTO client_weekplan (client_slug, thread, taak, toelichting, wie, url, taaktype, copy_url, bron_mail, week_year, week_no, status, sort_order, updated_at)
        VALUES (${slug}, 'overzicht', ${KAART}, ${toel}, 'Dev', ${null}, 'overig', ${docLink || null}, ${null}, ${w.year}, ${w.week}, 'gepland', 0, now())`;
    }

    const samenvatting = `${probleem.length} pagina's in de werklijst: ${metaKlaar.length} met meta-werk, ${totAlt} afbeeldingen zonder alt-tekst${dubbel.length ? `, ${dubbel.length} afbeeldingen dubbel gebruikt` : ""}.${docLink ? "" : " Geen Drive-map gekoppeld; het document kon niet worden geüpload."}`;
    await setState(slug, "done", docLink, samenvatting, "");
    return { ok: true, docLink };
  } catch (e) {
    await setState(slug, "error", "", "", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

// ── Werklijst 2.0: lezen, afvinken en automatische live-controle ──

export async function getWorklistData(slug: string): Promise<WorklistData> {
  await ensureSchema();
  await ensureTable();
  const state = await getDevWorklist(slug);
  const { rows } = await sql`SELECT items, images, overslag, dubbel, share_token, gemeten FROM client_dev_worklist WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  const ruw = (Array.isArray(r?.items) ? r?.items : []) as WorklistPage[];
  const ruwDubbel = (Array.isArray(r?.dubbel) ? r?.dubbel : []) as { file: string; src: string; paths: string[] }[];
  const shareToken = (r?.share_token as string) || "";
  const gemeten = Number(r?.gemeten) || ruw.length || 1;
  const overslag = (r?.overslag && typeof r.overslag === "object" ? r.overslag : { altBeeld: 0, paginas: 0, perPagina: 0 }) as WorklistOverslag;
  const { rows: mRows } = await sql`SELECT item_key, done, done_by, verified, soort FROM dev_worklist_marks WHERE client_slug = ${slug}`;
  const marks: Record<string, WorklistMark> = {};
  const soorten: Record<string, ImageSoort> = {};
  for (const m of mRows) {
    marks[m.item_key as string] = { done: !!m.done, doneBy: (m.done_by as string) || "", verified: !!m.verified };
    const k = String(m.item_key || "");
    if (k.startsWith("i|") && m.soort) soorten[k.slice(2)] = m.soort as ImageSoort;
  }
  // Werklijsten van vóór de indeling missen soort/src/paginas. Dat repareren we
  // bij het LEZEN, zodat bestaande lijsten meteen goed in beeld staan zonder
  // eerst opnieuw te hoeven draaien (regel: met terugwerkende kracht).
  //
  // Datzelfde geldt voor de meta's, en dat is hier belangrijker dan het lijkt.
  // In opgeslagen lijsten staan nog de teksten die de werklijst vroeger zelf
  // schreef, zonder goedkeuring. Die mogen niet meer in beeld komen, ook niet
  // tot iemand de lijst opnieuw draait. Daarom lezen we de meta's bij het LEZEN
  // uit Meta & CTR: wat daar goedgekeurd is en nog niet live staat, is de tekst;
  // al het andere valt weg. Wordt een meta daar doorgevoerd of ingetrokken, dan
  // verdwijnt hij hier vanzelf.
  const goedgekeurd = await goedgekeurdeMetas(slug).catch(() => new Map<string, { title: string; desc: string }>());
  const standVanVeld = (nieuw: string, huidig: string, kind: "meta_title" | "meta_description", copyDoc: string): MetaStand =>
    nieuw ? "voorstel" : !(huidig ? metaHardIssues(kind, huidig).length : 1) ? "goed" : copyDoc ? "copydoc" : "wacht";
  const pages = ruw.map((p) => {
    const g = goedgekeurd.get(urlKey(p.url)) || { title: "", desc: "" };
    return {
      ...p,
      newTitle: g.title,
      newDesc: g.desc,
      titleStand: standVanVeld(g.title, p.curTitle, "meta_title", p.copyDoc),
      descStand: standVanVeld(g.desc, p.curDesc, "meta_description", p.copyDoc),
      alts: (p.alts || []).map((a) => verrijkAlt(a, ruwDubbel, gemeten, soorten)),
    };
  });

  // De afbeeldingenlijst. Draait deze klant nog op een lijst van vóór de omslag,
  // dan bouwen we hem hier alsnog op uit de losse alt-regels per pagina: elke
  // afbeelding één keer, met alle pagina's waar hij op staat erbij.
  let images = (Array.isArray(r?.images) ? r?.images : []) as WorklistAlt[];
  if (!images.length && pages.length) {
    const bundel = new Map<string, WorklistAlt>();
    for (const p of pages) for (const a of p.alts || []) {
      const k = normFile(a.file);
      const bestaand = bundel.get(k);
      if (bestaand) {
        if (!bestaand.paths.includes(p.path)) bestaand.paths.push(p.path);
        if (!bestaand.alt && a.alt) bestaand.alt = a.alt;
        if (!bestaand.src && a.src) bestaand.src = a.src;
      } else {
        bundel.set(k, { ...a, file: k, paths: [...new Set([...(a.paths || []), p.path])] });
      }
    }
    images = [...bundel.values()];
  }
  images = images
    .map((a) => ({ ...verrijkAlt(a, ruwDubbel, gemeten, soorten), dubbel: false }))
    .sort((a, b) => (b.paginas || 0) - (a.paginas || 0) || a.file.localeCompare(b.file));

  // Oude vinkjes redden: die hingen aan pagina + bestand (a|<pagina>|<bestand>).
  // Is één van die pagina-vinkjes gezet, dan geldt de afbeelding als gedaan,
  // want het is in WordPress ook echt één handeling geweest.
  for (const img of images) {
    const nieuw = altKey(img.file);
    if (marks[nieuw]?.done || marks[nieuw]?.verified) continue;
    const oud = (img.paths || []).map((pad) => {
      const pg = pages.find((p) => p.path === pad);
      return pg ? marks[altKeyLegacy(pg.url, img.file)] : undefined;
    });
    const done = oud.some((m) => m?.done);
    const verified = oud.some((m) => m?.verified);
    if (done || verified) marks[nieuw] = { done, doneBy: oud.find((m) => m?.done)?.doneBy || "", verified };
  }

  const dubbel = ruwDubbel.filter((d) => {
    const k = normFile(d.file);
    return pasHandmatigToe(classifyImage({ file: k, src: d.src || "", paginas: d.paths?.length || 2, totaalPaginas: gemeten }), soorten[k] || null).moetUniek;
  });
  return { state, pages, paginaklussen: await paginaKlussen(slug), images, dubbel, gemeten, soorten, shareToken, marks, overslag };
}

/** De kaarten die naar de sitebouwer zijn doorgezet en nog niet klaar zijn. */
async function paginaKlussen(slug: string): Promise<PaginaKlus[]> {
  const { ALLE_PUNTEN } = await import("./dev-punten");
  const { rows } = await sql`
    SELECT id, url, taak, dev_taak, dev_toelichting, dev_docs, dev_punten
    FROM client_weekplan
    WHERE client_slug = ${slug} AND naar_dev = true AND status <> 'klaar'
    ORDER BY naar_dev_at DESC NULLS LAST, id DESC`;
  const kaal = (x: unknown) => String(x || "").replace(/<[^>]*>/g, "").trim();
  return rows.map((r) => {
    const url = String(r.url || "");
    let pad = url;
    try { pad = new URL(url).pathname; } catch { /* geen geldige url; dan het hele veld */ }
    const ids = Array.isArray(r.dev_punten) ? (r.dev_punten as string[]) : [];
    return {
      id: r.id as number,
      url,
      pad,
      taak: kaal(r.dev_taak) || kaal(r.taak),
      toelichting: kaal(r.dev_toelichting),
      docs: Array.isArray(r.dev_docs) ? (r.dev_docs as { label: string; url: string }[]) : [],
      punten: ids.map((id) => ALLE_PUNTEN.find((p) => p.id === id)?.label || id),
    };
  });
}

/** De vinksleutel van een paginaklus op de werklijst. */
export const paginaKlusKey = (id: number) => `p|${id}`;

/** Vult een opgeslagen alt-regel aan met de indeling (ook bij oude data). */
function verrijkAlt(a: WorklistAlt, dubbel: { file: string; src: string; paths: string[] }[], gemeten: number, soorten: Record<string, ImageSoort>): WorklistAlt {
  const k = normFile(a.file);
  const uitDubbel = dubbel.find((d) => normFile(d.file) === k);
  const paths = a.paths?.length ? a.paths : (uitDubbel?.paths || []);
  const paginas = a.paginas || paths.length || (a.dubbel ? 2 : 1);
  const src = a.src || uitDubbel?.src || "";
  const o = pasHandmatigToe(classifyImage({ file: k, src, paginas, totaalPaginas: gemeten }), soorten[k] || null);
  return { ...a, src, paginas, paths: paths.slice(0, 6), dubbel: o.moetUniek, soort: o.soort, reden: o.reden, altNodig: o.altNodig };
}

/** De handmatig gezette indelingen, per genormaliseerde bestandsnaam. */
async function getSoortOverrides(slug: string): Promise<Record<string, ImageSoort>> {
  const { rows } = await sql`SELECT item_key, soort FROM dev_worklist_marks WHERE client_slug = ${slug} AND soort IS NOT NULL`;
  const out: Record<string, ImageSoort> = {};
  for (const r of rows) { const k = String(r.item_key || ""); if (k.startsWith("i|")) out[k.slice(2)] = r.soort as ImageSoort; }
  return out;
}

/** Zet (of wist) de handmatige indeling van één afbeelding. */
export async function setWorklistSoort(slug: string, file: string, soort: ImageSoort | null): Promise<void> {
  await ensureSchema();
  await ensureTable();
  const key = soortKey(file);
  await sql`
    INSERT INTO dev_worklist_marks (client_slug, item_key, soort)
    VALUES (${slug}, ${key}, ${soort})
    ON CONFLICT (client_slug, item_key) DO UPDATE SET soort = ${soort}`;
}

export async function getSlugByWorklistToken(token: string): Promise<string | null> {
  await ensureSchema();
  await ensureTable();
  if (!token) return null;
  const { rows } = await sql`SELECT client_slug FROM client_dev_worklist WHERE share_token = ${token} LIMIT 1`;
  return (rows[0]?.client_slug as string) || null;
}

export async function setWorklistMark(slug: string, itemKey: string, done: boolean, door: string, url?: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO dev_worklist_marks (client_slug, item_key, done, done_by, done_at)
    VALUES (${slug}, ${itemKey}, ${done}, ${door || null}, ${done ? new Date().toISOString() : null})
    ON CONFLICT (client_slug, item_key) DO UPDATE SET done = ${done}, done_by = ${door || null}, done_at = ${done ? new Date().toISOString() : null}`;
  // Afvinken is echt uitgevoerd werk; terugzetten niet. Het komt hiermee in
  // "Wat we doen", zodat elke doorgevoerde meta of alt-tekst in het klant-
  // overzicht staat. De pagina-URL gaat mee, want daar volgen we later het
  // effect op (kliks, CTR) in het tabje Wijzigingen.
  if (done) {
    const isAlt = itemKey.startsWith("a|");
    const doorPingwin = /^pingwin/i.test(door || "");
    const wieTekst = doorPingwin ? "vanuit het dashboard doorgevoerd" : `doorgevoerd door de sitebouwer${door ? ` (${door})` : ""}`;
    await logActiviteit({
      slug, soort: isAlt ? "alt" : "meta", bron: "dev_worklist_marks", bronId: itemKey,
      wie: doorPingwin ? "Pingwin" : "Sitebouwer",
      url: url || null,
      intern: `${isAlt ? "Alt-tekst" : "Meta-tekst"} ${wieTekst}`,
    });
  }
}

async function setVerified(slug: string, itemKey: string, verified: boolean): Promise<void> {
  await sql`
    INSERT INTO dev_worklist_marks (client_slug, item_key, verified, verified_at)
    VALUES (${slug}, ${itemKey}, ${verified}, ${verified ? new Date().toISOString() : null})
    ON CONFLICT (client_slug, item_key) DO UPDATE SET verified = ${verified}, verified_at = ${verified ? new Date().toISOString() : null}`;
}

// Automatische controle: meet de live pagina's opnieuw en zet het groene
// "gecontroleerd"-vinkje op elk punt dat echt klopt (meta is de nieuwe tekst,
// alt staat op de afbeelding). Werkt ook de dubbel-status bij, zodat de knop
// "Alles uniek, controleer maar" van de sitebouwer hiermee afgehandeld wordt.
export async function verifyDevWorklist(slug: string): Promise<{ ok: boolean; samenvatting: string; error?: string }> {
  const data = await getWorklistData(slug);
  if (!data.pages.length) return { ok: false, samenvatting: "", error: "Er is nog geen werklijst; maak die eerst." };
  const gelijk = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase() && !!a.trim();
  let geverifieerd = 0, totaal = 0;
  const gebruik = new Map<string, Set<string>>();
  const bronnen = new Map<string, string>(); // bestandsnaam -> volledige afbeeldings-URL
  const staatErOp = new Map<string, { gevuld: boolean; attribuut: boolean }>();
  const metingen = new Map<string, PageMeasurement>();
  for (let i = 0; i < data.pages.length; i += 6) {
    await Promise.all(data.pages.slice(i, i + 6).map(async (p) => {
      const m = await measurePage(p.url, { staticOnly: true }).catch(() => null);
      if (m?.ok) metingen.set(p.url, m);
    }));
  }
  for (const p of data.pages) {
    const m = metingen.get(p.url);
    if (!m) continue;
    if (p.newTitle) { totaal++; const okT = gelijk(m.metaTitle, p.newTitle); await setVerified(slug, metaKey(p.url, "title"), okT); if (okT) geverifieerd++; }
    if (p.newDesc) { totaal++; const okD = gelijk(m.metaDescription, p.newDesc); await setVerified(slug, metaKey(p.url, "desc"), okD); if (okD) geverifieerd++; }
    for (const img of m.images) {
      const k = normFile(img.file);
      if (!k) continue;
      const st = staatErOp.get(k) || { gevuld: false, attribuut: false };
      if (img.hasAlt) st.attribuut = true;
      if (img.hasAlt && img.alt.trim()) st.gevuld = true;
      staatErOp.set(k, st);
      const e = gebruik.get(k) || new Set<string>();
      e.add(p.path);
      gebruik.set(k, e);
      if (img.src && !bronnen.has(k)) bronnen.set(k, img.src);
    }
  }
  // Alt-teksten controleren per AFBEELDING, niet per pagina: in WordPress is het
  // één veld, dus het is ook één controle en één vinkje.
  for (const a of data.images) {
    totaal++;
    const st = staatErOp.get(normFile(a.file));
    // Decoratieve afbeeldingen zijn juist goed met een LEEG alt-attribuut;
    // daar is "alt staat erop" dus niet de maatstaf.
    const okA = a.altNodig === false ? !!st?.attribuut : st?.gevuld === true;
    await setVerified(slug, altKey(a.file), okA);
    if (okA) geverifieerd++;
  }
  // Opnieuw indelen op de verse meting: welke foto's moeten nog uniek worden?
  // Vaste onderdelen (logo, header, icoontjes) vallen hier vanzelf buiten.
  const handmatig = await getSoortOverrides(slug);
  const totaalPaginas = Math.max(1, data.pages.length);
  const oordeelVan = (file: string) => {
    const k = normFile(file);
    return pasHandmatigToe(
      classifyImage({ file: k, src: bronnen.get(k) || "", paginas: gebruik.get(k)?.size || 1, totaalPaginas }),
      handmatig[k] || null,
    );
  };
  // "Zou beter kunnen": een suggestie voor de sitebouwer, geen blokkade meer.
  const beterEigenFoto = new Set([...gebruik.keys()].filter((f) => oordeelVan(f).moetUniek));
  const images = data.images.map((a) => {
    const k = normFile(a.file);
    const o = oordeelVan(a.file);
    return { ...a, src: a.src || bronnen.get(k) || "", dubbel: false, soort: o.soort, reden: o.reden, altNodig: o.altNodig, paginas: gebruik.get(k)?.size || a.paginas || 1, paths: [...(gebruik.get(k) || [])].slice(0, 6) };
  });
  const dubbelLijst = [...gebruik.entries()].filter(([f]) => beterEigenFoto.has(f)).map(([file, paths]) => ({ file, src: bronnen.get(file) || "", paths: [...paths] })).slice(0, 40);
  await sql`UPDATE client_dev_worklist SET images = ${JSON.stringify(images)}, dubbel = ${JSON.stringify(dubbelLijst)} WHERE client_slug = ${slug}`;
  const samenvatting = `Live gecontroleerd: ${geverifieerd} van ${totaal} punten staan er goed op. ${beterEigenFoto.size ? `${beterEigenFoto.size} foto's zouden beter een eigen foto kunnen zijn (suggestie, niets blokkeert).` : "Alle contentfoto's zijn uniek."}`;
  return { ok: true, samenvatting };
}
