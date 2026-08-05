import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { guardSlug } from "../../../../lib/admin-scope";
import {
  maakControle, runControle, getControle, laatsteControle, zetHandmatig, bewaarConcept,
} from "../../../../lib/mail-controle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

// ═══════════════════════════════════════════════════════════
// DE CONTROLEKNOP BIJ EEN MAIL
// ═══════════════════════════════════════════════════════════
// POST   start een controle en laat hem meteen server-side doorlopen
// GET    de stand plus de punten plus het concept (waar het scherm op pollt)
// PATCH  Maartens eigen oordeel over een punt, of het bewerkte concept
//
// Waarom de controle niet in het antwoord van de POST past: één controle leest een
// handvol pagina's door een echte browser en doet daarna nog twee AI-rondes. Dat
// zijn minuten, geen seconden. Dus: rij aanmaken, teruggeven, en het scherm pollt.
// ═══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "");
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const conversationId = String(body.conversationId || "").trim();
  const messageId = String(body.messageId || "").trim();
  const vraag = String(body.vraag || "").trim();
  if (!conversationId && !vraag) {
    return NextResponse.json({ ok: false, error: "Geen mailgesprek en geen vraag; ik weet dan niet wat ik moet controleren." }, { status: 400 });
  }

  const id = await maakControle({
    slug, conversationId, messageId,
    onderwerp: String(body.onderwerp || "").trim(),
    vraag,
  });

  // Meteen beginnen; de cron is alleen het vangnet als deze aanroep sneuvelt.
  waitUntil(runControle(id).catch(() => null));

  return NextResponse.json({ ok: true, id });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const idParam = req.nextUrl.searchParams.get("id");
  const conversationId = req.nextUrl.searchParams.get("conversationId") || "";

  const controle = idParam
    ? await getControle(slug, Number(idParam))
    : conversationId
      ? await laatsteControle(slug, conversationId)
      : null;

  return NextResponse.json({ ok: true, controle });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "");
  const g = await guardSlug(req, slug);
  if (!g.ok) return g.res;

  const id = Number(body.id || 0);
  if (!id) return NextResponse.json({ ok: false, error: "Geen controle opgegeven." }, { status: 400 });

  if (typeof body.puntKey === "string") {
    const waarde = String(body.handmatig || "");
    if (waarde !== "" && waarde !== "goed" && waarde !== "niet") {
      return NextResponse.json({ ok: false, error: "Onbekend oordeel." }, { status: 400 });
    }
    await zetHandmatig(slug, id, body.puntKey, waarde);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.conceptHtml === "string") {
    await bewaarConcept(slug, id, String(body.conceptOnderwerp || ""), body.conceptHtml);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Niets om bij te werken." }, { status: 400 });
}
