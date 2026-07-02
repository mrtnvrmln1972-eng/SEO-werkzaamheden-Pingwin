// ═══════════════════════════════════════════════════════════
// PAGINA-METING: exact uitmeten wat er op een live pagina staat,
// zodat de SEO-analyse/blauwdruk/copy tegen HARDE waarden scoort
// (zoals de Cowork-skill met een echte browser doet) in plaats van
// te schatten. Werkt op de gerenderde HTML (headless browser indien
// beschikbaar, anders de statische HTML — prima voor server-gerenderde
// sites zoals WordPress).
// ═══════════════════════════════════════════════════════════

import { renderHtml } from "./render-page";

export type MeasuredImage = { file: string; alt: string; altLength: number; hasAlt: boolean; format: string; hasDimensions: boolean; loading: string };
export type MeasuredLink = { href: string; text: string };
export type PageMeasurement = {
  ok: boolean;
  status: number | null;
  rendered: boolean; // via headless browser gerenderd?
  metaTitle: string; titleLength: number;
  metaDescription: string; descriptionLength: number;
  canonical: string; robots: string; viewport: string;
  ogTitle: string; ogDescription: string; ogImage: string;
  h1: string[]; h2: string[]; h3: string[];
  wordCount: number;
  images: MeasuredImage[]; imagesWithoutAlt: number; imagesNonWebp: number;
  internalLinks: MeasuredLink[]; internalLinkCount: number; externalLinkCount: number;
  schemaTypes: string[];
  faqDetected: boolean; faqCount: number;
};

const decode = (s: string) => (s || "")
  .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

function tags(html: string, tag: string, limit: number): string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((m) => decode(m[1])).filter(Boolean).slice(0, limit);
}
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : "";
}
function metaContent(html: string, key: string, kind: "name" | "property"): string {
  const re1 = new RegExp(`<meta[^>]+${kind}=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${kind}=["']${key}["']`, "i");
  return decode((html.match(re1) || html.match(re2) || ["", ""])[1]);
}

export async function measurePage(url: string, opts?: { staticOnly?: boolean }): Promise<PageMeasurement> {
  const empty: PageMeasurement = {
    ok: false, status: null, rendered: false, metaTitle: "", titleLength: 0, metaDescription: "", descriptionLength: 0,
    canonical: "", robots: "", viewport: "", ogTitle: "", ogDescription: "", ogImage: "",
    h1: [], h2: [], h3: [], wordCount: 0, images: [], imagesWithoutAlt: 0, imagesNonWebp: 0,
    internalLinks: [], internalLinkCount: 0, externalLinkCount: 0, schemaTypes: [], faqDetected: false, faqCount: 0,
  };

  // 1. Gerenderde HTML (headless browser) indien beschikbaar; anders statisch.
  // staticOnly slaat de browser over (voor concurrent-pagina's: snel, geen latency).
  const r = opts?.staticOnly ? { html: "", status: null as number | null, rendered: false } : await renderHtml(url);
  let html = r.html, status = r.status, rendered = r.rendered;
  if (!html) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 PingwinBot" } });
      status = res.status;
      if (res.ok) html = await res.text();
    } catch { /* laat leeg */ } finally { clearTimeout(t); }
    rendered = false;
  }
  if (!html) return { ...empty, status };

  const metaTitle = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]);
  const metaDescription = metaContent(html, "description", "name");
  let host = ""; try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* */ }

  // Afbeeldingen: alt, formaat, dimensies, lazy-loading.
  const images: MeasuredImage[] = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const src = attr(m[0], "src"), file = (src.split("?")[0].split("/").pop() || src).slice(0, 120);
    const alt = decode(attr(m[0], "alt"));
    const ext = (file.split(".").pop() || "").toLowerCase();
    return { file, alt, altLength: alt.length, hasAlt: /\balt\s*=/.test(m[0]), format: ext, hasDimensions: /\bwidth\s*=/.test(m[0]) && /\bheight\s*=/.test(m[0]), loading: attr(m[0], "loading") || "default" };
  }).filter((i) => i.file).slice(0, 150);

  // Interne + externe links.
  let externalLinkCount = 0;
  const internalLinks: MeasuredLink[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].split("#")[0], text = decode(m[2]).slice(0, 120);
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    let internal = href.startsWith("/");
    if (!internal) { try { internal = new URL(href).host.replace(/^www\./, "") === host; } catch { continue; } }
    if (internal) { if (internalLinks.length < 200) internalLinks.push({ href, text }); }
    else externalLinkCount++;
  }

  // Body-tekst (voor woordtelling en density).
  const bodyText = decode((html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i) || ["", html])[1]
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  // Schema-types uit JSON-LD.
  const schemaSet = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o: unknown) => {
        if (Array.isArray(o)) o.forEach(walk);
        else if (o && typeof o === "object") {
          const t = (o as Record<string, unknown>)["@type"];
          if (typeof t === "string") schemaSet.add(t); else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaSet.add(x));
          Object.values(o as Record<string, unknown>).forEach(walk);
        }
      };
      walk(JSON.parse(m[1].trim()));
    } catch { /* ongeldige JSON-LD */ }
  }

  const h2 = tags(html, "h2", 40), h3 = tags(html, "h3", 60);
  // FAQ-detectie: kop met "veelgestelde vragen"/"faq" + het aantal vraag-koppen erna.
  const faqHeading = [...h2, ...h3].some((h) => /veelgestelde vragen|faq|vraag en antwoord/i.test(h));
  const faqCount = [...h2, ...h3].filter((h) => /\?$/.test(h.trim())).length;

  return {
    ok: true, status, rendered,
    metaTitle, titleLength: metaTitle.length, metaDescription, descriptionLength: metaDescription.length,
    canonical: attr((html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [""])[0] || "", "href"),
    robots: metaContent(html, "robots", "name") || "default",
    viewport: metaContent(html, "viewport", "name"),
    ogTitle: metaContent(html, "og:title", "property"), ogDescription: metaContent(html, "og:description", "property"), ogImage: metaContent(html, "og:image", "property"),
    h1: tags(html, "h1", 5), h2, h3, wordCount,
    images, imagesWithoutAlt: images.filter((i) => !i.hasAlt || !i.alt).length, imagesNonWebp: images.filter((i) => i.format && !["webp", "avif", "svg"].includes(i.format)).length,
    internalLinks, internalLinkCount: internalLinks.length, externalLinkCount,
    schemaTypes: [...schemaSet].sort(),
    faqDetected: faqHeading, faqCount: faqHeading ? Math.max(faqCount, 1) : faqCount,
  };
}

// Meet de top-concurrenten uit de SERP statisch uit (snel, geen browser) zodat de
// analyse concreet kan vergelijken met wat de winnende pagina's WEL doen: hun
// omvang, koppen, FAQ en schema. Dit is de "wat mist"-grounding zoals Cowork die
// uit de SERP-top haalt. Max een handjevol, parallel.
export async function measureCompetitors(urls: string[], limit = 3): Promise<{ url: string; m: PageMeasurement }[]> {
  const pick = urls.filter(Boolean).slice(0, limit);
  const out = await Promise.all(pick.map(async (u) => ({ url: u, m: await measurePage(u, { staticOnly: true }).catch(() => null) })));
  return out.filter((x): x is { url: string; m: PageMeasurement } => !!x.m && x.m.ok);
}

export function competitorsToText(rows: { url: string; m: PageMeasurement }[]): string {
  if (!rows.length) return "TOP-CONCURRENTEN (inhoud): niet gemeten.";
  return ["TOP-CONCURRENTEN — wat de best scorende pagina's WEL op de pagina hebben (vergelijk hiermee bij 'wat mist' en zet hier de H2-doelen op):",
    ...rows.map((r, i) => `${i + 1}. ${r.url}\n   - ${r.m.wordCount} woorden; H1: "${r.m.h1[0] || "?"}"; ${r.m.h2.length} H2's: ${r.m.h2.slice(0, 12).map((h) => `"${h}"`).join(" | ") || "geen"}\n   - FAQ: ${r.m.faqDetected ? `ja (~${r.m.faqCount})` : "nee"}; schema: ${r.m.schemaTypes.join(", ") || "geen"}; interne links: ${r.m.internalLinkCount}`)].join("\n");
}

// Formatteert de meting + berekende waarden tot een blok voor de AI, zodat die
// per criterium tegen echte, gemeten waarden scoort (geen schatting).
export function measureToText(m: PageMeasurement, primaryKeyword: string): string {
  if (!m.ok) return "GEMETEN PAGINA-PROFIEL: kon de pagina niet uitlezen (mogelijk niet bereikbaar).";
  const kw = (primaryKeyword || "").toLowerCase().trim();
  const root = kw.split(/\s+/)[0] || kw;
  const inHeadings = (arr: string[]) => arr.filter((h) => kw && (h.toLowerCase().includes(kw) || (root && h.toLowerCase().includes(root)))).length;
  const h2hits = inHeadings(m.h2);
  const h2cov = m.h2.length ? Math.round((h2hits / m.h2.length) * 100) : 0;
  const density = m.wordCount && kw ? Math.round(((m.metaTitle + " " + m.h1.join(" ") + " " + m.h2.join(" ")).toLowerCase().split(kw).length - 1) / m.wordCount * 10000) / 100 : 0;
  return [
    `GEMETEN PAGINA-PROFIEL (${m.rendered ? "via headless browser gerenderd" : "statische HTML"}, HTTP ${m.status}). Score de criteria tegen DEZE gemeten waarden:`,
    `- Meta title: "${m.metaTitle}" (${m.titleLength} tekens; norm 50-60). Primair zoekwoord in eerste 30 tekens: ${m.metaTitle.slice(0, 30).toLowerCase().includes(root) ? "ja" : "nee"}.`,
    `- Meta description: "${m.metaDescription}" (${m.descriptionLength} tekens; norm 140-160).`,
    `- H1 (${m.h1.length}x, norm exact 1): ${m.h1.length ? m.h1.map((h) => `"${h}"`).join(" / ") : "GEEN H1"}.`,
    `- H2's (${m.h2.length}, norm 4-12): ${m.h2.map((h) => `"${h}"`).join(" | ") || "geen"}. H2-dekking op zoekwoord/variant: ${h2cov}% (${h2hits}/${m.h2.length}; norm 60-80%).`,
    `- H3's (${m.h3.length}): ${m.h3.slice(0, 20).map((h) => `"${h}"`).join(" | ") || "geen"}.`,
    `- Woordenaantal: ${m.wordCount}. Geschatte keyword-density primair: ${density}% (norm 0,5-2%).`,
    `- Interne links in de body: ${m.internalLinkCount} (norm >=5, competitief >=15). Voorbeelden: ${m.internalLinks.slice(0, 10).map((l) => `"${l.text || l.href}" -> ${l.href}`).join("; ") || "geen"}. Externe links: ${m.externalLinkCount}.`,
    `- Afbeeldingen: ${m.images.length} totaal; zonder alt-tekst: ${m.imagesWithoutAlt}; niet-WebP/AVIF: ${m.imagesNonWebp}. Alt-teksten: ${m.images.slice(0, 15).map((i) => `${i.file}="${i.alt || "(leeg)"}"`).join("; ") || "geen"}.`,
    `- Schema-types (JSON-LD): ${m.schemaTypes.join(", ") || "GEEN"}.`,
    `- FAQ-sectie aanwezig: ${m.faqDetected ? `ja (~${m.faqCount} vragen; norm 4-8)` : "nee"}.`,
    `- Canonical: ${m.canonical || "ontbreekt"}. Robots: ${m.robots}. Viewport: ${m.viewport || "ontbreekt"}. Open Graph: ${m.ogTitle || m.ogImage ? "aanwezig" : "ontbreekt"}.`,
  ].join("\n");
}
