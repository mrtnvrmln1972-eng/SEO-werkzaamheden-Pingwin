import { sql, ensureSchema } from "./db";
import { getClientBySlug } from "./clients";
import { getClientUrls, getPageDriveFolder } from "./site-urls";
import { getStepLinksAll } from "./page-doc-run";
import { measurePage, type PageMeasurement } from "./page-measure";
import { metaHardIssues } from "./meta-rules";
import { callClaude, LIGHT_MODEL } from "./anthropic";
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
};
export type WorklistPage = {
  url: string; path: string;
  curTitle: string; curDesc: string;
  newTitle: string; newDesc: string;
  copyDoc: string;
  alts: WorklistAlt[];
};
export type WorklistMark = { done: boolean; doneBy: string; verified: boolean };
export type WorklistData = {
  state: DevWorklistState;
  pages: WorklistPage[];
  dubbel: { file: string; src: string; paths: string[] }[];
  gemeten: number;
  soorten: Record<string, ImageSoort>;
  shareToken: string;
  marks: Record<string, WorklistMark>;
};

// Stabiele sleutels: m|<pagina>|title, m|<pagina>|desc, a|<pagina>|<bestand>.
export const metaKey = (url: string, veld: "title" | "desc") => `m|${urlKeyOf(url)}|${veld}`;
export const altKey = (url: string, file: string) => `a|${urlKeyOf(url)}|${normFile(file)}`;
// Handmatige indeling van een afbeelding staat los van de pagina: één keuze per
// bestand, site-breed, precies zoals de alt-tekst zelf ook site-breed is.
export const soortKey = (file: string) => `i|${normFile(file)}`;
function urlKeyOf(u: string): string { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, "").toLowerCase(); } catch { return (u || "").toLowerCase(); } }

const CRAWL_LIMIT = 60;   // maximaal zoveel live pagina's meten
const ALT_PAGE_LIMIT = 30; // voor zoveel probleempagina's schrijven we alt-teksten
const ALT_PER_PAGE = 40;   // maximaal zoveel afbeeldingen per pagina

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
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

// Meta-voorstellen voor een batch pagina's in één AI-aanroep (JSON-patroon).
async function proposeMetas(slug: string, clientName: string, pages: PageWork[]): Promise<void> {
  if (!pages.length) return;
  const { META_RULES_PROMPT } = await import("./meta-rules");
  const system =
    `Je bent SEO-copywriter bij bureau Pingwin en schrijft voor ${clientName} kant-en-klare meta's die een sitebouwer zo kan plakken.\n${META_RULES_PROMPT}\n` +
    `Antwoord met UITSLUITEND geldige JSON: {"paginas":[{"url":"...","title":"...","description":"..."}]} met voor ELKE opgegeven pagina precies één item. Geen tekst eromheen, geen emoji.`;
  const body = pages.map((p) => `URL: ${p.url}\nHuidige title: ${p.m.metaTitle || "(ontbreekt)"}\nHuidige description: ${p.m.metaDescription || "(ontbreekt)"}\nH1: ${p.m.h1.join(" | ") || "-"}\nH2: ${p.m.h2.slice(0, 8).join(" | ") || "-"}`).join("\n\n");
  const raw = await callClaude(system, [{ role: "user", content: body.slice(0, 14000) }], 3000, { slug, action: "dev-worklist-meta" });
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  const parsed = JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean) as { paginas?: { url?: string; title?: string; description?: string }[] };
  const byKey = new Map((parsed.paginas || []).map((p) => [urlKey(String(p.url || "")), p]));
  for (const p of pages) {
    const v = byKey.get(urlKey(p.url));
    if (v) { p.newTitle = String(v.title || "").trim(); p.newDesc = String(v.description || "").trim(); }
  }
}

// Alt-teksten voor één pagina (zelfde patroon als de losse alt_teksten-actie).
async function proposeAlts(slug: string, p: PageWork, nodig: (file: string) => boolean): Promise<void> {
  // Puur decoratieve afbeeldingen slaan we over: die horen een LEEG alt-veld te
  // krijgen, en dan is een verzonnen beschrijving juist fout (en zonde van de AI).
  const teSchrijven = p.missingAlts.filter((i) => nodig(i.file));
  if (!teSchrijven.length) return;
  const sys = "Je bent SEO-copywriter. Schrijf per afbeeldingsbestandsnaam een korte, natuurlijke Nederlandse alt-tekst (maximaal ongeveer 12 woorden) die beschrijft wat er waarschijnlijk op staat, passend bij de pagina. Geen keyword-stuffing, begin niet met 'afbeelding van'. Geef PRECIES per regel: bestandsnaam => alt-tekst. Geef niets anders terug, geen inleiding.";
  const user = `Pagina: ${p.url}\nTitel: ${p.m.metaTitle}\nH1: ${p.m.h1.join(" | ")}\nOnderwerpen (H2): ${p.m.h2.slice(0, 10).join(" | ")}\n\nAfbeeldingen zonder alt-tekst:\n${teSchrijven.map((i) => i.file).join("\n")}`;
  const text = await callClaude(sys, [{ role: "user", content: user }], 1500, { slug, action: "dev-worklist-alt" }, LIGHT_MODEL).catch(() => "");
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = /^(.+?)\s*=>\s*(.+)$/.exec(line.trim());
    if (m) map.set(normFile(m[1].trim()), m[2].trim());
  }
  for (const i of p.missingAlts) i.alt = map.get(normFile(i.file)) || i.alt;
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
    for (const p of measured) {
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

    const metaProbleem = measured.filter((p) => p.titleIssues.length || p.descIssues.length);
    const altProbleem = measured.filter((p) => p.missingAlts.length);
    const probleem = measured.filter((p) => p.titleIssues.length || p.descIssues.length || p.missingAlts.length);
    if (!probleem.length) {
      await setState(slug, "done", "", "Alle gemeten pagina's hebben nette meta's en alt-teksten; geen werklijst nodig.", "");
      return { ok: true };
    }

    // 4. Meta's kant-en-klaar schrijven (alleen waar geen copydocument ligt), in batches van 8.
    const teSchrijven = metaProbleem.filter((p) => !p.copyDoc);
    for (let i = 0; i < teSchrijven.length; i += 8) {
      await proposeMetas(slug, client.name, teSchrijven.slice(i, i + 8)).catch(() => { /* pagina's zonder voorstel houden hun issue-tekst */ });
    }
    // 5. Alt-teksten schrijven (begrensd aantal pagina's, drie tegelijk).
    const altPaginas = altProbleem.slice(0, ALT_PAGE_LIMIT);
    for (let i = 0; i < altPaginas.length; i += 3) {
      await Promise.all(altPaginas.slice(i, i + 3).map((p) => proposeAlts(slug, p, (f) => oordeelVan(f).altNodig)));
    }

    // 6. Het document bouwen (Pingwin-huisstijl) en naar Drive zetten.
    const totAlt = altProbleem.reduce((n, p) => n + p.missingAlts.length, 0);
    const sections: DocSection[] = [];
    sections.push({
      heading: "Hoe je deze lijst gebruikt",
      blocks: [
        { type: "paragraph", text: `Deze werklijst dekt de ${probleem.length} pagina's van ${client.name} waar de meta's of alt-teksten nog niet op orde zijn (gemeten op ${measured.length} live pagina's). Per pagina staan de nieuwe meta-title en meta-description kant-en-klaar om te plakken, plus per afbeelding een voorgestelde alt-tekst.` },
        { type: "bullets", items: [
          "Meta's: vervang de huidige title en description door de voorstellen hieronder (tekenaantal staat erbij).",
          "Alt-teksten: plak per afbeelding de voorgestelde alt-tekst in het alt-veld.",
          "Staat bij een pagina een verwijzing naar het copydocument, dan staan de meta's dáár al kant-en-klaar in.",
        ] },
        { type: "highlight", text: "Belangrijk: alleen echte contentfoto's die op een handvol pagina's terugkomen hoeven uniek gemaakt te worden. Die staan in de aparte lijst hieronder. Vaste onderdelen van de site (logo, header, footer, keurmerken, icoontjes) horen juist overal hetzelfde te zijn; die krijgen één goede alt-tekst en hoeven niet vervangen te worden." },
      ],
    });
    if (dubbel.length) {
      sections.push({
        heading: "Afbeeldingen die uniek gemaakt moeten worden",
        blocks: [
          { type: "paragraph", text: "Dit zijn contentfoto's die op meerdere pagina's staan. De alt-tekst hangt in WordPress aan de foto zelf, dus die klopt maar op één van die pagina's. Vervang ze per pagina door een eigen foto. Vaste onderdelen zoals het logo staan hier bewust niet bij." },
          { type: "table", headers: ["Afbeelding", "Aantal", "Pagina's"], rows: dubbel.map((d) => [d.file, String(d.paths.size), [...d.paths].slice(0, 6).join(", ") + (d.paths.size > 6 ? `, en nog ${d.paths.size - 6}` : "")]) },
        ],
      });
    }
    for (const p of probleem) {
      const blocks: DocSection["blocks"] = [];
      if (p.titleIssues.length || p.descIssues.length) {
        if (p.copyDoc) {
          blocks.push({ type: "paragraph", text: `De nieuwe meta-title en meta-description staan kant-en-klaar in het copydocument: ${p.copyDoc}` });
        } else {
          const rows: string[][] = [];
          rows.push(["Meta-title", p.newTitle || `(nog schrijven; huidig probleem: ${p.titleIssues.join(", ") || "in orde"})`, p.newTitle ? `${p.newTitle.length} tekens` : ""]);
          rows.push(["Meta-description", p.newDesc || `(nog schrijven; huidig probleem: ${p.descIssues.join(", ") || "in orde"})`, p.newDesc ? `${p.newDesc.length} tekens` : ""]);
          blocks.push({ type: "table", headers: ["Element", "Nieuw voorstel", "Lengte"], rows });
        }
      }
      if (p.missingAlts.length) {
        blocks.push({ type: "subheading", text: `Alt-teksten (${p.missingAlts.length} afbeeldingen)` });
        blocks.push({ type: "table", headers: ["Afbeelding", "Alt-tekst", "Soort"], rows: p.missingAlts.map((i) => {
          const o = oordeelVan(i.file);
          const tekst = !o.altNodig ? "(laat het alt-veld leeg, dit is versiering)" : (i.alt || "(zelf beschrijven wat erop staat)");
          return [i.file, tekst, o.moetUniek ? "eerst uniek maken" : o.reden];
        }) });
      }
      sections.push({ heading: p.path, blocks });
    }
    const buffer = await buildPingwinDoc({
      klant: client.name,
      rapporttype: "Werklijst sitebouwer",
      titel: "Meta's en alt-teksten, kant-en-klaar",
      ondertitel: `${probleem.length} pagina's, ${metaProbleem.length} met meta-werk, ${totAlt} afbeeldingen zonder alt-tekst`,
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
    const pages: WorklistPage[] = probleem.map((p) => ({
      url: p.url, path: p.path,
      curTitle: p.m.metaTitle, curDesc: p.m.metaDescription,
      newTitle: p.newTitle, newDesc: p.newDesc, copyDoc: p.copyDoc,
      alts: p.missingAlts.map((a) => {
        const o = oordeelVan(a.file);
        const u = usage.get(normFile(a.file));
        return {
          file: a.file, src: a.src || u?.src || "", alt: a.alt, dubbel: o.moetUniek,
          soort: o.soort, reden: o.reden, altNodig: o.altNodig,
          paginas: u?.paths.size || 1, paths: [...(u?.paths || [])].slice(0, 6),
        };
      }),
    }));
    const dubbelLijst = dubbel.map((d) => ({ file: d.file, src: d.src, paths: [...d.paths] }));
    const { randomBytes } = await import("crypto");
    const { rows: tokRows } = await sql`SELECT share_token FROM client_dev_worklist WHERE client_slug = ${slug} LIMIT 1`;
    const shareToken = (tokRows[0]?.share_token as string) || randomBytes(18).toString("base64url");
    await sql`
      UPDATE client_dev_worklist SET items = ${JSON.stringify(pages)}, dubbel = ${JSON.stringify(dubbelLijst)}, share_token = ${shareToken}, gemeten = ${measured.length}
      WHERE client_slug = ${slug}`;
    const afwerkLink = `/share/werklijst/${shareToken}`;

    // 7. Eén verzamelkaart in de weekplanning (upsert op vaste titel, nooit dubbel).
    const KAART = "Werklijst sitebouwer: meta's en alt-teksten site-breed";
    const toel = [
      "Achtergrond:",
      `- ${metaProbleem.length} pagina's met meta-title of meta-description buiten de regels.`,
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

    const samenvatting = `${probleem.length} pagina's in de werklijst: ${metaProbleem.length} met meta-werk, ${totAlt} afbeeldingen zonder alt-tekst${dubbel.length ? `, ${dubbel.length} afbeeldingen dubbel gebruikt` : ""}.${docLink ? "" : " Geen Drive-map gekoppeld; het document kon niet worden geüpload."}`;
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
  const { rows } = await sql`SELECT items, dubbel, share_token, gemeten FROM client_dev_worklist WHERE client_slug = ${slug} LIMIT 1`;
  const r = rows[0];
  const ruw = (Array.isArray(r?.items) ? r?.items : []) as WorklistPage[];
  const ruwDubbel = (Array.isArray(r?.dubbel) ? r?.dubbel : []) as { file: string; src: string; paths: string[] }[];
  const shareToken = (r?.share_token as string) || "";
  const gemeten = Number(r?.gemeten) || ruw.length || 1;
  const { rows: mRows } = await sql`SELECT item_key, done, done_by, verified, soort FROM dev_worklist_marks WHERE client_slug = ${slug}`;
  const marks: Record<string, WorklistMark> = {};
  const soorten: Record<string, ImageSoort> = {};
  for (const m of mRows) {
    marks[m.item_key as string] = { done: !!m.done, doneBy: (m.done_by as string) || "", verified: !!m.verified };
    const k = String(m.item_key || "");
    if (k.startsWith("i|") && m.soort) soorten[k.slice(2)] = m.soort as ImageSoort;
  }
  // Werklijsten van vóór de indeling missen soort/src/paginas, en hun "maak
  // uniek"-lijst bevat nog het logo en de vaste header. Allebei repareren we bij
  // het LEZEN, zodat bestaande lijsten meteen goed in beeld staan zonder eerst
  // opnieuw te hoeven draaien (regel: met terugwerkende kracht).
  const pages = ruw.map((p) => ({ ...p, alts: (p.alts || []).map((a) => verrijkAlt(a, ruwDubbel, gemeten, soorten)) }));
  const dubbel = ruwDubbel.filter((d) => {
    const k = normFile(d.file);
    return pasHandmatigToe(classifyImage({ file: k, src: d.src || "", paginas: d.paths?.length || 2, totaalPaginas: gemeten }), soorten[k] || null).moetUniek;
  });
  return { state, pages, dubbel, gemeten, soorten, shareToken, marks };
}

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

export async function setWorklistMark(slug: string, itemKey: string, done: boolean, door: string): Promise<void> {
  await ensureSchema();
  await ensureTable();
  await sql`
    INSERT INTO dev_worklist_marks (client_slug, item_key, done, done_by, done_at)
    VALUES (${slug}, ${itemKey}, ${done}, ${door || null}, ${done ? new Date().toISOString() : null})
    ON CONFLICT (client_slug, item_key) DO UPDATE SET done = ${done}, done_by = ${door || null}, done_at = ${done ? new Date().toISOString() : null}`;
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
    const perFile = new Map<string, { gevuld: boolean; attribuut: boolean }>();
    for (const img of m.images) {
      const k = normFile(img.file);
      if (!k) continue;
      const st = perFile.get(k) || { gevuld: false, attribuut: false };
      if (img.hasAlt) st.attribuut = true;
      if (img.hasAlt && img.alt.trim()) st.gevuld = true;
      perFile.set(k, st);
      const e = gebruik.get(k) || new Set<string>();
      e.add(p.path);
      gebruik.set(k, e);
      if (img.src && !bronnen.has(k)) bronnen.set(k, img.src);
    }
    for (const a of p.alts) {
      totaal++;
      const st = perFile.get(normFile(a.file));
      // Decoratieve afbeeldingen zijn juist goed met een LEEG alt-attribuut;
      // daar is "alt staat erop" dus niet de maatstaf.
      const okA = a.altNodig === false ? !!st?.attribuut : st?.gevuld === true;
      await setVerified(slug, altKey(p.url, a.file), okA);
      if (okA) geverifieerd++;
    }
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
  const nogUniekMaken = new Set([...gebruik.keys()].filter((f) => oordeelVan(f).moetUniek));
  const pages = data.pages.map((p) => ({
    ...p,
    alts: p.alts.map((a) => {
      const k = normFile(a.file);
      const o = oordeelVan(a.file);
      return { ...a, src: a.src || bronnen.get(k) || "", dubbel: o.moetUniek, soort: o.soort, reden: o.reden, altNodig: o.altNodig, paginas: gebruik.get(k)?.size || a.paginas || 1, paths: [...(gebruik.get(k) || [])].slice(0, 6) };
    }),
  }));
  const dubbelLijst = [...gebruik.entries()].filter(([f]) => nogUniekMaken.has(f)).map(([file, paths]) => ({ file, src: bronnen.get(file) || "", paths: [...paths] })).slice(0, 40);
  await sql`UPDATE client_dev_worklist SET items = ${JSON.stringify(pages)}, dubbel = ${JSON.stringify(dubbelLijst)} WHERE client_slug = ${slug}`;
  const samenvatting = `Live gecontroleerd: ${geverifieerd} van ${totaal} punten staan er goed op. ${nogUniekMaken.size ? `${nogUniekMaken.size} contentfoto's moeten nog uniek gemaakt worden.` : "Alle contentfoto's zijn nu uniek."}`;
  return { ok: true, samenvatting };
}
