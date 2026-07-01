import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { anthropicConfigured, callClaude } from "../../../../lib/anthropic";
import { summariseChatToSpec } from "../../../../lib/page-doc";
import { buildPingwinDoc } from "../../../../lib/pingwin-docx";
import { upsertStepTask } from "../../../../lib/tasks";
import { getPageDriveFolder } from "../../../../lib/site-urls";
import { uploadDocx } from "../../../../lib/drive";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}
function safeName(s: string): string {
  return (s || "document").replace(/[^\p{L}\p{N} _-]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "document";
}
function pagePath(u: string): string { try { return new URL(u).pathname || u; } catch { return u; } }

// Vat de chat-analyse samen tot één document (naar Drive of download) en legt de
// analyse vast als ÉÉN werkzaamheid, met het document eraan gekoppeld. De losse
// acties uit de analyse worden GEEN aparte werkzaamheden (die staan in het plan).
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  const analysis = String(body.analysis || "").trim();
  const extra = String(body.extra || "").trim().slice(0, 1500);
  if (!slug || !url || !analysis) return NextResponse.json({ ok: false, error: "Klant, URL en analyse zijn verplicht." }, { status: 400 });

  let spec, title;
  try {
    ({ spec, title } = await summariseChatToSpec(slug, url, analysis, extra || undefined));
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Kon de analyse niet samenvatten: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 });
  }

  let buffer: Buffer;
  try { buffer = await buildPingwinDoc(spec); }
  catch (e) { return NextResponse.json({ ok: false, error: `Kon het document niet opmaken: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 500 }); }

  // Korte, klantvriendelijke uitleg (het ?-veld): wat we analyseerden en waarom.
  let klantUitleg = "We hebben in kaart gebracht op welke zoekwoorden deze pagina zich moet richten en wat er nodig is om beter gevonden te worden.";
  try {
    const s = await callClaude(
      "Geef in 1 tot 2 korte zinnen, in gewone taal voor een klant (geen jargon, geen emoji), wat we voor deze pagina hebben geanalyseerd en waarom dat belangrijk is. Geef ALLEEN die zinnen terug.",
      [{ role: "user", content: analysis.slice(0, 8000) }], 200,
    );
    if (s.trim()) klantUitleg = s.trim();
  } catch { /* val terug op de standaardzin */ }

  const filename = `${safeName(spec.klant)}-analyse-${safeName(title)}.docx`;
  const wantDownload = String(body.deliver || "") === "download";
  let folderId = String(body.folderId || "").trim();
  if (!folderId && !wantDownload) {
    const saved = await getPageDriveFolder(slug, url).catch(() => null);
    if (saved) folderId = saved.folderId;
  }

  async function logTask(link: string): Promise<number | null> {
    return upsertStepTask(slug, {
      pageUrl: url, stepKind: "chat_analyse", title: `Analyse & zoekwoordkeuze: ${pagePath(url)}`,
      link: link || undefined, klantToelichting: klantUitleg, wie: "SEO", fase: "Bouwen", klantZichtbaar: true,
    }).catch(() => null);
  }

  if (folderId && !wantDownload) {
    let link: string, shared: boolean, owner: string, folder: string, isDoc: boolean, note: string;
    try { ({ link, shared, owner, folder, isDoc, note } = await uploadDocx(folderId, filename, buffer)); }
    catch (e) { return NextResponse.json({ ok: false, error: `Document gemaakt, maar upload naar Drive mislukte: ${e instanceof Error ? e.message : "onbekende fout"}` }, { status: 502 }); }
    const taskId = await logTask(link);
    return NextResponse.json({ ok: true, delivered: "drive", link, filename, taskId, title, shared, owner, folder, isDoc, note });
  }

  const taskId = await logTask("");
  // Schone kopie (zie page-doc): voorkomt een kapot Word-bestand bij download.
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Task-Id": taskId != null ? String(taskId) : "",
    },
  });
}
