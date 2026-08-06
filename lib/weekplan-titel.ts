import { getWeekplan, setWeekplanKaart, voegArchief, updateWeekplanToelichting } from "./weekplan";
import { getWeekplanPages } from "./overview";
import { urlKey } from "./url-key";
import { isKorteTitel, korteTitel, opdrachtenUitTitel } from "./kaart-titel";

// ═══════════════════════════════════════════════════════════
// DE VOLGELOPEN TITELS EENMALIG INKORTEN
// ═══════════════════════════════════════════════════════════
// Er stond een mechanisme dat bij elke keer laden een nieuwe opdracht met " + "
// achter de kaarttitel plakte. Dat is gestopt (zie weekplan-splitsen.ts), maar
// de titels die er al staan blijven lang. Deze stap kort ze één keer in.
//
// Drie dingen maken dit veilig:
//  1. De oude titel gaat eerst naar het archief, daarna pas wordt hij vervangen.
//  2. De losse opdrachten uit die titel landen als lijstje in de kaart, dus er
//     verdwijnt geen werk uit beeld.
//  3. Staat de titel al in de vaste vorm, of heeft Maarten hem zelf getypt, dan
//     gebeurt er niets. Daardoor doet een tweede ronde nul werk, ook al draait
//     deze functie bij elke keer laden.
//
// De proefstand (`droog`) verandert niets en vertelt alleen wat hij zou doen.

export type TitelWijziging = { id: number; oud: string; nieuw: string; opdrachten: string[] };

const KOP = "Opdrachten:";

export async function verkortTitels(
  slug: string,
  opties?: { droog?: boolean },
): Promise<TitelWijziging[]> {
  const droog = opties?.droog === true;
  const kaarten = await getWeekplan(slug);
  const teDoen = kaarten.filter((k) =>
    k.status !== "klaar" && !k.taakHandmatig && !isKorteTitel(k.taak) && (k.taak || "").length > 0);
  if (teDoen.length === 0) return [];

  // De paginastand alleen ophalen als er echt werk is; hij bepaalt of het
  // werkwoord "maken" of "optimaliseren" wordt.
  let pages: Record<string, { live: boolean }> = {};
  try {
    pages = await getWeekplanPages(slug) as unknown as Record<string, { live: boolean }>;
  } catch { pages = {}; }

  const uit: TitelWijziging[] = [];
  for (const k of teDoen) {
    const page = k.url ? pages[urlKey(k.url)] : undefined;
    const nieuw = korteTitel(k.taak, k.url, page);
    if (!nieuw || nieuw === k.taak) continue;

    // Alleen de opdrachten die niet al in de nieuwe titel zitten. Bij een titel
    // van één opdracht ("Optimaliseer /pad/") valt er niets te bewaren.
    const opdrachten = opdrachtenUitTitel(k.taak).filter((o) => o.length > 3);
    uit.push({ id: k.id, oud: k.taak, nieuw, opdrachten });
    if (droog) continue;

    await voegArchief(slug, k.id, "titel", k.taak);
    if (opdrachten.length > 1 || (opdrachten[0] && opdrachten[0] !== nieuw)) {
      await zetOpdrachten(slug, k.id, k.toelichting, opdrachten);
    }
    await setWeekplanKaart(slug, k.id, { taak: nieuw });
  }
  return uit;
}

/**
 * De opdrachten uit de oude titel onder één kopje in de kaarttekst zetten, met
 * dezelfde ontdubbeling die de rest van de kaart gebruikt: staat een regel er al
 * (in welke sectie dan ook), dan komt hij er niet nog een keer bij.
 */
async function zetOpdrachten(slug: string, id: number, toelichting: string, opdrachten: string[]): Promise<void> {
  const heel = (toelichting || "").trim();
  const bestaand = new Set(heel.split("\n").map(sleutel).filter(Boolean));
  const nieuw = opdrachten.filter((o) => !bestaand.has(sleutel(o)));
  if (nieuw.length === 0) return;

  const regels = heel ? heel.split("\n") : [];
  const kopIndex = regels.findIndex((r) => r.trim().toLowerCase() === KOP.toLowerCase());
  if (kopIndex >= 0) {
    // Onder het bestaande kopje, vóór de volgende lege regel.
    let eind = kopIndex + 1;
    while (eind < regels.length && regels[eind].trim()) eind++;
    regels.splice(eind, 0, ...nieuw.map((o) => `- ${o}`));
  } else {
    regels.push("", KOP, ...nieuw.map((o) => `- ${o}`));
  }
  await updateWeekplanToelichting(slug, id, regels.join("\n"));
}

const sleutel = (s: string) => s.trim().toLowerCase().replace(/^[-*]\s*/, "").replace(/[.:;]\s*$/, "");
