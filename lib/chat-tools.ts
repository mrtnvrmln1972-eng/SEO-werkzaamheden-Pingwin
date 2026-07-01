import type { ToolDef } from "./anthropic";
import { ahrefsConfigured, getKeywordsOverview, getSerpOverview } from "./ahrefs";

// Gereedschap dat de chat zelf mag inschakelen wanneer het nuttig is.
export const CHAT_TOOLS: ToolDef[] = [
  {
    name: "ahrefs_keyword_volume",
    description: "Haal het echte maandelijkse zoekvolume, keyword difficulty en CPC op uit Ahrefs voor één of meer zoekwoorden (standaard Nederland). Gebruik dit wanneer je absoluut zoekvolume nodig hebt om een zoekterm te kiezen, kandidaten te vergelijken, of om te toetsen of een term genoeg vraag heeft. Batch meerdere zoekwoorden in één aanroep.",
    input_schema: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" }, description: "De zoekwoorden om op te zoeken" },
        country: { type: "string", description: "ISO-landcode, standaard 'nl'" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "ahrefs_serp_top10",
    description: "Haal de top-10 organische zoekresultaten (positie, URL, titel, domain rating) op uit Ahrefs voor één zoekwoord (standaard Nederland). Gebruik dit voor een top-10-analyse: wie ranken er, wat voor pagina's zijn dat, hoe sterk zijn de concurrenten, en of de zoekintentie past bij de pagina.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Het zoekwoord voor de SERP-analyse" },
        country: { type: "string", description: "ISO-landcode, standaard 'nl'" },
      },
      required: ["keyword"],
    },
  },
];

export async function runChatTool(name: string, input: Record<string, unknown>): Promise<string> {
  const country = typeof input.country === "string" && input.country ? input.country : "nl";
  if (name === "ahrefs_keyword_volume") {
    if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld (AHREFS_API_TOKEN ontbreekt in Vercel).";
    const keywords = Array.isArray(input.keywords) ? (input.keywords as string[]) : [];
    if (keywords.length === 0) return "Geen zoekwoorden opgegeven.";
    const rows = await getKeywordsOverview(keywords, country);
    return JSON.stringify(rows);
  }
  if (name === "ahrefs_serp_top10") {
    if (!ahrefsConfigured()) return "Ahrefs is niet gekoppeld (AHREFS_API_TOKEN ontbreekt in Vercel).";
    const keyword = typeof input.keyword === "string" ? input.keyword : "";
    if (!keyword) return "Geen zoekwoord opgegeven.";
    const rows = await getSerpOverview(keyword, country);
    return JSON.stringify(rows);
  }
  return "Onbekende tool.";
}
