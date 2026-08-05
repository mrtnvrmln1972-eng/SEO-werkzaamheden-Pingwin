// ═══════════════════════════════════════════════════════════
// SAMENVOEGEN IS EEN DENKSTAP, GEEN PLAKSTAP
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: als er nieuwe informatie bij een bestaande paginakaart kwam,
// werden de titel en de toelichting van het nieuwe punt er als bullets achteraan
// geplakt. De enige controle op dubbelingen was of een regel LETTERLIJK gelijk was.
// Anders geformuleerd betekende dus: nieuwe regel. Zo stond er in één kaart drie
// keer hetzelfde in andere woorden, twee keer de eigen kaarttitel als bullet, en
// twee verschillende metingen van dezelfde pagina naast elkaar (positie 27.9 met
// 869 vertoningen én positie 30.1 met 615 vertoningen).
//
// Deze opruiming bestond al als handmatige knop "Ruim op" per kaart. Nu draait hij
// automatisch zodra er iets in een bestaande kaart wordt samengevoegd, want dat is
// precies het moment waarop de rommel ontstaat.
//
// Harde regel in de opdracht: NIETS inhoudelijks weggooien. Alleen dubbelingen,
// herhaling van de titel, en bij tegenstrijdige cijfers het verouderde getal.

import { sql, ensureSchema } from "./db";
import { callClaude, anthropicConfigured } from "./anthropic";
import { updateWeekplanToelichting } from "./weekplan";

export function tidySystemPrompt(taak: string, url?: string | null): string {
  return [
    `Je ruimt de infotekst van een SEO-projectkaart op. De kaart heet: "${taak}"${url ? ` en gaat over de pagina ${url}` : ""}.`,
    `Herschrijf de tekst naar EXACT dit formaat, in gewone platte tekst:`,
    `Achtergrond:`,
    `- korte puntige regels met alleen KENNIS: cijfers, herkomst, positionering, cannibalisatie-nuance, stand van zaken (elk punt hooguit vijftien woorden)`,
    `Afspraken en herkomst:`,
    `- '-'-bullets met mails (datum, wie), referenties, en instructies die over een ANDERE pagina gaan (met het pad erbij); deze sectie weglaten als hij leeg is`,
    `Aanpak per fase:`,
    `- '-'-bullets die beginnen met exact een fasenaam en dubbele punt: Analyse:, Blauwdruk:, Copy:, Bouw:, Structured data: (alleen fases die nodig zijn; meta-title/description hoort bij Copy, alt-teksten en interne links bij Bouw)`,
    `Regels: verzin NIETS en gooi NIETS inhoudelijks weg; alleen dubbelingen en herhaling van de kaarttitel mogen vervallen.`,
    `DUBBELINGEN: dezelfde constatering in andere woorden is een dubbeling. Houd er één over, de meest volledige.`,
    `TEGENSTRIJDIGE CIJFERS: staan er twee metingen van dezelfde pagina (bijvoorbeeld twee posities of twee aantallen vertoningen), houd dan ALLEEN de laatste aan, dat is de regel die het verst naar onder staat. Nooit allebei laten staan.`,
    `BEGRENZING: hooguit VIER regels onder Achtergrond. Kies de vier die iemand echt nodig heeft om deze klus te doen; laat de rest weg alleen als hij elders al staat, en verzin niets nieuws.`,
    `PER FASE ÉÉN REGEL: staan er meerdere instructies voor dezelfde fase, voeg die samen tot één regel zonder informatie te verliezen.`,
    `Elke instructie hoort bij precies één fase-regel, niet ook nog in Achtergrond. Geen Markdown-symbolen (#, | of **), geen emoji, geen tekst buiten dit formaat.`,
  ].join("\n");
}

/**
 * Ruimt de tekst van één kaart op. Geeft de nieuwe tekst terug, of null als er
 * niets te doen viel of de assistent niet meewerkte. Bij twijfel verandert er
 * niets: een halve opruiming is erger dan rommel.
 */
export async function tidyCard(slug: string, id: number): Promise<string | null> {
  if (!anthropicConfigured()) return null;
  await ensureSchema();
  const { rows } = await sql`SELECT taak, toelichting, url FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const rij = rows[0];
  if (!rij) return null;
  const oud = ((rij.toelichting as string) || "").trim();
  if (oud.length < 40) return null;

  try {
    const nieuw = (await callClaude(
      tidySystemPrompt(String(rij.taak || ""), rij.url as string | null),
      [{ role: "user", content: oud }],
      1500,
      { slug, action: "weekplan_tidy_merge" },
    )).trim();
    // Vangrail tegen een mislukt antwoord. Bewust NIET op lengte-verhouding: het
    // opruimen mag een kaart van 29 regels naar 4 brengen, dus een ratio-drempel
    // zou juist de geslaagde opruimingen weigeren. In plaats daarvan kijken we of
    // het formaat er nog staat: zonder "Achtergrond:"-kop is het geen opruiming
    // maar iets anders, en dan blijft de oude tekst staan.
    if (!nieuw || nieuw.length < 60) return null;
    if (!/^\s*achtergrond\s*:/im.test(nieuw)) return null;
    // Ging het origineel over fases, dan horen die er ook nog in te staan.
    if (/aanpak per fase/i.test(oud) && !/aanpak per fase/i.test(nieuw)) return null;
    await updateWeekplanToelichting(slug, id, nieuw);
    return nieuw;
  } catch {
    return null;
  }
}

/** Ruimt meerdere kaarten op, één voor één. Fouten per kaart worden genegeerd. */
export async function tidyCards(slug: string, ids: number[]): Promise<number> {
  let opgeruimd = 0;
  for (const id of ids) {
    const uit = await tidyCard(slug, id).catch(() => null);
    if (uit) opgeruimd++;
  }
  return opgeruimd;
}
