import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import {
  listKlantRegels, addKlantRegel, saveKlantRegel, deleteKlantRegel, type RegelSoort,
} from "../../../../lib/klant-regels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De extra regels onder een klant of lead: de website, de advertenties, hosting.
// Bureau-breed (het gaat over alle bedragen bij elkaar), dus alleen de eigenaar.

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, regels: await listKlantRegels() });
}

export async function POST(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    slug?: string; naam?: string; soort?: RegelSoort;
    bedrag?: number; kosten?: number; eenmaligOmzet?: number; eenmaligKosten?: number; startMaand?: string | null;
  };
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen bedrijf opgegeven." }, { status: 400 });
  const regel = await addKlantRegel(slug, String(body.naam || ""), body.soort || "overig");
  // Een nieuwe regel is een kopie van de rij erboven: zelfde bedrag, zelfde
  // kosten, zelfde eenmalige bedrag, zelfde startmaand. Dat is wat "dupliceren"
  // hoort te doen; daarna pas je één van de twee aan tot het klopt.
  const kopie = {
    bedrag: body.bedrag, kosten: body.kosten,
    eenmaligOmzet: body.eenmaligOmzet, eenmaligKosten: body.eenmaligKosten,
    startMaand: body.startMaand,
  };
  if (Object.values(kopie).some((v) => v !== undefined)) {
    await saveKlantRegel(regel.id, kopie);
    return NextResponse.json({ ok: true, regel: { ...regel, ...kopie } });
  }
  return NextResponse.json({ ok: true, regel });
}

export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const body = (await req.json().catch(() => ({}))) as {
    id?: number; naam?: string; soort?: RegelSoort;
    bedrag?: number; kosten?: number; eenmaligOmzet?: number; eenmaligKosten?: number;
    startMaand?: string | null; kans?: number | null;
  };
  const id = Number(body.id) || 0;
  if (!id) return NextResponse.json({ ok: false, error: "Geen regel opgegeven." }, { status: 400 });
  const { id: _weg, ...rest } = body;
  await saveKlantRegel(id, rest);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const id = Number(req.nextUrl.searchParams.get("id")) || 0;
  if (!id) return NextResponse.json({ ok: false, error: "Geen regel opgegeven." }, { status: 400 });
  await deleteKlantRegel(id);
  return NextResponse.json({ ok: true });
}
