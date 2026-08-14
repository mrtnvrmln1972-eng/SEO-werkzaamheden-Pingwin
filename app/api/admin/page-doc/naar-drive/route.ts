import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { uploadExistingDoc } from "../../../../../lib/page-doc-run";
import type { DocKind } from "../../../../../lib/page-doc";

export const runtime = "nodejs";
export const maxDuration = 120;

const KINDEN: DocKind[] = ["analyse", "blauwdruk", "copy"];

// Zet een AL VASTGELEGDE stap (analyse/blauwdruk/copy) alsnog om naar een
// Word-bestand in de inmiddels gekozen Drive-map, zonder de tekst opnieuw te
// laten schrijven. Bedoeld voor het vangnet op de interne documentweergave
// ("tussenfase"): een stap die ooit zonder gekozen map is gemaakt, kreeg
// daardoor nooit een echte Drive-link en kon dus ook niet meegaan naar de
// developer of in een mail. Zie lib/page-doc-run.ts, uploadExistingDoc.
export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const url = String(body.url || "").trim();
  const kind = String(body.kind || "") as DocKind;
  if (!slug || !url || !KINDEN.includes(kind)) {
    return NextResponse.json({ ok: false, error: "Klant, pagina en soort zijn verplicht." }, { status: 400 });
  }
  try {
    const link = await uploadExistingDoc(slug, url, kind);
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Uploaden naar Drive mislukte." }, { status: 500 });
  }
}
