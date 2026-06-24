import { NextRequest, NextResponse } from "next/server";
import { getClientByLoginId, getClientPassword } from "../../../lib/clients";
import { SESSION_COOKIE, makeSessionValue } from "../../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { loginId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const loginId = (body.loginId || "").trim();
  const password = body.password || "";

  if (!process.env.SESSION_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Server niet geconfigureerd (SESSION_SECRET ontbreekt)." },
      { status: 500 },
    );
  }

  const client = getClientByLoginId(loginId);
  const expected = client ? getClientPassword(client.slug) : undefined;

  // Vage foutmelding: verraadt niet of het de naam of het wachtwoord was.
  if (!client || !expected || password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Inlognaam of wachtwoord klopt niet." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionValue(client.slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });
  return res;
}
