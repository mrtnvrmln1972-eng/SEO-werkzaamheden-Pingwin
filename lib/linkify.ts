// Maakt kale URL's én kale paden/slugs (bijv. /hovenier/etten-leur/) automatisch
// klikbaar naar de live site, zonder bestaande links dubbel te linken. Werkt op de
// gerenderde HTML: alleen tekst buiten tags en bestaande <a>-links wordt aangeraakt.
// Eén gedeelde bron (harde opmaakregel: elke link/slug klikbaar, overal).
export function linkifyHtml(html: string, domain: string): string {
  const base = (domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  // Wat binnen <code> of <pre> staat is code om te lezen, geen adres om heen te
  // gaan: een @id als `https://site.nl/#organization` is een naam, geen pagina.
  // Zonder deze uitzondering werd zo'n stukje code alsnog een blauwe link.
  const parts = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<code\b[^>]*>[\s\S]*?<\/code>|<pre\b[^>]*>[\s\S]*?<\/pre>|<[^>]+>)/gi);
  return parts.map((seg, i) => {
    if (i % 2 === 1 || !seg) return seg; // een tag of bestaande link: niet aanraken
    let s = seg.replace(/(https?:\/\/[^\s<>"()]+[^\s<>"().,;:!?])/g, (m) => `<a href="${m}" target="_blank" rel="noreferrer">${m}</a>`);
    if (base) s = s.replace(/(^|[\s(>])(\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*\/)/gi, (_m, pre, path) => `${pre}<a href="https://${base}${path}" target="_blank" rel="noreferrer">${path}</a>`);
    return s;
  }).join("");
}
