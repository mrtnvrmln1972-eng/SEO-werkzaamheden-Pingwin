import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { callClaude, anthropicConfigured } from "../../../../../lib/anthropic";
import { appendTasks } from "../../../../../lib/tasks";
import { mdToHtml } from "../../../../../lib/markdown";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Maakt één klant-zichtbare werkzaamheid van de analyse: korte titel + een
// begrijpelijke klant-samenvatting, met de volledige analyse als interne notitie.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const analysis = String(body.analysis || "").trim();
  if (!slug || !url || !analysis) return NextResponse.json({ ok: false, error: "Klant, URL en analyse zijn verplicht." }, { status: 400 });

  const system = `Uit deze SEO-analyse voor een pagina: geef UITSLUITEND geldige JSON, exact:
{"title": "korte werkzaamheid-titel, max ~70 tekens", "clientSummary": "2 tot 4 zinnen in gewone taal voor de klant: wat we voor deze pagina gaan doen en waarom, zonder jargon"}
Geen tekst eromheen.`;
  let title = "SEO-optimalisatie pagina";
  let clientSummary = "";
  try {
    const raw = await callClaude(system, [{ role: "user", content: analysis.slice(0, 10000) }], 700);
    const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
    if (typeof parsed.title === "string" && parsed.title.trim()) title = parsed.title.trim().slice(0, 90);
    if (typeof parsed.clientSummary === "string") clientSummary = parsed.clientSummary.trim();
  } catch { /* val terug op standaardtitel */ }

  const internalNote = `${mdToHtml(analysis).slice(0, 9000)}`;
  const n = await appendTasks(slug, [{
    taak: title,
    toelichting: internalNote,           // volledige analyse als interne notitie (opgemaakt)
    klantToelichting: clientSummary,     // begrijpelijke samenvatting voor de klant
    status: "Gepland",
    wie: "SEO",
    fase: "Bouwen",
    pageUrl: url,
    klantZichtbaar: true,
  }]);

  return NextResponse.json({ ok: true, created: n, title });
}
