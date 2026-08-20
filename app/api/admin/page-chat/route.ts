import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { callClaudeAgentic, anthropicConfigured, type ChatMsg } from "../../../../lib/anthropic";
import { buildSystemPrompt, parseProposal, extractProposal } from "../../../../lib/page-chat-ground";
import { CHAT_TOOLS, runChatTool } from "../../../../lib/chat-tools";
import { korteGeschiedenis } from "../../../../lib/chat-inkorten";
import { bronVan, ontdubbel, type Bron } from "../../../../lib/chat-bronnen";
import { metAfkap, CHAT_AFKAP_MS, CHAT_AFKAP_TEKST } from "../../../../lib/afkap";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Gegronde pagina-chat: laadt live feiten voor de pagina en beantwoordt de vraag.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "De chat heeft een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const messages = Array.isArray(body.messages) ? (body.messages as ChatMsg[]) : [];
  if (!slug || !url || messages.length === 0) return NextResponse.json({ ok: false, error: "Klant, URL en bericht zijn verplicht." }, { status: 400 });

  try {
    const system = await buildSystemPrompt(slug, url);
    // Bij samenvatten gaat het hele gesprek volledig mee (die stap moet alles
    // overzien); bij een gewone vraag gaan oudere antwoorden ingekort mee, zodat
    // de AI zijn eigen rapporten niet elke beurt opnieuw uitschrijft.
    // De grens stond op 12 berichten: in een lang gesprek viel de grote analyse
    // dan buiten de samenvatting, precies het bericht waar alles om draait. Veertig
    // dekt elk echt gesprek; het samenvatten is een bewuste, incidentele actie.
    const volledig = body.volledig === true;
    const historie = volledig ? messages.slice(-40) : korteGeschiedenis(messages);
    // ── Eén klok voor het hele verzoek (20-08-2026) ──
    // Hier zat het gat waardoor "Samenvatten mislukt, probeer het nog een keer"
    // ontstond, zónder reden erbij. Het afkappen hieronder gold alléén voor het
    // opzoekwerk; de plan-extractie daarna was een tweede AI-aanroep zonder klok.
    // Duurde het samenvatten 260 seconden en de extractie nog 40, dan hakte
    // Vercel op 300 de functie om, kreeg de browser een foutpagina in plaats van
    // JSON, en klapte `r.json()` stuk op de generieke melding. Nu telt alles mee
    // in dezelfde begroting en komt er altijd leesbare JSON terug.
    const START = Date.now();
    const EIND = START + 285_000;
    // Ruimte om ná het opzoekwerk het plan te destilleren en te versturen.
    const RESERVE_MS = 25_000;
    // Wat de chat opzocht, meegeven zodat het onder het antwoord te zien is.
    const bronnen: Bron[] = [];
    const run = async (naam: string, invoer: Record<string, unknown>) => {
      const uit = await runChatTool(naam, invoer);
      try { const b = bronVan(naam, invoer); if (b) bronnen.push(b); } catch { /* nooit blokkeren */ }
      return uit;
    };
    // 9 rondes was te krap voor een pagina met veel zoekwoorden; de klok zorgt dat een
    // lang onderzoek netjes afrondt binnen het venster van 300 seconden.
    // Zelf afkappen vlak vóór de tijdslimiet van het platform, zodat de browser
    // altijd JSON terugkrijgt en nooit een foutpagina waar hij niets mee kan.
    // ── Ruimte voor een lang antwoord bij het samenvatten (20-08-2026) ──
    // De strategie van een locatiepagina is een compleet stuk: rol, zoekwoorden
    // met onderbouwing, negen acties, doel-URL. Dat past niet altijd in 4096
    // tokens, en dan trad de nood-ladder in werking: hetzelfde verzoek nóg twee
    // keer, met driemaal zo veel ruimte. Die herhaling kostte de minuten die het
    // samenvatten juist nodig had. Nu krijgt het samenvatten die ruimte meteen,
    // dus in één keer een compleet antwoord in plaats van drie halve pogingen.
    // Je betaalt wat er geschreven wordt, niet wat je toestaat.
    const ruimte = volledig ? 12000 : 4096;
    // Het samenvatten hoeft niet lang te zoeken (dat is in het gesprek al
    // gebeurd), maar wel lang te schrijven. Het onderzoek stopt daarom eerder,
    // zodat er tijd overblijft om het uit te schrijven.
    const onderzoekTot = START + (volledig ? 140_000 : 210_000);
    const raw = await metAfkap(
      callClaudeAgentic(system, historie, CHAT_TOOLS, run, 20, ruimte, { slug, action: "page_chat" }, onderzoekTot),
      Math.min(CHAT_AFKAP_MS, Math.max(10_000, EIND - RESERVE_MS - Date.now())),
      "",
    );
    if (!raw) return NextResponse.json({ ok: false, error: CHAT_AFKAP_TEKST }, { status: 502 });
    const { reply } = parseProposal(raw);
    // Aparte extractie voor een altijd-complete accepteer-lijst (nooit afgekapt).
    // Met een eigen klok: is de tijd op, dan gaat het antwoord zonder gedestilleerd
    // plan terug (de aanroeper valt dan terug op de volledige tekst als plan) in
    // plaats van dat het hele verzoek stukloopt op de tijdslimiet van Vercel.
    const restMs = EIND - Date.now();
    const proposal = restMs > 8_000
      ? await metAfkap(extractProposal(reply).catch(() => null), restMs, null)
      : null;
    return NextResponse.json({ ok: true, reply, proposal, bronnen: ontdubbel(bronnen) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
