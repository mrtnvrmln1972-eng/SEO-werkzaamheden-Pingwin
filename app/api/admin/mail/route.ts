import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { msStatus, msSearchClientEmails, msReplyHtml, msSendMail, msListAttachments } from "../../../../lib/ms-graph";
import { getVerborgenMails, verbergMail } from "../../../../lib/snapshots";
import { zoektermenVoorPagina, scoreMail } from "../../../../lib/page-emails";
import { getStepLinks } from "../../../../lib/page-doc-run";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Live mails met een klant ophalen uit Microsoft 365.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  // Lichte status-vraag (voor het mailvenster): is er hier een mailkoppeling?
  // Zonder koppeling valt de UI terug op het eigen mailprogramma (mailto).
  if (req.nextUrl.searchParams.get("status") === "1") {
    const s = await msStatus();
    return NextResponse.json({ ok: true, connected: s.connected });
  }
  // De bijlagen van één mail, zodat je ze in het paneel naar een taak kunt slepen.
  // Alleen de lijst (naam en id); het bestand zelf wordt pas opgehaald als je hem
  // ergens neerlegt.
  const bijlagenVan = req.nextUrl.searchParams.get("bijlagen") || "";
  if (bijlagenVan) {
    const g0 = await guardSlug(req, req.nextUrl.searchParams.get("slug") || ""); if (!g0.ok) return g0.res;
    const lijst = await msListAttachments(bijlagenVan).catch(() => null);
    // Inline-plaatjes worden al weggefilterd; logo's en handtekeningen die er toch
    // als losse bijlage in zitten zijn geen documenten.
    const bijlagen = (lijst || []).filter((a) => !/^image\//i.test(a.type || ""));
    return NextResponse.json({ ok: true, bijlagen });
  }

  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const status = await msStatus();
  if (!status.connected) return NextResponse.json({ ok: true, connected: false, emails: [] });

  const query = (client.email || client.domain || "").trim();
  if (!query) return NextResponse.json({ ok: true, connected: true, emails: [] });

  const emails = await msSearchClientEmails(query, status.account || "", 15);
  if (emails === null) return NextResponse.json({ ok: false, error: "Ophalen mislukt. Mogelijk opnieuw koppelen." }, { status: 502 });
  // Wat Maarten hier heeft weggegooid, blijft weg (de mail zelf blijft in de mailbox staan).
  const weg = new Set(await getVerborgenMails(slug));
  const overgebleven = emails.filter((e) => !weg.has(e.id));

  // Deze lijst diende alleen als "laatste 15 mails van de klant", los van welke
  // pagina er open staat. Klik je op een kaart om zelf een mail te koppelen, dan
  // stond de meest recente mail bovenaan, ook al ging die over iets heel anders
  // (een planningsoverleg, een andere pagina). Is er een pagina meegegeven, sorteer
  // dan op wat er echt bij die pagina past: dezelfde puntentelling die de automaat
  // ook gebruikt, alleen sorterend in plaats van wegfilterend, dus er verdwijnt
  // nooit een mail die je zelf zoekt.
  const gevraagdeUrl = req.nextUrl.searchParams.get("url") || "";
  if (!gevraagdeUrl) return NextResponse.json({ ok: true, connected: true, emails: overgebleven });

  const klantDomein = (client.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  let pad = "";
  try { pad = new URL(gevraagdeUrl).pathname.replace(/\/+$/, ""); } catch { pad = ""; }
  const [termen, stepLinks] = await Promise.all([
    zoektermenVoorPagina(slug, gevraagdeUrl).catch(() => []),
    getStepLinks(slug, gevraagdeUrl).catch(() => ({ analyse: "", blauwdruk: "", copy: "" } as Record<string, string>)),
  ]);
  const docLinks = Object.values(stepLinks).filter(Boolean);
  const gerangschikt = overgebleven
    .map((e) => ({ e, s: scoreMail(e, pad, docLinks, termen, klantDomein) }))
    .sort((a, b) => b.s.score - a.s.score || (new Date(b.e.receivedAt || 0).getTime() - new Date(a.e.receivedAt || 0).getTime()))
    .map(({ e, s }) => ({ ...e, relevantie: s.score }));
  return NextResponse.json({ ok: true, connected: true, emails: gerangschikt });
}

// Een mail uit dit overzicht weghalen. Raakt de mailbox niet: we onthouden
// alleen dat dit bericht niet meer bij deze klant getoond hoeft te worden.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Geen mail opgegeven." }, { status: 400 });
  await verbergMail(slug, id);
  return NextResponse.json({ ok: true });
}

// Een mail beantwoorden vanuit het dashboard.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const html = String(body.html || "").trim();
  const to = String(body.to || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  // Hoort deze gebruiker bij deze klant? Stond alleen op de GET; nu er meer
  // schermen langs deze route mailen, hoort de controle ook hier.
  const bodySlug = String(body.slug || "").trim();
  if (bodySlug) { const g = await guardSlug(req, bodySlug); if (!g.ok) return g.res; }

  // Compose-modus: een nieuwe mail versturen (bijv. naar de developer).
  if (body.mode === "compose") {
    if (to.length === 0 || !html) return NextResponse.json({ ok: false, error: "Ontvanger en bericht zijn verplicht." }, { status: 400 });
    const result = await msSendMail(to, String(body.subject || "").trim(), html);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sentTo: result.sentTo || [] });
  }

  const id = String(body.id || "").trim();
  if (!id || !html) return NextResponse.json({ ok: false, error: "Mail-id en bericht zijn verplicht." }, { status: 400 });
  const result = await msReplyHtml(id, html, to);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: result.sentTo || [] });
}
