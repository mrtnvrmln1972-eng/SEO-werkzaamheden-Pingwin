import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getOpenInvoices, moneybirdConfigured, type OpenInvoice } from "../../../../lib/moneybird";
import { msSendMail, msStatus } from "../../../../lib/ms-graph";
import { getSetting, SETTING_INVOICE_MAIL } from "../../../../lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mailt de >30-dagen-facturen van één klant (met Moneybird-links) naar het
// administratie-adres uit de instellingen. De server haalt de facturen zelf
// opnieuw op; er wordt niets uit de browser vertrouwd behalve de klant-slug.

const OVERDUE_DAYS = 30;

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function emailDomain(v: string | null | undefined): string {
  const s = (v || "").trim().toLowerCase();
  if (!s) return "";
  return s.includes("@") ? s.split("@").pop() || "" : s;
}
function norm(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  if (!moneybirdConfigured()) return NextResponse.json({ ok: false, error: "Moneybird is niet gekoppeld." }, { status: 400 });

  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const client = slug ? await getClientBySlug(slug) : null;
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  const to = await getSetting(SETTING_INVOICE_MAIL);
  if (!to) return NextResponse.json({ ok: false, error: "Er is nog geen administratie-e-mailadres ingesteld. Vul dat in bij Beheer, onder Instellingen." }, { status: 400 });

  const ms = await msStatus();
  if (!ms.connected) return NextResponse.json({ ok: false, error: "De mailbox is niet gekoppeld (Outlook/Microsoft)." }, { status: 400 });

  // Zelfde koppeling als het openstaand-overzicht: op vastgelegd Moneybird-contact,
  // met naam/e-maildomein als vangnet voor klanten die nog niet gekoppeld zijn.
  const matches = (i: OpenInvoice): boolean => {
    if (client.moneybirdContactId) return i.contactId === client.moneybirdContactId;
    const cName = norm(client.name);
    if (cName && norm(i.contactName) === cName) return true;
    const cDomain = emailDomain(client.cockpit.emailDomain) || emailDomain(client.email);
    const iDomain = emailDomain(i.contactEmail);
    return !!cDomain && !!iDomain && cDomain === iDomain;
  };

  let overdue: OpenInvoice[];
  try {
    overdue = (await getOpenInvoices()).filter((i) => matches(i) && i.daysOpen > OVERDUE_DAYS);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Moneybird ophalen mislukt." }, { status: 502 });
  }
  if (overdue.length === 0) return NextResponse.json({ ok: false, error: "Er staat voor deze klant geen factuur langer dan 30 dagen open." }, { status: 400 });

  overdue.sort((a, b) => b.daysOpen - a.daysOpen);
  const total = overdue.reduce((s, i) => s + i.totalUnpaid, 0);

  // Bewust simpele mail: aanhef, korte alinea, simpele opsomming, afsluiting.
  const items = overdue.map((i) =>
    `<li style="margin-bottom:6px;">Factuur ${i.invoiceId}: ${euro(i.totalUnpaid)}, ${i.daysOpen} dagen open &mdash; <a href="${i.url}">open in Moneybird</a></li>`
  ).join("");
  const html = [
    `<p>Hoi,</p>`,
    `<p>Bij ${client.name} ${overdue.length === 1 ? "staat 1 factuur" : `staan ${overdue.length} facturen`} langer dan ${OVERDUE_DAYS} dagen open, samen ${euro(total)}:</p>`,
    `<ul>${items}</ul>`,
    `<p>Wil je hier even achteraan gaan? Via de link bij elke factuur kun je in Moneybird direct een herinnering versturen.</p>`,
    `<p>Groet,<br/>Maarten</p>`,
  ].join("");

  const subject = `Openstaande facturen ${client.name}: ${euro(total)} (langer dan ${OVERDUE_DAYS} dagen)`;
  const sent = await msSendMail([to], subject, html);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error || "Mail versturen mislukt." }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: to, count: overdue.length });
}
