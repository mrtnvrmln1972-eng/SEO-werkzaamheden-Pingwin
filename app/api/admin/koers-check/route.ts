import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured, callClaude } from "../../../../lib/anthropic";
import { getFocus } from "../../../../lib/focus";
import { htmlNaarTekst } from "../../../../lib/veilige-html";
import { getPrioriteitenScan } from "../../../../lib/prioriteiten-scan";
import { getRoadmap } from "../../../../lib/nav-plan";

export const runtime = "nodejs";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════
// "KLOPT DIT NOG?" BIJ DE KOERS
// ═══════════════════════════════════════════════════════════
// De koers is Maartens eigen tekst en blijft dat. Deze route schrijft er dus
// NOOIT in; hij legt de tekst naast de feiten die het dashboard al heeft liggen
// en zegt alleen wat er niet meer klopt. Commentaar naast de tekst, nooit erin.
//
// Waarom dat een harde grens is: een koers die door een model herschreven wordt,
// is na twee rondes niet meer van Maarten, en dan is het precies het automatisch
// samengeraapte lijstje dat hij niet wil.
//
// Leest alleen opgeslagen uitkomsten: geen scan, geen Ahrefs, geen Search Console.

const SYSTEM = `Je controleert een korte, met de hand geschreven SEO-koers van een bureau tegen de feiten die het dashboard heeft liggen.

Je schrijft NOOIT een nieuwe koers en je stelt geen herschrijving voor. Je noemt alleen wat er niet meer klopt of wat er ontbreekt.

Regels:
- Maximaal zes punten, liever minder. Staat er niets scheef, zeg dat dan in één zin.
- Elk punt is één regel, begint met wat er aan de hand is, en noemt het bewijs uit de gegevens hieronder.
- Alleen dingen die je in de gegevens ziet. Verzin geen cijfers, geen pagina's en geen zoekwoorden.
- Nederlands, gewone taal, geen jargon.
- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, een dubbele punt of een nieuwe zin.
- Antwoord als platte opsomming met "- " per regel. Geen kopjes, geen inleiding, geen afsluiting.`;

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  if (!anthropicConfigured()) {
    return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  }
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const focus = await getFocus(slug).catch(() => null);
  const koers = htmlNaarTekst(focus?.koersHtml || "").trim();
  if (!koers) {
    return NextResponse.json({ ok: false, error: "Er staat nog geen koers. Schrijf eerst in een paar regels waar we naartoe werken." }, { status: 400 });
  }

  const delen: string[] = [`=== DE KOERS (Maartens eigen tekst) ===\n${koers.slice(0, 4000)}`];

  const prio = await getPrioriteitenScan(slug).catch(() => null);
  const regels = prio?.result?.regels || [];
  if (regels.length) {
    const top = regels.filter((r) => r.tier === "1" || r.tier === "2").slice(0, 25)
      .map((r) => `${r.zoekwoord || "(geen zoekwoord)"} op ${r.url || "(geen pagina)"}: nu positie ${r.huidigePositie || "niet in beeld"}, doel ${r.targetPositie}, ${r.maandvolume} zoekopdrachten per maand`);
    if (top.length) delen.push(`=== DE GROOTSTE KANSEN NU (uit de prioriteitenscan van ${prio?.updatedAt || "onbekende datum"}) ===\n${top.join("\n")}`);
  } else {
    delen.push("=== DE GROOTSTE KANSEN NU ===\nEr is voor deze klant nog geen prioriteitenscan gedraaid.");
  }

  const roadmap = await getRoadmap(slug).catch(() => null);
  if (roadmap) {
    const teBouwen = roadmap.nodes.filter((n) => n.inPlan && !n.live).map((n) => n.url).slice(0, 40);
    const staanEr = roadmap.nodes.filter((n) => n.inPlan && n.live).map((n) => n.url).slice(0, 60);
    delen.push(`=== PAGINA'S UIT DE ROADMAP DIE NOG NIET BESTAAN ===\n${teBouwen.length ? teBouwen.join("\n") : "geen"}`);
    delen.push(`=== PAGINA'S UIT DE ROADMAP DIE INMIDDELS LIVE STAAN ===\n${staanEr.length ? staanEr.join("\n") : "geen"}`);
  }

  try {
    const antwoord = await callClaude(SYSTEM, [{ role: "user", content: delen.join("\n\n") }], 900, { slug, action: "koers-check" });
    return NextResponse.json({ ok: true, commentaar: antwoord.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "De controle is niet gelukt." }, { status: 500 });
  }
}
