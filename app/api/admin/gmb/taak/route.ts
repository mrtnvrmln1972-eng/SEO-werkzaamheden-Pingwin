import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { addWeekplanTasks, isoWeek } from "../../../../../lib/weekplan";
import { getGmbStand } from "../../../../../lib/gmb";
import { CHECK, SUGGESTIES } from "../../../../../lib/gmb-kennis";

export const runtime = "nodejs";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════
// VAN SIGNAAL NAAR TAAK OP DE PLANNING
// ═══════════════════════════════════════════════════════════
// Een bevinding die alleen op een scherm staat, gebeurt niet. Daarom kan elk
// punt op het profielscherm hier een kaart in de weekplanning worden, met drie
// dingen erin die een kaart pas bruikbaar maken:
//
// 1. WAT er moet gebeuren (de actie uit lib/gmb-kennis.ts, niet een herhaling
//    van het probleem).
// 2. WAAROM, plus het gemeten bewijs. Zonder dat is een kaart over drie weken
//    een raadsel, en kun je er ook niets over aan de klant vertellen.
// 3. WAAR HET VANDAAN KOMT: een link terug naar exact dit punt op het
//    profielscherm. Deze kaart hangt niet aan een pagina van de site, dus zonder
//    die link is er geen weg terug naar de context.
//
// Bewust geen AI: de tekst staat al vast in de kennislaag, en een model dat hem
// herschrijft levert alleen variatie op tussen kaarten die hetzelfde bedoelen.

/** De vaste terugweg naar het punt op het scherm. */
function herkomst(slug: string, anker: string): string {
  return `/admin/client/${slug}?tab=google-profiel#${anker}`;
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  // Welke punten: een losse selectie, of alles wat er bij deze locatie ligt.
  const soort = String(body.soort || "");
  const sleutel = String(body.sleutel || "").trim();   // welke vestiging
  const keys: string[] = Array.isArray(body.keys) ? body.keys.map(String).filter(Boolean) : [];
  if (!soort || !keys.length) return NextResponse.json({ ok: false, error: "Er is niets aangevinkt om op de planning te zetten." }, { status: 400 });

  const stand = await getGmbStand(slug);
  const loc = stand.result?.locaties.find((l) => l.sleutel === sleutel) || stand.result?.locaties[0] || null;
  const waar = loc?.vestiging ? ` (${loc.vestiging})` : "";
  const week = isoWeek(new Date());

  const rijen: { taak: string; toelichting: string; wie: string; taaktype: string; week: { year: number; week: number } }[] = [];

  if (soort === "bevinding") {
    for (const k of keys) {
      const c = CHECK.get(k);
      if (!c) continue;
      const bev = loc?.bevindingen.find((b) => b.key === k);
      rijen.push({
        taak: `Google-profiel${waar}: ${c.label.toLowerCase()}`,
        toelichting: [
          `**Wat je doet:** ${c.actie}`,
          bev?.bewijs ? `**Wat we gemeten hebben:** ${bev.bewijs}` : "",
          `**Waarom dit uitmaakt:** ${c.waarom}`,
          loc?.profiel?.mapsUrl ? `**Het profiel:** ${loc.profiel.mapsUrl}` : "",
          `**Waar dit vandaan komt:** ${herkomst(slug, `gmb-${sleutel}-${k}`)}`,
        ].filter(Boolean).join("\n\n"),
        wie: "SEO", taaktype: "gmb", week,
      });
    }
  } else if (soort === "suggestie") {
    for (const k of keys) {
      const s = SUGGESTIES.find((x) => x.key === k);
      if (!s) continue;
      rijen.push({
        taak: `Google-profiel${waar}: ${s.titel.toLowerCase()}`,
        toelichting: [
          `**Wat je doet:** ${s.wat}`,
          `**Waarom dit werkt:** ${s.waarom}`,
          `**Hoe vaak:** ${s.ritme}`,
          loc?.profiel?.mapsUrl ? `**Het profiel:** ${loc.profiel.mapsUrl}` : "",
          `**Waar dit vandaan komt:** ${herkomst(slug, `gmb-suggestie-${k}`)}`,
        ].filter(Boolean).join("\n\n"),
        wie: "SEO", taaktype: "gmb", week,
      });
    }
  } else if (soort === "beheer") {
    // De allereerste taak bij een nieuwe klant: toegang vragen. Staat los van de
    // metingen, want zonder toegang blijft de helft ongemeten.
    rijen.push({
      taak: `Google-profiel${waar}: beheertoegang aanvragen bij de klant`,
      toelichting: [
        `**Wat je doet:** mail de klant met het verzoek om Pingwin als beheerder toe te voegen aan het Google-bedrijfsprofiel. De kant-en-klare tekst staat op het profielscherm, met het juiste Google-adres erin.`,
        `**Waarom dit uitmaakt:** met beheertoegang zien we hoe vaak het profiel gezien wordt, hoe vaak er gebeld wordt en hoeveel routes er opgevraagd worden. Dat is de voor-en-na waarmee we kunnen laten zien wat het werk oplevert. Zonder toegang meten we alleen de buitenkant.`,
        `**Waar dit vandaan komt:** ${herkomst(slug, "gmb-beheer")}`,
      ].join("\n\n"),
      wie: "SEO", taaktype: "gmb", week,
    });
  } else {
    return NextResponse.json({ ok: false, error: "Onbekend soort punt." }, { status: 400 });
  }

  if (!rijen.length) return NextResponse.json({ ok: false, error: "Deze punten konden niet omgezet worden." }, { status: 400 });

  const r = await addWeekplanTasks(slug, "google-profiel", rijen);
  const n = r.added + r.merged;
  return NextResponse.json({
    ok: true, added: r.added, merged: r.merged,
    melding: `${n} ${n === 1 ? "taak" : "taken"} op de planning gezet${r.merged ? `, waarvan ${r.merged} samengevoegd met een bestaande kaart` : ""}.`,
  });
}
