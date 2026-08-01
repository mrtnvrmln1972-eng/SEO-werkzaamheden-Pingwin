import { getSetting, setSetting } from "./settings";
import { callClaudeWebSearch } from "./anthropic";

// ═══════════════════════════════════════════════════════════
// ACTUELE STAND STRUCTURED DATA (maandelijkse check, app-breed)
// ═══════════════════════════════════════════════════════════
// Richtlijnen rond structured data veranderen doorlopend (Google's rich results,
// hoe AI-zoekmachines entiteiten citeren). Deze check onderzoekt via websearch
// wat de laatste stand is en vat samen hoe wij het toepassen. Het resultaat is
// app-breed (geldt voor alle klanten) en wordt getoond bij de kennisbank op de
// Klant-tab. Is de stand ouder dan een maand, dan meldt het panel dat en kan
// hij met één klik ververst worden.
// ═══════════════════════════════════════════════════════════

const KEY = "schema_actueel";
export const VEROUDERD_NA_DAGEN = 31;

export type SchemaActueel = { datum: string; tekst: string; verouderd: boolean };

export async function getSchemaActueel(): Promise<SchemaActueel | null> {
  const raw = await getSetting(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { datum?: string; tekst?: string };
    if (!p.datum || !p.tekst) return null;
    const leeftijd = (Date.now() - new Date(p.datum).getTime()) / 86400000;
    return { datum: p.datum, tekst: p.tekst, verouderd: leeftijd > VEROUDERD_NA_DAGEN };
  } catch { return null; }
}

export async function runSchemaActueel(): Promise<SchemaActueel> {
  const sys = `Je bent technisch SEO-specialist bij bureau Pingwin. Onderzoek via websearch wat er de afgelopen maanden is veranderd rond structured data en hoe het nu gewaardeerd wordt, en vat dat samen als interne "laatste stand" voor het team.
Onderzoek gericht: (1) wijzigingen in Google's rich results en structured data-richtlijnen (gestopte of nieuwe rich result-types, nieuwe verplichte velden), (2) hoe AI-zoekmachines (AI Overviews, ChatGPT, Perplexity) structured data en entity graphs gebruiken bij citeren, (3) relevante wijzigingen in veelgebruikte plugins (Yoast, Rank Math).
OUTPUT: nette markdown in het Nederlands, kort en scanbaar, geen jargonmuur en geen emoji. Exact deze secties:
## Laatste stand (kort)
3-6 bullets met de belangrijkste actuele feiten, elk met maand/jaar erbij.
## Wat dit betekent voor onze aanpak
3-5 bullets: wat wij hierdoor wel of juist niet meer doen in de schema's van klanten.
## Bronnen
Bullets met de gebruikte bronnen (naam + URL).
Geen inleiding of naschrift. Alleen bevestigde informatie uit de zoekresultaten; speculatie weglaten.`;
  const tekst = await callClaudeWebSearch(sys, [{ role: "user", content: `Vandaag is ${new Date().toISOString().slice(0, 10)}. Doe het onderzoek en geef de laatste stand.` }], 3000, { slug: "app", action: "schema-actueel" }, 8);
  const datum = new Date().toISOString();
  await setSetting(KEY, JSON.stringify({ datum, tekst: tekst.trim() }));
  return { datum, tekst: tekst.trim(), verouderd: false };
}
