import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { googleStatus, driveStatus, disconnectDrive } from "../../../../lib/google";

export const runtime = "nodejs";

// Status van de twee losse Google-koppelingen (Beheer → Instellingen):
// data = Search Console + Analytics (wie de cijfers levert),
// drive = documenten-opslag (in wiens Drive documenten landen).

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const [data, drive] = await Promise.all([googleStatus(), driveStatus()]);
  return NextResponse.json({ ok: true, data, drive });
}

// Drive-koppeling verwijderen (de data-koppeling laten we bewust met rust;
// die vervang je door simpelweg opnieuw te koppelen).
export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  await disconnectDrive();
  return NextResponse.json({ ok: true });
}
