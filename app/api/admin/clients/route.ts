import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { listClients, createClient, deleteClient, updateClientCockpit, parseSheetUrl } from "../../../../lib/clients";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const clients = await listClients();
  return NextResponse.json({ ok: true, clients });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const loginId = String(body.loginId || "").trim();
  const email = String(body.email || "").trim();
  const sheetUrl = String(body.sheetUrl || "").trim();

  const maandbudget = Number(body.maandbudget) || 0;
  const linkbuilding = Number(body.linkbuilding) || 0;
  const uurtarief = Number(body.uurtarief) || 0;
  const beschikbareUren = Number(body.beschikbareUren) || 0;

  if (!name || !loginId) {
    return NextResponse.json(
      { ok: false, error: "Naam en inlognaam zijn verplicht." },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(loginId)) {
    return NextResponse.json(
      { ok: false, error: "Inlognaam mag alleen letters, cijfers, punt, streepje of underscore bevatten (geen spaties)." },
      { status: 400 },
    );
  }

  const { sheetId, gid } = parseSheetUrl(sheetUrl);
  if (!sheetId) {
    return NextResponse.json(
      { ok: false, error: "Kon geen geldige Google Sheet-link herkennen. Plak de volledige link naar het juiste tabblad." },
      { status: 400 },
    );
  }

  try {
    const { client, password } = await createClient({
      name, loginId, email, sheetId, gid,
      maandbudget, linkbuilding, uurtarief, beschikbareUren,
    });
    return NextResponse.json({ ok: true, client, password });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "Er bestaat al een klant met deze inlognaam. Kies een andere." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Aanmaken mislukt: " + msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  }
  const ok = await updateClientCockpit(slug, {
    emailDomain: String(body.emailDomain || "").trim() || null,
    workDocUrl: String(body.workDocUrl || "").trim() || null,
    resultsUrl: String(body.resultsUrl || "").trim() || null,
    status: String(body.status || "").trim() || null,
    lastContact: String(body.lastContact || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
  });
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get("slug") || "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  }
  const removed = await deleteClient(slug);
  return NextResponse.json({ ok: removed });
}
