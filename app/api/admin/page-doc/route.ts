import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { generateDocSpec, type DocKind } from "../../../../lib/page-doc";
import { buildPingwinDoc } from "../../../../lib/pingwin-docx";
import { appendTasks } from "../../../../lib/tasks";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}

// Genereert een Pingwin-huisstijl document (blauwdruk of copy) voor één pagina en
// geeft het terug als .docx-download. Bij copy komt er tevens een taak voor de
// developer bij (de copy moet immers door de bouwer op de pagina worden gezet).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const kindRaw = String(body.kind || "").trim();
  const kind: DocKind = kindRaw === "copy" ? "copy" : kindRaw === "analyse" ? "analyse" : "blauwdruk";
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  let spec, title;
  try {
    ({ spec, title } = await generateDocSpec(slug, url, kind));
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon de ${kind} niet genereren: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  let buffer: Buffer;
  try {
    buffer = await buildPingwinDoc(spec);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon het document niet opmaken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  // Copy is een bouwtaak voor de developer: als taak wegschrijven zodat hij op de pagina komt.
  if (kind === "copy") {
    try {
      await appendTasks(slug, [{
        taak: `Nieuwe copy plaatsen: ${title}`.slice(0, 90),
        toelichting: "De copy staat in het bijgevoegde Pingwin-document. Plaats de teksten (H1, H2's, alinea's, FAQ, meta-title en meta-description) op de pagina.",
        status: "Gepland",
        wie: "Dev",
        fase: "Bouwen",
        pageUrl: url,
        klantZichtbaar: false,
      }]);
    } catch { /* document toch teruggeven, taak is bijzaak */ }
  }

  const filename = `${safeName(spec.klant)}-${kind}-${safeName(title)}.docx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Doc-Kind": kind,
    },
  });
}
