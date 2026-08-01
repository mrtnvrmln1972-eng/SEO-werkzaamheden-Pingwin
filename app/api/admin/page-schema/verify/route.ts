import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getPageSchema, fetchRawJsonLd } from "../../../../../lib/page-schema";
import { analyzeExistingSchema } from "../../../../../lib/schema-check";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Controleer live": staat het geadviseerde schema nu echt op de pagina?
// Her-fetcht de live pagina en vergelijkt de aanwezige types en @id's met wat
// de motor heeft opgeleverd; meldt ook dubbel geplaatste types.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const url = String(body.url || "").trim();
  if (!slug || !url) return NextResponse.json({ ok: false, error: "Klant en pagina zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const state = await getPageSchema(slug, url);
  if (!state.jsonld) return NextResponse.json({ ok: false, error: "Er is nog geen structured data gegenereerd voor deze pagina; draai eerst de structured data-stap." }, { status: 400 });

  let verwacht: { types: string[]; ids: string[] };
  try {
    const inv = analyzeExistingSchema([state.jsonld]);
    verwacht = { types: inv.types, ids: inv.ids };
  } catch { return NextResponse.json({ ok: false, error: "De opgeslagen JSON-LD is niet leesbaar." }, { status: 500 }); }

  const rawLive = await fetchRawJsonLd(url);
  const live = analyzeExistingSchema(rawLive);
  const liveIds = new Set(live.ids);
  const liveTypes = new Set(live.types);
  const ontbrekendeIds = verwacht.ids.filter((i) => !liveIds.has(i));
  const ontbrekendeTypes = verwacht.types.filter((t) => !liveTypes.has(t));
  // Dubbel geplaatst: telt een type vaker in de live blokken dan verwacht?
  const teller = new Map<string, number>();
  for (const raw of rawLive) {
    try {
      const inv = analyzeExistingSchema([raw]);
      for (const t of inv.types) teller.set(t, (teller.get(t) || 0) + 1);
    } catch { /* kapot blok */ }
  }
  const dubbel = [...teller.entries()].filter(([, n]) => n > 1).map(([t, n]) => `${t} (${n}×)`);

  const geplaatst = ontbrekendeIds.length === 0 && ontbrekendeTypes.length === 0;
  return NextResponse.json({
    ok: true,
    geplaatst,
    dubbel,
    ontbreekt: [...new Set([...ontbrekendeTypes, ...ontbrekendeIds])].slice(0, 12),
    liveTypes: live.types,
    melding: geplaatst
      ? (dubbel.length ? `Het schema staat live, maar deze types staan dubbel: ${dubbel.join(", ")}. Laat de developer de dubbele verwijderen.` : "Alles staat live zoals geadviseerd; de fase kan op klaar.")
      : `Nog niet (volledig) geplaatst. Ontbreekt: ${[...ontbrekendeTypes, ...ontbrekendeIds].slice(0, 8).join(", ")}.`,
  });
}
