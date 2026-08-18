import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { addWeekplanTasks, isoWeek, setWeekplanNotitie } from "../../../../lib/weekplan";
import { callClaude, LIGHT_MODEL, anthropicConfigured } from "../../../../lib/anthropic";
import { eigenTekst } from "../../../../lib/mail-tekst";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// VAN MAIL NAAR TAAK, IN ÉÉN KLIK
// ═══════════════════════════════════════════════════════════
// Bij "Laatste mails" staat naast het Superhuman-knopje een knopje "Taak". Komt
// er een mail binnen met werk erin (een foutmelding op een pagina, een verzoek
// van de klant), dan hoefde daar tot nu toe eerst een taak voor getypt te worden
// met de mail ernaast: onderwerp overtypen, samenvatten, en de link erbij zoeken.
//
// Dit doet die drie dingen zelf:
//   1. een korte taaktitel uit de mail (één regel, geen onderwerpregel-plakwerk);
//   2. een heel korte beschrijving in het BESTAANDE veld Aantekeningen van de
//      kaart, met de link naar de mail eronder. Bewust geen nieuw veld erbij:
//      een tweede plek voor hetzelfde soort tekst loopt gegarandeerd uit elkaar;
//   3. de mail als bronmail aan de kaart hangen, zodat de kaart zelf al een
//      knopje "Bronmail" heeft.
//
// Zonder AI-sleutel werkt de knop gewoon door: dan wordt de onderwerpregel de
// titel en het eerste stukje mail de aantekening. Een knop die niets doet omdat
// een sleutel ontbreekt is erger dan een iets minder mooie titel.

const TITEL_MAX = 90;

/** Onderwerpregel zonder de Re:/Fwd:-aanslibbing ervoor. */
function schoonOnderwerp(s: string): string {
  return (s || "").replace(/^\s*((re|fw|fwd|antw|aw)\s*:\s*)+/i, "").trim();
}

function ontsnap(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** De aantekening zoals hij in het veld komt: korte beschrijving, dan de herkomst. */
function notitieHtml(beschrijving: string, van: string, datum: string, link: string): string {
  const regels: string[] = [];
  if (beschrijving) regels.push(`<p>${ontsnap(beschrijving)}</p>`);
  const herkomst = [van && `van ${van}`, datum].filter(Boolean).join(", ");
  const bron = link
    ? `<p>Uit de mail${herkomst ? ` ${herkomst}` : ""}: <a href="${ontsnap(link)}">open de mail</a></p>`
    : herkomst ? `<p>Uit de mail ${herkomst}.</p>` : "";
  if (bron) regels.push(bron);
  return regels.join("");
}

function nederlandseDatum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const onderwerp = schoonOnderwerp(String(body.onderwerp || ""));
  const van = String(body.van || "").trim();
  const link = String(body.link || "").trim().slice(0, 600);
  const datumIso = String(body.datum || "").trim();
  const datum = datumIso ? nederlandseDatum(datumIso) : "";
  // De mailtekst komt van het scherm mee: daar hangt de mail al, dus hem hier
  // nog een keer bij Microsoft ophalen zou een tweede ronde zijn voor dezelfde
  // tekst. HTML gaat door dezelfde opschoner als de rest van het dashboard, dus
  // handtekening en citaat eronder tellen niet mee.
  const ruw = String(body.tekst || "");
  const tekst = (/<[a-z][\s\S]*>/i.test(ruw) ? eigenTekst(ruw, "", 2500) : ruw.replace(/\s+/g, " ").trim()).slice(0, 2500);

  if (!onderwerp && !tekst) {
    return NextResponse.json({ ok: false, error: "Deze mail heeft geen onderwerp en geen tekst om een taak van te maken." }, { status: 400 });
  }

  // Terugval: zonder AI-sleutel (of als het uitschrijven misgaat) is de
  // onderwerpregel de titel en het begin van de mail de aantekening.
  let titel = onderwerp.slice(0, TITEL_MAX) || tekst.slice(0, TITEL_MAX);
  let beschrijving = tekst.slice(0, 300);

  if (anthropicConfigured()) {
    const sys = `Je bent Maartens assistent bij SEO-bureau Pingwin. Je krijgt één e-mail met een klant en maakt daar een taakkaart van.
Regels:
- "titel": één korte regel in het Nederlands die zegt WAT ER MOET GEBEUREN, in de gebiedende wijs, maximaal ${TITEL_MAX} tekens. Niet de onderwerpregel overtypen. Voorbeeld: "Foutmelding op de knippatronen-pagina laten oplossen".
- "beschrijving": twee tot drie korte zinnen over waar de mail over gaat en wat er gevraagd wordt. Gewone taal, geen jargon, geen opmaak (geen markdown, geen sterretjes, geen kopjes), geen aanhef of afsluiting, geen losse streepjes als zinsscheiding.
- Verzin niets: gebruik alleen wat er in de mail staat.
Antwoord met UITSLUITEND geldige JSON: {"titel":"...","beschrijving":"..."}`;
    const inhoud = [
      van && `Afzender: ${van}`,
      datum && `Datum: ${datum}`,
      `Onderwerp: ${onderwerp || "(geen onderwerp)"}`,
      "",
      tekst || "(geen tekst)",
    ].filter((r) => r !== undefined).join("\n");
    try {
      const raw = await callClaude(sys, [{ role: "user", content: inhoud }], 600, { slug, action: "mail-taak" }, LIGHT_MODEL);
      const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { titel?: string; beschrijving?: string };
      if (p.titel && p.titel.trim()) titel = p.titel.trim().slice(0, TITEL_MAX);
      if (p.beschrijving && p.beschrijving.trim()) beschrijving = p.beschrijving.trim().slice(0, 600);
    } catch {
      /* stil: de terugval hierboven is een prima taak, alleen minder mooi geformuleerd */
    }
  }

  if (!titel) return NextResponse.json({ ok: false, error: "Er kwam geen taaktitel uit deze mail." }, { status: 400 });

  try {
    const r = await addWeekplanTasks(slug, "mail", [{
      taak: titel,
      wie: "SEO",
      bronMail: link || undefined,
      week: isoWeek(new Date()),
    }]);
    const id = r.nieuweIds[0];
    if (!id) {
      return NextResponse.json({ ok: false, error: "Deze taak stond al in de planning." }, { status: 409 });
    }
    await setWeekplanNotitie(slug, id, notitieHtml(beschrijving, van, datum, link)).catch(() => null);
    return NextResponse.json({ ok: true, id, titel });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Taak aanmaken mislukte: " + (e as Error).message }, { status: 500 });
  }
}
