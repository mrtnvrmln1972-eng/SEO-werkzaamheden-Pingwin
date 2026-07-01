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

  const system = `Je bent een SEO-specialist bij bureau Pingwin die een technische analyse omzet in een nette, begrijpelijke e-mail voor de klant${clientName ? ` (${clientName})` : ""}.

REGELS:
- Gewone, warme, professionele taal. GEEN SEO-jargon (of leg het in één zin uit). De klant is geen SEO-expert.
- Structuur: een korte persoonlijke aanhef, één alinea inleiding (wat we hebben bekeken), de belangrijkste bevindingen kort in bullets, en wat we concreet gaan doen. Sluit vriendelijk af.
- Kort en scanbaar. Geen verzonnen cijfers; alleen wat in de analyse staat.
- Geef ALLEEN de e-mailtekst terug, in nette markdown. Geen extra uitleg eromheen, geen <voorstel>-blok.`;

  try {
    const email = await callClaude(system, [{ role: "user", content: `Zet deze analyse om in een klant-mail:\n\n${analysis}` }], 1500);
    return NextResponse.json({ ok: true, email: email.trim() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
