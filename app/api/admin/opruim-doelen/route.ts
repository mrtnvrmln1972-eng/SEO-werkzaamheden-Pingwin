import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getCannibalAnalysis, zorgVoorPlaatsen } from "../../../../lib/cannibal-redirect";
import { getClientBySlug } from "../../../../lib/clients";
import { bouwWerklijst } from "../../../../lib/opruim-werklijst";
import { bepaalDoelen, type DoelenRapport } from "../../../../lib/opruim-doelvinder";
import { getSetting, setSetting } from "../../../../lib/settings";
import { baseFromDomain } from "../../../../lib/wordpress";
import { testRedirect } from "../../../../lib/redirect-test";
import { getWpConnForClient, createWpRedirect, createWpGone, savePageRedirect } from "../../../../lib/wp";
import { zetOpruimRegel } from "../../../../lib/opruim-regels";
import { legNulmetingVast } from "../../../../lib/opruim-nameten";

export const runtime = "nodejs";
export const maxDuration = 300;

// Het voorstel voor een redirect-doel per op te ruimen pagina, plus de twee
// knoppen die erbij horen: doorvoeren en testen. De berekening zelf staat in
// lib/opruim-doelvinder.ts, de test in lib/redirect-test.ts; hier staat het loket.
//
// Testen is bewust een GET: het leest alleen en verandert niets, en zo kan een
// meekijk-sessie hem ook draaien. Doorvoeren is een POST en gaat daarmee door
// dezelfde poort als elke andere wijziging (guardSlug weigert een POST uit een
// alleen-lezen sessie).

const cacheKey = (slug: string) => `opruim_doelen:${slug}`;

async function bouw(slug: string): Promise<DoelenRapport & { lijstDatum: string | null }> {
  const domain = (await getClientBySlug(slug).catch(() => null))?.domain || "";
  const [st, plaatsen] = await Promise.all([
    getCannibalAnalysis(slug),
    domain ? zorgVoorPlaatsen(slug, domain).catch(() => null) : Promise.resolve(null),
  ]);
  const regels = bouwWerklijst(st.result, plaatsen?.adviezen || []);
  // De vestigingen komen uit de bedrijfsgegevens, via de plaatsanalyse die ze al
  // ophaalt. Alleen een plaats waar de klant echt zit mag een bestemming zijn.
  const rapport = await bepaalDoelen(slug, domain, regels, plaatsen?.vestigingen || []);
  return { ...rapport, lijstDatum: st.result?.generatedAt || null };
}

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const slug = q.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug).catch(() => null);

  // ── Test: wat gebeurt er echt als je het oude adres opent? ──
  if (q.get("actie") === "test") {
    const van = q.get("van") || "";
    const naar = q.get("naar") || "";
    const gone = q.get("gone") === "1";
    if (!van) return NextResponse.json({ ok: false, error: "Geen pagina opgegeven." }, { status: 400 });
    try {
      const test = await testRedirect(baseFromDomain(client?.domain || ""), van, gone ? "" : naar, gone);
      return NextResponse.json({ ok: true, test });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Test mislukt." }, { status: 500 });
    }
  }

  try {
    // Uit de bewaarde stand als die bij dezelfde analyse hoort: de berekening
    // leest alle pagina's van de site en dat hoeft niet bij elke schermopbouw.
    if (q.get("opnieuw") !== "1") {
      const ruw = await getSetting(cacheKey(slug)).catch(() => null);
      if (ruw) {
        try {
          const d = JSON.parse(ruw) as DoelenRapport & { lijstDatum: string | null };
          const st = await getCannibalAnalysis(slug);
          if ((st.result?.generatedAt || null) === (d.lijstDatum ?? null)) return NextResponse.json({ ok: true, ...d });
        } catch { /* stuk gegaan? gewoon opnieuw berekenen */ }
      }
    }
    const d = await bouw(slug);
    await setSetting(cacheKey(slug), JSON.stringify(d)).catch(() => { /* bewaren is bijvangst */ });
    return NextResponse.json({ ok: true, ...d });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Doelen bepalen mislukt." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim();
  const actie = String(body.actie || "").trim();
  const van = String(body.van || "").trim();
  const naar = String(body.naar || "").trim();
  const gone = body.gone === true;
  if (!slug || !van) return NextResponse.json({ ok: false, error: "Klant of pagina ontbreekt." }, { status: 400 });
  if (!van.startsWith("/")) return NextResponse.json({ ok: false, error: "Het oude pad moet met / beginnen." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug).catch(() => null);

  try {
    // ── Een ander doel kiezen: dat wordt een vaste regel ──
    // Zo hoeft een correctie van Maarten maar één keer gemaakt te worden; de
    // volgende analyse krijgt hem mee (lib/opruim-regels.ts).
    if (actie === "doel") {
      if (!naar.startsWith("/")) return NextResponse.json({ ok: false, error: "Het doelpad moet met / beginnen." }, { status: 400 });
      await zetOpruimRegel(slug, van, { besluit: "redirect", naar, notitie: "Doel met de hand gekozen in de werklijst." });
      await setSetting(cacheKey(slug), "").catch(() => { /* stil */ });
      return NextResponse.json({ ok: true, melding: `Vastgelegd: ${van} gaat naar ${naar}. Dit doel blijft staan, ook na een nieuwe analyse.` });
    }

    // ── Doorvoeren op de site ──
    if (actie === "plaats") {
      if (!gone && !naar.startsWith("/")) return NextResponse.json({ ok: false, error: "Het doelpad moet met / beginnen." }, { status: 400 });
      const conn = await getWpConnForClient(slug);
      if (!conn) {
        return NextResponse.json({
          ok: false,
          error: "Deze klant heeft nog geen sitekoppeling. Koppel de website op de Klant-tab (gebruikersnaam plus applicatiewachtwoord) en zorg dat de gratis plugin Redirection actief is.",
        }, { status: 400 });
      }
      const id = gone ? await createWpGone(conn, van) : await createWpRedirect(conn, van, naar);
      // Meteen nameten: bewijs boven beloftes. "Doorgevoerd" betekent hier dat
      // de omleiding echt gezien is, niet dat de opdracht verstuurd is.
      const test = await testRedirect(conn.url, van, gone ? "" : naar, gone);
      if (test.oordeel !== "fout") {
        await zetOpruimRegel(slug, van, { besluit: "redirect", naar: gone ? "" : naar, doorgevoerd: true });
        await savePageRedirect(slug, `${conn.url}${van}`, van, gone ? "410 (bewust weg)" : naar, test.goed, id).catch(() => { /* stil */ });
        if (client?.domain && !gone) await legNulmetingVast(slug, client.domain, van, naar).catch(() => { /* stil */ });
      }
      await setSetting(cacheKey(slug), "").catch(() => { /* stil */ });
      return NextResponse.json({ ok: test.oordeel !== "fout", test });
    }

    return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Actie mislukt." }, { status: 500 });
  }
}
