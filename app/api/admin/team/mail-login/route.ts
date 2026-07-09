import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../../lib/admin-scope";
import { getTeamUserById, resetTeamUserPassword } from "../../../../../lib/team-users";
import { msSendMail, msStatus } from "../../../../../lib/ms-graph";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mailt de inloggegevens naar een teamlid: genereert een NIEUW wachtwoord
// (wachtwoorden staan alleen versleuteld in de database en zijn dus niet terug
// te lezen) en stuurt loginnaam + wachtwoord + login-URL vanaf de gekoppelde
// mailbox. Elke klik = een vers wachtwoord; het oude vervalt.

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: { id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Geen geldige gebruiker." }, { status: 400 });

  const user = await getTeamUserById(id);
  if (!user) return NextResponse.json({ ok: false, error: "Gebruiker niet gevonden." }, { status: 404 });
  if (!user.email) return NextResponse.json({ ok: false, error: "Vul eerst een e-mailadres in bij dit teamlid (Bewerken)." }, { status: 400 });

  const ms = await msStatus();
  if (!ms.connected) return NextResponse.json({ ok: false, error: "De mailbox is niet gekoppeld (Outlook/Microsoft). Koppel die eerst; dan kan het dashboard mails versturen." }, { status: 400 });

  const password = await resetTeamUserPassword(id);
  if (!password) return NextResponse.json({ ok: false, error: "Wachtwoord genereren mislukt." }, { status: 500 });

  const loginUrl = `${req.nextUrl.origin}/admin`;
  const first = (user.name || "").trim().split(/\s+/)[0] || "collega";
  const html = `
    <p>Beste ${first},</p>
    <p>Hierbij je inloggegevens voor het SEO-dashboard van Pingwin. Hiermee log je in op het dashboard.</p>
    <p>
      Inloggen: <a href="${loginUrl}">${loginUrl}</a><br>
      Inlognaam: <strong>${user.loginId}</strong><br>
      Wachtwoord: <strong>${password}</strong>
    </p>
    <p>Lukt het inloggen niet, stuur me dan even een berichtje.</p>
    <p>Met vriendelijke groet,<br>Maarten</p>`;

  const sent = await msSendMail([user.email], "Je inloggegevens voor het Pingwin SEO-dashboard", html);
  if (!sent.ok) {
    // Het wachtwoord is al vernieuwd; geef het één keer terug zodat je het
    // alsnog zelf kunt doorgeven.
    return NextResponse.json({ ok: false, error: `Mailen mislukte (${sent.error || "onbekende fout"}). Er is wel een nieuw wachtwoord gegenereerd; geef het eventueel zelf door.`, password }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sentTo: user.email });
}
