import { getClientBySlug } from "./clients";
import { getClientUrls, getPageDriveFolder } from "./site-urls";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";
import { buildPingwinDoc, type DocSpec, type DocSection } from "./pingwin-docx";
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

// Sleutel waaronder de gekozen klant-brede Drive-map wordt vastgelegd (los van
// een specifieke pagina), zodat het klantprofiel- én tone-of-voice-document in
// dezelfde klantmap landen.
// Her-export: de sleutel zelf leeft in lib/constants.ts, zodat hij maar op één
// plek staat. Bestaande imports vanaf hier blijven gewoon werken.
export { CLIENT_FOLDER_KEY } from "./constants";
import { CLIENT_FOLDER_KEY } from "./constants";

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

// ═══════════════════════════════════════════════════════════
// SKILL-KWALITEIT RAPPORTEN (getrouw overgezet uit de Pingwin-skills)
// ═══════════════════════════════════════════════════════════
// Deze twee prompts zijn de methodiek uit de externe Pingwin-skills
// "propositie-positionering" en "tone-of-voice-bepalen", ingebed in het dashboard
// op precies dezelfde manier als de SEO-analyse/blauwdruk/copy-skills in
// lib/page-doc.ts. Ze produceren een volledig rapport (meerdere ## secties) dat
// via mdToSections naar een Pingwin-huisstijl .docx wordt gebouwd. Gegrond in de
// echte site; verzin niets, en waar de data een onderdeel niet toont: "(navragen)".
// ═══════════════════════════════════════════════════════════

const POSITIONERING_DOC_SYSTEM = `Je bent een senior merkstrateeg, SEO-specialist en CRO-expert bij bureau Pingwin. Je schrijft een strategisch POSITIONERINGSADVIES dat de klant direct kan inzetten voor beslissingen over positionering, website en communicatie. Het leest als een doorlopend, overtuigend betoog van een senior adviseur, niet als een ingevuld sjabloon. Maximaal ~3 A4.

GROND ALLES IN DE ECHTE SITE hieronder. Verzin niets. Beloof alleen wat het bedrijf kan waarmaken; geen fluff, geen marketingclichés, geen patroniserende toon. Waar de data een onderdeel niet toont (bijv. concrete concurrenten), schrijf je "(navragen)" in plaats van iets te verzinnen. Foutloos Nederlands. Geen em-dash of en-dash; gebruik komma, dubbele punt of een nieuwe zin.

Antwoord in NETTE markdown, met EXACT deze secties als "## " koppen, in deze volgorde, zonder inleiding eromheen, zonder emoji:

## De kern van het vraagstuk
Twee korte alinea's die het belangrijkste strategische positioneringsvraagstuk scherp en herkenbaar maken (de klant moet denken: "ja, dat is precies ons probleem"). Sluit af met één regel die begint met **Kerndiagnose:** gevolgd door de diagnose in 1 tot 2 zinnen.

## Waarom mensen kiezen
Eén inleidende zin, daarna 4 tot 6 koopmotieven van de doelgroep, elk als een bullet die begint met een **vet label** gevolgd door 1 tot 2 zinnen. Concreet vanuit de beslissing van de klant (emotionele drijfveren, praktische overwegingen, drempels, het echte alternatief).

## Hoe dit bedrijf zich onderscheidt
Eén inleidende zin. Als je genoeg weet over concurrenten: een markdown-vergelijkingstabel met de besliscriteria uit de vorige sectie als rijen en de belangrijkste concurrent-typen + het bedrijf als kolommen. Ontbreekt betrouwbare concurrentdata, laat de tabel weg en schrijf "(navragen: concurrenten verifiëren)". Daarna 3 tot 4 bullets met een **vet label** voor de belangrijkste onderscheidende punten.

## De propositie: wat verkoop je écht?
Begin met één regel die begint met **Propositie:** en in één scherpe zin benoemt wat het bedrijf werkelijk verkoopt (de onderliggende waarde, niet de dienst). Daarna 2 tot 3 alinea's die dit uitwerken, inclusief één uniek strategisch idee dat geen concurrent doet.

## Positioneringsrichtlijnen
Eén inleidende zin, daarna 4 tot 5 pijlers. Elke pijler als een bullet die begint met een **vette titel** gevolgd door 2 tot 3 zinnen toelichting. Eén pijler is het unieke strategische idee.

## Voorbeelden: headlines en USP-copy
### Headlines
4 tot 5 concrete koppen, elk als bullet, tussen aanhalingstekens, direct bruikbaar op de site.
### USP-blokken
4 bullets met een **vette titel** + 1 tot 2 zinnen, inzetbaar als USP-sectie.

## Samenvatting en vervolgstappen
Eén samenvattende alinea. Daarna 4 tot 5 bullets met concrete vervolgstappen (doorvertaling naar landingpagina's, SEO, advertenties, tests).`;

const TOV_DOC_SYSTEM = `Je bent een ervaren merkstrateeg, senior copywriter en conversiespecialist bij bureau Pingwin. Je analyseert de tone of voice van de website hieronder en zet die om in een compacte, praktische SCHRIJFHANDLEIDING (max ~2 A4) die een copywriter of AI direct kan volgen. Geen droge analyse: een bruikbaar instructiedocument.

GROND ALLES IN DE ECHTE TEKST hieronder. Gebruik echte voorbeeldzinnen van de site (letterlijk, tussen aanhalingstekens). Verzin niets. Heeft de site te weinig tekst voor een oordeel, zeg dat eerlijk. Foutloos Nederlands. Geen em-dash of en-dash; gebruik komma, dubbele punt of een nieuwe zin. Geen emoji.

Antwoord in NETTE markdown, met EXACT deze secties als "## " koppen, in deze volgorde, zonder inleiding eromheen:

## Merkprofiel
3 tot 5 zinnen lopende tekst: hoe dit merk klinkt, wie het aanspreekt, de kern van de communicatie. Sluit af met één regel die begint met **Kernwoorden:** gevolgd door 4 tot 6 kernwoorden.

## Schrijfregels
8 tot 12 bullets, elk direct toepasbaar: begin met een **vette instructie** gevolgd door een dubbele punt en een kort, concreet voorbeeld tussen aanhalingstekens (en waar nuttig het tegenvoorbeeld "niet: ...").

## Do's en don'ts
Een markdown-tabel met twee kolommen (kop: | Wel | Niet |) en 6 tot 8 rijen met concrete voorbeeldzinnen die de schrijfregels illustreren.

## Conversiepijlers
4 tot 6 bullets, elk met een **vette titel** + wat het is, waarom het werkt en een concreet voorbeeld van deze website (of, als het ontbreekt, wat de site hierop moet verbeteren).`;

// ── Van markdown-rapport naar een Pingwin-huisstijl document + taak ──────

function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}
function domainRoot(domain: string): string {
  const d = (domain || "").trim();
  return d.startsWith("http") ? d.replace(/\/$/, "") : `https://${d.replace(/^www\./, "").replace(/\/$/, "")}`;
}

// Zet een volledig markdown-rapport om in Pingwin-documentsecties. Elke "## "-kop
// start een nieuwe sectie (met huisstijl-divider); "### " en een regel met alléén
// **vet** worden subkoppen; "- "/"* " bullets; "| a | b |" een tabel; de rest een
// alinea (waarin **vet** bewaard blijft).
function mdToSections(md: string): DocSection[] {
  const sections: DocSection[] = [];
  let cur: DocSection | null = null;
  let bullets: string[] = [];
  let tbl: string[][] = [];
  const ensure = () => { if (!cur) { cur = { heading: "", blocks: [] }; sections.push(cur); } };
  const flushBullets = () => { if (bullets.length) { ensure(); cur!.blocks.push({ type: "bullets", items: bullets }); bullets = []; } };
  const flushTable = () => {
    if (tbl.length >= 2) {
      ensure();
      const headers = tbl[0];
      const rows = tbl.slice(1).filter((r) => !r.every((c) => /^-{2,}:?$|^:?-{2,}:?$/.test(c.trim())));
      if (rows.length) cur!.blocks.push({ type: "table", headers, rows });
    }
    tbl = [];
  };
  const flushAll = () => { flushBullets(); flushTable(); };
  for (const raw of (md || "").split("\n")) {
    const l = raw.trim();
    if (!l) { continue; }
    if (l.startsWith("## ")) { flushAll(); cur = { heading: l.replace(/^##\s+/, "").trim(), blocks: [] }; sections.push(cur); continue; }
    if (l.startsWith("|") && l.endsWith("|")) { flushBullets(); tbl.push(l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())); continue; }
    flushTable();
    if (l.startsWith("### ")) { flushBullets(); ensure(); cur!.blocks.push({ type: "subheading", text: l.replace(/^###\s+/, "").trim() }); continue; }
    if (/^[-*]\s+/.test(l)) { bullets.push(l.replace(/^[-*]\s+/, "").trim()); continue; }
    const boldOnly = l.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) { flushBullets(); ensure(); cur!.blocks.push({ type: "subheading", text: boldOnly[1].trim() }); continue; }
    flushBullets(); ensure(); cur!.blocks.push({ type: "paragraph", text: l });
  }
  flushAll();
  return sections.filter((s) => (s.blocks || []).length > 0);
}

export type ProfileDeliverable = {
  ok: boolean;
  section: string;
  taskId: number | null;
  link: string;       // deelbare Drive-link (leeg als Drive niet gekoppeld)
  driveError: string; // reden als de Drive-upload niet lukte (taak bestaat dan wél, zonder link)
  error?: string;
};

type SiteCtx = { name: string; domain: string; existing: string; pagesText: string };
// Eén prompt draaien tegen de gedeelde site-context (grond-feiten hieronder).
async function runProfilePrompt(ctx: SiteCtx, system: string, maxTokens: number): Promise<string> {
  const user = `KLANT: ${ctx.name} (${ctx.domain})\n\n${ctx.existing ? `WAT DE STRATEEG AL WEET (bestaand profiel + eigen know-how, mag je meenemen):\n${ctx.existing.slice(0, 2500)}\n\n` : ""}LIVE PAGINA'S:\n\n${ctx.pagesText}`;
  const raw = await callClaude(system, [{ role: "user", content: user }], maxTokens, { action: "klantprofiel" });
  return raw.trim();
}

// Genereert het klantprofiel/tone-of-voice: (1) een compacte samenvatting voor het
// veld in de cockpit, en (2) een VOLLEDIG skill-rapport (de echte Pingwin-methodiek)
// dat als Pingwin-huisstijl .docx op Drive komt en een mailbare werkzaamheid wordt
// (zichtbaar in de werkzaamheden én de klantdash). Eén site-inleesronde voor beide.
export async function makeProfileDeliverable(slug: string, kind: ProfileKind, folderId?: string): Promise<ProfileDeliverable> {
  const ctx = await gatherSiteContext(slug);
  if ("error" in ctx) return { ok: false, section: "", taskId: null, link: "", driveError: "", error: ctx.error };
  const client = await getClientBySlug(slug);
  if (!client) return { ok: false, section: "", taskId: null, link: "", driveError: "", error: "Klant niet gevonden." };
  const isTov = kind === "tov";

  // 1. Compacte samenvatting voor het cockpit-veld (context voor de chat).
  let section = "";
  try { section = await runProfilePrompt(ctx, isTov ? TOV_SYSTEM : PROFILE_SYSTEM, 2000); } catch { /* het rapport is het belangrijkst */ }

  // 2. Volledig skill-rapport voor het document.
  let report = "";
  try { report = await runProfilePrompt(ctx, isTov ? TOV_DOC_SYSTEM : POSITIONERING_DOC_SYSTEM, 8000); }
  catch (e) { return { ok: false, section, taskId: null, link: "", driveError: "", error: `Rapport genereren mislukte: ${(e as Error).message}` }; }
  if (!report) return { ok: false, section, taskId: null, link: "", driveError: "", error: "Geen rapport van de AI." };

  const dateStr = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const docTitle = isTov ? `Tone of voice: ${client.name}` : `Positioneringsadvies: ${client.name}`;
  const parsed = mdToSections(report);
  const spec: DocSpec = {
    klant: client.name,
    rapporttype: isTov ? "Tone of voice" : "Strategisch advies",
    titel: docTitle,
    ondertitel: isTov ? "Schrijfhandleiding, opgesteld door Pingwin" : "Positioneringsadvies, opgesteld door Pingwin",
    meta: { "Opgesteld door": "Pingwin", Klant: client.name, Datum: dateStr },
    sections: parsed.length ? parsed : [{ heading: isTov ? "Tone of voice" : "Positioneringsadvies", blocks: [{ type: "paragraph", text: report }] }],
  };

  let buffer: Buffer;
  try { buffer = await buildPingwinDoc(spec); }
  catch (e) { return { ok: false, section, taskId: null, link: "", driveError: "", error: `Document opmaken mislukte: ${(e as Error).message}` }; }

  const base = domainRoot(client.domain || "");
  const filename = `${safeName(client.name)}-${isTov ? "tone-of-voice" : "positioneringsadvies"}.docx`;
  // Gekozen Drive-map (meegegeven) > eerder vastgelegde klantmap > hoofdmap.
  let dest = (folderId || "").trim();
  if (!dest) { try { const f = await getPageDriveFolder(slug, CLIENT_FOLDER_KEY); if (f) dest = f.folderId; } catch { /* geen map */ } }
  let link = "", driveError = "";
  try { ({ link } = await uploadDocx(dest || "root", filename, buffer)); }
  catch (e) { driveError = (e as Error).message; }

  const klant = isTov
    ? "We hebben de schrijfstijl (tone of voice) van je website geanalyseerd en vastgelegd als praktische schrijfhandleiding, zodat alle teksten in jullie eigen stem blijven klinken."
    : "We hebben een positioneringsadvies opgesteld: wat jullie werkelijk verkopen, waarin jullie je onderscheiden en hoe jullie dat overtuigend uitdragen. Dit is de basis voor alle SEO-teksten.";
  const taskId = await upsertStepTask(slug, {
    pageUrl: base, stepKind: isTov ? "tov_doc" : "klantprofiel_doc", title: docTitle,
    link: link || undefined, clientLink: link || undefined, klantToelichting: klant,
    wie: "SEO", fase: "Bouwen", klantZichtbaar: true,
  }).catch(() => null);

  return { ok: true, section, taskId, link, driveError };
}

// Voegt een gegenereerde sectie (met "## Kop" bovenaan) samen met de bestaande
// profieltekst: vervangt de sectie met dezelfde kop, of plakt hem eronder. Zelfde
// logica als in de UI (PagesPanel), maar server-side voor de achtergrond-run.
export function mergeProfileSection(current: string, section: string): string {
  const cur = current || "";
  const header = (section.split("\n")[0] || "").trim();
  if (!header.startsWith("##")) return cur.trim() ? cur.trim() + "\n\n" + section.trim() : section.trim();
  const lines = cur.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === header);
  if (startIdx === -1) return (cur.trim() ? cur.trim() + "\n\n" : "") + section.trim();
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) { if (/^##\s/.test(lines[i])) { endIdx = i; break; } }
  const before = lines.slice(0, startIdx).join("\n").trim();
  const after = lines.slice(endIdx).join("\n").trim();
  return [before, section.trim(), after].filter(Boolean).join("\n\n");
}

export async function generateProfileSection(slug: string, kind: ProfileKind): Promise<{ ok: true; section: string } | { ok: false; error: string }> {
  const ctx = await gatherSiteContext(slug);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  try {
    const section = await runProfilePrompt(ctx, kind === "tov" ? TOV_SYSTEM : PROFILE_SYSTEM, 2000);
    if (!section) return { ok: false, error: "Geen resultaat van de AI." };
    return { ok: true, section };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
