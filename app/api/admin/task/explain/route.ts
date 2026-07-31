import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { callClaude } from "../../../../../lib/anthropic";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function stripTags(s: string): string {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

// Maakt van de "waarom" achter een taak (de onderbouwing die de bird's eye bedacht)
// een korte, klantvriendelijke uitleg-mail. Zo laat je de waarde en de moeite zien
// zonder een urenstaat: "dit doen we, dít is waarom, en dit levert het op."
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taak = stripTags(String(body.taak || ""));
  const toelichting = stripTags(String(body.toelichting || ""));
  const url = String(body.url || "").trim();
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en taak zijn verplicht." }, { status: 400 });

  const client = await getClientBySlug(slug).catch(() => null);
  const naam = client?.name || "de klant";
  const profiel = (client?.seoProfile || "").slice(0, 1500);

  const system = [
    `Je schrijft namens Pingwin (SEO- en online-marketingbureau) een korte, vriendelijke e-mail aan de klant "${naam}".`,
    `Doel: in gewone taal uitleggen wat we (gaan) doen, waarom dat goed is voor hun vindbaarheid, en wat het oplevert. Zo ziet de klant de waarde, zonder een urenverantwoording.`,
    ``,
    `Harde regels voor de opmaak (dit is een echte klant-mail):`,
    `- Gewone taal, geen jargon. Vermijd woorden als "meta", "canonical", "cannibalisatie" of leg ze in één simpele zin uit.`,
    `- Simpel: aanhef, een paar korte alinea's, hooguit een paar simpele bullets, vriendelijke afsluiting. Geen kopjes, geen tabellen, geen vetgedrukte woorden.`,
    `- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, puntkomma, haakjes of een nieuwe zin.`,
    `- Nederlands. Kort en concreet. Geen loze beloftes. Sluit af met "Met vriendelijke groet, Pingwin".`,
    profiel ? `\nContext over de klant (gebruik subtiel om de toon te raken, niet letterlijk overnemen):\n${profiel}` : ``,
  ].join("\n");

  const user = [
    `Taak: ${taak}`,
    url ? `Pagina: ${url}` : ``,
    toelichting ? `Achtergrond en waarom (intern; vertaal dit naar begrijpelijke klanttaal):\n${toelichting}` : `Er is nog geen aparte onderbouwing; leg op basis van de taak zelf uit waarom dit goed is voor de vindbaarheid.`,
  ].filter(Boolean).join("\n");

  try {
    const text = await callClaude(system, [{ role: "user", content: user }], 700, { slug, action: "taak_uitleg_klant" });
    const clean = (text || "").trim();
    if (!clean) return NextResponse.json({ ok: false, error: "Geen uitleg gegenereerd." }, { status: 502 });
    return NextResponse.json({ ok: true, text: clean });
  } catch {
    return NextResponse.json({ ok: false, error: "De assistent is niet bereikbaar." }, { status: 502 });
  }
}
