import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../../lib/db";
import { updateMetaProposal } from "../../../../../lib/meta-ctr";
import { pushMetaToSite } from "../../../../../lib/wp-push";
import { appendTasks } from "../../../../../lib/tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST {slug, url} : voer de GOEDGEKEURDE meta-velden van deze pagina in één
// keer door op de gekoppelde WordPress-site. Bij succes gaat de status naar
// 'doorgevoerd' en start de effectmeting vanzelf.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { slug?: string; url?: string };
  const slug = (body.slug || "").trim(), url = (body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  await ensureSchema();
  const { rows } = await sql`SELECT prop_title, prop_desc, title_status, desc_status FROM meta_proposals WHERE client_slug = ${slug} AND page_url = ${url} LIMIT 1`;
  const r = rows[0];
  if (!r) return NextResponse.json({ ok: false, error: "Er is nog geen voorstel voor deze pagina." }, { status: 400 });

  // Alleen goedgekeurde velden gaan naar de site; open of afgewezen velden nooit.
  const fields: { title?: string; desc?: string } = {};
  if (r.title_status === "goedgekeurd" && r.prop_title) fields.title = r.prop_title as string;
  if (r.desc_status === "goedgekeurd" && r.prop_desc) fields.desc = r.prop_desc as string;
  if (!fields.title && !fields.desc) return NextResponse.json({ ok: false, error: "Keur eerst de titel en/of beschrijving goed; alleen goedgekeurde velden worden doorgevoerd." }, { status: 400 });

  try {
    const result = await pushMetaToSite(slug, url, fields);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.detail }, { status: 422 });
    await updateMetaProposal(slug, url, { status: "doorgevoerd" });
    // De uitvoering wordt standaard als afgevinkte werkzaamheid gelogd (ca. 10 min),
    // in de huidige maand, zodat het in het takenlijstje terugkomt.
    try {
      const pretty = url.replace(/^https?:\/\/[^/]+/i, "") || url;
      const wat = fields.title && fields.desc ? "meta-titel + beschrijving" : fields.title ? "meta-titel" : "meta-beschrijving";
      const maand = new Date().toLocaleDateString("nl-NL", { month: "long" }).toLowerCase();
      await appendTasks(slug, [{ taak: `Verbeterde ${wat} doorgevoerd op ${pretty}`, wie: "SEO", fase: "Opschonen", status: "Klaar", uren: 0.15, maand, pageUrl: url, klantZichtbaar: true }]);
    } catch { /* taak-log is extra; nooit de push laten falen */ }
    return NextResponse.json({ ok: true, detail: result.detail, pushed: Object.keys(fields) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
