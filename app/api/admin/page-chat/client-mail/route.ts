import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { callClaude, anthropicConfigured } from "../../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Zet een SEO-analyse om in een nette, begrijpelijke e-mail voor de klant.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "De mail-generatie heeft een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const analysis = String(body.analysis || "").trim();
  const clientName = String(body.clientName || "").trim();
  if (!analysis) return NextResponse.json({ ok: false, error: "Geen analyse meegegeven." }, { status: 400 });

  const system = `Je bent een SEO-specialist bij bureau Pingwin. Vat de analyse hieronder samen tot een CONCLUSIE-BLOK dat de klant${clientName ? ` (${clientName})` : ""} als kern in een e-mail kan zetten. De aanhef, inleidende en afsluitende tekst schrijft de gebruiker zelf; jij levert ALLEEN de kern.

TAAL EN TOON:
- Gewone, warme, professionele taal. GEEN SEO-jargon (of leg het in één zin uit). De klant is geen SEO-expert.

INHOUD (alleen de kern, geen aanhef/afsluiting):
- Eén korte alinea: wat we voor deze pagina hebben bekeken en de belangrijkste conclusie.
- "Wat we zien" als een korte bullet-lijst (de belangrijkste bevindingen).
- "Wat we voorstellen" als een korte bullet-lijst (de concrete acties).

OPMAAK (streng):
- GEEN aanhef ("Beste ..."), GEEN afsluiting/ondertekening. GEEN tabellen, GEEN horizontale lijnen (---), GEEN markdown-koppen met #, GEEN vet-sterretjes-spam, GEEN emoji.
- Alleen gewone alinea's en simpele bullets (met "- "). Kort en scanbaar.
- Geen verzonnen cijfers; alleen wat in de analyse staat.
- Geef ALLEEN het conclusie-blok terug, niets eromheen.`;

  try {
    const email = await callClaude(system, [{ role: "user", content: `Vat deze analyse samen tot een conclusie-blok:\n\n${analysis}` }], 1200);
    return NextResponse.json({ ok: true, email: email.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
