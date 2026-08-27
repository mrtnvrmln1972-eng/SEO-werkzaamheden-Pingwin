import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { waitUntil } from "@vercel/functions";
import { anthropicConfigured } from "../../../../../lib/anthropic";
import { makeProfileDeliverable, mergeProfileSection, type ProfileKind } from "../../../../../lib/client-profile-gen";
import { getClientBySlug, saveClientProfile } from "../../../../../lib/clients";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Genereert een klantprofiel- of tone-of-voice-samenvatting uit de live site.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const kind: ProfileKind = body.kind === "tov" ? "tov" : "profile";
  const folderId = String(body.folderId || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });

  // Achtergrond: meteen server-side draaien (wegklikken mag). We mergen het resultaat
  // zelf in het profielveld en slaan het op, zodat de client het straks kan ophalen.
  if (body.background === true) {
    waitUntil((async () => {
      try {
        const res = await makeProfileDeliverable(slug, kind, folderId || undefined);
        if (res.ok && res.section.trim()) {
          const client = await getClientBySlug(slug);
          const merged = mergeProfileSection(client?.seoProfileRuw || "", res.section);
          await saveClientProfile(slug, merged);
        }
      } catch { /* uitblijven = de gebruiker probeert opnieuw */ }
    })());
    return NextResponse.json({ ok: true, started: true });
  }

  const res = await makeProfileDeliverable(slug, kind, folderId || undefined);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, section: res.section, taskId: res.taskId, link: res.link, driveError: res.driveError });
}
