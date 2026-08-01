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
  // Mail v2: doelgroep (klant/dev/anders), een vrije instructie en documentlinks
  // die als kale URL in de mail mogen. Zonder deze velden gedraagt de route zich
  // exact als voorheen (klant-mail), dus bestaande aanroepen blijven werken.
  const audience = ["klant", "dev", "anders"].includes(String(body.audience || "")) ? String(body.audience) : "klant";
  const instructie = stripTags(String(body.instructie || "")).slice(0, 1000);
  const ontvanger = stripTags(String(body.ontvanger || "")).slice(0, 120);
  const links = (Array.isArray(body.links) ? body.links : [])
    .map((l) => ({ label: stripTags(String((l as Record<string, unknown>)?.label || "")).slice(0, 60), url: String((l as Record<string, unknown>)?.url || "").trim().slice(0, 600) }))
    .filter((l) => l.url).slice(0, 6);
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en taak zijn verplicht." }, { status: 400 });

  const client = await getClientBySlug(slug).catch(() => null);
  const naam = client?.name || "de klant";
  const profiel = (client?.seoProfile || "").slice(0, 1500);

  const opmaakRegels = [
    `Harde regels voor de opmaak en lengte (dit is een echte mail, niemand leest een muur van tekst):`,
    `- MAXIMAAL 120 woorden tussen aanhef en afsluiting. Liever korter. Dit is hard.`,
    `- Opbouw: aanhef, één openingszin met de kern, dan de concrete punten als korte '-'-bullets (elk één regel), eventueel één slotzin, afsluiting.`,
    `- Vertel NOOIT het proces na ("voor we aan de slag gingen hebben we uitgebreid gekeken naar..."): alleen wat er gebeurt of gebeurd is en wat het oplevert.`,
    `- Alinea's van hooguit twee zinnen. Geen kopjes, geen tabellen, geen vetgedrukte woorden, geen Markdown-tekens.`,
    `- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, puntkomma, haakjes of een nieuwe zin.`,
    `- Nederlands. Kort en concreet. Geen loze beloftes.`,
  ];
  const doelgroep = audience === "dev"
    ? [
        `Je schrijft namens Maarten van Pingwin (SEO-bureau) een korte, directe e-mail aan de developer/sitebouwer van de klant "${naam}".`,
        `Doel: concreet doorgeven wat er op de site moet gebeuren, met de relevante details zodat de developer meteen aan de slag kan. Vakjargon mag.`,
        ...opmaakRegels,
        `- Sluit af met "Groet, Maarten (Pingwin)".`,
      ]
    : audience === "anders"
    ? [
        `Je schrijft namens Maarten van Pingwin (SEO- en online-marketingbureau) een korte, heldere e-mail${ontvanger ? ` aan ${ontvanger}` : ""} over werk voor de klant "${naam}".`,
        `Doel: neutraal en duidelijk uitleggen waar het over gaat en wat er van de ontvanger wordt gevraagd of gemeld.`,
        ...opmaakRegels,
        `- Sluit af met "Met vriendelijke groet, Maarten (Pingwin)".`,
      ]
    : [
        `Je schrijft namens Pingwin (SEO- en online-marketingbureau) een korte, vriendelijke e-mail aan de klant "${naam}".`,
        `Doel: in gewone taal uitleggen wat we (gaan) doen, waarom dat goed is voor hun vindbaarheid, en wat het oplevert. Zo ziet de klant de waarde, zonder een urenverantwoording.`,
        `Gewone taal, geen jargon. Vermijd woorden als "meta", "canonical", "cannibalisatie" of leg ze in één simpele zin uit.`,
        ...opmaakRegels,
        `- Sluit af met "Met vriendelijke groet, Pingwin".`,
      ];

  const system = [
    ...doelgroep,
    links.length ? `\nDeze documentlinks mag je als kale URL in de mail opnemen waar relevant (bijvoorbeeld ter controle of review):\n${links.map((l) => `- ${l.label}: ${l.url}`).join("\n")}` : ``,
    instructie ? `\nEXTRA WENS VAN DE GEBRUIKER (volg dit):\n${instructie}` : ``,
    profiel && audience === "klant" ? `\nContext over de klant (gebruik subtiel om de toon te raken, niet letterlijk overnemen):\n${profiel}` : ``,
  ].filter(Boolean).join("\n");

  const user = [
    `Taak: ${taak}`,
    url ? `Pagina: ${url}` : ``,
    toelichting ? `Achtergrond en waarom (intern; gebruik wat relevant is voor deze ontvanger):\n${toelichting}` : `Er is nog geen aparte onderbouwing; schrijf op basis van de taak zelf.`,
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
