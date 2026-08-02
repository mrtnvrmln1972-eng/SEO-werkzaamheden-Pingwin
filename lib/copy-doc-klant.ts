import { getClientBySlug } from "./clients";
import { getPageDocOutputs, getPageDriveFolder } from "./site-urls";
import { getGscForPage } from "./google";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { metaVerdictText } from "./meta-rules";
import { buildPingwinDoc, type DocSpec, type DocSection, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";

// ═══════════════════════════════════════════════════════════
// HET NIEUWE COPY-KLANTDOCUMENT
// ═══════════════════════════════════════════════════════════
// Vaste opbouw, zodat de klant bij elke oplevering begrijpt wat eraan
// voorafging, zonder technische informatie:
// 1. "Hoe deze nieuwe tekst tot stand kwam" (vaste uitleg in vier stappen)
// 2. "Over deze pagina" (maatwerk: zoekintentie, huidige ranking, waarom belangrijk)
// 3. SEO-metadata uit de pixel-motor (met tekens en pixel-oordeel)
// 4. De volledige nieuwe copy met H1/H2/H3-labels
// ═══════════════════════════════════════════════════════════

// De vaste uitleg (door Maarten goedgekeurde tekst).
export const COPY_UITLEG_SECTIE: DocSection = {
  heading: "Hoe deze nieuwe tekst tot stand kwam",
  blocks: [
    { type: "step", nr: 1, title: "We beginnen bij de strategie", text: "Voordat er één woord geschreven wordt, kijken we wat deze pagina moet doen. Wat zoekt iemand die deze zoekterm intypt: informatie, een prijs, of een bedrijf om te bellen? Die zoekintentie bepaalt de hele opzet van de pagina. We beoordelen ook of dit onderwerp een eigen pagina verdient, of juist beter samenvalt met een bestaande pagina; dat verschilt per situatie en voorkomt dat pagina's elkaar in de weg zitten." },
    { type: "step", nr: 2, title: "Dan analyseren we de huidige pagina", text: "Wat er al staat, is waardevol: Google kent deze pagina en heeft er een beeld van. Daarom behouden we zoveel mogelijk van de bestaande inhoud, zolang die aan de kwaliteitseisen voldoet. Zo blijft de pagina stabiel in de zoekresultaten en bouwen we verder op wat al werkt, in plaats van opnieuw te beginnen." },
    { type: "step", nr: 3, title: "Daarna maken we de blauwdruk", text: "We analyseren de tien pagina's die nu bovenaan staan in Google voor deze zoekterm: welke onderwerpen behandelen ze, welke vragen beantwoorden ze, wat verwacht een bezoeker dus minimaal? Alles wat relevant is nemen we op. En we voegen bewust onderwerpen toe die de top tien nog niet behandelt: dat is voor Google de reden om onze pagina toe te voegen en hoog te zetten. Een pagina die alleen nadoet wat er al staat, voegt niets toe; een pagina die completer is wel." },
    { type: "step", nr: 4, title: "Tot slot schrijven we de tekst", text: "Op basis van al het bovenstaande, en in de tone of voice van jullie merk: we analyseren hoe jullie schrijven en praten, zodat de nieuwe tekst klinkt als jullie en niet als een tekstfabriek. Het resultaat is de pagina hieronder: klaar om te plaatsen." },
  ],
};

// Vaste opening: wat we van de klant vragen (door Maarten vastgesteld).
export const COPY_INTRO_SECTIE: DocSection = {
  heading: "Lees na, pas aan en stuur terug",
  blocks: [{ type: "highlight", text: "Op basis van de SEO-analyse, de blauwdruk en de top 10-analyse hebben we deze copy ontwikkeld die voldoet aan de perfecte invulling voor deze pagina. Uiteraard heb jij veel meer verstand van jouw vak en je bedrijf dan wij, dus vragen we je wel om deze teksten goed door te nemen en aan te passen waar nodig. Als je deze teksten (al dan niet aangepast) terugstuurt, dan zullen wij ze op de juiste, SEO-geoptimaliseerde manier in de website verwerken." }],
};

// Drie maatwerk-secties in één AI-aanroep: waar de teksten over gaan, welke
// zoekwoorden erin verwerkt zijn (met per zoekwoord de reden) en wat dit voor
// de vindbaarheid betekent. Gevoed met de echte Search Console-cijfers.
export async function maatwerkSecties(slug: string, url: string, copyTekst: string, analyseTekst: string): Promise<DocSection[]> {
  const client = await getClientBySlug(slug);
  const gsc = client?.domain ? await getGscForPage(client.domain, url, 90).catch(() => []) : [];
  const data = gsc.slice(0, 12).map((k) => `"${k.keyword}": positie ${Math.round(k.position * 10) / 10}, ${k.clicks} klikken, ${k.impressions} vertoningen`).join("\n") || "Nog geen meetbare posities (bijvoorbeeld een nieuwe pagina).";
  const sys = `Je bent SEO-strateeg bij bureau Pingwin en schrijft de uitleg voor de klant in een copy-briefing. Schrijf in gewone taal, persoonlijk, zonder jargon en zonder emoji.
Geef UITSLUITEND geldige JSON met exact deze velden:
{"waarover":"3 tot 5 zinnen: waar de nieuwe teksten over gaan. Noem de groei in omvang als je die kunt afleiden (van korte introductie naar volwaardige dienstenpagina), de toon en de positionering van dit bedrijf.",
 "zoekwoorden":[{"kw":"zoekwoord","reden":"één korte zin waarom dit zoekwoord erin zit; noem bij het hoofdzoekwoord de echte positie als die er is"}],
 "vindbaarheid":"3 tot 5 zinnen: wat dit voor de vindbaarheid betekent. Wees eerlijk en concreet, gebruik de echte cijfers, benoem de oorzaak van het probleem en wat er nu verandert."}
Regels: 4 tot 7 zoekwoorden, het hoofdzoekwoord eerst; verzin geen cijfers, gebruik alleen wat in de data staat.`;
  const user = `Pagina: ${url}\nBedrijf: ${client?.name || ""}\n\nHUIDIGE POSITIES (Search Console, 90 dagen):\n${data}\n\nDE NIEUWE TEKST:\n${copyTekst.slice(0, 9000)}\n\n${analyseTekst ? `UIT DE ANALYSE VAN DE HUIDIGE PAGINA:\n${analyseTekst.slice(0, 3000)}` : ""}`;
  try {
    const raw = await callClaude(sys, [{ role: "user", content: user }], 2000, { slug, action: "copy-doc-maatwerk" });
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { waarover?: string; zoekwoorden?: { kw: string; reden: string }[]; vindbaarheid?: string };
    const uit: DocSection[] = [];
    if (p.waarover) uit.push({ heading: "Waar de nieuwe teksten over gaan", blocks: [{ type: "paragraph", text: p.waarover }] });
    const kws = (p.zoekwoorden || []).filter((k) => k?.kw).slice(0, 8);
    if (kws.length) uit.push({ heading: "Welke zoekwoorden erin verwerkt zijn", blocks: [{ type: "table", headers: ["Zoekwoord", "Waarom dit erin zit"], rows: kws.map((k) => [k.kw, k.reden || ""]) }] });
    if (p.vindbaarheid) uit.push({ heading: "Wat dit voor jullie vindbaarheid betekent", blocks: [{ type: "paragraph", text: p.vindbaarheid }] });
    return uit;
  } catch { return []; }
}

// Meta-titel en description uit de copy, getoetst met de pixel-motor.
export async function metaSectie(slug: string, copyTekst: string): Promise<DocSection | null> {
  const sys = `Haal uit dit document de definitieve meta-title en meta-description van de pagina (de eerste/beste variant als er meerdere staan). Antwoord met UITSLUITEND geldige JSON: {"title":"...","description":"..."}. Staat er geen meta in, geef dan lege strings.`;
  try {
    const raw = await callClaude(sys, [{ role: "user", content: copyTekst.slice(0, 8000) }], 400, { slug, action: "copy-doc-meta" }, LIGHT_MODEL);
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { title?: string; description?: string };
    const title = (p.title || "").trim();
    const desc = (p.description || "").trim();
    if (!title && !desc) return null;
    const rows: string[][] = [];
    if (title) rows.push(["Meta-title", title, `${title.length} tekens`, metaVerdictText("meta_title", title)]);
    if (desc) rows.push(["Meta-description", desc, `${desc.length} tekens`, metaVerdictText("meta_description", desc)]);
    return {
      heading: "SEO-metadata (gemeten met de Pingwin pixel-motor)",
      blocks: [
        { type: "table", headers: ["Element", "Tekst", "Lengte", "Oordeel"], rows },
        { type: "paragraph", text: "Google meet titels en beschrijvingen niet in tekens maar in pixels; onze motor meet de exacte breedte en toetst aan de vaste criterialijst, zodat niets wordt afgekapt in de zoekresultaten." },
      ],
    };
  } catch { return null; }
}

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
  const [maatwerk, meta] = await Promise.all([
    maatwerkSecties(slug, url, copy, outputs["analyse"] || ""),
    metaSectie(slug, copy),
  ]);
  const copySecties = copyNaarSecties(copy).filter((s) => !/seo-metadata|scorecard|behoud/i.test(s.heading || ""));
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: "Copy-briefing",
    titel: `Nieuwe teksten voor ${pad}`,
    ondertitel: "Uitleg voor de klant plus de volledige webteksten om na te lezen en te corrigeren.",
    meta: { Pagina: pad, Datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) },
    sections: [
      COPY_INTRO_SECTIE,
      COPY_UITLEG_SECTIE,
      ...maatwerk,
      ...(meta ? [meta] : []),
      { heading: "De volledige webteksten (lees na en corrigeer)", blocks: [{ type: "paragraph", text: "Hieronder de volledige teksten voor de pagina. Lees ze door, pas aan waar nodig en geef je correcties terug aan Pingwin. Bij elke kop staat de aanduiding (H1, H2, H3), zodat de sitebouwer precies weet welk kopniveau hij moet gebruiken." }] },
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
