import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { anthropicConfigured, callClaude } from "../../../../lib/anthropic";
import { getFocus } from "../../../../lib/focus";
import { getOppakStand } from "../../../../lib/oppak-stand";
import { getChatHistory } from "../../../../lib/chat";
import { getWeekplan } from "../../../../lib/weekplan";
import { htmlNaarTekst } from "../../../../lib/veilige-html";

export const runtime = "nodejs";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════
// "BIJWERKEN" BIJ WAT WE NU OPPAKKEN
// ═══════════════════════════════════════════════════════════
// Maakt een VOORSTEL voor het lijstje op basis van wat er sinds de laatste
// wijziging is besloten. Deze route SLAAT NIETS OP: hij geeft de tekst terug,
// Maarten ziet oud naast nieuw, en pas zijn klik zet het erin. Die grens is
// hard en staat in proeven/takenpagina.proef.ts, om dezelfde reden als bij de
// koers-controle: een lijstje dat zichzelf mag overschrijven is na twee rondes
// niet meer van hem, en dan is het precies het automatisch samengeraapte
// lijstje dat hier niet gewenst is.

const SYSTEM = `Je stelt het lijstje "Wat we nu oppakken" op voor één SEO-klant van bureau Pingwin.

Dat lijstje beantwoordt één vraag: waar wordt op dit moment aan gewerkt, en wat is als eerstvolgende aan de beurt.

Regels:
- Maximaal zeven regels, liever vijf. Elke regel is één ding dat opgepakt wordt, in één korte zin.
- Alleen wat je terugziet in de gegevens hieronder. Verzin geen taken, geen pagina's, geen zoekwoorden en geen cijfers.
- Het laatst besloten wint. Spreekt een recent gesprek een ouder lijstje tegen, volg dan het gesprek.
- Staat een regel al op de planning, zet er dan achter: (loopt). Is het besloten maar nog niet gepland, zet er niets achter.
- Geen tabellen, geen zoekwoordenlijsten, geen kopjes. Dat hoort in het strategiestuk, niet hier.
- Nederlands, gewone taal, geen jargon, geen Engels waar Nederlands kan.
- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, een dubbele punt of een nieuwe zin.

Antwoord UITSLUITEND met een genummerde lijst, één regel per punt, in de vorm "1. ...". Geen inleiding, geen afsluiting, geen codeblok, geen kopjes.`;

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

  const stand = await getOppakStand(slug);
  const focus = await getFocus(slug).catch(() => null);

  const delen: string[] = [];
  const gebruikt: string[] = [];

  // ── Wat er nu staat ──
  const huidig = htmlNaarTekst(focus?.prioHtml || "").trim();
  delen.push(huidig
    ? `=== WAT ER NU IN HET LIJSTJE STAAT (van ${stand.bijgewerkt ? stand.bijgewerkt.slice(0, 10) : "onbekende datum"}; mogelijk verouderd) ===\n${huidig.slice(0, 3000)}`
    : "=== WAT ER NU IN HET LIJSTJE STAAT ===\nHet lijstje is leeg.");

  // ── De gesprekken die na die datum gelopen hebben, nieuwste eerst ──
  for (const plek of stand.nieuwer) {
    if (plek.soort !== "gesprek" || !plek.thread) continue;
    const msgs = await getChatHistory(slug, plek.thread).catch(() => []);
    // De laatste beurten wegen het zwaarst: daar staat waar een gesprek op uitkwam.
    const tekst = msgs.slice(-8)
      .map((m) => `${m.role === "user" ? "Maarten" : "Assistent"}: ${(m.content || "").replace(/\s+/g, " ").slice(0, 1200)}`)
      .join("\n");
    if (!tekst.trim() && !plek.samenvatting) continue;
    delen.push(`=== GESPREK "${plek.titel}" (${plek.datum.slice(0, 10)}, NIEUWER dan het lijstje) ===\n${plek.samenvatting ? plek.samenvatting + "\n" : ""}${tekst.slice(0, 6000)}`);
    gebruikt.push(`${plek.titel} (${plek.datum.slice(0, 10)})`);
  }

  // ── Het strategiestuk uit het dossier ──
  const strategie = htmlNaarTekst(focus?.html || "").trim();
  if (strategie) {
    delen.push(`=== HET STRATEGIESTUK IN HET DOSSIER VAN DEZE KLANT ===\n${strategie.slice(0, 7000)}`);
    if (stand.nieuwer.some((p) => p.soort === "strategie")) gebruikt.push("De strategie in het dossier");
  }

  // ── Wat er nu op de planning staat, zodat "(loopt)" klopt ──
  const plan = await getWeekplan(slug).catch(() => []);
  const open = plan.filter((k) => k.status !== "klaar").map((k) => k.taak).filter(Boolean).slice(0, 40);
  delen.push(`=== WAT ER NU OP DE PLANNING STAAT ===\n${open.length ? open.join("\n") : "Er staat niets open op de planning."}`);

  try {
    const antwoord = await callClaude(SYSTEM, [{ role: "user", content: delen.join("\n\n") }], 1200, { slug, action: "oppak-voorstel" });
    // Gewone tekst met genummerde regels, geen HTML: het scherm rendert hem via
    // dezelfde weg als alle andere uitkomsten, en pas bij het overnemen wordt er
    // opgemaakte tekst van gemaakt. Eén renderweg betekent dat er nergens ruwe
    // opmaaktekens in beeld kunnen komen.
    const voorstel = antwoord.replace(/^```[a-z]*\s*|\s*```$/g, "").trim();
    if (!voorstel) {
      return NextResponse.json({ ok: false, error: "Er kwam geen bruikbaar voorstel uit." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, voorstel, gebruikt });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Het voorstel maken is niet gelukt." }, { status: 500 });
  }
}
