import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug, setVoordeurUrl } from "../../../../lib/clients";
import { omgevingStand, pingwinAdresOk } from "../../../../lib/omgeving";

export const runtime = "nodejs";
export const maxDuration = 30;

// ═══════════════════════════════════════════════════════════
// DE CONTROLE OP DE VOORDEUR VAN EEN KLANT
// ═══════════════════════════════════════════════════════════
// Een klant kan een eigen adres hebben waar alleen hij bestaat (het
// klantvenster). Dat adres hoort naar dezelfde gegevens te kijken als dit
// dashboard, want anders zijn er weer twee administraties.
//
// Het probleem is dat je dat aan het scherm niet ziet. Een voordeur die nog aan
// zijn oude database hangt toont dezelfde klant, met dezelfde soort gegevens,
// alleen zijn ze van gisteren. Idem als het slot er niet op staat: dan is de
// voordeur gewoon het hele dashboard, met elke klant erin, en dat merk je pas
// als je hem deelt.
//
// Daarom vraagt deze route het bij de voordeur zelf op (via zijn /api/versie) en
// vergelijkt hij het met deze omgeving. Zo hoeft Maarten niet twee schermen
// naast elkaar te leggen en te gissen, en hoeft hij zeker niet in Vercel te gaan
// kijken. Eén knop, en het antwoord is ja of nee met de reden erbij.
// ═══════════════════════════════════════════════════════════

type Uitkomst = {
  bereikbaar: boolean;
  /** Wat de voordeur over zichzelf zegt. */
  venster: string | null;
  gegevens: string | null;
  versie: string | null;
  /** Kijkt hij naar dezelfde gegevens als deze omgeving? */
  zelfdeGegevens: boolean;
  /** Staat het slot op deze klant? */
  vensterGoed: boolean;
  klaar: boolean;
  /** Wat er nog moet gebeuren, in gewone taal. Leeg als alles klopt. */
  teDoen: string[];
};

async function controleer(adres: string, slug: string): Promise<Uitkomst> {
  const leeg: Uitkomst = {
    bereikbaar: false, venster: null, gegevens: null, versie: null,
    zelfdeGegevens: false, vensterGoed: false, klaar: false, teDoen: [],
  };

  let data: { venster?: string | null; gegevens?: string | null; kort?: string | null } | null = null;
  try {
    const res = await fetch(`${adres}/api/versie`, { cache: "no-store" });
    if (res.ok) data = await res.json().catch(() => null);
  } catch {
    data = null;
  }
  // Let op: deze regels komen als gewone tekst op het scherm (Signaal in
  // app/_ui/Uitkomst.tsx toont ze zoals ze zijn, met alleen links klikbaar).
  // Dus geen sterretjes of accolades erin, die zou je letterlijk zien staan.
  if (!data) {
    return {
      ...leeg,
      teDoen: ["Dit adres antwoordt niet. Klopt het adres, en staat er een Pingwin-omgeving op?"],
    };
  }

  const hier = omgevingStand();
  const venster = (data.venster || null) as string | null;
  const gegevens = (data.gegevens || null) as string | null;
  const zelfdeGegevens = Boolean(hier.gegevens && gegevens && hier.gegevens === gegevens);
  const vensterGoed = venster === slug;

  const teDoen: string[] = [];
  if (!zelfdeGegevens) {
    teDoen.push(
      gegevens
        ? "De voordeur kijkt naar een andere database dan dit dashboard. Zolang dat zo is zijn het twee administraties: wat je hier verandert, komt daar niet aan. Koppel daar dezelfde database als hier."
        : "De voordeur heeft geen database ingesteld, of hij kon er niet bij.",
    );
  }
  if (!venster) {
    teDoen.push(
      `Op de voordeur staat geen slot: daar is elke klant te zien en draaien de nachtronden een tweede keer. Zet daar de instelling WERELD_KLANT op ${slug}.`,
    );
  } else if (!vensterGoed) {
    teDoen.push(`De voordeur staat op klant ${venster} in plaats van ${slug}. Zet WERELD_KLANT daar op ${slug}.`);
  }

  return {
    bereikbaar: true,
    venster,
    gegevens,
    versie: (data.kort || null) as string | null,
    zelfdeGegevens,
    vensterGoed,
    klaar: zelfdeGegevens && vensterGoed,
    teDoen,
  };
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const klant = await getClientBySlug(slug);
  return NextResponse.json({ ok: true, adres: klant?.cockpit.voordeurUrl || "", hier: omgevingStand() });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }

  const slug = String(body.slug || "").trim().toLowerCase();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const adres = String(body.adres || "").trim().replace(/\/+$/, "");
  if (adres && !pingwinAdresOk(adres)) {
    return NextResponse.json({ ok: false, error: "Geef het adres van een Pingwin-omgeving, beginnend met https://." }, { status: 400 });
  }

  await setVoordeurUrl(slug, adres);
  if (!adres) return NextResponse.json({ ok: true, adres: "", uitkomst: null, hier: omgevingStand() });

  return NextResponse.json({ ok: true, adres, uitkomst: await controleer(adres, slug), hier: omgevingStand() });
}
