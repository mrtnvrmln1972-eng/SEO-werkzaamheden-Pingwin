import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sql } from "../../../../lib/db";
import { uploadDocx, readDriveDoc } from "../../../../lib/drive";
import { listKnowledge, getOpenProposal, proposeKnowledge, confirmKnowledge, ignoreKnowledge, knowledgeGaps } from "../../../../lib/schema-knowledge";

export const runtime = "nodejs";
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Kennisbank + rood lijstje + eventueel openstaand voorstel.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const [entities, gaps, proposal] = await Promise.all([listKnowledge(slug), knowledgeGaps(slug), getOpenProposal(slug)]);
  return NextResponse.json({ ok: true, entities, gaps, proposal });
}

// Een Drive-map voor klant-brede uploads: de map van de pagina met het kortste
// pad (meestal de hoofdmap-achtige), anders de Drive-hoofdmap.
async function clientFolderId(slug: string): Promise<string> {
  try {
    const { rows } = await sql`SELECT folder_id, url FROM page_drive_folders WHERE client_slug = ${slug} ORDER BY length(url) ASC LIMIT 1`;
    return (rows[0]?.folder_id as string) || "root";
  } catch { return "root"; }
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    const slug = String(form.get("slug") || "").trim();
    const file = form.get("file");
    if (!slug || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Klant en bestand zijn verplicht." }, { status: 400 });
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;
    const naam = file.name || "aangeleverd-materiaal";
    const buf = Buffer.from(await file.arrayBuffer());
    let tekst = "";
    if (/\.(txt|md|json|csv)$/i.test(naam)) tekst = buf.toString("utf8");
    else if (/\.docx$/i.test(naam)) {
      try {
        const up = await uploadDocx(await clientFolderId(slug), `Kennisbank-${new Date().toISOString().slice(0, 10)}-${naam}`, buf);
        const read = await readDriveDoc(up.id, 60000);
        if (read.ok) tekst = read.text || "";
      } catch (e) { return NextResponse.json({ ok: false, error: "Uploaden mislukte: " + (e as Error).message }, { status: 500 }); }
    } else return NextResponse.json({ ok: false, error: "Dit bestandstype kan ik nog niet lezen. Sleep een .docx, .txt, .md of .json, of plak tekst/een Drive-link." }, { status: 400 });
    if (!tekst.trim()) return NextResponse.json({ ok: false, error: "Kon geen leesbare tekst uit het bestand halen." }, { status: 400 });
    try {
      const proposal = await proposeKnowledge(slug, naam, tekst);
      return NextResponse.json({ ok: true, proposal });
    } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const action = String(body.action || "").trim();

  try {
    if (action === "tekst") {
      const tekst = String(body.tekst || "").trim();
      if (!tekst) return NextResponse.json({ ok: false, error: "Geen tekst ontvangen." }, { status: 400 });
      const proposal = await proposeKnowledge(slug, "geplakte tekst", tekst);
      return NextResponse.json({ ok: true, proposal });
    }
    if (action === "link") {
      const driveLink = String(body.driveLink || "").trim();
      const read = await readDriveDoc(driveLink, 60000);
      if (!read.ok) return NextResponse.json({ ok: false, error: read.error || "Kon het document niet lezen." }, { status: 400 });
      const proposal = await proposeKnowledge(slug, read.name || "gedeeld document", read.text || "");
      return NextResponse.json({ ok: true, proposal });
    }
    if (action === "verwerk") {
      const r = await confirmKnowledge(slug, Number(body.id || 0));
      return r.ok ? NextResponse.json({ ok: true, verwerkt: r.verwerkt }) : NextResponse.json({ ok: false, error: r.error }, { status: 500 });
    }
    if (action === "negeer") {
      await ignoreKnowledge(slug, Number(body.id || 0));
      return NextResponse.json({ ok: true });
    }
    if (action === "taak") {
      // Het rode lijstje als kaart in de weekplanning, zodat het uitvraagwerk niet blijft liggen.
      const gaps = await knowledgeGaps(slug);
      if (!gaps.length) return NextResponse.json({ ok: false, error: "Er staat niets meer open." }, { status: 400 });
      const { addWeekplanTasks, isoWeek } = await import("../../../../lib/weekplan");
      await addWeekplanTasks(slug, "overzicht", [{
        taak: "Structured data: ontbrekende gegevens opvragen bij de klant",
        toelichting: `Achtergrond:\n- De structured data-kennisbank mist nog gegevens.\nAanpak per fase:\n${gaps.map((r) => `- ${r}`).join("\n")}`,
        wie: "SEO", taaktype: "overig", week: isoWeek(new Date()),
      }]);
      return NextResponse.json({ ok: true });
    }
  } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
