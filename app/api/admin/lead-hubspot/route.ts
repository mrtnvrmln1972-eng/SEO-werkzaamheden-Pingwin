import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug, setClientBudget, setClientFase } from "../../../../lib/clients";
import { getHubspotLead, koppelDeal, ontkoppelLead, syncHubspot, getHubspotInstelling } from "../../../../lib/hubspot-leads";
import { hubspotConfigured, hsMaakNotitie } from "../../../../lib/hubspot";
import { saveRegelExtra, getRegelExtra, getRegelBron, LEAD_STANDAARD_KANS } from "../../../../lib/prognose";
import { addDossierItem } from "../../../../lib/lead-dossier";
import { planOpvolging } from "../../../../lib/mail-opvolg";
import { ahrefsConfigured, getSiteAuthority, getAhrefsTopPages } from "../../../../lib/ahrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alles wat je bij één lead doet: de stand uit HubSpot lezen, het beoogde budget
// zetten, de kans bijstellen, een notitie kwijt, een opvolging inplannen, of hun
// site even doormeten. De koppeling zelf (welke pijplijnen, de sleutel) staat op
// /admin/beheer; dit gaat alleen over dit ene bedrijf.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });

  const [lead, regel, bron, instelling] = await Promise.all([
    getHubspotLead(slug).catch(() => null),
    getRegelExtra(slug).catch(() => null),
    getRegelBron(slug).catch(() => ""),
    getHubspotInstelling().catch(() => null),
  ]);

  return NextResponse.json({
    ok: true,
    gekoppeld: hubspotConfigured(),
    lead,
    fase: client.fase,
    budget: { maandbudget: client.budget.maandbudget, linkbuilding: client.budget.linkbuilding },
    prognose: {
      kans: regel?.kans ?? null,
      startMaand: regel?.startMaand ?? null,
      feeAds: regel?.extraOmzet ?? 0,
      maandkosten: regel?.extraKosten ?? 0,
      eenmalig: regel?.eenmaligOmzet ?? 0,
      eenmaligKosten: regel?.eenmaligKosten ?? 0,
      // "hubspot" = automatisch gevuld, "handmatig" = Maarten heeft hem gezet.
      bron: bron || "",
    },
    notitiesTerug: !!instelling?.notitiesTerug,
    bron: instelling?.bron || "contacten",
    ingesteld: !!(instelling?.bron === "deals" || (instelling?.filterVeld && instelling?.filterWaarde)),
  });
}

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const client = await getClientBySlug(slug);
  if (!client) return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    actie?: string; maandbudget?: number; linkbuilding?: number; kans?: number;
    startMaand?: string; dealId?: string; tekst?: string; dagen?: number;
    soort?: "seo" | "ads" | "website" | "overig";
    feeAds?: number; maandkosten?: number; eenmalig?: number; eenmaligKosten?: number;
  };

  switch (body.actie) {
    // Het beoogde maandbudget. Dit is het enige bedrag dat de prognose gebruikt,
    // en het staat bewust in het dashboard: een deal in HubSpot is meestal een
    // totaalbedrag en dat zou de prognose onbruikbaar maken.
    case "budget": {
      const maandbudget = Math.max(0, Math.round(Number(body.maandbudget) || 0));
      const linkbuilding = Math.max(0, Math.round(Number(body.linkbuilding) || 0));
      await setClientBudget(slug, {
        maandbudget,
        linkbuilding: Math.min(linkbuilding, maandbudget),
        uurtarief: client.budget.uurtarief,
        beschikbareUren: client.budget.beschikbareUren,
      });
      return NextResponse.json({ ok: true });
    }

    // Alles wat de prognose van deze lead moet weten en wat NIET uit HubSpot
    // komt: wanneer hij naar verwachting start, hoe groot de kans is, de fee voor
    // advertenties, de kosten per maand, en een eenmalig bedrag (een website) met
    // de kosten daarvan. Zodra Maarten hier iets zet is deze regel van hem en
    // laat de HubSpot-ronde hem met rust; zie saveRegelUitBron in lib/prognose.ts.
    case "prognose": {
      const getal = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
      // Bestaat er nog geen regel voor deze lead, dan begint hij op de standaard
      // leadkans en niet op 100. Zonder dit zou het invullen van alleen een
      // startmaand een lead stilletjes als zekere omzet in de prognose zetten.
      const versLead = client.fase !== "klant" && body.kans === undefined && !(await getRegelExtra(slug).catch(() => null));
      await saveRegelExtra(slug, {
        ...(versLead ? { kans: LEAD_STANDAARD_KANS } : {}),
        ...(body.kans !== undefined ? { kans: Number(body.kans) } : {}),
        ...(body.startMaand !== undefined ? { startMaand: body.startMaand || null } : {}),
        ...(body.soort !== undefined ? { soort: body.soort } : {}),
        ...(body.feeAds !== undefined ? { extraOmzet: getal(body.feeAds) } : {}),
        ...(body.maandkosten !== undefined ? { extraKosten: getal(body.maandkosten) } : {}),
        ...(body.eenmalig !== undefined ? { eenmaligOmzet: getal(body.eenmalig) } : {}),
        ...(body.eenmaligKosten !== undefined ? { eenmaligKosten: getal(body.eenmaligKosten) } : {}),
      });
      return NextResponse.json({ ok: true, bron: await getRegelBron(slug) });
    }

    case "koppel": {
      const res = await koppelDeal(slug, String(body.dealId || ""));
      return NextResponse.json({ ...res, lead: await getHubspotLead(slug) });
    }

    case "ontkoppel": {
      await ontkoppelLead(slug);
      return NextResponse.json({ ok: true });
    }

    case "ophalen": {
      const res = await syncHubspot({ volledig: true });
      return NextResponse.json({ ...res, lead: await getHubspotLead(slug) });
    }

    // Een notitie: altijd in het dossier hier, en alleen als Maarten dat heeft
    // aangezet ook als notitie bij de deal in HubSpot.
    case "notitie": {
      const tekst = String(body.tekst || "").trim();
      if (!tekst) return NextResponse.json({ ok: false, error: "Lege notitie." }, { status: 400 });
      await addDossierItem(slug, { inhoud: tekst, soort: "notitie", bron: "dashboard" });
      const instelling = await getHubspotInstelling();
      const lead = await getHubspotLead(slug);
      let naarHubspot = false;
      let fout = "";
      if (instelling.notitiesTerug && lead?.dealId) {
        const r = await hsMaakNotitie(lead.dealId, tekst);
        naarHubspot = r.ok;
        fout = r.error || "";
      }
      return NextResponse.json({ ok: true, naarHubspot, error: fout || undefined });
    }

    case "opvolging": {
      const dagen = Math.min(90, Math.max(1, Math.round(Number(body.dagen) || 5)));
      await planOpvolging({
        clientSlug: slug,
        taak: String(body.tekst || "").slice(0, 300) || `Opvolgen: ${client.name}`,
        naar: client.email || "",
        url: `/admin/client/${slug}?tab=lead`,
        dagen,
        soort: "taak",
      });
      return NextResponse.json({ ok: true, dagen });
    }

    // Lead wordt klant. Alles blijft staan (dossier, documenten, mail); alleen
    // het label verandert, en daarmee gaat de prognose van "kans" naar "zeker".
    case "maak-klant": {
      await setClientFase(slug, "klant");
      await saveRegelExtra(slug, { kans: 100 });
      return NextResponse.json({ ok: true });
    }

    // De snelle blik op hun site: waar staan ze nu, en welke pagina's brengen het
    // meeste op. Bewust op een knop en niet automatisch, want dit kost credits.
    case "scan": {
      const domein = (client.domain || "").trim();
      if (!domein) return NextResponse.json({ ok: false, error: "Deze lead heeft nog geen website ingevuld." }, { status: 400 });
      if (!ahrefsConfigured()) return NextResponse.json({ ok: false, error: "Ahrefs is niet gekoppeld in deze omgeving." }, { status: 400 });
      try {
        const [autoriteit, pagina] = await Promise.all([
          getSiteAuthority(domein),
          getAhrefsTopPages(domein, 10).catch(() => []),
        ]);
        const regels = [
          `## Snelle blik op ${domein}`,
          "",
          `- Autoriteit (Domain Rating): ${autoriteit.domainRating ?? "onbekend"}`,
          `- Verwijzende domeinen: ${autoriteit.refDomains ?? "onbekend"}`,
          `- Backlinks: ${autoriteit.backlinks ?? "onbekend"}`,
          "",
          "### Pagina's die nu het meeste opleveren",
          "",
          "| Pagina | Bezoek per maand | Belangrijkste zoekwoord | Positie |",
          "|---|---|---|---|",
          ...pagina.slice(0, 10).map((p) => `| ${p.url} | ${p.traffic ?? "?"} | ${p.topKeyword || "?"} | ${p.position ?? "?"} |`),
        ];
        const tekst = regels.join("\n");
        await addDossierItem(slug, {
          inhoud: tekst,
          titel: `Snelle blik op ${domein} (${new Date().toISOString().slice(0, 10)})`,
          samenvatting: `Autoriteit ${autoriteit.domainRating ?? "?"}, ${autoriteit.refDomains ?? "?"} verwijzende domeinen, top ${pagina.length} pagina's opgehaald.`,
          soort: "meting",
          bron: "ahrefs",
        });
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
      }
    }

    default:
      return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
  }
}
