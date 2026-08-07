import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { uploadEnConverteer, readDriveDoc } from "../../../../lib/drive";
import { kanDirectGelezen, tekstUitLokaalBestand } from "../../../../lib/bestand-tekst";
import { ensureClientFolder } from "../../../../lib/drive-map";
import { getClientBySlug } from "../../../../lib/clients";
import { listKnowledge, getOpenProposals, proposeKnowledge, confirmKnowledge, confirmAllKnowledge, ignoreKnowledge, knowledgeGaps, knowledgeGapsPerVeld, applyKnowledgeToOrg, opruimenDubbel, deleteKnowledgeEntity } from "../../../../lib/schema-knowledge";

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
  if (!(await getClientBySlug(slug).catch(() => null))) {
    return NextResponse.json({ ok: false, error: "Deze klant bestaat niet." }, { status: 404 });
  }
  const [entities, gaps, proposals] = await Promise.all([listKnowledge(slug), knowledgeGaps(slug), getOpenProposals(slug)]);
  return NextResponse.json({ ok: true, entities, gaps, proposals, proposal: proposals[0] || null });
}

// De klantmap, die nu gewoon bestaat (of automatisch wordt aangemaakt).
// Hier stond eerder een noodgreep: "pak de map van de pagina met het kortste
// pad, anders de hoofdmap van Drive". Daarmee kon een klantdocument in een
// willekeurige paginamap of los in Maartens Drive belanden.
async function clientFolderId(slug: string): Promise<string> {
  return (await ensureClientFolder(slug).catch(() => null)) || "root";
}

// De tekst uit één aangeleverd bestand halen. Naast .docx en platte tekst nu ook
// pdf en scans/foto's: artsen-fiches komen meestal als pdf binnen en werden
// eerder simpelweg geweigerd. Drive doet de omzetting (inclusief tekstherkenning
// op een scan), daar hoeft geen extra pakket voor in de app.
async function tekstUitBestand(slug: string, file: File): Promise<{ naam: string; tekst: string; fout?: string }> {
  const naam = file.name || "aangeleverd-materiaal";
  const buf = Buffer.from(await file.arrayBuffer());
  const datum = new Date().toISOString().slice(0, 10);
  try {
    // Word, Excel en platte tekst lezen we hier, zonder omweg via Drive. Een
    // .docx ging eerder wél naar Drive maar zonder omzetting naar een Google Doc,
    // en kwam dan terug als "kan ik niet als tekst lezen".
    if (kanDirectGelezen(naam)) {
      const tekst = await tekstUitLokaalBestand(naam, buf);
      return { naam, tekst, fout: tekst.trim() ? undefined : "het bestand lijkt leeg of bevat geen tekst" };
    }
    if (/\.(pdf|doc|rtf|odt|png|jpe?g|webp|gif|tiff?)$/i.test(naam)) {
      const mime = /\.pdf$/i.test(naam) ? "application/pdf"
        : /\.doc$/i.test(naam) ? "application/msword"
        : /\.rtf$/i.test(naam) ? "application/rtf"
        : /\.odt$/i.test(naam) ? "application/vnd.oasis.opendocument.text"
        : /\.png$/i.test(naam) ? "image/png"
        : /\.webp$/i.test(naam) ? "image/webp"
        : /\.gif$/i.test(naam) ? "image/gif"
        : /\.tiff?$/i.test(naam) ? "image/tiff" : "image/jpeg";
      const up = await uploadEnConverteer(await clientFolderId(slug), `Kennisbank-${datum}-${naam}`, buf, mime);
      const read = await readDriveDoc(up.id, 60000);
      return { naam, tekst: read.ok ? read.text || "" : "", fout: read.ok ? undefined : read.error };
    }
    return { naam, tekst: "", fout: "dit bestandstype kan ik niet lezen. Wel: Word (.docx), Excel (.xlsx), pdf, tekst (.txt, .md, .json, .csv), en scans of foto's" };
  } catch (e) { return { naam, tekst: "", fout: (e as Error).message }; }
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const ctype = req.headers.get("content-type") || "";

  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    const slug = String(form.get("slug") || "").trim();
    // ALLE meegestuurde bestanden, niet alleen het eerste: eerder werd bij het
    // slepen van een stapel fiches stilletjes alleen het bovenste verwerkt.
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (!slug || !files.length) return NextResponse.json({ ok: false, error: "Klant en bestand zijn verplicht." }, { status: 400 });
    const g = await guardSlug(req, slug); if (!g.ok) return g.res;

    const proposals: unknown[] = [];
    const fouten: string[] = [];
    for (const file of files) {
      const { naam, tekst, fout } = await tekstUitBestand(slug, file);
      if (fout || !tekst.trim()) { fouten.push(`${naam}: ${fout || "geen leesbare tekst gevonden"}`); continue; }
      try { proposals.push(await proposeKnowledge(slug, naam, tekst)); }
      catch (e) { fouten.push(`${naam}: ${(e as Error).message}`); }
    }
    if (!proposals.length) {
      return NextResponse.json({ ok: false, error: fouten.join(" · ") || "Kon niets uit deze bestanden halen." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, proposals, proposal: proposals[0], fouten });
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
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
      // Meteen doorzetten naar de bedrijfsgegevens: de kennisbank is geen
      // eindstation, de velden in het formulier moeten gevuld raken.
      const toegepast = await applyKnowledgeToOrg(slug).catch(() => ({ gevuld: 0, nieuweVestigingen: 0, nieuweArtsen: 0 }));
      return NextResponse.json({ ok: true, verwerkt: r.verwerkt, ...toegepast });
    }
    if (action === "verwerkAlles") {
      const r = await confirmAllKnowledge(slug);
      const toegepast = await applyKnowledgeToOrg(slug).catch(() => ({ gevuld: 0, nieuweVestigingen: 0, nieuweArtsen: 0 }));
      return NextResponse.json({ ok: true, ...r, ...toegepast });
    }
    if (action === "toepassen") {
      // Voor wat al eerder in de kennisbank kwam: eerst dubbelen samenvoegen,
      // dan alsnog in de velden zetten.
      const opgeruimd = await opruimenDubbel(slug).catch(() => 0);
      const r = await applyKnowledgeToOrg(slug);
      return NextResponse.json({ ok: true, opgeruimd, ...r });
    }
    if (action === "verwijder") {
      await deleteKnowledgeEntity(slug, Number(body.id || 0));
      return NextResponse.json({ ok: true });
    }
    if (action === "opruimen") {
      const opgeruimd = await opruimenDubbel(slug);
      return NextResponse.json({ ok: true, opgeruimd });
    }
    if (action === "negeer") {
      await ignoreKnowledge(slug, Number(body.id || 0));
      return NextResponse.json({ ok: true });
    }
    if (action === "taak") {
      // Het rode lijstje als kaart in de weekplanning, zodat het uitvraagwerk niet blijft liggen.
      // Gegroepeerd per veldtype (knowledgeGapsPerVeld), niet los per vestiging: de
      // kaarttekst wordt verderop herkend op bijna-identieke regels als "hetzelfde
      // punt" en liet dan de meeste namen uit een rijtje gelijksoortige vestigingen
      // vallen. Eén samengevoegde regel per veldtype voorkomt dat, en is meteen
      // ook bruikbaarder als tekst voor de mail naar de klant.
      const gaps = await knowledgeGapsPerVeld(slug);
      if (!gaps.length) return NextResponse.json({ ok: false, error: "Er staat niets meer open." }, { status: 400 });
      const TAAK_TITEL = "Structured data: ontbrekende gegevens opvragen bij de klant";
      const toelichting = `Achtergrond:\n- De structured data-kennisbank mist nog gegevens.\nAanpak per fase:\n${gaps.map((r) => `- ${r}`).join("\n")}`;
      // addWeekplanTasks slaat een tweede keer aanmaken in dezelfde week geruisloos
      // over (dedup op titel): de knop meldde dan toch "aangemaakt", terwijl er niets
      // gebeurde en de lijst met ontbrekende gegevens verouderd bleef staan. Staat er
      // al een open kaart met deze vaste titel, dan werken we die nu bij in plaats
      // van niets te doen.
      const { sql } = await import("../../../../lib/db");
      const { rows: bestaand } = await sql`
        SELECT id FROM client_weekplan
        WHERE client_slug = ${slug} AND status <> 'klaar' AND lower(taak) = lower(${TAAK_TITEL})
        ORDER BY id DESC LIMIT 1`;
      if (bestaand[0]) {
        await sql`UPDATE client_weekplan SET toelichting = ${toelichting}, updated_at = now() WHERE id = ${bestaand[0].id}`;
        return NextResponse.json({ ok: true, bijgewerkt: true });
      }
      const { addWeekplanTasks, isoWeek } = await import("../../../../lib/weekplan");
      await addWeekplanTasks(slug, "overzicht", [{
        taak: TAAK_TITEL, toelichting, wie: "SEO", taaktype: "overig", week: isoWeek(new Date()),
      }]);
      return NextResponse.json({ ok: true, bijgewerkt: false });
    }
  } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
