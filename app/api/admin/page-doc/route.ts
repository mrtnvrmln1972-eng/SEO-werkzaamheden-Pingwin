import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { generateDocSpec, type DocKind } from "../../../../lib/page-doc";
import { buildPingwinDoc } from "../../../../lib/pingwin-docx";
import { upsertStepTask } from "../../../../lib/tasks";
import { getPageDriveFolder } from "../../../../lib/site-urls";
import { uploadDocx } from "../../../../lib/drive";

const STEP_KIND: Record<DocKind, string> = { analyse: "analyse_doc", blauwdruk: "blauwdruk_doc", copy: "copy_doc" };
const STEP_TITLE: Record<DocKind, string> = { analyse: "SEO-analyse", blauwdruk: "Blauwdruk", copy: "Copywriting" };
function pagePath(u: string): string { try { return new URL(u).pathname || u; } catch { return u; } }

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
  const extra = String(body.extra || "").trim().slice(0, 1500);
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  let spec, title;
  try {
    ({ spec, title } = await generateDocSpec(slug, url, kind, extra || undefined));
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon de ${kind} niet genereren: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  let buffer: Buffer;
  try {
    buffer = await buildPingwinDoc(spec);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon het document niet opmaken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  const filename = `${safeName(spec.klant)}-${kind}-${safeName(title)}.docx`;

  // Aflevering: naar Google Drive als er een bestemmingsmap is (expliciet meegegeven
  // of eerder per pagina vastgelegd) en de aanvraag niet om download vraagt.
  const wantDownload = String(body.deliver || "") === "download";
  let folderId = String(body.folderId || "").trim();
  if (!folderId && !wantDownload) {
    const saved = await getPageDriveFolder(slug, url).catch(() => null);
    if (saved) folderId = saved.folderId;
  }

  // Elke stap is een werkzaamheid (SEO), met het document eraan gekoppeld. Één per
  // pagina+stap: opnieuw genereren werkt het document bij, niet een nieuwe taak.
  async function logStepTask(link: string, shared: boolean) {
    const toelichting = link
      ? `${STEP_TITLE[kind]}-document in Google Drive: <a href="${link}">open document</a>.${shared ? " Iedereen met de link kan het bekijken." : " Let op: automatisch delen lukte niet; zet delen in Drive nog even zelf aan."}`
      : `${STEP_TITLE[kind]}-document gegenereerd (gedownload; nog niet in Drive geplaatst).`;
    return upsertStepTask(slug, {
      pageUrl: url, stepKind: STEP_KIND[kind], taak: `${STEP_TITLE[kind]}: ${pagePath(url)}`,
      toelichting, docLink: link || undefined, wie: "SEO", fase: "Bouwen", klantZichtbaar: true,
    }).catch(() => null);
  }

  if (folderId && !wantDownload) {
    let link: string, shared: boolean;
    try {
      ({ link, shared } = await uploadDocx(folderId, filename, buffer));
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Document gemaakt, maar upload naar Drive mislukte: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 502 });
    }
    const taskId = await logStepTask(link, shared);
    return NextResponse.json({ ok: true, delivered: "drive", link, filename, kind, taskId, shared });
  }

  // Geen bestemmingsmap: download; de stap wordt wel als werkzaamheid vastgelegd.
  await logStepTask("", false);
  // Schone kopie: een Node-Buffer kan een venster in een gedeeld geheugenblok zijn;
  // direct als HTTP-body meegeven levert soms een kapot bestand. Uint8Array-kopie fixt dat.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Doc-Kind": kind,
    },
  });
}
