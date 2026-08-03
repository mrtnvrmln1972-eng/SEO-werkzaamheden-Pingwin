import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { bewaarBestand, getClientFiles, verwijderBestand } from "../../../../lib/client-files";

export const runtime = "nodejs";
// Uitlezen gaat via Drive (omzetten van docx/pdf) en een afbeelding wordt
// beschreven; dat kost even.
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

const MAX_BYTES = 20 * 1024 * 1024;

// Wat er in dit gesprek (of in de hele kast) hangt.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = req.nextUrl.searchParams.get("thread") || "";
  const url = req.nextUrl.searchParams.get("url") || "";
  const files = await getClientFiles(slug, { thread: thread || undefined, url: url || undefined });
  return NextResponse.json({ ok: true, files });
}

// Een gedropt of geplakt bestand: origineel naar de klantmap in Drive, inhoud
// uitgelezen (of bij een afbeelding beschreven), en als rij in de bestandenkast.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
  const slug = String(form.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Dit bestand is groter dan 20 MB. Zet het zelf in Drive en plak de link." }, { status: 400 });

  const naam = (file.name || "bestand").slice(0, 200);
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await bewaarBestand(slug, naam, buf, file.type || "", {
    thread: String(form.get("thread") || "").trim(),
    url: String(form.get("url") || "").trim(),
  });
  return r.ok ? NextResponse.json({ ok: true, file: r.file }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 });
}

// Uit de kast halen. Het bestand zelf blijft in Drive staan.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en bestand zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await verwijderBestand(slug, id);
  return NextResponse.json({ ok: true });
}
