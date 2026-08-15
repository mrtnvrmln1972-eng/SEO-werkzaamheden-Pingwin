import { maakBon } from "./ronde-bon";

// ═══════════════════════════════════════════════════════════
// ÉÉN PLEK DIE EEN RONDE START BIJ GITHUB
// ═══════════════════════════════════════════════════════════
// Er zijn vier aanleidingen om een ronde te starten: de knop op de tweak-stapel,
// de knop bij de grote punten, en de twee uurwerken die dat vanzelf doen. Die
// deden allemaal hetzelfde: bij GitHub aankloppen om een werkstroom te starten.
//
// Dat stond op weg naar vier kopieën van dezelfde code, en dat is precies de
// vaste les uit het projectgeheugen: dezelfde regel op meerdere plekken loopt
// uit elkaar zonder dat iemand het merkt. Dus één functie, en de rest roept hem.
//
// Belangrijk onderdeel: elke start maakt hier een verse toegangsbon en geeft die
// mee aan de werkstroom. Daardoor heeft een ronde zijn eigen toegang tot het
// dashboard en hangt hij niet langer aan de meekijk-sleutel van Maarten, die
// vervalt zodra hij een nieuwe maakt. Zie lib/ronde-bon.ts voor het waarom.
// ═══════════════════════════════════════════════════════════

const REPO = process.env.GITHUB_TWEAK_REPO || "mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin";

/** De drie fouten die in de praktijk voorkomen, elk met wat je eraan doet. */
export const GITHUB_UITLEG: Record<number, string> = {
  401: "GitHub weigert het token. Waarschijnlijk verlopen of verkeerd overgenomen; maak een nieuw fijnmazig token en zet het opnieuw in Vercel.",
  403: "Het token mag dit niet. Het heeft het recht Actions: read and write nodig op deze repo.",
  404: "GitHub kent de werkstroom niet. Controleer of hij op main staat onder .github/workflows.",
};

export type StartUitslag =
  | { ok: true; ronde: string }
  | { ok: false; error: string; klaarzetten?: boolean; status: number };

/** Een naam voor deze ronde, zodat te zien is wie het slot heeft. */
export function rondeNaam(bron: string): string {
  const tijd = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `${bron}-${tijd}`;
}

/**
 * Werkt de knop, zonder hem in te drukken?
 *
 * Bestaat omdat de enige manier om dat te weten anders was: erop drukken en
 * kijken wat er misgaat. Er wordt niets mee gestart.
 */
export async function werkstroomKlaar(bestand: string): Promise<{ klaar: boolean; reden?: string }> {
  const token = process.env.GITHUB_TWEAK_TOKEN;
  if (!token) {
    return { klaar: false, reden: "De sleutel GITHUB_TWEAK_TOKEN staat nog niet in Vercel, dus de knop kan GitHub niet bereiken." };
  }
  if (!process.env.SESSION_SECRET) {
    return { klaar: false, reden: "SESSION_SECRET ontbreekt, dus een ronde kan geen toegangsbon meekrijgen." };
  }
  const antwoord = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${bestand}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!antwoord) return { klaar: false, reden: "GitHub was even niet bereikbaar." };
  if (antwoord.status === 200) return { klaar: true };
  return { klaar: false, reden: GITHUB_UITLEG[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).` };
}

/**
 * Een werkstroom starten, met een verse toegangsbon erbij.
 *
 * `extra` zijn invoervelden van de werkstroom zelf (bijvoorbeeld "handmatig").
 * De bon en de rondenaam gaan er altijd in mee.
 */
export async function startWerkstroom(
  bestand: string,
  baan: "tweak" | "punt",
  bron: string,
  extra: Record<string, string> = {},
): Promise<StartUitslag> {
  const token = process.env.GITHUB_TWEAK_TOKEN;
  if (!token) {
    return {
      ok: false,
      klaarzetten: true,
      status: 503,
      error:
        "De knop is er, de sleutels nog niet. Er zijn er twee nodig: GITHUB_TWEAK_TOKEN in " +
        "Vercel (een fijnmazig GitHub-token op deze repo met het recht Actions: read and " +
        "write), en ANTHROPIC_API_KEY als repo-secret in GitHub. De toegang tot dit dashboard " +
        "regelt de ronde zelf, dus daar hoef je niets meer voor te zetten.",
    };
  }

  const ronde = rondeNaam(bron);
  let bon: string;
  try {
    bon = maakBon(ronde, baan);
  } catch {
    return { ok: false, status: 500, error: "SESSION_SECRET ontbreekt op de server; een ronde kan zo geen toegang krijgen." };
  }

  const antwoord = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${bestand}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { bon, ronde, ...extra } }),
    },
  ).catch(() => null);

  if (!antwoord) return { ok: false, status: 502, error: "GitHub was niet bereikbaar. Probeer het zo nog eens." };
  if (antwoord.status === 204) return { ok: true, ronde };
  return {
    ok: false,
    status: 502,
    error: GITHUB_UITLEG[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).`,
  };
}
