import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { rondeStand } from "../../../../../lib/tweak-ronde";
import { telOpen } from "../../../../../lib/tweaks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE KNOP "NU DRAAIEN"
// ═══════════════════════════════════════════════════════════
// Tot nu toe was een ronde starten handwerk: een verse chat openen en /tweaks
// plakken. Dat werkt, maar het betekent dat Maarten aan een computer moet zitten
// met een chat ernaast, terwijl de ronde zelf niemand nodig heeft. Hij ziet iets
// op zijn telefoon, meldt het, en dan moet hij wachten tot hij achter zijn bureau
// zit om dezelfde melding nog een keer aan te raken.
//
// Deze route start dezelfde ronde vanaf de knop, via GitHub Actions: een
// werkstroom (.github/workflows/tweak-ronde.yml) die Claude Code draait met de
// opdracht /tweaks. Eén klik, en de aanpassing staat straks live.
//
// ER ZIJN DRIE SLEUTELS VOOR NODIG, ELK OM EEN ANDERE REDEN:
//  1. GITHUB_TWEAK_TOKEN, in Vercel. Waarmee dit dashboard bij GitHub mag
//     aankloppen om de werkstroom te starten. Een fijnmazig token op deze ene
//     repo, met alleen het recht "Actions: read and write". Meer heeft hij niet
//     nodig, dus meer geeft hij niet.
//  2. ANTHROPIC_API_KEY, als repo-secret in GitHub. Waarmee de werkstroom Claude
//     mag laten denken. Die staat bewust NIET in Vercel: dit dashboard hoeft er
//     niet bij te kunnen, alleen de werkstroom.
//  3. PINGWIN_KIJK_SLEUTEL, als repo-secret in GitHub. Waarmee de ronde bij dit
//     dashboard mag kijken en de standen mag bijwerken. Zonder deze claimt hij
//     de wachtrij niet en meldt hij niets terug; dan draait hij blind.
//
// Alleen de eerste kan deze route zien, want alleen die staat hier. Ontbreekt
// hij, dan zegt de route dat gewoon, met wat er moet gebeuren. Een knop die
// stilletjes niets doet is erger dan geen knop.
// ═══════════════════════════════════════════════════════════

const REPO = process.env.GITHUB_TWEAK_REPO || "mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin";
const WERKSTROOM = "tweak-ronde.yml";

/**
 * Werkt de knop, zonder hem in te drukken?
 *
 * Bestaat omdat de enige manier om dat te weten anders was: erop drukken en
 * kijken wat er misgaat. Deze vraag haalt de werkstroom op bij GitHub met
 * hetzelfde token en dezelfde naam als de knop gebruikt, dus lukt dit, dan lukt
 * de knop ook. Er wordt niets mee gestart en er gaat geen ronde lopen.
 *
 * Wat hij NIET kan zien: of ANTHROPIC_API_KEY in GitHub goed staat. Die sleutel
 * hoort niet in dit dashboard thuis, dus dit dashboard kan er ook niet bij. Dat
 * blijkt pas bij de eerste echte ronde, en dan staat het in het GitHub-logboek.
 */
export async function GET(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  const token = process.env.GITHUB_TWEAK_TOKEN;
  if (!token) {
    return NextResponse.json({
      ok: true, klaar: false,
      reden: "De sleutel GITHUB_TWEAK_TOKEN staat nog niet in Vercel, dus de knop kan GitHub niet bereiken.",
    });
  }

  const antwoord = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WERKSTROOM}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  ).catch(() => null);

  if (!antwoord) {
    return NextResponse.json({ ok: true, klaar: false, reden: "GitHub was even niet bereikbaar." });
  }
  if (antwoord.status === 200) {
    return NextResponse.json({ ok: true, klaar: true });
  }
  const uitleg: Record<number, string> = {
    401: "GitHub weigert het token. Waarschijnlijk verlopen of verkeerd overgenomen; maak een nieuw fijnmazig token en zet het opnieuw in Vercel.",
    403: "Het token mag dit niet. Het heeft het recht Actions: read and write nodig op deze repo.",
    404: "Het token ziet deze repo of de werkstroom niet. Controleer of hij op repository SEO-werkzaamheden-Pingwin staat, en niet op alle repo's van een ander account.",
  };
  return NextResponse.json({
    ok: true, klaar: false,
    reden: uitleg[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).`,
  });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Draait er al een? Dan is nog een keer starten precies de botsing die de
  // wachtrij moet voorkomen. Deze controle staat er dus vóór de knop, niet erna.
  const stand = await rondeStand();
  if (stand.ronde) {
    return NextResponse.json({
      ok: false,
      error: "Er loopt al een ronde. Die is meestal binnen een paar minuten klaar.",
      ronde: stand,
    }, { status: 409 });
  }

  const tellers = await telOpen();
  if (tellers.wachtrij === 0) {
    return NextResponse.json({ ok: false, error: "Er staat niets in de wachtrij." }, { status: 400 });
  }

  const token = process.env.GITHUB_TWEAK_TOKEN;
  if (!token) {
    return NextResponse.json({
      ok: false,
      klaarzetten: true,
      error:
        "De knop is er, de sleutels nog niet. Er zijn er drie nodig: GITHUB_TWEAK_TOKEN in " +
        "Vercel (een fijnmazig GitHub-token op deze repo met het recht Actions: read and " +
        "write), en als repo-secret in GitHub zowel ANTHROPIC_API_KEY als PINGWIN_KIJK_SLEUTEL. " +
        "Zolang ze er niet zijn start je een ronde met de knop hiernaast, die de startregel op " +
        "je klembord zet.",
    }, { status: 503 });
  }

  const antwoord = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WERKSTROOM}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  ).catch(() => null);

  if (!antwoord) {
    return NextResponse.json({ ok: false, error: "GitHub was niet bereikbaar. Probeer het zo nog eens." }, { status: 502 });
  }
  if (antwoord.status === 204) {
    return NextResponse.json({
      ok: true,
      melding: `De ronde is gestart. ${tellers.wachtrij === 1 ? "Eén aanpassing" : `${tellers.wachtrij} aanpassingen`} gaan mee; zodra ze live staan verschijnen ze hier onder "Klaar, klopt het?".`,
    });
  }

  // De drie fouten die in de praktijk voorkomen, elk met wat je eraan doet. Een
  // kale statuscode zegt Maarten niets en kost een chat om uit te zoeken.
  const uitleg: Record<number, string> = {
    401: "GitHub weigert het token. Waarschijnlijk verlopen; maak een nieuw fijnmazig token en zet het opnieuw in Vercel.",
    403: "Het token mag dit niet. Het heeft het recht Actions: read and write nodig op deze repo.",
    404: "GitHub kent de werkstroom niet. Die staat op main als .github/workflows/tweak-ronde.yml; controleer of hij daar echt staat.",
  };
  return NextResponse.json({
    ok: false,
    error: uitleg[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).`,
  }, { status: 502 });
}
