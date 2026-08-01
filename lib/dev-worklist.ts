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
// Responsive/lazyload-varianten (foto-300x200.jpg) tellen als dezelfde afbeelding.
const normFile = (f: string) => f.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
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
  missingAlts: { file: string; alt: string }[]; // alt = voorstel
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
async function proposeAlts(slug: string, p: PageWork): Promise<void> {
  if (!p.missingAlts.length) return;
  const sys = "Je bent SEO-copywriter. Schrijf per afbeeldingsbestandsnaam een korte, natuurlijke Nederlandse alt-tekst (maximaal ongeveer 12 woorden) die beschrijft wat er waarschijnlijk op staat, passend bij de pagina. Geen keyword-stuffing, begin niet met 'afbeelding van'. Geef PRECIES per regel: bestandsnaam => alt-tekst. Geef niets anders terug, geen inleiding.";
  const user = `Pagina: ${p.url}\nTitel: ${p.m.metaTitle}\nH1: ${p.m.h1.join(" | ")}\nOnderwerpen (H2): ${p.m.h2.slice(0, 10).join(" | ")}\n\nAfbeeldingen zonder alt-tekst:\n${p.missingAlts.map((i) => i.file).join("\n")}`;
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
        if (!img.hasAlt || !img.alt.trim()) p.missingAlts.push({ file: img.file, alt: "" });
      }
      p.missingAlts = p.missingAlts.slice(0, ALT_PER_PAGE);
    }

    // 3. Afbeeldingen die op meerdere pagina's terugkomen (unieke-afbeeldingen-instructie).
    const usage = new Map<string, { file: string; paths: Set<string> }>();
    for (const p of measured) {
      const perPage = new Set(p.m.images.map((i) => normFile(i.file)).filter(Boolean));
      for (const k of perPage) {
        const e = usage.get(k) || { file: k, paths: new Set<string>() };
        e.paths.add(p.path);
        usage.set(k, e);
      }
    }
    const dubbel = [...usage.values()].filter((e) => e.paths.size >= 2 && !/(logo|icon|favicon|avatar)/.test(e.file)).sort((a, b) => b.paths.size - a.paths.size).slice(0, 25);

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
      await Promise.all(altPaginas.slice(i, i + 3).map((p) => proposeAlts(slug, p)));
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
        { type: "highlight", text: "Belangrijk: gebruik per pagina zoveel mogelijk unieke afbeeldingen. Een afbeelding die op meerdere pagina's terugkomt heeft overal dezelfde alt-tekst, en die klopt dan maar op één van die pagina's. Staat dezelfde foto toch op meerdere pagina's, geef hem dan per pagina een eigen, passende alt-tekst of vervang hem door een unieke foto." },
      ],
    });
    if (dubbel.length) {
      sections.push({
        heading: "Afbeeldingen die op meerdere pagina's staan",
        blocks: [{ type: "table", headers: ["Afbeelding", "Aantal", "Pagina's"], rows: dubbel.map((d) => [d.file, String(d.paths.size), [...d.paths].slice(0, 6).join(", ")]) }],
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
        blocks.push({ type: "table", headers: ["Afbeelding", "Alt-tekst"], rows: p.missingAlts.map((i) => [i.file, i.alt || "(zelf beschrijven wat erop staat)"]) });
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

    // 7. Eén verzamelkaart in de weekplanning (upsert op vaste titel, nooit dubbel).
    const KAART = "Werklijst sitebouwer: meta's en alt-teksten site-breed";
    const toel = [
      "Achtergrond:",
      `- ${metaProbleem.length} pagina's met meta-title of meta-description buiten de regels.`,
      `- ${totAlt} afbeeldingen zonder alt-tekst, verdeeld over ${altProbleem.length} pagina's.`,
      dubbel.length ? `- ${dubbel.length} afbeeldingen staan op meerdere pagina's (zelfde alt overal, klopt maar op één plek).` : "",
      "Aanpak per fase:",
      docLink ? `- Bouw: werk de werklijst af (${docLink}); alles staat er kant-en-klaar in.` : "- Bouw: werk de werklijst af; genereer hem opnieuw voor een actuele versie.",
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
