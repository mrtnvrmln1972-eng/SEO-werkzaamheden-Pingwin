import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import {
  listTeamUsers,
  createTeamUser,
  updateTeamUser,
  resetTeamUserPassword,
  deleteTeamUser,
} from "../../../../lib/team-users";

export const runtime = "nodejs";

// Beheer van teamgebruikers (gasten). Uitsluitend voor de eigenaar.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, users: await listTeamUsers() });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const name = String(body.name || "").trim();
  const loginId = String(body.loginId || "").trim();
  const allowedSlugs = Array.isArray(body.allowedSlugs) ? (body.allowedSlugs as unknown[]).map((s) => String(s)) : [];
  const canSeeMail = body.canSeeMail === true;
  const canEdit = body.canEdit === true;
  const editSlugs = Array.isArray(body.editSlugs) ? (body.editSlugs as unknown[]).map((s) => String(s)) : [];
  const email = String(body.email || "").trim();

  if (!loginId) return NextResponse.json({ ok: false, error: "Inlognaam is verplicht." }, { status: 400 });
  if (!/^[a-zA-Z0-9._-]+$/.test(loginId)) {
    return NextResponse.json({ ok: false, error: "Inlognaam mag alleen letters, cijfers, punt, streepje of underscore bevatten (geen spaties)." }, { status: 400 });
  }

  try {
    const { user, password } = await createTeamUser({ name, loginId, allowedSlugs, canSeeMail, canEdit, editSlugs, email });
    return NextResponse.json({ ok: true, user, password });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "Er bestaat al een gebruiker met deze inlognaam." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Aanmaken mislukt: " + msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige gebruiker." }, { status: 400 });

  // Wachtwoord opnieuw genereren.
  if (body.action === "resetPassword") {
    const password = await resetTeamUserPassword(id);
    if (!password) return NextResponse.json({ ok: false, error: "Gebruiker niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true, password });
  }

  // Rechten bijwerken (naam, e-mail, klanten, mail-recht, wijzig-recht).
  const patch: { name?: string | null; allowedSlugs?: string[]; canSeeMail?: boolean; canEdit?: boolean; editSlugs?: string[]; email?: string | null } = {};
  if ("name" in body) patch.name = String(body.name || "").trim() || null;
  if ("allowedSlugs" in body) patch.allowedSlugs = Array.isArray(body.allowedSlugs) ? (body.allowedSlugs as unknown[]).map((s) => String(s)) : [];
  if ("canSeeMail" in body) patch.canSeeMail = body.canSeeMail === true;
  if ("canEdit" in body) patch.canEdit = body.canEdit === true;
  if ("editSlugs" in body) patch.editSlugs = Array.isArray(body.editSlugs) ? (body.editSlugs as unknown[]).map((s) => String(s)) : [];
  if ("email" in body) patch.email = String(body.email || "").trim() || null;
  const ok = await updateTeamUser(id, patch);
  if (!ok) return NextResponse.json({ ok: false, error: "Gebruiker niet gevonden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const id = Number(new URL(req.url).searchParams.get("id") || "");
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige gebruiker." }, { status: 400 });
  const removed = await deleteTeamUser(id);
  return NextResponse.json({ ok: removed });
}
