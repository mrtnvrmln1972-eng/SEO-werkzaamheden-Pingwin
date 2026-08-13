import { getClientBySlug } from "./clients";
import { getPageDocOutputs, getPageDriveFolder, getPagePlan, savePageDocOutput } from "./site-urls";
import { getGscForPage } from "./google";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { metaVerdictText } from "./meta-rules";
import { perfectioneerMeta } from "./meta-machine";
import { webtekstSecties } from "./copy-briefing";
import { metaUitCopydoc, type CopydocMeta } from "./copydoc-meta";
import { buildPingwinDoc, type DocSpec, type DocSection, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";

// ═══════════════════════════════════════════════════════════
// HET COPY-KLANTDOCUMENT
// ═══════════════════════════════════════════════════════════
// Bewust sober (besluit 13-08-2026, na feedback dat de volle huisstijl met
// omslagfoto, stappenkaarten, KPI-pillen en callouts er te "gelikt AI" uitzag
// voor een document dat een klant gewoon moet nálezen). Vaste opbouw:
// 1. Kopregel (logo + oranje streep, uit buildPingwinDoc) en een sobere titel,
//    geen omslagfoto, geen nummer-bolletjes (stijl: "werkdocument").
// 2. Eén korte, droge uitleg (1-2 alinea's): strategie → analyse → blauwdruk →
//    copy, hoe dat tot deze tekst leidde.
// 3. De metatitel en -omschrijving, gewoon als tekst (de pixel-correctielus
//    blijft wel draaien, alleen het uitgebreide verificatie-tabelletje niet).
// 4. De volledige nieuwe copy met H1/H2/H3-labels, zonder verdere opmaak.
// ═══════════════════════════════════════════════════════════

// De vaste, droge uitleg (goedgekeurd 13-08-2026; vervangt de vier stappenkaarten).
export const COPY_UITLEG_SECTIE: DocSection = {
  blocks: [
    { type: "paragraph", text: "Deze tekst komt in vier stappen tot stand. Eerst bepalen we de strategie: welke zoekintentie deze pagina bedient en welk zoekwoord daarbij hoort. Daarna analyseren we de huidige pagina, zodat we behouden wat al werkt in plaats van opnieuw te beginnen. Vervolgens maken we de blauwdruk op basis van de tien pagina's die nu bovenaan Google staan voor deze zoekterm: welke onderwerpen zij behandelen en wat wij toevoegen om vollediger te zijn. Tot slot schrijven we de tekst, in de toon van jullie eigen merk." },
    { type: "paragraph", text: "Lees de tekst hieronder na en pas aan waar jij het beter weet. Stuur je correcties terug, dan verwerken wij de tekst SEO-geoptimaliseerd op de site." },
  ],
};

/**
 * Het primaire zoekwoord van deze pagina: eerst wat er in het plan gekozen is
 * ("Primair: ..."), anders het zoekwoord waarop de pagina nu het meeste bezoek
 * haalt. Zonder zoekwoord kan de meta-poort niet toetsen of het zoekwoord
 * vooraan staat; met een verkeerd zoekwoord zou hij verkeerd toetsen. Leeg mag
 * dus: dan vervallen alleen die twee checks.
 */
async function primairZoekwoord(slug: string, url: string, domain: string): Promise<string> {
  const plan = await getPagePlan(slug, url).catch(() => "");
  const plat = (plan || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const m = plat.match(/primair\s*[:：]\s*([^\n<]+)/i);
  if (m) return m[1].replace(/\*+/g, "").trim();
  if (!domain) return "";
  const kw = await getGscForPage(domain, url, 90).catch(() => []);
  const beste = [...kw].sort((a, b) => (b.clicks - a.clicks) || (b.impressions - a.impressions))[0];
  return beste?.keyword || "";
}

// De meta uit de copy halen. Eerst deterministisch (dezelfde herkenning die de
// rest van het dashboard gebruikt), en alleen als dat niets oplevert een kleine
// AI-aanroep als vangnet. Scheelt een aanroep per document en, belangrijker,
// het houdt het document en de meta-machine op exact dezelfde tekst.
async function metaUitCopy(slug: string, copyTekst: string): Promise<CopydocMeta> {
  const direct = metaUitCopydoc(copyTekst);
  if (direct.title || direct.desc) return direct;
  const sys = `Haal uit dit document de definitieve meta-title en meta-description van de pagina (de eerste/beste variant als er meerdere staan). Antwoord met UITSLUITEND geldige JSON: {"title":"...","description":"..."}. Staat er geen meta in, geef dan lege strings.`;
  try {
    const raw = await callClaude(sys, [{ role: "user", content: copyTekst.slice(0, 8000) }], 400, { slug, action: "copy-doc-meta" }, LIGHT_MODEL);
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { title?: string; description?: string };
    return { title: (p.title || "").trim(), desc: (p.description || "").trim() };
  } catch { return { title: "", desc: "" }; }
}

/**
 * Meta-titel en description voor het klantdocument: eerst perfect maken, dan pas
 * tonen.
 *
 * Waarom die volgorde: dit document toonde het oordeel van de pixel-motor bij
 * een tekst die het zelf had geschreven. Stond die tekst dan net buiten het
 * venster van Google, dan las de klant in ónze oplevering dat onze eigen titel
 * "te kort, ruimte onbenut" was. Een oordeel over eigen werk hoort niet in een
 * oplevering; een perfecte meta wel. De correctielus (lib/meta-machine.ts)
 * draait dus vóór het document gebouwd wordt, en wat er dan staat, is de tekst
 * die de klant krijgt. Verbetert de lus iets, dan gaat die correctie ook terug
 * de opgeslagen copy in, zodat het document, de site-doorvoer en de CTR-machine
 * dezelfde tekst gebruiken.
 */
export async function metaSectie(slug: string, url: string, copyTekst: string, keyword?: string, merk = ""): Promise<{ sectie: DocSection; nieuweCopy?: string } | null> {
  const gevonden = await metaUitCopy(slug, copyTekst);
  if (!gevonden.title && !gevonden.desc) return null;

  const h1 = (/^#\s+(.+)$/m.exec(copyTekst)?.[1] || "").replace(/^H1\s*[—–-]\s*/i, "").trim();
  const context = copyTekst.slice(0, 1500);

  // Eigen woorden voor de laatste slag: de naam van het bedrijf is altijd waar,
  // dus daar mag de vijl mee aanvullen als de tekst te kort blijft.
  const bouwstenen = [merk].filter(Boolean);
  // Vier pogingen in plaats van drie: dit is de laatste plek waar een meta nog
  // bijgeschaafd kan worden voordat de klant hem ziet.
  const t = gevonden.title
    ? await perfectioneerMeta({ kind: "meta_title", tekst: gevonden.title, slug, keyword, h1: h1 || undefined, context, maxPogingen: 4, bouwstenen })
    : null;
  const titel = t?.tekst || "";
  const d = gevonden.desc
    ? await perfectioneerMeta({ kind: "meta_description", tekst: gevonden.desc, slug, keyword, title: titel || undefined, context, maxPogingen: 4, bouwstenen })
    : null;
  const omschrijving = d?.tekst || "";

  // Correcties terugschrijven in de opgeslagen copy, zodat er één tekst blijft.
  let nieuweCopy: string | undefined;
  if (t?.gewijzigd || d?.gewijzigd) {
    let tekst = copyTekst;
    if (t?.gewijzigd) tekst = tekst.split(gevonden.title).join(titel);
    if (d?.gewijzigd) tekst = tekst.split(gevonden.desc).join(omschrijving);
    if (tekst !== copyTekst) nieuweCopy = tekst;
  }

  // Komt een tekst ondanks de correctielus én de vijl niet door de eigen poort,
  // dan is dat een signaal voor ONS, niet voor de klant: in het document staat
  // alleen de opgeleverde tekst en de meting, nooit een afkeuring van eigen
  // werk. Maar stil blijven is ook fout, want dan levert het dashboard zonder
  // een kik iets af dat niet aan onze eigen lat voldoet. Daarom onthouden we het
  // hier, en zeggen de routes het erbij (zie laatsteMetaMelding).
  metaMelding = "";
  for (const [kind, tekst, r] of [["meta_title", titel, t], ["meta_description", omschrijving, d]] as const) {
    if (tekst && r && !r.ok) {
      console.warn(`[copy-doc-klant] ${kind} haalt de opleverpoort niet: ${metaVerdictText(kind, tekst)}`);
      const naam = kind === "meta_title" ? "paginatitel" : "omschrijving";
      metaMelding = [metaMelding, `De ${naam} haalt onze eigen lat nog niet: ${r.issues[0] || metaVerdictText(kind, tekst)}.`].filter(Boolean).join(" ");
    }
  }
  // Blijven er alleen zoekwoord-criteria over, dan ligt het meestal niet aan de
  // tekst maar aan het opgegeven zoekwoord. Een "primair zoekwoord" van vijf
  // woorden ("duurzame hovenier Breda inheemse beplanting") kan per definitie niet
  // vooraan in een titel van 60 tekens staan en niet letterlijk in een leesbare
  // omschrijving; dan zakt de meta op drie punten zonder dat er iets mis is met
  // het schrijfwerk. Dat hoort Maarten te weten, want alleen hij kan het
  // zoekwoord bijstellen.
  const woordenInKeyword = (keyword || "").trim().split(/\s+/).filter(Boolean).length;
  if (metaMelding && woordenInKeyword >= 5) {
    metaMelding += ` Let op: het primaire zoekwoord van deze pagina is een zin van ${woordenInKeyword} woorden ("${keyword}"). Zolang dat zo staat, kunnen de zoekwoord-criteria niet slagen, hoe goed de tekst ook is; kies een echt zoekwoord in het plan van deze pagina.`;
  }

  // Sober: alleen de tekst zelf, met de tekenlengte erachter. De pixel-motor
  // (perfectioneerMeta hierboven) heeft de tekst intussen al gecorrigeerd zodat
  // hij past; een verificatietabel met vinkjes daarnaast voegde alleen
  // opsmuk toe, geen informatie die de klant nog nodig heeft.
  const blocks: DocBlock[] = [
    { type: "paragraph", text: `Metatitel: ${titel} (${titel.length} tekens)` },
    { type: "paragraph", text: `Metaomschrijving: ${omschrijving} (${omschrijving.length} tekens)` },
  ];

  return {
    sectie: { heading: "De paginatitel en omschrijving in Google", blocks },
    nieuweCopy,
  };
}

/**
 * Haalde de meta van het laatst gebouwde klantdocument onze eigen lat niet, dan
 * staat dat hier. Leeg betekent: alles door de poort. Dezelfde opzet als
 * laatsteOmslagGelukt, zodat de routes het aan Maarten kunnen melden in plaats
 * van het alleen in een serverlog te zetten.
 */
let metaMelding = "";
export function laatsteMetaMelding(): string { return metaMelding; }

// De opgeslagen copy-tekst (markdown-achtig) → nette document-secties, met de
// H1/H2/H3-labels zichtbaar bij elke kop.
export function copyNaarSecties(tekst: string): DocSection[] {
  const secties: DocSection[] = [];
  let cur: DocSection = { blocks: [] };
  let bullets: string[] = [];
  let tabel: string[][] = [];
  const label = (kop: string, niveau: "H1" | "H2" | "H3") => (/^H[123]\b/.test(kop.trim()) ? kop.trim() : `${niveau} — ${kop.trim()}`);
  const flushBullets = () => { if (bullets.length) { cur.blocks.push({ type: "bullets", items: bullets } as DocBlock); bullets = []; } };
  const flushTabel = () => { if (tabel.length > 1) cur.blocks.push({ type: "table", headers: tabel[0], rows: tabel.slice(1) } as DocBlock); else if (tabel.length === 1) cur.blocks.push({ type: "paragraph", text: tabel[0].join(" | ") } as DocBlock); tabel = []; };
  const flushSectie = () => { flushBullets(); flushTabel(); if (cur.heading || cur.blocks.length) secties.push(cur); cur = { blocks: [] }; };
  for (const raw of (tekst || "").split("\n")) {
    const r = raw.trim();
    const h1 = /^#\s+(.*)$/.exec(r);
    const h2 = /^##\s+(.*)$/.exec(r);
    const h3 = /^###\s+(.*)$/.exec(r);
    if (h1) { flushSectie(); cur = { heading: label(h1[1], "H1"), blocks: [] }; continue; }
    if (h2) { flushSectie(); cur = { heading: label(h2[1], "H2"), blocks: [] }; continue; }
    if (h3) { flushBullets(); flushTabel(); cur.blocks.push({ type: "subheading", text: label(h3[1], "H3") } as DocBlock); continue; }
    if (/^[-*]\s+/.test(r)) { flushTabel(); bullets.push(r.replace(/^[-*]\s+/, "")); continue; }
    if (r.includes(" | ")) { flushBullets(); tabel.push(r.split(" | ").map((c) => c.trim())); continue; }
    flushBullets(); flushTabel();
    if (r.startsWith(">")) cur.blocks.push({ type: "highlight", text: r.replace(/^>\s*/, "") } as DocBlock);
    else if (r) cur.blocks.push({ type: "paragraph", text: r } as DocBlock);
  }
  flushSectie();
  return secties;
}

// Het volledige document in het nieuwe formaat, uit de al opgeslagen gegevens.
export async function buildCopyKlantSpec(slug: string, url: string): Promise<{ ok: boolean; spec?: DocSpec; error?: string }> {
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, error: "Klant niet gevonden." };
  const outputs = await getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>));
  const copy = outputs["copy"] || "";
  if (!copy.trim()) return { ok: false, error: "Voor deze pagina is nog geen copy gegenereerd; draai eerst de copy-stap." };
  const pad = (() => { try { return new URL(url).pathname; } catch { return url; } })();
  const keyword = await primairZoekwoord(slug, url, client.domain || "");
  const meta = await metaSectie(slug, url, copy, keyword, client.name);
  // Heeft de correctielus de meta bijgeschaafd, dan gaat die tekst ook terug de
  // opgeslagen copy in: één tekst voor het document, de site en de CTR-machine.
  if (meta?.nieuweCopy) await savePageDocOutput(slug, url, "copy", meta.nieuweCopy).catch(() => { /* terugschrijven is aanvulling */ });
  const copySecties = webtekstSecties(copyNaarSecties(copy));
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: "Copy",
    titel: `Nieuwe teksten voor ${pad}`,
    // Sober werkdocument: geen omslagfoto, geen nummer-bolletjes. Zie de uitleg
    // bovenaan dit bestand (besluit 13-08-2026).
    stijl: "werkdocument",
    sections: [
      COPY_UITLEG_SECTIE,
      ...(meta ? [meta.sectie] : []),
      { heading: "De volledige tekst", blocks: [] },
      ...copySecties,
    ],
  };
  return { ok: true, spec };
}

// Voorbeeld/oplevering: bouw het document en zet het in de Drive-map van de pagina.
export async function maakCopyKlantDoc(slug: string, url: string): Promise<{ ok: boolean; link?: string; error?: string }> {
  const r = await buildCopyKlantSpec(slug, url);
  if (!r.ok || !r.spec) return { ok: false, error: r.error };
  const folder = await getPageDriveFolder(slug, url).catch(() => null);
  if (!folder?.folderId) return { ok: false, error: "Deze pagina heeft nog geen Drive-map; koppel die eerst (tab Pagina's)." };
  const buffer = await buildPingwinDoc(r.spec);
  const pad = (() => { try { return new URL(url).pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "pagina"; } catch { return "pagina"; } })();
  const { link } = await uploadDocx(folder.folderId, `Nieuwe-tekst-${pad}.docx`, buffer);
  return { ok: true, link };
}
