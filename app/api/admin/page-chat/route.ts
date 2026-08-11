import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { callClaudeAgentic, anthropicConfigured, type ChatMsg } from "../../../../lib/anthropic";
import { buildSystemPrompt, parseProposal, extractProposal } from "../../../../lib/page-chat-ground";
import { CHAT_TOOLS, runChatTool } from "../../../../lib/chat-tools";
import { korteGeschiedenis } from "../../../../lib/chat-inkorten";
import { bronVan, ontdubbel, type Bron } from "../../../../lib/chat-bronnen";

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
    // Wat de chat opzocht, meegeven zodat het onder het antwoord te zien is.
    const bronnen: Bron[] = [];
    const run = async (naam: string, invoer: Record<string, unknown>) => {
      const uit = await runChatTool(naam, invoer);
      try { const b = bronVan(naam, invoer); if (b) bronnen.push(b); } catch { /* nooit blokkeren */ }
      return uit;
    };
    // 9 rondes was te krap voor een pagina met veel zoekwoorden; de klok zorgt dat een
    // lang onderzoek netjes afrondt binnen het venster van 300 seconden.
    const raw = await callClaudeAgentic(system, historie, CHAT_TOOLS, run, 20, 4096, { slug, action: "page_chat" }, Date.now() + 210_000);
    const { reply } = parseProposal(raw);
    // Aparte extractie voor een altijd-complete accepteer-lijst (nooit afgekapt).
    const proposal = await extractProposal(reply).catch(() => null);
    return NextResponse.json({ ok: true, reply, proposal, bronnen: ontdubbel(bronnen) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
