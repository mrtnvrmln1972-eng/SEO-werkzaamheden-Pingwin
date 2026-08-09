import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { msListAccounts, msDisconnectAccount } from "../../../../lib/ms-graph";

export const runtime = "nodejs";

// Gekoppelde Microsoft-mailboxen (R5, meerdere mailboxen). Alleen de eigenaar
// beheert welke mailboxen meedoen; koppelen zelf gaat via /api/ms/auth/start
// (dat is een login-actie en hoort dus bij Maarten).

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const accounts = await msListAccounts();
  return NextResponse.json({ ok: true, accounts });
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige mailbox." }, { status: 400 });
  await msDisconnectAccount(id);
  return NextResponse.json({ ok: true });
}
