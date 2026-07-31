// Eén gedeelde sleutel om URL's te vergelijken (weekplan-kaart vs Pagina's-lijst).
// Bewust simpel: protocol, www., trailing slash en hoofdletters doen er niet toe.
export function urlKey(u: string): string {
  return (u || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}
