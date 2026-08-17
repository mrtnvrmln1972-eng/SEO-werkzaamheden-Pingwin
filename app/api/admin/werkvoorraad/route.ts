import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getPrioriteitenScan } from "../../../../lib/prioriteiten-scan";
import { getMetaKansen } from "../../../../lib/meta-ctr";
import { getCannibalAnalysis } from "../../../../lib/cannibal-redirect";
import { getNametingen } from "../../../../lib/opruim-nameten";
import { getInternalLinksState } from "../../../../lib/internal-links";
import { getRoadmap } from "../../../../lib/nav-plan";
import { urlKey } from "../../../../lib/url-key";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// DE WERKVOORRAAD: hoeveel ligt er klaar, per plek
// ═══════════════════════════════════════════════════════════
// Voedt de chips onderaan het koersblok op de takenpagina. Eén regel per plek,
// zodat Maarten in één blik ziet waar iets klaarligt zonder vijf schermen open
// te klikken.
//
// HARDE REGEL: deze route LEEST alleen wat er al is opgeslagen. Hij start nooit
// een motor en belt nooit Ahrefs of Search Console. Anders zou het openen van de
// takenpagina, tien keer per dag, elke keer geld kosten. Draait er nog geen
// analyse, dan is het antwoord "nog niet gedraaid" en NIET het getal 0: die twee
// betekenen iets heel anders, en een 0 die eigenlijk "onbekend" is, is precies
// het cijfer waarop je iets ten onrechte laat liggen.

export type WerkPost = {
  sleutel: string;
  label: string;
  /** null = deze motor is hier nog nooit gedraaid. */
  aantal: number | null;
  /** Waar de chip naartoe gaat, relatief aan de cockpit van deze klant. */
  tab: string;
  /** Wat het getal betekent, in gewone taal. Wordt de tooltip van de chip. */
  uitleg: string;
};

async function veilig<T>(werk: () => Promise<T>): Promise<T | null> {
  try { return await werk(); } catch { return null; }
}

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const [prio, meta, canni, nametingen, links, roadmap] = await Promise.all([
    veilig(() => getPrioriteitenScan(slug)),
    veilig(() => getMetaKansen(slug)),
    veilig(() => getCannibalAnalysis(slug)),
    veilig(() => getNametingen(slug)),
    veilig(() => getInternalLinksState(slug)),
    veilig(() => getRoadmap(slug)),
  ]);

  const posten: WerkPost[] = [];

  // ── Prioriteitenscan: tier 1 en 2, min wat al op de planning staat ──
  {
    const regels = prio?.result?.regels || null;
    const opPlanning = new Set((prio?.inPlanning || []).map((u) => urlKey(u)));
    const aantal = regels === null ? null : regels
      .filter((r) => r.tier === "1" || r.tier === "2")
      .filter((r) => !r.url || !opPlanning.has(urlKey(r.url)))
      .length;
    posten.push({
      sleutel: "prioriteiten", label: "Prioriteitenscan", aantal, tab: "prioriteiten",
      uitleg: "Kansen voor deze week en deze maand die nog niet op de planning staan",
    });
  }

  // ── Meta & CTR: alles wat nog niet is doorgevoerd ──
  {
    const aantal = meta === null ? null
      : meta.filter((r) => r.proposal?.status !== "doorgevoerd").length;
    posten.push({
      sleutel: "meta", label: "Meta & CTR", aantal, tab: "meta",
      uitleg: "Pagina's met een betere titel of omschrijving die nog niet live staat",
    });
  }

  // ── Opruimen: omleidingen uit de lijst die nog niet zijn doorgevoerd ──
  // "Doorgevoerd" is hier hetzelfde bewijs als op het opruimscherm: er ligt een
  // nulmeting, en die wordt pas vastgelegd als de omleiding live is nagemeten.
  {
    const map = canni?.result?.redirectMap || null;
    const gedaan = new Set((nametingen || []).map((n) => urlKey(n.van)));
    const aantal = map === null ? null : map.filter((r) => !gedaan.has(urlKey(r.van))).length;
    posten.push({
      sleutel: "opruimen", label: "Opruimen", aantal, tab: "cannibalisatie",
      uitleg: "Omleidingen en samenvoegingen die nog doorgevoerd moeten worden",
    });
  }

  // ── Interne links: voorgestelde links, opgeteld over alle doelpagina's ──
  {
    const doelen = links?.result?.doelpaginas || null;
    const aantal = doelen === null ? null
      : doelen.reduce((n, d) => n + (d.voorgesteldeLinks?.length || 0), 0);
    posten.push({
      sleutel: "interne-links", label: "Interne links", aantal, tab: "interne-links",
      uitleg: "Voorgestelde interne links naar de doelpagina's",
    });
  }

  // ── Navigatie-roadmap: pagina's die in het plan staan maar nog niet bestaan ──
  {
    const nodes = roadmap?.nodes || null;
    const aantal = nodes === null ? null : nodes.filter((n) => n.inPlan && !n.live).length;
    posten.push({
      sleutel: "roadmap", label: "Nog te bouwen pagina's", aantal, tab: "",
      uitleg: "Pagina's die in de navigatie-roadmap staan maar nog niet live zijn",
    });
  }

  return NextResponse.json({ ok: true, posten });
}
