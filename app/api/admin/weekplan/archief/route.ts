import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getArchief } from "../../../../../lib/weekplan";

export const runtime = "nodejs";

// Het archief van één projectkaart: oude titels, oude kaartteksten en regels die
// niet meer pasten, met de datum erbij. Wordt pas opgehaald als je het blok
// openklapt; het staat er voor als je iets terug moet zoeken, niet om te lezen.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const items = await getArchief(slug, id);
  return NextResponse.json({ ok: true, items });
}
