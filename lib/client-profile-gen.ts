import { getClientBySlug } from "./clients";
import { getClientUrls, getPageDriveFolder } from "./site-urls";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";
import { buildPingwinDoc, type DocSpec, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { upsertStepTask } from "./tasks";

// ═══════════════════════════════════════════════════════════
// KLANTPROFIEL + TONE-OF-VOICE GENEREREN uit de live site
// ═══════════════════════════════════════════════════════════
// Twee knoppen bij het klantprofiel starten een concept: een klantprofiel
// (positionering, expertise, doelgroep, overtuiging, commerciële koers) en een
// tone-of-voice-analyse. Beide worden gegrond in de echte site (homepage + een
// paar kernpagina's), zodat de chat daarna over strategie, doelgroep en
// zoekwoorden kan nadenken op basis van feiten, niet aannames. De uitkomst is
// een compacte samenvatting die in het klantprofielveld komt; Maarten vult zijn
// eigen know-how aan (rode opmerking in de UI).
// ═══════════════════════════════════════════════════════════

export type ProfileKind = "profile" | "tov";

// Kernpagina's van de klant ophalen en uitlezen (homepage + drukste pagina's).
async function gatherSiteContext(slug: string): Promise<{ name: string; domain: string; existing: string; pagesText: string } | { error: string }> {
  const client = await getClientBySlug(slug);
  if (!client) return { error: "Klant niet gevonden." };
  const domain = (client.domain || "").trim();
  if (!domain) return { error: "Deze klant heeft nog geen domein. Vul eerst het domein in bij de klantgegevens." };

  const urls = await getClientUrls(slug).catch(() => []);
  const base = domain.startsWith("http") ? domain.replace(/\/$/, "") : `https://${domain.replace(/^www\./, "").replace(/\/$/, "")}`;

  // Homepage eerst, daarna de drukste pagina's (op GSC-klikken), ontdubbeld, max 5.
  const ordered = [...urls].sort((a, b) => b.gscClicks - a.gscClicks).map((u) => u.url);
  const picks: string[] = [];
  const seen = new Set<string>();
  for (const u of [base, base + "/", ...ordered]) {
    const key = u.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key); picks.push(u);
    if (picks.length >= 5) break;
  }

  const pages = await Promise.all(picks.slice(0, 5).map((u) => fetchPageContent(u).catch(() => null)));
  const blocks = pages
    .filter((p): p is NonNullable<typeof p> => !!p && p.status != null && p.status >= 200 && p.status < 400 && (!!p.text || !!p.h1))
    .map((p) => {
      const headings = (p.headings || []).slice(0, 15).join(" | ");
      return `URL: ${p.url}\nTitel: ${p.title || ""}\nH1: ${p.h1 || ""}\nKoppen: ${headings}\nTekst: ${(p.text || "").slice(0, 2500)}`;
    });

  if (blocks.length === 0) return { error: "Kon de live pagina's niet uitlezen (geen bereikbare pagina's gevonden)." };
  return { name: client.name, domain, existing: (client.seoProfile || "").trim(), pagesText: blocks.join("\n\n---\n\n") };
}

const PROFILE_SYSTEM = `Je bent een SEO- en merkstrateeg van bureau Pingwin. Je stelt een COMPACT klantprofiel op als werkinstructie voor copywriting en strategie, gegrond in de echte website (hieronder). Verzin niets; leid alles af uit de aangeleverde pagina's. Waar je iets niet zeker weet, schrijf "(navragen)".

Antwoord in NETTE markdown, exact met deze kop bovenaan en deze structuur, zonder inleiding eromheen, zonder emoji:

## Klantprofiel (automatisch gegenereerd)

**Rol voor de copywriter:** <2 tot 3 zinnen expert-persona uit het vakgebied van deze klant>

**Bedrijf en positionering**
- <wie zijn ze, wat onderscheidt hen, werkgebied>

**Expertise en onderwerp**
- <inhoudelijke autoriteit, kerndiensten>

**Doelgroep en hun twijfels**
- <voor wie, en welke bezwaren/twijfels weggenomen moeten worden>

**Overtuigingsprincipes**
- <proof, autoriteit, geruststelling: reviews, cijfers, USP's die op de site staan>

**Compliance en grenzen**
- <wat niet beloofd/gezegd mag worden in deze branche>

**Commerciële voorkeur en schrijfhouding**
- <ideale klant/projecten, prijspositionering, balans eerlijk vs overtuigend; (navragen) waar de site dit niet toont>

Houd elk onderdeel kort (bullets, geen lange lappen). Concrete keuzes en voorbeelden zijn waardevoller dan abstracte beschrijving.`;

const TOV_SYSTEM = `Je bent een tone-of-voice-analist van bureau Pingwin. Je analyseert de SCHRIJFSTIJL van de klant, gegrond in de echte website (hieronder). Verzin niets; haal echte voorbeeldzinnen uit de aangeleverde tekst.

Antwoord in NETTE markdown, exact met deze kop bovenaan en deze structuur, zonder inleiding eromheen, zonder emoji:

## Tone of voice (automatisch gegenereerd)

**Karakter in het kort:** <3 tot 5 kernwoorden voor de stijl, bijv. nuchter, warm, deskundig>

**Woorden en stijl wel**
- <kenmerken die passen: aanspreekvorm (je/u), zinslengte, vakwoorden wel/niet uitleggen>

**Woorden en stijl niet**
- <wat je vermijdt: jargon, superlatieven, holle marketing>

**Voorbeeldzinnen van de site**
- "<echte zin 1 uit de tekst>"
- "<echte zin 2 uit de tekst>"

Houd het bruikbaar als schrijf-instructie. Als de site te weinig tekst heeft voor een oordeel, zeg dat eerlijk.`;

// ── Van markdown-samenvatting naar een Pingwin-huisstijl document + taak ──────

function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}
function domainRoot(domain: string): string {
  const d = (domain || "").trim();
  return d.startsWith("http") ? d.replace(/\/$/, "") : `https://${d.replace(/^www\./, "").replace(/\/$/, "")}`;
}

// Zet de gegenereerde markdown-sectie om in nette documentblokken (koppen,
// bullets, alinea's). Een regel met alléén **vet** wordt een subkop; een bullet
// (- of *) een opsomming; de rest een alinea (waarin **vet** bewaard blijft).
function mdToBlocks(md: string): { heading: string; blocks: DocBlock[] } {
  let heading = "";
  const blocks: DocBlock[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { blocks.push({ type: "bullets", items: bullets }); bullets = []; } };
  for (const raw of (md || "").split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("## ")) { heading = l.replace(/^##\s+/, "").trim(); continue; }
    if (l.startsWith("### ")) { flush(); blocks.push({ type: "subheading", text: l.replace(/^###\s+/, "").trim() }); continue; }
    if (/^[-*]\s+/.test(l)) { bullets.push(l.replace(/^[-*]\s+/, "").trim()); continue; }
    const boldOnly = l.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) { flush(); blocks.push({ type: "subheading", text: boldOnly[1].trim() }); continue; }
    flush(); blocks.push({ type: "paragraph", text: l });
  }
  flush();
  return { heading, blocks };
}

export type ProfileDeliverable = {
  ok: boolean;
  section: string;
  taskId: number | null;
  link: string;       // deelbare Drive-link (leeg als Drive niet gekoppeld)
  driveError: string; // reden als de Drive-upload niet lukte (taak bestaat dan wél, zonder link)
  error?: string;
};

// Genereert het klantprofiel/tone-of-voice, bouwt er een Pingwin-huisstijl .docx
// van, levert dat op Drive (deelbaar) en maakt er een mailbare werkzaamheid van
// die in de werkzaamheden én de klantdash verschijnt.
export async function makeProfileDeliverable(slug: string, kind: ProfileKind): Promise<ProfileDeliverable> {
  const gen = await generateProfileSection(slug, kind);
  if (!gen.ok) return { ok: false, section: "", taskId: null, link: "", driveError: "", error: gen.error };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, section: gen.section, taskId: null, link: "", driveError: "", error: "Klant niet gevonden." };

  const isTov = kind === "tov";
  const dateStr = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const { heading, blocks } = mdToBlocks(gen.section);
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: isTov ? "Tone of voice" : "Klantprofiel",
    titel: isTov ? `Tone of voice: ${client.name}` : `Klantprofiel: ${client.name}`,
    ondertitel: "Opgesteld door Pingwin",
    meta: { Klant: client.name, Datum: dateStr, Domein: (client.domain || "").replace(/^https?:\/\//, "") },
    sections: [{ heading: heading || (isTov ? "Tone of voice" : "Klantprofiel"), blocks }],
  };

  let buffer: Buffer;
  try { buffer = await buildPingwinDoc(spec); }
  catch (e) { return { ok: false, section: gen.section, taskId: null, link: "", driveError: "", error: `Document opmaken mislukte: ${(e as Error).message}` }; }

  const base = domainRoot(client.domain || "");
  const filename = `${safeName(client.name)}-${isTov ? "tone-of-voice" : "klantprofiel"}.docx`;
  // Drive-map van de homepage hergebruiken als die is ingesteld; anders de hoofdmap.
  let folderId = "";
  try { const f = await getPageDriveFolder(slug, base); if (f) folderId = f.folderId; } catch { /* geen map ingesteld */ }
  let link = "", driveError = "";
  try { ({ link } = await uploadDocx(folderId || "root", filename, buffer)); }
  catch (e) { driveError = (e as Error).message; }

  const title = isTov ? `Tone of voice: ${client.name}` : `Klantprofiel: ${client.name}`;
  const klant = isTov
    ? "We hebben de schrijfstijl (tone of voice) van je website geanalyseerd en vastgelegd als richtlijn, zodat alle teksten in jullie eigen stem blijven klinken."
    : "We hebben een klantprofiel opgesteld: wie jullie zijn, jullie expertise, doelgroep en wat jullie onderscheidt. Dit is de basis voor alle SEO-teksten.";
  const taskId = await upsertStepTask(slug, {
    pageUrl: base, stepKind: isTov ? "tov_doc" : "klantprofiel_doc", title,
    link: link || undefined, clientLink: link || undefined, klantToelichting: klant,
    wie: "SEO", fase: "Bouwen", klantZichtbaar: true,
  }).catch(() => null);

  return { ok: true, section: gen.section, taskId, link, driveError };
}

export async function generateProfileSection(slug: string, kind: ProfileKind): Promise<{ ok: true; section: string } | { ok: false; error: string }> {
  const ctx = await gatherSiteContext(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const system = kind === "tov" ? TOV_SYSTEM : PROFILE_SYSTEM;
  const user = `KLANT: ${ctx.name} (${ctx.domain})\n\n${ctx.existing ? `WAT DE STRATEEG AL WEET (bestaand profiel, mag je meenemen):\n${ctx.existing.slice(0, 2000)}\n\n` : ""}LIVE PAGINA'S:\n\n${ctx.pagesText}`;
  try {
    const raw = await callClaude(system, [{ role: "user", content: user }], 2000);
    const section = raw.trim();
    if (!section) return { ok: false, error: "Geen resultaat van de AI." };
    return { ok: true, section };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
