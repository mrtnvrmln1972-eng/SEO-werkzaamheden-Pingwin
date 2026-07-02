import { getClientBySlug } from "./clients";
import { getClientUrls } from "./site-urls";
import { fetchPageContent } from "./page-content";
import { callClaude } from "./anthropic";

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
