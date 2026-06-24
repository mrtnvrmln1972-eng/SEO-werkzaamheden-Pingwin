import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminSession } from "../../../../lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const password = body.password || "";

  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Server niet geconfigureerd (admin)." },
      { status: 500 },
    );
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Wachtwoord klopt niet." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
