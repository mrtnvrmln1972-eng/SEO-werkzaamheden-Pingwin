import { NextRequest, NextResponse } from "next/server";
import { getOrgData, saveOrgData, getSlugByOrgToken, type OrgData } from "../../../../lib/org-data";
import { getClientBySlug } from "../../../../lib/clients";

export const runtime = "nodejs";

// Publieke (token-beveiligde) API voor de klant-deelpagina met bedrijfsgegevens.
// De token is het enige toegangsbewijs; zonder geldige token geen data.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const slug = await getSlugByOrgToken(token);
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });
  const [rec, client] = await Promise.all([getOrgData(slug), getClientBySlug(slug)]);
  return NextResponse.json({ ok: true, data: rec.data, locked: rec.locked, clientName: client?.name || "" });
}

export async function POST(req: NextRequest) {
  let body: { token?: string; data?: OrgData };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = await getSlugByOrgToken(String(body.token || ""));
  if (!slug) return NextResponse.json({ ok: false, error: "Deze link is niet (meer) geldig." }, { status: 404 });
  if (!body.data) return NextResponse.json({ ok: false, error: "Geen gegevens meegegeven." }, { status: 400 });
  const res = await saveOrgData(slug, body.data, "klant");
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 423 });
  return NextResponse.json({ ok: true });
}
