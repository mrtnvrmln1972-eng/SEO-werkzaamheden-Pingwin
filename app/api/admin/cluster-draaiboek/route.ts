import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import {
  bouwDraaiboek, getStanden, getAlleStanden, magStarten, wisDraaiboek, zetStand,
  STAP_VAN_SLEUTEL, type StapSleutel, type Stand, type Modus,
} from "../../../../lib/cluster-draaiboek";
import { createDocRun } from "../../../../lib/page-doc-run";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════
// HET DRAAIBOEK VAN EEN BLOK WERK: STAND OPHALEN EN STAPPEN ZETTEN
// ═══════════════════════════════════════════════════════════
// GET ?slug=            → de standen van álle blokken, voor de voortgangsstreepjes
// GET ?slug=&cluster=   → het volledige draaiboek van één blok
// POST                  → een stap starten, afvinken, overslaan, terugzetten of
//                         op automatisch zetten
//
// Het slot zit HIER, niet alleen in het scherm. Een knop uitschakelen is
// vriendelijk, maar het moet ook niet kunnen als iemand het verzoek zelf stuurt:
// een omleiding vóórdat de tekst is overgezet is niet terug te draaien.
//
// Alles via guardSlug, dus een meekijk-sessie leest wel en schrijft niet.

// De drie stappen die op de bestaande documentmotor draaien (page_doc_runs).
const MOTOR_STAPPEN: Partial<Record<StapSleutel, "analyse" | "blauwdruk" | "copy">> = {
  analyse: "analyse", blauwdruk: "blauwdruk", copy: "copy",
};

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const cluster = req.nextUrl.searchParams.get("cluster") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  try {
    if (!cluster) return NextResponse.json({ ok: true, standen: await getAlleStanden(slug) });
    const heeftSamenvoeging = req.nextUrl.searchParams.get("samenvoeging") !== "nee";
    const standen = await getStanden(slug, cluster);
    return NextResponse.json({ ok: true, draaiboek: bouwDraaiboek(cluster, standen, { heeftSamenvoeging }) });
  } catch {
    return NextResponse.json({ ok: false, error: "Het draaiboek kon niet opgehaald worden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    slug?: string; cluster?: string; stap?: StapSleutel; actie?: string;
    modus?: Modus; resultaat?: string; notitie?: string;
    urls?: string[]; heeftSamenvoeging?: boolean;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const slug = String(body.slug || "").trim();
  const cluster = String(body.cluster || "").trim();
  if (!slug || !cluster) return NextResponse.json({ ok: false, error: "Klant en blok verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const heeftSamenvoeging = body.heeftSamenvoeging !== false;

  try {
    // Alles van dit blok terug naar het begin.
    if (body.actie === "opnieuw") {
      await wisDraaiboek(slug, cluster);
      return NextResponse.json({
        ok: true, melding: "Het draaiboek staat weer op het begin.",
        draaiboek: bouwDraaiboek(cluster, [], { heeftSamenvoeging }),
      });
    }

    const stap = body.stap;
    if (!stap || !STAP_VAN_SLEUTEL.has(stap)) {
      return NextResponse.json({ ok: false, error: "Onbekende stap." }, { status: 400 });
    }
    const def = STAP_VAN_SLEUTEL.get(stap)!;
    let melding = "";

    // De modus omzetten is geen stap uitvoeren; dat mag altijd, behalve bij de
    // twee stappen die per definitie een mens nodig hebben.
    if (body.actie === "modus") {
      const modus: Modus = body.modus === "automatisch" ? "automatisch" : "handmatig";
      if (modus === "automatisch" && !def.magAutomatisch) {
        return NextResponse.json({
          ok: false,
          error: `"${def.naam}" kan niet op automatisch. Deze stap heeft een mens nodig, en dat is met opzet.`,
        }, { status: 400 });
      }
      await zetStand(slug, cluster, stap, { modus });
      melding = modus === "automatisch"
        ? `"${def.naam}" gaat voortaan vanzelf zodra hij aan de beurt is.`
        : `"${def.naam}" zet je voortaan zelf aan.`;
      const standen = await getStanden(slug, cluster);
      return NextResponse.json({ ok: true, melding, draaiboek: bouwDraaiboek(cluster, standen, { heeftSamenvoeging }) });
    }

    if (body.actie === "start") {
      // Het slot, ook op de server. Het scherm zet de knop al uit, maar dat is
      // een beleefdheid; dit is de grendel.
      const nu = bouwDraaiboek(cluster, await getStanden(slug, cluster), { heeftSamenvoeging });
      const mag = magStarten(nu, stap);
      if (!mag.ok) return NextResponse.json({ ok: false, error: mag.reden }, { status: 409 });

      const motorStap = MOTOR_STAPPEN[stap];
      if (motorStap) {
        // Deze stappen draaien op de bestaande documentmotor: één achtergrondrun
        // per pagina die blijft. Die runs zijn te volgen op de pagina zelf.
        const urls = (body.urls || []).filter(Boolean);
        if (!urls.length) {
          return NextResponse.json({
            ok: false, error: "Er zijn geen pagina's in dit blok waar deze stap op kan draaien.",
          }, { status: 400 });
        }
        let gestart = 0;
        for (const url of urls) {
          try { await createDocRun(slug, url, `Blok: ${cluster}`, "", [motorStap], "klant"); gestart++; }
          catch { /* stil: één pagina die niet start mag de rest niet blokkeren */ }
        }
        if (!gestart) {
          await zetStand(slug, cluster, stap, { stand: "mislukt", notitie: "Geen enkele run kon starten." });
          return NextResponse.json({ ok: false, error: "Geen enkele run kon starten." }, { status: 500 });
        }
        await zetStand(slug, cluster, stap, {
          stand: "bezig",
          notitie: `${gestart} ${gestart === 1 ? "pagina" : "pagina's"} in de wachtrij gezet.`,
        });
        melding = `${def.naam}: ${gestart} ${gestart === 1 ? "run" : "runs"} gestart. Dat draait op de achtergrond; je kunt gerust wegklikken.`;
      } else if (body.resultaat) {
        // Een stap die uitgerekend is (termverdeling, verdict, linkplan,
        // bouwpakket): het resultaat komt mee en de stap is meteen klaar.
        await zetStand(slug, cluster, stap, { stand: "klaar", resultaat: String(body.resultaat).slice(0, 60000) });
        melding = `${def.naam} is klaar.`;
      } else {
        // Werk van een mens of van een koppeling die nog gebouwd wordt: de stap
        // gaat op "bezig" en jij vinkt hem af als het gedaan is.
        await zetStand(slug, cluster, stap, { stand: "bezig" });
        melding = `${def.naam} staat op bezig. Vink hem af zodra het gedaan is.`;
      }
    } else if (body.actie === "klaar" || body.actie === "overslaan" || body.actie === "terug") {
      const stand: Stand = body.actie === "klaar" ? "klaar"
        : body.actie === "overslaan" ? "overgeslagen" : "klaar-om-te-starten";
      await zetStand(slug, cluster, stap, {
        stand,
        ...(body.resultaat !== undefined ? { resultaat: String(body.resultaat).slice(0, 60000) } : {}),
        ...(body.notitie !== undefined ? { notitie: String(body.notitie).slice(0, 2000) } : {}),
      });
      melding = body.actie === "klaar" ? `${def.naam} is afgevinkt.`
        : body.actie === "overslaan" ? `${def.naam} is overgeslagen.`
        : `${def.naam} staat weer open.`;
    } else {
      return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
    }

    const standen = await getStanden(slug, cluster);
    return NextResponse.json({ ok: true, melding, draaiboek: bouwDraaiboek(cluster, standen, { heeftSamenvoeging }) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Het draaiboek bijwerken mislukte: " + (e as Error).message }, { status: 500 });
  }
}
