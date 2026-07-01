import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { anthropicConfigured } from "../../../../lib/anthropic";
import { clientVersionSpec, type DocKind } from "../../../../lib/page-doc";
import { buildPingwinDoc } from "../../../../lib/pingwin-docx";
import { getPageDriveFolder, getPageDocOutputs } from "../../../../lib/site-urls";
import { setClientDocLink } from "../../../../lib/tasks";
import { uploadDocx } from "../../../../lib/drive";

const STEP_KIND: Record<string, string> = { analyse: "analyse_doc", blauwdruk: "blauwdruk_doc", copy: "copy_doc" };

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}
function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}
const LABEL: Record<string, string> = { analyse: "analyse", blauwdruk: "blauwdruk", copy: "copy" };

// Maakt een KLANTVERSIE van een eerder gegenereerd technisch document (analyse/
// blauwdruk/copy): korte, begrijpelijke duiding in klanttaal. Het technische
// bronstuk blijft ongemoeid (blijft de bron voor de blauwdruk).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const kind = ["analyse", "blauwdruk", "copy"].includes(String(body.kind)) ? String(body.kind) : "analyse";
  const extra = String(body.extra || "").trim().slice(0, 1500);
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en URL zijn verplicht." }, { status: 400 });

  // Bron = de tekst van het eerder gegenereerde technische document.
  const outputs = await getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>));
  const source = outputs[kind];
  if (!source) return NextResponse.json({ ok: false, error: `Genereer eerst het ${LABEL[kind]}-document (knop hierboven); daar maak ik dan de klantversie van.` }, { status: 400 });

  let spec, title;
  try {
    ({ spec, title } = await clientVersionSpec(slug, url, kind as DocKind, source, extra || undefined));
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon de klantversie niet maken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  let buffer: Buffer;
  try { buffer = await buildPingwinDoc(spec); }
  catch (e) { return NextResponse.json({ ok: false, error: `Kon het document niet opmaken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 }); }

  const filename = `${safeName(spec.klant)}-klantversie-${LABEL[kind]}-${safeName(title)}.docx`;
  const wantDownload = String(body.deliver || "") === "download";
  let folderId = String(body.folderId || "").trim();
  if (!folderId && !wantDownload) {
    const saved = await getPageDriveFolder(slug, url).catch(() => null);
    if (saved) folderId = saved.folderId;
  }

  if (folderId && !wantDownload) {
    let link: string, shared: boolean, owner: string, folder: string, isDoc: boolean, note: string;
    try { ({ link, shared, owner, folder, isDoc, note } = await uploadDocx(folderId, filename, buffer)); }
    catch (e) { return NextResponse.json({ ok: false, error: `Document gemaakt, maar upload naar Drive mislukte: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 502 }); }
    // Koppel de klantversie aan de stap-werkzaamheid zodat hij in het klantdashboard verschijnt.
    await setClientDocLink(slug, url, STEP_KIND[kind], link).catch(() => null);
    return NextResponse.json({ ok: true, delivered: "drive", link, filename, title, shared, owner, folder, isDoc, note });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
