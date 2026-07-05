import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminSession, makeUserSession } from "../../../../lib/admin-auth";
import { getTeamUserForLogin } from "../../../../lib/team-users";
import { verifyPassword } from "../../../../lib/password";

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
      { ok: false, error: "Server niet geconfigureerd (admin)." },
      { status: 500 },
    );
  }

  function setCookie(value: string) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  // 1) Env-eigenaar: alleen het wachtwoord (ADMIN_PASSWORD), zoals altijd. Werkt
  //    zowel zonder inlognaam als met de inlognaam "admin".
  if (
    process.env.ADMIN_PASSWORD &&
    password === process.env.ADMIN_PASSWORD &&
    (loginId === "" || loginId.toLowerCase() === "admin")
  ) {
    return setCookie(makeAdminSession());
  }

  // 2) Teamgebruiker (gast): inlognaam + wachtwoord tegen de database.
  if (loginId) {
    const found = await getTeamUserForLogin(loginId).catch(() => null);
    if (found && verifyPassword(password, found.passwordHash)) {
      return setCookie(makeUserSession(found.user.id));
    }
  }

  return NextResponse.json({ ok: false, error: "Inlognaam of wachtwoord klopt niet." }, { status: 401 });
}
