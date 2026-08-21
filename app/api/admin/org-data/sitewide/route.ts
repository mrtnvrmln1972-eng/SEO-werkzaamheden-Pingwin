import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getOrgData } from "../../../../../lib/org-data";
import { getClientBySlug } from "../../../../../lib/clients";
import { buildSitewideJsonLd, detectSitewideAnchor } from "../../../../../lib/page-schema";
import { uploadPlainFile } from "../../../../../lib/drive";
import { getTasks, deleteTasksByIds, appendTasks } from "../../../../../lib/tasks";
import { sitewideToelichting } from "../../../../../lib/structured-taak";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// De vaste titel van deze taak. Staat hier één keer, want hij wordt zowel
// gebruikt om de taak aan te maken als om de vorige exemplaren te herkennen.
const TAAK_TITEL = "Site-brede structured data doorvoeren (alle pagina's)";

/** Zelfde taak? Zonder opmaak en zonder losse spaties vergeleken. */
function zelfdeTitel(a: string, b: string): boolean {
  const kaal = (s: string) => (s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return !!kaal(a) && kaal(a) === kaal(b);
}

function siteOf(domain: string): string {
  const d = (domain || "").trim();
  if (!d) return "";
  return (d.match(/^https?:\/\//i) ? d : `https://${d}`).replace(/\/+$/, "");
}

// GET: het site-brede identiteitsblok (Organization/LocalBusiness + WebSite),
// deterministisch gebouwd uit de bedrijfsgegevens. Staat er al organisatie-
// schema van een SEO-plugin op de homepage (met een @id), dan vult dit blok
// aan op diezelfde @id in plaats van een tweede organisatie te verzinnen.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  if (!slug) return NextResponse.json({ ok: false, error: "Klant is verplicht." }, { status: 400 });
  const [rec, client] = await Promise.all([getOrgData(slug), getClientBySlug(slug)]);
  const site = siteOf(client?.domain || "");
  if (!site) return NextResponse.json({ ok: false, error: "Deze klant heeft nog geen domein ingevuld." }, { status: 400 });
  if (!rec.data.bedrijfsnaam) return NextResponse.json({ ok: false, error: "Vul (of genereer) eerst de bedrijfsgegevens; minimaal de bedrijfsnaam." }, { status: 400 });
  const detectie = await detectSitewideAnchor(site).catch(() => ({ pluginLabel: "", gekoppeld: false, anchor: null }));
  return NextResponse.json({
    ok: true,
    jsonld: buildSitewideJsonLd(rec.data, site, detectie.anchor),
    locked: rec.locked,
    plugin: detectie.gekoppeld ? detectie.pluginLabel : "",
    gekoppeld: !!detectie.anchor,
  });
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
  const detectie = await detectSitewideAnchor(site).catch(() => ({ pluginLabel: "", gekoppeld: false, anchor: null as { id: string; type: string } | null }));
  const jsonld = buildSitewideJsonLd(rec.data, site, detectie.anchor);
  try {
    const json = await uploadPlainFile("root", `schema-sitewide-${slug}.json`, jsonld, "application/json");
    const existing = await getTasks(slug).catch(() => []);
    // Ontdubbelen op de soort taak, met de titel als terugval: de taken die vóór
    // 18-08-2026 langs deze weg zijn aangemaakt hebben géén step_kind (dat werd
    // stilzwijgend niet opgeslagen), dus zonder die terugval blijven ze staan.
    // Bij Bogard stonden er zo vier identieke.
    const dupes = existing.filter((t) =>
      typeof t.id === "number"
      && (t.stepKind === "structured_data_sitewide" || zelfdeTitel(t.taak, TAAK_TITEL)),
    ).map((t) => t.id as number);
    if (dupes.length) await deleteTasksByIds(slug, dupes).catch(() => { /* dedupe is hulp */ });
    // De leeslink voor de sitebouwer (bedrijfsgegevens + dit JSON-LD, in context)
    // gaat mee in de taak, zodat afvinken in Werkzaamheden en delen met de
    // developer via dezelfde taak lopen in plaats van los van elkaar.
    const devUrl = rec.devShareToken ? `${req.nextUrl.origin}/share/org-dev/${rec.devShareToken}` : "";
    // De tekst zelf staat in lib/structured-taak.ts, want exact dezelfde
    // boodschap gaat ook de mail in en staat op de deelpagina. Markdown, dus
    // met benoemde links in plaats van twee kale webadressen in een lap tekst.
    const ids = await appendTasks(slug, [{
      categorie: "Structured data",
      taak: TAAK_TITEL,
      toelichting: sitewideToelichting(
        { jsonLink: json.link, devUrl },
        { pluginLabel: detectie.pluginLabel, gekoppeld: !!detectie.anchor, anchorId: detectie.anchor?.id },
      ),
      klantToelichting: "We voegen de vaste bedrijfsinformatie (naam, contact, profielen) als onzichtbare structured data toe aan de hele site, zodat Google en AI-zoekmachines het bedrijf herkennen.",
      // "Naar dev", niet "Gepland": dit is de knop "Delen met developer", dus dit
      // ís het moment van doorzetten. Op "Gepland" bleef de taak alleen in
      // Werkzaamheden staan en kwam hij nooit op /admin/developer, terwijl de
      // mail die hier direct achteraan gaat wél naar de developer verwijst.
      status: "Naar dev",
      wie: "Dev",
      fase: "Bouwen",
      stepKind: "structured_data_sitewide",
      docLink: json.link,
      klantZichtbaar: true,
    }]);
    // `gedeeld` is de enige eerlijke manier om te weten of de developer dat
    // bestand ook echt kan openen: Drive zet het op "iedereen met de link", en
    // lukt dat niet (rechten, beleid), dan krijgt hij een toegang-aanvragen-
    // scherm. Dat hoort in beeld te staan vóór de mail de deur uit gaat.
    return NextResponse.json({ ok: true, taskId: ids[0], jsonLink: json.link, gedeeld: !!json.shared, devUrl });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Doorzetten mislukt." }, { status: 500 });
  }
}
