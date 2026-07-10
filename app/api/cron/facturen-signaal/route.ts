import { NextRequest, NextResponse } from "next/server";
import { getOpenInvoices, moneybirdConfigured, type OpenInvoice } from "../../../../lib/moneybird";
import { msSendMail, msStatus } from "../../../../lib/ms-graph";
import { listClients } from "../../../../lib/clients";

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

  // Gegroepeerd per klant: aantal facturen + totaalbedrag, met een link naar de
  // klant-cockpit (daar staat de facturen-balk met de Moneybird-links om te
  // herinneren). Facturen zonder gekoppelde klant komen onderaan als 'Overig'.
  const clients = await listClients().catch(() => []);
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://pingwin-seo-dashboard.vercel.app";
  const groups = new Map<string, { name: string; slug: string | null; invoices: OpenInvoice[] }>();
  for (const inv of overdue) {
    const client = clients.find((c) => c.moneybirdContactId && inv.contactId === c.moneybirdContactId);
    const key = client ? client.slug : `mb:${inv.contactName || "onbekend"}`;
    const cur = groups.get(key) || { name: client?.name || inv.contactName || "Overig", slug: client?.slug || null, invoices: [] };
    cur.invoices.push(inv);
    groups.set(key, cur);
  }
  const sorted = [...groups.values()].sort((a, b) => b.invoices.reduce((s, i) => s + i.totalUnpaid, 0) - a.invoices.reduce((s, i) => s + i.totalUnpaid, 0));

  // Bewust simpele mail: aanhef, korte alinea, simpele opsomming per klant, afsluiting.
  const items = sorted.map((g) => {
    const sum = g.invoices.reduce((s, i) => s + i.totalUnpaid, 0);
    const label = `${g.invoices.length === 1 ? "1 factuur" : `${g.invoices.length} facturen`}, samen ${euro(sum)}`;
    const link = g.slug
      ? ` &mdash; <a href="${origin}/admin/client/${encodeURIComponent(g.slug)}">open ${g.name} in het dashboard</a> (daar staan de Moneybird-links om te herinneren)`
      : g.invoices[0]?.url ? ` &mdash; <a href="${g.invoices[0].url}">open in Moneybird</a>` : "";
    return `<li style="margin-bottom:8px;"><strong>${g.name}</strong>: ${label}${link}</li>`;
  }).join("");
  const html = [
    `<p>Hoi Maarten,</p>`,
    `<p>${overdue.length === 1 ? "Er staat 1 factuur" : `Er staan ${overdue.length} facturen`} langer dan ${OVERDUE_DAYS} dagen open, samen ${euro(total)}, bij ${sorted.length === 1 ? "1 klant" : `${sorted.length} klanten`}:</p>`,
    `<ul>${items}</ul>`,
    `<p>Groet,<br/>je Pingwin-dashboard</p>`,
  ].join("");

  const subject = `Facturen-signaal: ${overdue.length === 1 ? "1 factuur staat" : `${overdue.length} facturen staan`} langer dan ${OVERDUE_DAYS} dagen open (${euro(total)})`;
  const sent = await msSendMail([TO], subject, html);
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error || "Mail versturen mislukt." }, { status: 502 });
  return NextResponse.json({ ok: true, sent: true, count: overdue.length, total });
}
