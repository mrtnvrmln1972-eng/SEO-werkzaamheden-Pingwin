import { getClientBySlug } from "./clients";
import { getPageDocOutputs, getPageDriveFolder, getPagePlan, savePageDocOutput } from "./site-urls";
import { getGscForPage } from "./google";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { metaVerdictText } from "./meta-rules";
import { perfectioneerMeta } from "./meta-machine";
import { metaRegels, webtekstSecties } from "./copy-briefing";
import { metaUitCopydoc, type CopydocMeta } from "./copydoc-meta";
import { buildPingwinDoc, type DocSpec, type DocSection, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";

// ═══════════════════════════════════════════════════════════
// HET NIEUWE COPY-KLANTDOCUMENT
// ═══════════════════════════════════════════════════════════
// Vaste opbouw, zodat de klant bij elke oplevering begrijpt wat eraan
// voorafging, zonder technische informatie:
// 1. "Hoe deze nieuwe tekst tot stand kwam" (vaste uitleg in vier stappen)
// 2. "Over deze pagina" (maatwerk: zoekintentie, huidige ranking, waarom belangrijk)
// 3. De paginatitel en omschrijving zoals Google ze toont
// 4. De volledige nieuwe copy met H1/H2/H3-labels
//
// De uitleg in 2 en 3 wordt hier verser opgebouwd uit de echte cijfers. Het
// opgeslagen copy-document bevat diezelfde uitleg ook (het is één document dat
// zowel briefing als copy is), en die oude versie valt er hier dus uit; alleen
// de webteksten blijven over. Zie webtekstSecties in lib/copy-briefing.ts.
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
 "vindbaarheid":"één of twee zinnen die de kern samenvatten: waar de pagina nu staat en wat er verandert.",
 "vindbaarheidPunten":["3 tot 5 losse punten, elk één korte regel. Eerst wat er misging, dan wat de nieuwe tekst oplost. Gebruik de echte cijfers."],
 "kpi":[{"label":"korte naam van de meetwaarde","waarde":"het getal","verschil":"eventueel de vorige waarde, anders leeg","status":"goed of actie of neutraal"}]}
Regels: noem ALLE zoekwoorden die daadwerkelijk in de nieuwe tekst verwerkt zijn (minimaal 4, maximaal 14), het hoofdzoekwoord eerst; staat er in het bronstuk al een zoekwoordenlijst, neem die dan volledig over. Verzin geen cijfers, gebruik alleen wat in de data staat.
Voor "kpi": 2 tot 4 regels, uitsluitend uit de meegegeven Search Console-cijfers (positie, klikken, vertoningen van het hoofdzoekwoord). Zijn er geen cijfers, geef dan een lege lijst.
Status: "actie" als het slecht staat, "goed" als het goed staat of duidelijk verbetert, anders "neutraal".`;
  const user = `Pagina: ${url}\nBedrijf: ${client?.name || ""}\n\nHUIDIGE POSITIES (Search Console, 90 dagen):\n${data}\n\nDE NIEUWE TEKST:\n${copyTekst.slice(0, 9000)}\n\n${analyseTekst ? `UIT DE ANALYSE VAN DE HUIDIGE PAGINA:\n${analyseTekst.slice(0, 3000)}` : ""}`;
  try {
    const raw = await callClaude(sys, [{ role: "user", content: user }], 2600, { slug, action: "copy-doc-maatwerk" });
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as {
      waarover?: string; zoekwoorden?: { kw: string; reden: string }[]; vindbaarheid?: string;
      vindbaarheidPunten?: string[]; kpi?: { label?: string; waarde?: string; verschil?: string; status?: string }[];
    };
    const uit: DocSection[] = [];
    if (p.waarover) uit.push({ heading: "Waar de nieuwe teksten over gaan", blocks: [{ type: "paragraph", text: p.waarover }] });
    const kws = (p.zoekwoorden || []).filter((k) => k?.kw).slice(0, 14);
    if (kws.length) uit.push({ heading: "Welke zoekwoorden erin verwerkt zijn", blocks: [{ type: "table", headers: ["Zoekwoord", "Waarom dit erin zit"], rows: kws.map((k) => [k.kw, k.reden || ""]) }] });
    // De stand in cijfers, dan de kern in één zin, dan de punten los. Een lap tekst
    // met getallen erdoorheen leest niemand; dit wel.
    const kpi = (p.kpi || []).filter((k) => k?.label && k?.waarde).slice(0, 4).map((k) => ({
      label: String(k.label), waarde: String(k.waarde), verschil: k.verschil ? String(k.verschil) : "",
      status: (["goed", "actie", "neutraal"].includes(String(k.status)) ? k.status : "neutraal") as "goed" | "actie" | "neutraal",
    }));
    const punten = (p.vindbaarheidPunten || []).filter(Boolean).map(String).slice(0, 6);
    if (p.vindbaarheid || kpi.length || punten.length) {
      const blocks: DocBlock[] = [];
      if (kpi.length) blocks.push({ type: "kpi", rows: kpi });
      if (p.vindbaarheid) blocks.push({ type: "paragraph", text: p.vindbaarheid });
      if (punten.length) blocks.push({ type: "bullets", items: punten });
      uit.push({ heading: "Wat dit voor jullie vindbaarheid betekent", blocks });
    }
    return uit;
  } catch { return []; }
}

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
export async function metaSectie(slug: string, url: string, copyTekst: string, keyword?: string): Promise<{ sectie: DocSection; nieuweCopy?: string } | null> {
  const gevonden = await metaUitCopy(slug, copyTekst);
  if (!gevonden.title && !gevonden.desc) return null;

  const h1 = (/^#\s+(.+)$/m.exec(copyTekst)?.[1] || "").replace(/^H1\s*[—–-]\s*/i, "").trim();
  const context = copyTekst.slice(0, 1500);

  // Vier pogingen in plaats van drie: dit is de laatste plek waar een meta nog
  // bijgeschaafd kan worden voordat de klant hem ziet.
  const t = gevonden.title
    ? await perfectioneerMeta({ kind: "meta_title", tekst: gevonden.title, slug, keyword, h1: h1 || undefined, context, maxPogingen: 4 })
    : null;
  const titel = t?.tekst || "";
  const d = gevonden.desc
    ? await perfectioneerMeta({ kind: "meta_description", tekst: gevonden.desc, slug, keyword, title: titel || undefined, context, maxPogingen: 4 })
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

  // Komt een tekst ondanks de correctielus niet door de eigen poort, dan is dat
  // een signaal voor ons, niet voor de klant: in het document staat alleen de
  // opgeleverde tekst en de meting, nooit een afkeuring van eigen werk.
  for (const [kind, tekst] of [["meta_title", titel], ["meta_description", omschrijving]] as const) {
    if (tekst && (kind === "meta_title" ? t : d)?.ok === false) {
      console.warn(`[copy-doc-klant] ${kind} haalt de opleverpoort niet: ${metaVerdictText(kind, tekst)}`);
    }
  }

  return {
    sectie: {
      heading: "De paginatitel en omschrijving in Google",
      blocks: [
        { type: "table", headers: ["Element", "Tekst", "Lengte"], rows: metaRegels(titel, omschrijving) },
        { type: "paragraph", text: "Dit is wat iemand in Google ziet voordat hij klikt. Google meet die twee regels niet in tekens maar in pixels: een W is breed, een i smal. Onze motor meet de exacte breedte in het lettertype van de zoekresultaten en schrijft net zo lang bij of in tot de tekst het venster van Google precies vult. Zo wordt er niets afgekapt en blijft er geen ruimte onbenut waarin een concurrent wél zijn argument kwijt kan." },
      ],
    },
    nieuweCopy,
  };
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
  const keyword = await primairZoekwoord(slug, url, client.domain || "");
  const [maatwerk, meta] = await Promise.all([
    maatwerkSecties(slug, url, copy, outputs["analyse"] || ""),
    metaSectie(slug, url, copy, keyword),
  ]);
  // Heeft de correctielus de meta bijgeschaafd, dan gaat die tekst ook terug de
  // opgeslagen copy in: één tekst voor het document, de site en de CTR-machine.
  if (meta?.nieuweCopy) await savePageDocOutput(slug, url, "copy", meta.nieuweCopy).catch(() => { /* terugschrijven is aanvulling */ });
  // Alleen de daadwerkelijke webteksten uit het opgeslagen document. De uitleg
  // die daar ook in staat, bouwt dit document hierboven verser op; twee keer
  // dezelfde uitleg naast elkaar leest niemand.
  const copySecties = webtekstSecties(copyNaarSecties(copy));
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: "Copy-briefing",
    titel: `Nieuwe teksten voor ${pad}`,
    ondertitel: "Uitleg voor de klant plus de volledige webteksten om na te lezen en te corrigeren.",
    meta: { Pagina: pad, Datum: new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) },
    // Sfeerbeeld van de pagina zelf op de omslag, en het slotcitaat uit de huisstijl.
    sfeerbeeldUrl: url,
    slotcitaat: "Lees de teksten na en pas ze aan waar jij het beter weet. Daarna zetten wij ze SEO-geoptimaliseerd op de site.",
    sections: [
      COPY_INTRO_SECTIE,
      COPY_UITLEG_SECTIE,
      ...maatwerk,
      ...(meta ? [meta.sectie] : []),
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
