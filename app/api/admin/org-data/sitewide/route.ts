import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getOrgData } from "../../../../../lib/org-data";
import { getClientBySlug } from "../../../../../lib/clients";
import { buildSitewideJsonLd } from "../../../../../lib/page-schema";
import { uploadPlainFile } from "../../../../../lib/drive";
import { getTasks, deleteTasksByIds, appendTasks } from "../../../../../lib/tasks";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function siteOf(domain: string): string {
  const d = (domain || "").trim();
  if (!d) return "";
  return (d.match(/^https?:\/\//i) ? d : `https://${d}`).replace(/\/+$/, "");
}

// GET: het site-brede identiteitsblok (Organization/LocalBusiness + WebSite),
// deterministisch gebouwd uit de bedrijfsgegevens.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const [rec, client] = await Promise.all([getOrgData(slug), getClientBySlug(slug)]);
  const site = siteOf(client?.domain || "");
  if (!site) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });
  if (!rec.data.bedrijfsnaam) return NextResponse.json({ ok: false, error: "Vul (of genereer) eerst de bedrijfsgegevens; minimaal de bedrijfsnaam." }, { status: 400 });
  return NextResponse.json({ ok: true, jsonld: buildSitewideJsonLd(rec.data, site), locked: rec.locked });
}

// POST: zet het site-brede blok door als .json-bestand in Drive + één Dev-taak.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const [rec, client] = await Promise.all([getOrgData(slug), getClientBySlug(slug)]);
  const site = siteOf(client?.domain || "");
  if (!site || !rec.data.bedrijfsnaam) return NextResponse.json({ ok: false, error: "Vul eerst de bedrijfsgegevens (minimaal bedrijfsnaam) en het domein in." }, { status: 400 });
  const jsonld = buildSitewideJsonLd(rec.data, site);
  try {
    const json = await uploadPlainFile("root", `schema-sitewide-${slug}.json`, jsonld, "application/json");
    const existing = await getTasks(slug).catch(() => []);
    const dupes = existing.filter((t) => t.stepKind === "structured_data_sitewide" && typeof t.id === "number").map((t) => t.id as number);
    if (dupes.length) await deleteTasksByIds(slug, dupes).catch(() => { /* dedupe is hulp */ });
    const ids = await appendTasks(slug, [{
      categorie: "Structured data",
      taak: "Site-brede structured data doorvoeren (alle pagina's)",
      toelichting: `JSON-LD (copy-paste, plaatsen in de head van elke pagina of via de SEO-plugin): ${json.link}\nDit is het identiteitsblok (bedrijf + website) waar de per-pagina schema's naar verwijzen. Na plaatsing controleren met search.google.com/test/rich-results.`,
      klantToelichting: "We voegen de vaste bedrijfsinformatie (naam, contact, profielen) als onzichtbare structured data toe aan de hele site, zodat Google en AI-zoekmachines het bedrijf herkennen.",
      status: "Gepland",
      wie: "Dev",
      fase: "Bouwen",
      stepKind: "structured_data_sitewide",
      docLink: json.link,
      klantZichtbaar: true,
    }]);
    return NextResponse.json({ ok: true, taskId: ids[0], jsonLink: json.link });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Doorzetten mislukt." }, { status: 500 });
  }
}
