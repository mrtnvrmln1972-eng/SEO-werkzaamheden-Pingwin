import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { listClients, setClientBudget } from "../../../../lib/clients";
import {
  getPrognose, savePrognoseInstelling, saveRegelExtra,
  addPost, deletePost, maandPlus,
} from "../../../../lib/prognose";
import { moneybirdConfigured, getProfitLoss, getMbContacts } from "../../../../lib/moneybird";
import {
  bouwVoorstel, setLinkbuilderZoekterm, setLinkbuilderId, linkbuildingPostNaam,
} from "../../../../lib/prognose-boekhouding";
import { vervangPost, maandNu } from "../../../../lib/prognose";

export const runtime = "nodejs";
export const maxDuration = 60;

// De prognose op /admin/financien. Uitsluitend voor de eigenaar: hier staan de
// bedragen van alle klanten en leads bij elkaar, en dat mag nooit via de gewone
// klant-scope bereikbaar zijn.

async function stuurPrognose() {
  const klanten = await listClients();
  const uitkomst = await getPrognose(
    klanten.map((k) => ({ slug: k.slug, name: k.name, fase: k.fase, budget: k.budget })),
  );
  return NextResponse.json({ ok: true, ...uitkomst });
}

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  try {
    return await stuurPrognose();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: {
    instelling?: { target?: number; targetOp?: "netto" | "omzet"; vasteLasten?: number; horizon?: number };
    regel?: {
      slug?: string; kans?: number; startMaand?: string | null; eindMaand?: string | null;
      extraKosten?: number; opmerking?: string;
      // Het maandbedrag en de linkbuilding staan in de klantrij zelf, niet in de
      // prognosetabel. Ze mogen hier wél bewerkt worden (anders moet Maarten voor
      // elk bedrag naar een andere cockpit), maar ze worden daar weggeschreven.
      // Zo blijft er één bedrag bestaan in plaats van twee die uit elkaar lopen.
      bedrag?: number; linkbuilding?: number;
    };
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  try {
    if (body.instelling) await savePrognoseInstelling(body.instelling);
    if (body.regel?.slug) {
      const { slug, bedrag, linkbuilding, ...rest } = body.regel;
      await saveRegelExtra(slug, rest);
      if (bedrag !== undefined || linkbuilding !== undefined) {
        const klant = (await listClients()).find((k) => k.slug === slug);
        if (klant) {
          await setClientBudget(slug, {
            maandbudget: bedrag !== undefined ? Math.max(0, bedrag) : klant.budget.maandbudget,
            linkbuilding: linkbuilding !== undefined ? Math.max(0, linkbuilding) : klant.budget.linkbuilding,
            uurtarief: klant.budget.uurtarief,
            beschikbareUren: klant.budget.beschikbareUren,
          });
        }
      }
    }
    return await stuurPrognose();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: {
    actie?: string;
    post?: { naam: string; soort?: string; maand?: string; bedrag?: number; kans?: number; herhaalt?: boolean };
    slugs?: string[];
    linkbuilder?: string;
    linkbuilderId?: string | null;
    bedrag?: number;
    naam?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  try {
    // De leveranciers om uit te kiezen. Een keuzelijst raadt niet; een zoekterm
    // op een mailadres wel, en die miste precies het geval waar het om ging (de
    // linkbuilder staat in de boekhouding onder zijn bedrijfsnaam).
    if (body.actie === "moneybird-contacten") {
      if (!moneybirdConfigured()) {
        return NextResponse.json({ ok: false, error: "Moneybird is niet gekoppeld." }, { status: 400 });
      }
      const contacten = (await getMbContacts())
        .map((c) => ({ id: c.id, naam: c.name, email: c.email }))
        .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
      return NextResponse.json({ ok: true, contacten });
    }

    // Linkbuilding die niet per klant te herleiden is, alsnog laten meetellen.
    // De kosten zijn echt; alleen de verdeling over klanten is onbekend. Als
    // vaste maandpost staan ze in de prognose in plaats van uit beeld te vallen.
    if (body.actie === "linkbuilding-als-maandpost") {
      const bedrag = Math.max(0, Math.round(Number(body.bedrag) || 0));
      if (!bedrag) return NextResponse.json({ ok: false, error: "Geen bedrag om over te nemen." }, { status: 400 });
      await vervangPost(body.naam || linkbuildingPostNaam(null), {
        soort: "kosten", maand: maandNu(), bedrag, kans: 100, herhaalt: true,
      });
      return await stuurPrognose();
    }

    // ── De prognose vullen vanuit de boekhouding ──
    // Bewust twee losse stappen. "voorstel" leest alleen en laat zien wat er zou
    // veranderen; "overnemen" schrijft, en alleen de regels die Maarten aanvinkt.
    // Eén knop die twintig bedragen tegelijk omzet is precies de knop waarvan je
    // later niet meer weet wat hij gedaan heeft.
    if (body.actie === "boekhouding-voorstel" || body.actie === "boekhouding-overnemen") {
      if (!moneybirdConfigured()) {
        return NextResponse.json({ ok: false, error: "Moneybird is niet gekoppeld." }, { status: 400 });
      }
      if (body.linkbuilder !== undefined) await setLinkbuilderZoekterm(body.linkbuilder);
      if (body.linkbuilderId !== undefined) await setLinkbuilderId(body.linkbuilderId);

      const klanten = await listClients();
      const voorstel = await bouwVoorstel(klanten.map((k) => ({
        slug: k.slug, name: k.name, fase: k.fase, domain: k.domain,
        moneybirdContactId: k.moneybirdContactId, budget: k.budget,
      })));

      if (body.actie === "boekhouding-voorstel") {
        return NextResponse.json({ ok: true, voorstel });
      }

      const kies = new Set(Array.isArray(body.slugs) ? body.slugs : []);
      let overgenomen = 0;
      for (const r of voorstel.regels) {
        if (!r.slug || !kies.has(r.slug) || !r.wijzigt) continue;
        const klant = klanten.find((k) => k.slug === r.slug);
        if (!klant) continue;
        await setClientBudget(r.slug, {
          maandbudget: Math.max(0, r.bedrag),
          linkbuilding: Math.max(0, r.linkbuilding),
          uurtarief: klant.budget.uurtarief,
          beschikbareUren: klant.budget.beschikbareUren,
        });
        overgenomen++;
      }
      const uit = await stuurPrognose();
      const d = await uit.json();
      return NextResponse.json({ ...d, overgenomen });
    }

    // Vaste lasten laten vullen vanuit de boekhouding: het gemiddelde van de
    // laatste drie afgesloten maanden. Zo hoeft Maarten niet te schatten wat
    // Moneybird al weet. Losse klantkosten (linkbuilding) horen hier niet bij,
    // die staan al per klant; dit is bewust een grove maat waar hij op stuurt.
    if (body.actie === "vaste-lasten-uit-boekhouding") {
      if (!moneybirdConfigured()) {
        return NextResponse.json({ ok: false, error: "Moneybird is niet gekoppeld." }, { status: 400 });
      }
      const nu = maandNu();
      const periodes = [1, 2, 3].map((n) => maandPlus(nu, -n).replace("-", ""));
      const rapporten = await Promise.all(periodes.map((p) => getProfitLoss(p)));
      const gemiddeld = rapporten.reduce((s, r) => s + r.totalExpenses, 0) / (rapporten.length || 1);
      await savePrognoseInstelling({ vasteLasten: Math.max(0, Math.round(gemiddeld)) });
      return await stuurPrognose();
    }

    if (body.post) {
      await addPost(body.post);
      return await stuurPrognose();
    }
    return NextResponse.json({ ok: false, error: "Niets te doen." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const id = Number(new URL(req.url).searchParams.get("post") || 0);
  if (!id) return NextResponse.json({ ok: false, error: "Geen post opgegeven." }, { status: 400 });
  try {
    await deletePost(id);
    return await stuurPrognose();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
