import type { ToolDef } from "./anthropic";
import { ahrefsConfigured, getKeywordsOverview, getSerpOverview, getKeywordIdeas, getUrlOrganicKeywords, getSiteAuthority } from "./ahrefs";
import { fetchPageContent } from "./page-content";
import { readDriveDoc } from "./drive";
import { measurePage } from "./page-measure";

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
    name: "ahrefs_site_authority",
    description: "Domain Rating, aantal verwijzende domeinen en backlinks (Ahrefs). Geef een kaal domein (pingwin.nl) voor site-brede autoriteit, of een volledige pagina-URL (pingwin.nl/seo-bureau/) voor de backlinks van precies die pagina (DR is dan van het domein erachter). Gebruik dit voor de autoriteits-vergelijking (kan de klant realistisch winnen van de top-10?), voor pagina-niveau linkanalyse, en voor uitspraken over linkprofiel. Verzin NOOIT een Domain Rating of aantal referring domains; haal ze hiermee op — ook voor concurrenten uit de top-10.",
    input_schema: { type: "object", properties: { target: { type: "string" } }, required: ["target"] },
  },
  {
    name: "fetch_page_content",
    description: "Haal de echte on-page inhoud van een URL op (titel, meta-description, H1, koppen, kern van de tekst). Gebruik dit om te beoordelen of de inhoud bij de zoekintentie past, en om een content-gap te doen tegen de top-10 (haal ook de inhoud van een paar concurrent-URL's op). Werkt op elke publieke URL.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "lees_document",
    description: "Leest de tekstinhoud van een gekoppeld Google-document (Doc/Sheet/Slides) uit via de Drive-koppeling. Geef een Google-link of document-id. Gebruik dit ALTIJD voor docs.google.com-links (een gewone fetch werkt daar niet); zo kun je aangeleverde copy, blauwdrukken en werkdocumenten echt lezen en vergelijken met de live pagina.",
    input_schema: { type: "object", properties: { link: { type: "string", description: "Google Drive-link of document-id" } }, required: ["link"] },
  },
  {
    name: "check_afbeeldingen_alt",
    description: "Controleert de afbeeldingen van een live pagina: per unieke afbeelding de bestandsnaam en de alt-tekst (of dat die ONTBREEKT). Gebruik dit om alt-tekst-taken te verifiëren of een concrete lijst voor de developer te maken; een gewone fetch geeft die img-informatie niet terug.",
    input_schema: { type: "object", properties: { url: { type: "string", description: "Volledige URL van de pagina" } }, required: ["url"] },
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
  if (name === "ahrefs_site_authority") {
    if (!ahrefsConfigured()) return need();
    const target = typeof input.target === "string" ? input.target : "";
    if (!target) return "Geen doel (domein of URL) opgegeven.";
    return JSON.stringify(await getSiteAuthority(target));
  }
  if (name === "fetch_page_content") {
    const url = typeof input.url === "string" ? input.url : "";
    if (!url) return "Geen URL opgegeven.";
    return JSON.stringify(await fetchPageContent(url));
  }
  if (name === "lees_document") {
    const r = await readDriveDoc(String(input.link || ""));
    if (!r.ok) return `Kon document niet lezen: ${r.error}`;
    return `Document "${r.name}":\n${r.text}`;
  }
  if (name === "check_afbeeldingen_alt") {
    const url = typeof input.url === "string" ? input.url : "";
    if (!url) return "Geen URL opgegeven.";
    const m = await measurePage(url, { staticOnly: true });
    if (!m.ok) return `Pagina niet leesbaar (status ${m.status ?? "?"}).`;
    // Responsive/lazyload-varianten ontdubbelen op basisbestandsnaam.
    const normImg = (f: string) => f.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
    const perBestand = new Map<string, string>();
    for (const img of m.images) {
      const k = normImg(img.file);
      const alt = (img.hasAlt && img.alt.trim()) ? img.alt.trim() : "";
      if (!perBestand.has(k) || (alt && !perBestand.get(k))) perBestand.set(k, alt);
    }
    if (!perBestand.size) return "Geen afbeeldingen gevonden op deze pagina.";
    const regels = [...perBestand.entries()].map(([f, alt]) => `- ${f}: ${alt ? `alt = "${alt}"` : "ALT ONTBREEKT"}`);
    const zonder = regels.filter((r) => r.includes("ALT ONTBREEKT")).length;
    return `${perBestand.size} unieke afbeeldingen, waarvan ${zonder} zonder alt-tekst:\n${regels.join("\n")}`;
  }
  return "Onbekende tool.";
}
