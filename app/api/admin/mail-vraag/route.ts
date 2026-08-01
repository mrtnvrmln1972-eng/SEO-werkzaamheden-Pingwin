import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getEmails } from "../../../../lib/snapshots";
import { callClaude } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// Slim vraagveld bij Laatste mails: een vraag in gewone taal ("ik heb een
// document 'klantenservice Bogart', staat er iets over in de mail?") wordt
// beantwoord uit de mails die al in het dashboard hangen; de relevante mails
// komen bovenaan te staan. Zoeken in Superhuman blijft de terugval voor het
// volledige archief.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const vraag = String(body.vraag || "").trim();
  if (!slug || !vraag) return NextResponse.json({ ok: false, error: "Klant en vraag zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const emails = await getEmails(slug, 60);
  if (!emails.length) return NextResponse.json({ ok: false, error: "Er hangen nog geen mails in het dashboard voor deze klant." }, { status: 400 });
  const strip = (html: string | null) => (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lijst = emails.map((e) => {
    const inhoud = (strip(e.bodyHtml) || e.preview || "").slice(0, 700);
    return `[${e.id}] ${e.receivedAt ? e.receivedAt.slice(0, 10) : "?"} ${e.direction === "out" ? "verzonden aan" : "ontvangen van"} ${e.fromName || e.fromAddress || "?"} | Onderwerp: ${e.subject || "(geen)"}\n${inhoud}`;
  }).join("\n\n");

  const sys = `Je bent Maartens assistent bij SEO-bureau Pingwin en beantwoordt een vraag over de e-mails van één klant. Je krijgt de recente mails (met id's) en een vraag in gewone taal.
Regels:
- Antwoord kort en concreet in het Nederlands, in nette markdown (geen emoji, geen jargonmuur): wat is er gevonden en wat moet Maarten ermee. Verwijs naar mails als "de mail van [datum] over [onderwerp]".
- Baseer je UITSLUITEND op de meegegeven mails; staat het er niet in, zeg dat dan eerlijk en adviseer de Superhuman-zoekknop voor het volledige archief.
- "mailIds": de id's van de mails die het antwoord onderbouwen, relevantste eerst (maximaal 5; leeg als niets relevant is).
Antwoord met UITSLUITEND geldige JSON: {"antwoord_md":"...","mailIds":["..."]}`;
  try {
    const raw = await callClaude(sys, [{ role: "user", content: `VRAAG: ${vraag}\n\nMAILS:\n${lijst.slice(0, 40000)}` }], 1600, { slug, action: "mail-vraag" });
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { antwoord_md?: string; mailIds?: unknown };
    const bekend = new Set(emails.map((e) => String(e.id)));
    const ids = (Array.isArray(p.mailIds) ? p.mailIds.map(String) : []).filter((i) => bekend.has(i)).slice(0, 5);
    return NextResponse.json({ ok: true, antwoord: (p.antwoord_md || "").trim() || "Hier kon ik niets over vinden in de mails in het dashboard.", ids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Zoeken mislukte: " + (e as Error).message }, { status: 500 });
  }
}
