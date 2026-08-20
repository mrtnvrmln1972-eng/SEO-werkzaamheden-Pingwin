import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getEmails, getVerborgenMails, type EmailSnapshot } from "../../../../lib/snapshots";
import { getClientBySlug } from "../../../../lib/clients";
import { msStatus, msSearchClientEmails, msSearchMail } from "../../../../lib/ms-graph";
import { zoektermenUitVraag, corrigeerNaam } from "../../../../lib/mail-zoektermen";
import { isRuisMail } from "../../../../lib/mail-tekst";
import { callClaude } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * De mails van deze klant, zoals ze op het scherm staan: eerst live uit de
 * mailbox, en pas als dat niets oplevert wat er opgeslagen is.
 *
 * Waarom dit erbij moest (18-08-2026): dit veld las alleen `client_emails`, en
 * die tabel wordt sinds de Microsoft-koppeling niet meer gevuld. Je stelde dus
 * een vraag over mail die naast je op het scherm stond en kreeg "er hangen nog
 * geen mails in het dashboard voor deze klant" terug. Dezelfde zeef als bij
 * "Laatste mails", zodat een nieuwsbrief het antwoord niet vervuilt.
 */
async function liveMails(slug: string): Promise<EmailSnapshot[]> {
  const client = await getClientBySlug(slug);
  const zoek = (client?.email || client?.domain || "").trim();
  if (!zoek) return getEmails(slug, 60);
  const status = await msStatus();
  if (!status.connected) return getEmails(slug, 60);
  const live = await msSearchClientEmails(zoek, status.account || "", 60);
  if (!live || live.length === 0) return getEmails(slug, 60);
  const weg = new Set(await getVerborgenMails(slug).catch(() => [] as string[]));
  const schoon = live.filter((e) => !weg.has(e.id) && !isRuisMail(e));
  return (schoon.length ? schoon : live) as unknown as EmailSnapshot[];
}

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

  // De mails die op het scherm staan komen LIVE uit de mailbox; opgeslagen mail
  // (client_emails) is alleen wat er ooit via de brug in de database beland is.
  // Dit veld las alleen die database, en dus kreeg je "er hangen nog geen mails
  // in het dashboard" terwijl er een kolom verderop tientallen mails stonden.
  // Nu eerst de mailbox, met de opgeslagen mails als terugval.
  const klantMails = await liveMails(slug).catch(() => [] as Awaited<ReturnType<typeof getEmails>>);
  // ── En nu ook zoeken op de vraag zelf (20-08-2026) ──
  // Hierboven staan de recentste mails van deze klant. Dat is een goed begin en
  // een slecht einde: de mail die je zoekt is vaak juist een oudere, en dan
  // bestaat hij voor het antwoord niet. Maarten vroeg naar "mail van pehlevian"
  // en kreeg één wisseling terug, terwijl de thread die hij zocht (drie weken
  // ouder) gewoon in de mailbox stond.
  //
  // Dus: de woorden uit de vraag worden zoekopdrachten in de mailbox, en een
  // verschreven naam wordt eerst bijgetrokken tegen de mensen met wie deze klant
  // echt mailt ("pehlevian" → "Pehlivan").
  const namen = Array.from(new Set(klantMails.flatMap((e) => [e.fromName || "", e.fromAddress || ""]).filter(Boolean)));
  const termen = zoektermenUitVraag(vraag).map((t) => corrigeerNaam(t, namen));
  const gezocht: string[] = [];
  const extra = new Map<string, EmailSnapshot>();
  const status = await msStatus().catch(() => ({ connected: false, account: "" }));
  if (status.connected && termen.length) {
    const rondes = await Promise.all(termen.slice(0, 3).map(async (t) => {
      const r = await msSearchMail(`"${t}"`, status.account || "", 20, t).catch(() => null);
      return { term: t, mails: r || [] };
    }));
    for (const r of rondes) {
      if (!r.mails.length) continue;
      gezocht.push(r.term);
      for (const m of r.mails) if (!isRuisMail(m)) extra.set(String(m.id), m as unknown as EmailSnapshot);
    }
  }
  // De klantmails eerst (dat is de context waarin je de vraag stelt), daarna wat
  // het zoeken opleverde. Dubbele mails vallen weg op hun id.
  const samen = new Map<string, EmailSnapshot>();
  for (const m of klantMails) samen.set(String(m.id), m);
  for (const [id, m] of extra) if (!samen.has(id)) samen.set(id, m);
  const emails = Array.from(samen.values());
  if (!emails.length) {
    return NextResponse.json({
      ok: false,
      error: "Ik kan de mailbox nu niet bereiken en er staat ook nog niets opgeslagen voor deze klant. Probeer het zo nog eens, of zoek in Superhuman.",
    }, { status: 400 });
  }
  const strip = (html: string | null) => (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lijst = emails.map((e) => {
    const inhoud = (strip(e.bodyHtml) || e.preview || "").slice(0, 700);
    return `[${e.id}] ${e.receivedAt ? e.receivedAt.slice(0, 10) : "?"} ${e.direction === "out" ? "verzonden aan" : "ontvangen van"} ${e.fromName || e.fromAddress || "?"} | Onderwerp: ${e.subject || "(geen)"}\n${inhoud}`;
  }).join("\n\n");

  const sys = `Je bent Maartens assistent bij SEO-bureau Pingwin en beantwoordt een vraag over de e-mails van één klant. Je krijgt de recente mails (met id's) en een vraag in gewone taal.
Regels:
- Antwoord kort en concreet in het Nederlands, in nette markdown (geen emoji, geen jargonmuur): wat is er gevonden en wat moet Maarten ermee. Verwijs naar mails als "de mail van [datum] over [onderwerp]".
- Baseer je UITSLUITEND op de meegegeven mails; staat het er niet in, zeg dat dan eerlijk en adviseer de Superhuman-zoekknop voor het volledige archief.
- Je krijgt de recente mails van deze klant PLUS wat het zoeken op de woorden uit de vraag opleverde. Is er op een naam of woord gezocht dat anders gespeld was dan in de vraag, dan staat dat bij ZOCHT OP; noem die schrijfwijze in je antwoord, zodat duidelijk is waar het antwoord vandaan komt.
- "mailIds": de id's van de mails die het antwoord onderbouwen, relevantste eerst (maximaal 5; leeg als niets relevant is).
Antwoord met UITSLUITEND geldige JSON: {"antwoord_md":"...","mailIds":["..."]}`;
  try {
    const zochtOp = gezocht.length ? `ZOCHT OP: ${gezocht.join(", ")}\n\n` : "";
    const raw = await callClaude(sys, [{ role: "user", content: `VRAAG: ${vraag}\n\n${zochtOp}MAILS:\n${lijst.slice(0, 40000)}` }], 1600, { slug, action: "mail-vraag" });
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)) as { antwoord_md?: string; mailIds?: unknown };
    const bekend = new Set(emails.map((e) => String(e.id)));
    const ids = (Array.isArray(p.mailIds) ? p.mailIds.map(String) : []).filter((i) => bekend.has(i)).slice(0, 5);
    return NextResponse.json({ ok: true, antwoord: (p.antwoord_md || "").trim() || "Hier kon ik niets over vinden in de mails in het dashboard.", ids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Zoeken mislukte: " + (e as Error).message }, { status: 500 });
  }
}
