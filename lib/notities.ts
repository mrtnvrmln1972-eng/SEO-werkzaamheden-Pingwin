import { sql } from "./db";
import { htmlNaarTekst } from "./veilige-html";

// ═══════════════════════════════════════════════════════════
// NOTITIES ALS KLANTKENNIS
// ═══════════════════════════════════════════════════════════
// Wat Maarten in een notitie plakt (een telefoontje, een afspraak, iets wat hij
// bij een concurrent zag) telt mee als achtergrond over die klant. Deze functie
// zet de notities om naar leesbare tekst voor een prompt, met de titel erboven
// zodat het model weet waar iets vandaan komt.
//
// Geen notities = lege string, zodat er dan ook geen leeg blok in de prompt
// belandt en het gedrag exact blijft zoals het was.

const MAX = 6000;

export async function notitiesTekst(slug: string, max = MAX): Promise<string> {
  let rows: Record<string, unknown>[] = [];
  try {
    const r = await sql`
      SELECT titel, inhoud, updated_at FROM client_notes
      WHERE client_slug = ${slug} AND status <> 'weg'
      ORDER BY id DESC`;
    rows = r.rows;
  } catch {
    return "";  // tabel bestaat nog niet (nog nooit een notitie gemaakt)
  }
  const stukken: string[] = [];
  let lengte = 0;
  for (const r of rows) {
    const tekst = htmlNaarTekst(String(r.inhoud || "")).trim();
    if (!tekst) continue;
    const titel = String(r.titel || "").trim() || "Notitie";
    const datum = r.updated_at ? new Date(r.updated_at as string).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";
    const blok = `--- ${titel}${datum ? ` (${datum})` : ""} ---\n${tekst}`;
    if (lengte + blok.length > max) break;   // nieuwste eerst; de oudste vallen af
    stukken.push(blok);
    lengte += blok.length;
  }
  return stukken.join("\n\n");
}
