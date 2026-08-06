import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { callClaude, anthropicConfigured } from "../../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// CONCEPT-ANTWOORD OP EEN REVIEW
// ═══════════════════════════════════════════════════════════
// Het dashboard schrijft, een mens verstuurt. Dit endpoint plaatst bewust NIETS
// op het profiel: het levert alleen de tekst, die op het scherm bewerkbaar in
// beeld komt. Automatisch antwoorden namens een klant op zijn eigen etalage is
// precies het soort ding dat één keer misgaat en dan onherstelbaar is.

const SYSTEM = `Je schrijft een antwoord op een Google-review namens een Nederlands bedrijf. De eigenaar leest het na en plaatst het zelf.

REGELS:
- Nederlands, "u", kort: twee tot vier zinnen, nooit meer.
- Bij een positieve review: bedank persoonlijk, noem waar de review over ging, geen verkooppraat.
- Bij een kritische review: erken wat er misging, ga NIET in discussie, verdedig niets, bied aan het offline op te lossen met een concreet contactkanaal. Nooit de klant tegenspreken, ook niet als hij ongelijk heeft.
- Nooit excuses maken voor iets dat niet vaststaat; "vervelend dat u dit zo ervaren heeft" mag wel.
- Noem de naam van de reviewer als die er is.
- Verwerk waar het natuurlijk past één keer wat het bedrijf doet en waar (dat helpt de vindbaarheid), maar NOOIT geforceerd en nooit als opsomming van zoekwoorden.
- Geen emoji, geen uitroeptekens-stapels, geen streepje als zinsscheiding (gebruik komma, dubbele punt of een nieuwe zin).
- Geef UITSLUITEND de antwoordtekst terug, zonder aanhalingstekens, zonder kopje, zonder toelichting.`;

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  if (!anthropicConfigured()) {
    return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const tekst = String(body.tekst || "").trim();
  const sterren = Number(body.sterren || 0);
  const auteur = String(body.auteur || "").trim();
  const vestiging = String(body.vestiging || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Deze klant bestaat niet (meer)." }, { status: 400 });

  // Het klantprofiel en de tone of voice staan al in het dashboard; zonder die
  // context klinkt elk antwoord als een willekeurig bedrijf.
  const profiel = (client.seoProfile || "").slice(0, 6000);

  const vraag = [
    `BEDRIJF: ${client.name}${vestiging ? ` (vestiging ${vestiging})` : ""}`,
    profiel ? `\nWIE DIT BEDRIJF IS EN HOE HET SCHRIJFT:\n${profiel}` : "\n(Er is nog geen klantprofiel; houd het antwoord daarom neutraal en algemeen.)",
    `\nDE REVIEW:\nAantal sterren: ${sterren || "onbekend"}\nDoor: ${auteur || "onbekend"}\nTekst: ${tekst || "(de reviewer gaf alleen sterren, geen tekst)"}`,
    `\nSchrijf het antwoord.`,
  ].join("\n");

  try {
    const antwoord = await callClaude(SYSTEM, [{ role: "user", content: vraag }], 500, { slug, action: "gmb_review_antwoord" });
    return NextResponse.json({ ok: true, antwoord: antwoord.trim().replace(/^["']|["']$/g, "") });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Het concept schrijven is misgegaan: ${(e as Error).message}` }, { status: 500 });
  }
}
