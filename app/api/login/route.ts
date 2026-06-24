import { NextRequest, NextResponse } from "next/server";
import { getClientForLogin } from "../../../lib/clients";
import { verifyPassword } from "../../../lib/password";
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

  const found = await getClientForLogin(loginId);

  // Vage foutmelding: verraadt niet of het de naam of het wachtwoord was.
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "Inlognaam of wachtwoord klopt niet." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionValue(found.config.slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
