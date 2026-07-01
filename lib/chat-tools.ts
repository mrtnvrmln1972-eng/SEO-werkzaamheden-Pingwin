import type { ToolDef } from "./anthropic";
import { ahrefsConfigured, getKeywordsOverview, getSerpOverview, getKeywordIdeas, getUrlOrganicKeywords } from "./ahrefs";
import { fetchPageContent } from "./page-content";

// Gereedschap dat de chat zelf mag inschakelen wanneer het nuttig is.
export const CHAT_TOOLS: ToolDef[] = [
  {
    name: "ahrefs_keyword_volume",
    description: "Echt maandelijks zoekvolume, keyword difficulty, CPC én zoekintentie (informationeel/commercieel/transactioneel/navigationeel) uit Ahrefs voor één of meer zoekwoorden (standaard NL). Gebruik dit om een zoekterm te kiezen, kandidaten te vergelijken, vraag te toetsen, en intentie aan paginatype te koppelen. Batch meerdere zoekwoorden in één aanroep.",
    input_schema: { type: "object", properties: { keywords: { type: "array", items: { type: "string" } }, country: { type: "string" } }, required: ["keywords"] },
  },
  {
    name: "ahrefs_serp_top10",
    description: "Top-10 organische resultaten (positie, URL, titel, domain rating) uit Ahrefs voor één zoekwoord (standaard NL). Gebruik voor een top-10-analyse: wie ranken er, wat voor pagina's, hoe sterk de concurrenten, en welke zoekintentie de SERP toont. Roep dit ook voor twee zoekwoorden aan om SERP-overlap te bepalen (>50% zelfde URL's = zelfde intentie, samenvoegen).",
    input_schema: { type: "object", properties: { keyword: { type: "string" }, country: { type: "string" } }, required: ["keyword"] },
  },
  {
    name: "ahrefs_keyword_ideas",
    description: "Zoekwoord-ideeën (passende termen) rond een zaad-zoekwoord uit Ahrefs, met volume en difficulty (standaard NL). Gebruik om termen te vinden waar de klant nog NIET op rankt, en om de beste primaire/secundaire zoekwoorden uit een bredere set te kiezen.",
    input_schema: { type: "object", properties: { seed: { type: "string" }, country: { type: "string" } }, required: ["seed"] },
  },
  {
    name: "ahrefs_url_organic_keywords",
    description: "De zoekwoorden waarop een specifieke URL organisch rankt (positie, volume, verkeer) uit Ahrefs. Gebruik voor de eigen pagina, of voor een concurrent-URL uit de top-10, om een content-gap te vinden: waar rankt de concurrent op dat wij missen?",
    input_schema: { type: "object", properties: { url: { type: "string" }, country: { type: "string" } }, required: ["url"] },
  },
  {
    name: "fetch_page_content",
    description: "Haal de echte on-page inhoud van een URL op (titel, meta-description, H1, koppen, kern van de tekst). Gebruik dit om te beoordelen of de inhoud bij de zoekintentie past, en om een content-gap te doen tegen de top-10 (haal ook de inhoud van een paar concurrent-URL's op). Werkt op elke publieke URL.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

export async function runChatTool(name: string, input: Record<string, unknown>): Promise<string> {
  const country = typeof input.country === "string" && input.country ? input.country : "nl";
  const need = (): string => "Ahrefs is niet gekoppeld (AHREFS_API_TOKEN ontbreekt in Vercel).";
  if (name === "ahrefs_keyword_volume") {
    if (!ahrefsConfigured()) return need();
    const keywords = Array.isArray(input.keywords) ? (input.keywords as string[]) : [];
    if (keywords.length === 0) return "Geen zoekwoorden opgegeven.";
    return JSON.stringify(await getKeywordsOverview(keywords, country));
  }
  if (name === "ahrefs_serp_top10") {
    if (!ahrefsConfigured()) return need();
    const keyword = typeof input.keyword === "string" ? input.keyword : "";
    if (!keyword) return "Geen zoekwoord opgegeven.";
    return JSON.stringify(await getSerpOverview(keyword, country));
  }
  if (name === "ahrefs_keyword_ideas") {
    if (!ahrefsConfigured()) return need();
    const seed = typeof input.seed === "string" ? input.seed : "";
    if (!seed) return "Geen zaad-zoekwoord opgegeven.";
    return JSON.stringify(await getKeywordIdeas(seed, country));
  }
  if (name === "ahrefs_url_organic_keywords") {
    if (!ahrefsConfigured()) return need();
    const url = typeof input.url === "string" ? input.url : "";
    if (!url) return "Geen URL opgegeven.";
    return JSON.stringify(await getUrlOrganicKeywords(url, country));
  }
  if (name === "fetch_page_content") {
    const url = typeof input.url === "string" ? input.url : "";
    if (!url) return "Geen URL opgegeven.";
    return JSON.stringify(await fetchPageContent(url));
  }
  return "Onbekende tool.";
}
