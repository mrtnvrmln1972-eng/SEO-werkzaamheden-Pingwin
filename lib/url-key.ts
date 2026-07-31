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

// Kleine bewerkingsafstand (Levenshtein), begrensd; genoeg voor enkelvoud/meervoud.
function afstand(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  const rij = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let vorige = rij[0];
    rij[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = rij[j];
      rij[j] = Math.min(rij[j] + 1, rij[j - 1] + 1, vorige + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorige = tmp;
    }
  }
  return rij[n];
}

// Zoekt voor een (mogelijk door de AI gevormd) pad de dichtstbijzijnde ECHTE URL
// uit de bekende lijst: zelfde bovenliggende map en het laatste segment op hooguit
// twee tekens na gelijk (dekt enkelvoud/meervoud, zoals edof-lens vs edof-lenzen).
// Geen overtuigende match: null (kan een bewust nieuwe pagina zijn).
export function nearestKnownUrl(kandidaat: string, bekendeUrls: string[]): string | null {
  const kKey = urlKey(kandidaat);
  if (!kKey) return null;
  if (bekendeUrls.some((u) => urlKey(u) === kKey)) return null; // bestaat al exact
  const kDelen = kKey.split("/");
  const kLaatste = kDelen.pop() || "";
  const kMap = kDelen.join("/");
  let beste: { url: string; d: number } | null = null;
  for (const u of bekendeUrls) {
    const uKey = urlKey(u);
    const uDelen = uKey.split("/");
    const uLaatste = uDelen.pop() || "";
    if (uDelen.join("/") !== kMap) continue;
    const d = afstand(kLaatste, uLaatste, 3);
    if (d > 0 && d <= 2 && (!beste || d < beste.d)) beste = { url: u, d };
  }
  return beste ? beste.url : null;
}
