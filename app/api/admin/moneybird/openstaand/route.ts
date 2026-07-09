import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../../lib/admin-scope";
import { listClients, setMoneybirdContact, type ClientConfig } from "../../../../../lib/clients";
import { getOpenInvoices, getMbContacts, moneybirdConfigured, type OpenInvoice } from "../../../../../lib/moneybird";

export const runtime = "nodejs";

// Openstaande facturen uit Moneybird, gegroepeerd per dashboard-klant.
// Alleen voor de eigenaar; klant-logins en gast-teamleden komen hier niet in.

const OVERDUE_DAYS = 30; // signaalgrens: 30 dagen na verzenddatum

function emailDomain(v: string | null | undefined): string {
  const s = (v || "").trim().toLowerCase();
  if (!s) return "";
  return s.includes("@") ? s.split("@").pop() || "" : s;
}
function norm(v: string | null | undefined): string {
  return (v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Automatische match: Moneybird-contactnaam gelijk aan de klantnaam, of het
// e-maildomein van het contact gelijk aan dat van de klant.
function autoMatch(client: ClientConfig, inv: OpenInvoice): boolean {
  const cName = norm(client.name);
  if (cName && norm(inv.contactName) === cName) return true;
  const cDomain = emailDomain(client.cockpit.emailDomain) || emailDomain(client.email);
  const iDomain = emailDomain(inv.contactEmail);
  return !!cDomain && !!iDomain && cDomain === iDomain;
}

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  if (!moneybirdConfigured()) {
    return NextResponse.json({ ok: true, configured: false, byClient: [], unmatched: [], totals: null });
  }

  // Losse hulpvraag: alle Moneybird-contacten (voor een koppel-keuzelijst).
  if (req.nextUrl.searchParams.get("contacts") === "1") {
    try {
      const contacts = await getMbContacts();
      return NextResponse.json({ ok: true, configured: true, contacts });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 502 });
    }
  }

  try {
    const [invoices, clients] = await Promise.all([getOpenInvoices(), listClients()]);

    const withFlag = invoices.map((i) => ({ ...i, over30: i.daysOpen > OVERDUE_DAYS }));
    const claimed = new Set<string>();
    const byClient: {
      slug: string; name: string; invoices: typeof withFlag;
      openTotal: number; overdueCount: number; overdueTotal: number;
    }[] = [];

    for (const client of clients) {
      let mine = withFlag.filter((i) => client.moneybirdContactId && i.contactId === client.moneybirdContactId);
      // Nog niet gekoppeld: probeer automatisch te matchen en leg de koppeling
      // vast, zodat die daarna vaststaat en handmatig te corrigeren is.
      if (!client.moneybirdContactId) {
        mine = withFlag.filter((i) => autoMatch(client, i));
        const contactId = mine.find((i) => i.contactId)?.contactId;
        if (contactId) await setMoneybirdContact(client.slug, contactId);
      }
      mine.forEach((i) => claimed.add(i.id));
      if (mine.length === 0) continue;
      const overdue = mine.filter((i) => i.over30);
      byClient.push({
        slug: client.slug,
        name: client.name,
        invoices: mine,
        openTotal: mine.reduce((s, i) => s + i.totalUnpaid, 0),
        overdueCount: overdue.length,
        overdueTotal: overdue.reduce((s, i) => s + i.totalUnpaid, 0),
      });
    }

    // Facturen van Moneybird-contacten die (nog) niet aan een dashboard-klant
    // gekoppeld zijn; die mogen niet onzichtbaar blijven.
    const unmatched = withFlag.filter((i) => !claimed.has(i.id));

    const overdueAll = withFlag.filter((i) => i.over30);
    return NextResponse.json({
      ok: true,
      configured: true,
      overdueDays: OVERDUE_DAYS,
      totals: {
        count: withFlag.length,
        total: withFlag.reduce((s, i) => s + i.totalUnpaid, 0),
        overdueCount: overdueAll.length,
        overdueTotal: overdueAll.reduce((s, i) => s + i.totalUnpaid, 0),
      },
      byClient,
      unmatched,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 502 });
  }
}

// Handmatig het Moneybird-contact van een klant koppelen of (met lege waarde)
// ontkoppelen. Er wordt niets in Moneybird zelf gewijzigd.
export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const contactId = String(body.contactId || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant (slug) ontbreekt." }, { status: 400 });
  const done = await setMoneybirdContact(slug, contactId);
  if (!done) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
