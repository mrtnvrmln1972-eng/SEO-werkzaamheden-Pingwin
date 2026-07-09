import { NextRequest, NextResponse } from "next/server";
import { getOpenInvoices, moneybirdConfigured } from "../../../../lib/moneybird";
import { msSendMail, msStatus } from "../../../../lib/ms-graph";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Wekelijkse facturen-mail (Vercel Cron, maandagochtend): een simpel overzicht
// van alle facturen die langer dan 30 dagen na verzending openstaan, naar
// maarten@pingwin.nl. Staat er niets zo lang open, dan komt er geen mail.

const OVERDUE_DAYS = 30;
const TO = "maarten@pingwin.nl";

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  // Zelfde beveiliging als de andere crons: met CRON_SECRET moet de header
  // kloppen (Vercel Cron stuurt die mee); zonder secret mag handmatig testen.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  if (!moneybirdConfigured()) return NextResponse.json({ ok: true, skipped: "Moneybird niet geconfigureerd." });
  const mail = await msStatus();
  if (!mail.connected) return NextResponse.json({ ok: false, error: "Microsoft 365 is niet gekoppeld; mail kan niet verstuurd worden." }, { status: 502 });

  let overdue;
  try {
    overdue = (await getOpenInvoices()).filter((i) => i.daysOpen > OVERDUE_DAYS);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Moneybird ophalen mislukt." }, { status: 502 });
  }
  if (overdue.length === 0) return NextResponse.json({ ok: true, sent: false, reason: "Geen facturen langer dan 30 dagen open." });

  overdue.sort((a, b) => b.daysOpen - a.daysOpen);
  const total = overdue.reduce((s, i) => s + i.totalUnpaid, 0);

  // Bewust simpele mail: aanhef, korte alinea, simpele opsomming, afsluiting.
  const items = overdue.map((i) =>
    `<li style="margin-bottom:6px;">${i.contactName}: factuur ${i.invoiceId}, ${euro(i.totalUnpaid)}, ${i.daysOpen} dagen open &mdash; <a href="${i.url}">open in Moneybird</a></li>`
  ).join("");
  const html = [
    `<p>Hoi Maarten,</p>`,
    `<p>${overdue.length === 1 ? "Er staat 1 factuur" : `Er staan ${overdue.length} facturen`} langer dan ${OVERDUE_DAYS} dagen open, samen ${euro(total)}:</p>`,
    `<ul>${items}</ul>`,
    `<p>Via de link bij elke factuur kun je in Moneybird direct een herinnering versturen.</p>`,
    `<p>Groet,<br/>je Pingwin-dashboard</p>`,
  ].join("");

  const subject = `Facturen-signaal: ${overdue.length === 1 ? "1 factuur staat" : `${overdue.length} facturen staan`} langer dan ${OVERDUE_DAYS} dagen open (${euro(total)})`;
  const sent = await msSendMail([TO], subject, html);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error || "Mail versturen mislukt." }, { status: 502 });
  return NextResponse.json({ ok: true, sent: true, count: overdue.length, total });
}
