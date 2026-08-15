import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../../lib/admin-scope";
import { puntStand, volgendeTaak } from "../../../../../lib/punt-ronde";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// DE KNOP "NU DRAAIEN" VOOR EEN GROOT PUNT
// ═══════════════════════════════════════════════════════════
// Normaal draait deze baan 's nachts vanzelf (.github/workflows/punt-nacht.yml,
// elk uur binnen het nachtvenster). Deze knop start dezelfde werkstroom nu
// meteen, voor als Maarten niet tot de nacht wil wachten, of voor als hij een
// plan wil zien zonder er een chat voor te openen.
//
// Dezelfde drie sleutels als bij de tweak-ronde, elk om een andere reden:
//  1. GITHUB_TWEAK_TOKEN, in Vercel. Waarmee dit dashboard bij GitHub mag
//     aankloppen om een werkstroom te starten. Eén fijnmazig token op deze ene
//     repo met alleen "Actions: read and write"; hij dekt beide werkstromen,
//     dus er hoeft niets nieuws bij.
//  2. ANTHROPIC_API_KEY, als repo-secret in GitHub. Waarmee de ronde mag denken.
//  3. PINGWIN_KIJK_SLEUTEL, als repo-secret in GitHub. Waarmee de ronde bij dit
//     dashboard mag kijken en zijn voortgang mag melden.
//
// Alleen de eerste kan deze route zien, want alleen die staat hier. Ontbreekt
// hij, dan zegt de route dat gewoon. Een knop die stilletjes niets doet is
// erger dan geen knop.
// ═══════════════════════════════════════════════════════════

const REPO = process.env.GITHUB_TWEAK_REPO || "mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin";
const WERKSTROOM = "punt-nacht.yml";

const UITLEG: Record<number, string> = {
  401: "GitHub weigert het token. Waarschijnlijk verlopen of verkeerd overgenomen; maak een nieuw fijnmazig token en zet het opnieuw in Vercel.",
  403: "Het token mag dit niet. Het heeft het recht Actions: read and write nodig op deze repo.",
  404: "GitHub kent de werkstroom niet. Die staat op main als .github/workflows/punt-nacht.yml; controleer of hij daar echt staat.",
};

/** Werkt de knop, zonder hem in te drukken? Zelfde vraag als bij de tweaks. */
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

  if (!antwoord) return NextResponse.json({ ok: true, klaar: false, reden: "GitHub was even niet bereikbaar." });
  if (antwoord.status === 200) return NextResponse.json({ ok: true, klaar: true });
  return NextResponse.json({
    ok: true, klaar: false,
    reden: UITLEG[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).`,
  });
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Loopt er al iets, in welke baan dan ook? Dan is nog een keer starten precies
  // de botsing die het slot moet voorkomen.
  const stand = await puntStand();
  if (stand.slot.ronde) {
    return NextResponse.json({
      ok: false,
      error: stand.slot.baan === "punt"
        ? "Er wordt op dit moment al een groot punt gebouwd."
        : "Er loopt nu een tweak-ronde. Grote punten en tweaks bouwen nooit tegelijk; die is meestal binnen een paar minuten klaar.",
      stand,
    }, { status: 409 });
  }

  const taak = await volgendeTaak();
  if (!taak.werk || !taak.punt) {
    return NextResponse.json({
      ok: false,
      error: "Er staat niets klaar. Keur een plan goed, of vraag een plan aan bij een idee.",
    }, { status: 400 });
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
      // `handmatig` zet het nachtvenster opzij: Maarten drukt zelf, dus hij zit
      // erbij. Het slot blijft gewoon gelden.
      body: JSON.stringify({ ref: "main", inputs: { handmatig: "ja" } }),
    },
  ).catch(() => null);

  if (!antwoord) {
    return NextResponse.json({ ok: false, error: "GitHub was niet bereikbaar. Probeer het zo nog eens." }, { status: 502 });
  }
  if (antwoord.status === 204) {
    return NextResponse.json({
      ok: true,
      melding: taak.werk === "bouwen"
        ? `${taak.punt.code} wordt nu gebouwd: ${taak.punt.titel}. Je ziet hierboven bij welke stap hij is.`
        : `Er wordt nu een plan geschreven voor ${taak.punt.code}: ${taak.punt.titel}. Zodra het klaar is verschijnt het hier voor je akkoord.`,
    });
  }

  return NextResponse.json({
    ok: false,
    error: UITLEG[antwoord.status] || `GitHub gaf een fout terug (${antwoord.status}).`,
  }, { status: 502 });
}
