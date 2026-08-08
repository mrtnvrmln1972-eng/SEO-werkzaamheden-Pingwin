import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPaginaMails, getPaginaMail, zoekMailsVoorPagina, koppelMail, pinMail, losMail, wegMail } from "../../../../lib/page-emails";
import { msListAttachments, msGetAttachment } from "../../../../lib/ms-graph";
import { leesAangeleverdDocument, voegVersieToe } from "../../../../lib/doc-versions";
import { logActiviteit } from "../../../../lib/activiteit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mails die bij één pagina horen: ophalen, opnieuw zoeken, vastpinnen,
// losmaken of wegklikken. Weggeklikt blijft weg; die komt nooit terug als
// voorstel.

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    return NextResponse.json({ ok: true, mails: await getPaginaMails(slug, url) });
  } catch {
    return NextResponse.json({ ok: false, error: "De mails konden niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "");
  const url = String(body.url || "");
  const actie = String(body.actie || "");
  const id = Number(body.id || 0);
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  try {
    if (actie === "zoek") {
      if (!url) return NextResponse.json({ ok: false, error: "Pagina is verplicht." }, { status: 400 });
      const r = await zoekMailsVoorPagina(slug, url);
      return NextResponse.json({ ok: true, ...r, mails: await getPaginaMails(slug, url) });
    }
    if (!id) return NextResponse.json({ ok: false, error: "Mail is verplicht." }, { status: 400 });

    // Tekstbijlagen uit deze mail als klantversie klaarzetten. Ze verschijnen
    // daarna in het bestaande Documenten-blokje op de kaart, met de knoppen
    // Verwerk en Negeer die er al zijn. Geen nieuw besluitscherm dus.
    if (actie === "bijlage") {
      const m = await getPaginaMail(slug, id);
      if (!m) return NextResponse.json({ ok: false, error: "Mail niet gevonden." }, { status: 404 });
      const lijst = await msListAttachments(m.messageId);
      if (lijst === null) return NextResponse.json({ ok: false, error: "De mailkoppeling staat uit of de mail is niet meer op te halen." }, { status: 502 });
      const bruikbaar = lijst.filter((a) => /\.(docx|pdf|txt|md)$/i.test(a.naam));
      if (!bruikbaar.length) return NextResponse.json({ ok: false, error: "Deze mail heeft geen tekstbijlage." }, { status: 400 });

      const klaar: string[] = [];
      const mislukt: string[] = [];
      for (const a of bruikbaar) {
        const bin = await msGetAttachment(m.messageId, a.id);
        if (!bin) { mislukt.push(a.naam); continue; }
        const lees = await leesAangeleverdDocument(slug, m.url, bin.naam, bin.buffer);
        if (!lees.ok || !lees.tekst) { mislukt.push(`${a.naam} (${lees.error || "onleesbaar"})`); continue; }
        await voegVersieToe(slug, m.url, bin.naam, lees.tekst, lees.driveLink || "");
        klaar.push(a.naam);
        await logActiviteit({
          slug, soort: "copy", bron: "mail-bijlage", bronId: `${m.messageId}:${a.id}`,
          url: m.url, wie: "Pingwin", zichtbaar: false,
          intern: `Klantversie uit de mail van ${m.vanNaam || m.vanAdres}: ${a.naam}`,
          bewijs: m.webLink || m.superhumanLink || null,
        });
      }
      return NextResponse.json({
        ok: klaar.length > 0,
        klaar, mislukt,
        error: klaar.length ? undefined : `Geen enkele bijlage kon ingelezen worden. ${mislukt.join("; ")}`,
      });
    }

    // Zelf koppelen werkt op het bericht-id uit de mailbox, niet op een rij-id in
    // page_emails: de mail hoeft daar nog helemaal niet te staan, dat is juist het
    // punt van deze actie.
    if (actie === "koppel") {
      const messageId = String(body.messageId || "").trim();
      if (!messageId || !url) return NextResponse.json({ ok: false, error: "Mail en pagina zijn allebei nodig." }, { status: 400 });
      const r = await koppelMail(slug, url, messageId);
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, mails: await getPaginaMails(slug, url) });
    }

    if (actie === "pin") await pinMail(slug, id);
    else if (actie === "los") await losMail(slug, id);
    else if (actie === "weg") await wegMail(slug, id);
    else return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
    return NextResponse.json({ ok: true, mails: url ? await getPaginaMails(slug, url) : [] });
  } catch {
    return NextResponse.json({ ok: false, error: "De actie kon niet uitgevoerd worden." }, { status: 500 });
  }
}
