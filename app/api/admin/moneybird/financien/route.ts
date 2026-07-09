import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../../lib/admin-scope";
import {
  getProfitLoss, getProfitLossRaw, getLedgerAccounts, getPostDetails,
  getExpensesByContact, getExpensesByContactRaw, getMbContacts, moneybirdConfigured,
} from "../../../../../lib/moneybird";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Financiële data voor de begrotingspagina (alleen eigenaar).
// - ?period=202607 of ?period=202601..202612 → winst/verlies + grootboek.
// - ?level=post&type=revenue|cost&ledgerId=...&period=... → drill-down: de
//   facturen achter één post, gegroepeerd per klant/leverancier.
// - ?level=abonnementen&months=6 → kosten per leverancier per maand (voor
//   het herkennen van terugkerende kosten).
// - ?raw=pl / ?raw=ebc → onbewerkte rapport-respons (debug van veldnamen).

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  if (!moneybirdConfigured()) return NextResponse.json({ ok: true, configured: false });

  const q = req.nextUrl.searchParams;
  const period = (q.get("period") || "this_year").trim();

  try {
    if (q.get("raw") === "pl") {
      return NextResponse.json({ ok: true, configured: true, raw: await getProfitLossRaw(period) });
    }
    if (q.get("raw") === "ebc") {
      return NextResponse.json({ ok: true, configured: true, raw: await getExpensesByContactRaw(period) });
    }

    const level = q.get("level") || "";
    if (level === "post") {
      const type = q.get("type") === "revenue" ? "revenue" as const : "cost" as const;
      const ledgerId = (q.get("ledgerId") || "").trim();
      if (!ledgerId) return NextResponse.json({ ok: false, error: "ledgerId ontbreekt." }, { status: 400 });
      const contacts = await getPostDetails(type, ledgerId, period);
      return NextResponse.json({ ok: true, configured: true, contacts });
    }
    if (level === "abonnementen") {
      const n = Math.min(12, Math.max(3, Number(q.get("months")) || 6));
      const now = new Date();
      const months: string[] = [];
      for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const [perMonthRaw, contacts] = await Promise.all([
        Promise.all(months.map((m) => getExpensesByContact(m))),
        getMbContacts(),
      ]);
      // Het rapport geeft alleen contact-id's; de namen komen uit de contactenlijst.
      const nameOf = new Map(contacts.map((c) => [c.id, c.name]));
      const perMonth = perMonthRaw.map((list) =>
        list.map((r) => ({ ...r, contactName: r.contactName || nameOf.get(r.contactId) || "Onbekende leverancier" }))
      );
      return NextResponse.json({ ok: true, configured: true, months, perMonth });
    }

    const [profitLoss, ledger] = await Promise.all([getProfitLoss(period), getLedgerAccounts()]);
    return NextResponse.json({ ok: true, configured: true, profitLoss, ledger });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Ophalen mislukt." }, { status: 502 });
  }
}
