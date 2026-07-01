// Haalt de on-page inhoud van een URL op (titel, meta, H1, koppen, kern van de
// tekst) zodat de chat kan beoordelen of de inhoud bij de zoekintentie past en
// een content-gap kan doen tegen de top-10.

export type PageContent = {
  url: string;
  status: number | null;
  title: string;
  metaDescription: string;
  h1: string;
  headings: string[];
  text: string;
};

function decode(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decode(m[1].replace(/<[^>]*>/g, " ")) : "";
}

export async function fetchPageContent(url: string): Promise<PageContent> {
  const empty: PageContent = { url, status: null, title: "", metaDescription: "", h1: "", headings: [], text: "" };
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { ...empty, status: res.status };
    const html = await res.text();

    const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i).slice(0, 200);
    const metaDescription = decode((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || ["", ""])[1]).slice(0, 300);
    const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).slice(0, 200);
    const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => decode(m[1].replace(/<[^>]*>/g, " "))).filter(Boolean).slice(0, 25);

    // Kern van de tekst: body zonder scripts/styles, koppen en tekst samengevat.
    let body = html.replace(/<head[\s\S]*?<\/head>/i, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "");
    body = decode(body.replace(/<[^>]*>/g, " "));
    const text = body.slice(0, 2000);

    return { url, status: res.status, title, metaDescription, h1, headings, text };
  } catch {
    return empty;
  }
}
