import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

// Centrale markeringen op Bird's eye-punten (per klant + onderwerp): welk punt
// is al doorgezet naar de weekplanning ('taak'), naar een bespreeklijst
// ('lijst'), genegeerd ('weg') of afgevinkt ('klaar'). Zo klopt de stand op elk
// apparaat, en staat een herhaald punt in een later antwoord automatisch al
// ingeklapt (zelfde punt = zelfde herkenning).

const STATEN = ["taak", "lijst", "weg", "klaar"];

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_answer_marks (
      client_slug TEXT NOT NULL,
      thread      TEXT NOT NULL,
      punt_hash   TEXT NOT NULL,
      staat       TEXT NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (client_slug, thread, punt_hash)
    )`;
}

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const thread = req.nextUrl.searchParams.get("thread") || "";
  if (!slug || !thread) return NextResponse.json({ ok: false, error: "Klant en onderwerp zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`SELECT punt_hash, staat FROM client_answer_marks WHERE client_slug = ${slug} AND thread = ${thread}`;
  const marks: Record<string, string> = {};
  for (const r of rows) marks[r.punt_hash as string] = r.staat as string;
  return NextResponse.json({ ok: true, marks });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const thread = String(body.thread || "").trim();
  if (!slug || !thread) return NextResponse.json({ ok: false, error: "Klant en onderwerp zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await ensureSchema(); await ensureTable();
  // set: één punt (staat null = keuze terugdraaien). bulk: meerdere in één keer.
  const invoer = (typeof body.bulk === "object" && body.bulk) ? (body.bulk as Record<string, unknown>) : { [String(body.hash || "")]: body.staat };
  let n = 0;
  for (const [hash, staatRaw] of Object.entries(invoer)) {
    if (!hash || n >= 200) continue;
    const staat = staatRaw == null ? null : String(staatRaw);
    if (staat === null) {
      await sql`DELETE FROM client_answer_marks WHERE client_slug = ${slug} AND thread = ${thread} AND punt_hash = ${hash}`;
    } else {
      if (!STATEN.includes(staat)) continue;
      await sql`
        INSERT INTO client_answer_marks (client_slug, thread, punt_hash, staat, updated_at)
        VALUES (${slug}, ${thread}, ${hash}, ${staat}, now())
        ON CONFLICT (client_slug, thread, punt_hash) DO UPDATE SET staat = ${staat}, updated_at = now()`;
    }
    n++;
  }
  return NextResponse.json({ ok: true, verwerkt: n });
}
