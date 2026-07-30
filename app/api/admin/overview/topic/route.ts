import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { setThreadMeta, generateTopicMetaFor } from "../../../../../lib/chat";

export const runtime = "nodejs";

// Slaat de samenvatting (1-2 regels) en/of de "gedaan"-vlag van één bird's
// eye-onderwerp (thread) op. Raakt de berichten niet aan.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = String(body.thread || "").trim();
  if (!slug || !thread) return NextResponse.json({ ok: false, error: "Klant en onderwerp zijn verplicht." }, { status: 400 });

  // Inhaalslag: genereer titel + samenvatting uit de bestaande historie.
  if (body.generate === true) {
    try { const gen = await generateTopicMetaFor(slug, thread); return NextResponse.json({ ok: true, ...gen }); }
    catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  }

  const meta: { title?: string; summary?: string; done?: boolean } = {};
  if (typeof body.title === "string") meta.title = body.title;
  if (typeof body.summary === "string") meta.summary = body.summary;
  if (typeof body.done === "boolean") meta.done = body.done;
  await setThreadMeta(slug, thread, meta);
  return NextResponse.json({ ok: true });
}
