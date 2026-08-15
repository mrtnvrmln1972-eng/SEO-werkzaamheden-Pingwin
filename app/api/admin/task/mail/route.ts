import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { msSendMail, msStatus } from "../../../../../lib/ms-graph";
import { getClientBySlug } from "../../../../../lib/clients";
import { planOpvolging } from "../../../../../lib/mail-opvolg";
import { bouwMailHtml } from "../../../../../lib/mail-body";

export const runtime = "nodejs";
export const maxDuration = 60;

// Verstuurt de mail vanuit een weekplan-kaart écht, via Microsoft 365.
//
// De knop "Versturen" zette eerder alleen window.location.href op een mailto-link.
// Dat opent hooguit een mailprogramma, en met een lange tekst plus een volledige
// Google Docs-URL wordt die link zo lang dat browsers hem stil laten vallen: je
// klikt en er gebeurt niets. De facturenmail verstuurt al via Graph; dit doet
// hetzelfde.
//
// Mens aan het stuur blijft gelden: er gaat alleen iets weg als Maarten op
// Versturen klikt, met de tekst die hij op dat moment ziet.

// Adressen opschonen. Microsoft weigerde "maarten@pingwin.nl," omdat de komma als
// onderdeel van het adres meeging: "Recipient is not resolved". Splitsen op komma en
// puntkomma lost dat op en maakt meerdere ontvangers meteen mogelijk.
function adressen(ruw: string): string[] {
  return (ruw || "")
    .split(/[,;]+/)
    .map((a) => a.trim().replace(/^[<]|[>]$/g, ""))
    .filter(Boolean);
}
const ADRES_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  let body: { slug?: string; to?: string; onderwerp?: string; tekst?: string; links?: { label: string; url: string }[];
               afbeeldingen?: string[]; herinnerDagen?: number; taak?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const ontvangers = adressen(String(body.to || ""));
  const to = ontvangers.join(", ");
  const tekst = String(body.tekst || "").trim();
  const onderwerp = String(body.onderwerp || "").trim();
  if (!ontvangers.length) return NextResponse.json({ ok: false, error: "Vul eerst het e-mailadres van de ontvanger in." }, { status: 400 });
  // Vóór het versturen controleren, zodat je een begrijpelijke melding krijgt in
  // plaats van een afwijzing van Microsoft achteraf.
  const fout = ontvangers.filter((a) => !ADRES_OK.test(a));
  if (fout.length) return NextResponse.json({ ok: false, error: `Dit lijkt geen geldig e-mailadres: ${fout.join(", ")}` }, { status: 400 });
  if (!tekst) return NextResponse.json({ ok: false, error: "De mail is nog leeg." }, { status: 400 });

  const st = await msStatus().catch(() => ({ configured: false, connected: false, account: null }));
  if (!st.connected) {
    // Geen koppeling: eerlijk zeggen wat er aan de hand is en waar het opgelost
    // wordt, in plaats van een knop die stil niets doet.
    return NextResponse.json({
      ok: false,
      koppelingOntbreekt: true,
      error: "Microsoft 365 is niet gekoppeld, dus versturen kan niet vanuit het dashboard. Koppel het op het Klant-tabblad, of gebruik Kopieer en plak de mail in Superhuman.",
    }, { status: 400 });
  }

  const links = (Array.isArray(body.links) ? body.links : []).filter((l) => l && l.url && l.label);
  // Max 6, zelfde grens als het venster zelf hanteert bij het toevoegen.
  const afbeeldingen = (Array.isArray(body.afbeeldingen) ? body.afbeeldingen : []).filter((a) => typeof a === "string").slice(0, 6);
  const klant = await getClientBySlug(slug).catch(() => null);
  const html = bouwMailHtml(tekst, links, klant?.domain || "", afbeeldingen);
  const r = await msSendMail(ontvangers, onderwerp || "Bericht van Pingwin", html);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "Versturen mislukte." }, { status: 502 });

  // Om een reactie moet je vaak zelf achteraan. Vroeg je om een herinnering, dan
  // verschijnt die op de afgesproken dag bij het belletje in de kopbalk.
  const dagen = Number(body.herinnerDagen || 0);
  let herinnering = "";
  if (dagen > 0) {
    await planOpvolging({
      clientSlug: slug, taak: String(body.taak || ""), onderwerp, naar: to,
      url: String(body.url || ""), dagen,
    }).catch(() => { /* de mail is weg; een mislukte herinnering mag dat niet ongedaan maken */ });
    herinnering = ` Je krijgt over ${Math.round(dagen)} ${Math.round(dagen) === 1 ? "dag" : "dagen"} een herinnering om te checken of er antwoord is.`;
  }
  return NextResponse.json({ ok: true, sentTo: r.sentTo, samenvatting: `Verstuurd naar ${to}.${herinnering}` });
}
