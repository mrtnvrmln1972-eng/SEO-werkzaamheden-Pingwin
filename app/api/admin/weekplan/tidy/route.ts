import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../../lib/db";
import { updateWeekplanToelichting } from "../../../../../lib/weekplan";
import { callClaude, anthropicConfigured } from "../../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// "Ruim op": herschrijft de kaarttekst één keer naar het strakke formaat
// (Doel-kennis, Afspraken, Aanpak per fase). Alleen op Maartens klik; de prompt
// verbiedt verzinnen en weggooien, dus de inhoud blijft, alleen de ordening niet.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = Number(body.id);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart-id zijn verplicht." }, { status: 400 });

  await ensureSchema();
  const { rows } = await sql`SELECT taak, toelichting, url FROM client_weekplan WHERE client_slug = ${slug} AND id = ${id} LIMIT 1`;
  const rij = rows[0];
  if (!rij) return NextResponse.json({ ok: false, error: "Kaart niet gevonden." }, { status: 404 });
  const oud = ((rij.toelichting as string) || "").trim();
  if (!oud) return NextResponse.json({ ok: false, error: "Deze kaart heeft geen tekst om op te ruimen." }, { status: 400 });

  const system = [
    `Je ruimt de infotekst van een SEO-projectkaart op. De kaart heet: "${String(rij.taak || "")}"${rij.url ? ` en gaat over de pagina ${rij.url}` : ""}.`,
    `Herschrijf de tekst naar EXACT dit formaat, in gewone platte tekst:`,
    `Achtergrond:`,
    `- korte puntige regels met alleen KENNIS: cijfers, herkomst, positionering, cannibalisatie-nuance, stand van zaken (elk punt hooguit vijftien woorden)`,
    `Afspraken en herkomst:`,
    `- '-'-bullets met mails (datum, wie), referenties, en instructies die over een ANDERE pagina gaan (met het pad erbij); deze sectie weglaten als hij leeg is`,
    `Aanpak per fase:`,
    `- '-'-bullets die beginnen met exact een fasenaam en dubbele punt: Analyse:, Blauwdruk:, Copy:, Bouw:, Structured data: (alleen fases die nodig zijn; meta-title/description hoort bij Copy, alt-teksten en interne links bij Bouw)`,
    `Regels: verzin NIETS en gooi NIETS inhoudelijks weg; alleen dubbelingen en herhaling van de kaarttitel mogen vervallen. Elke instructie hoort bij precies één fase-regel, niet ook nog in Achtergrond. Geen Markdown-symbolen (#, | of **), geen emoji, geen tekst buiten dit formaat.`,
  ].join("\n");

  try {
    const nieuw = (await callClaude(system, [{ role: "user", content: oud }], 1500, { slug, action: "weekplan_tidy" })).trim();
    if (!nieuw || nieuw.length < 20) return NextResponse.json({ ok: false, error: "Opruimen leverde geen bruikbare tekst op; er is niets gewijzigd." }, { status: 502 });
    await updateWeekplanToelichting(slug, id, nieuw);
    return NextResponse.json({ ok: true, toelichting: nieuw });
  } catch {
    return NextResponse.json({ ok: false, error: "De assistent is niet bereikbaar; er is niets gewijzigd." }, { status: 502 });
  }
}
