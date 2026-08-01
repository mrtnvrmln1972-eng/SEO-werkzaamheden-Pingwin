import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

// Bespreeklijsten per persoon (Klant, Dev, ...): kleine afvinklijstjes met alles
// wat Maarten met iemand wil bespreken, laten doen of controleren. Punten
// blijven bewaard (klaar = doorgestreept, niet weg); mailen stempelt "gedeeld"
// zodat zichtbaar is wat de ander al heeft.

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_discuss_items (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      persoon     TEXT NOT NULL,
      tekst       TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'open',
      gedeeld_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cdi_slug ON client_discuss_items (client_slug, persoon)`;
}

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await ensureSchema(); await ensureTable();
  const { rows } = await sql`
    SELECT id, persoon, tekst, status, gedeeld_at, created_at FROM client_discuss_items
    WHERE client_slug = ${slug} AND status <> 'weg'
    ORDER BY (status = 'klaar'), id`;
  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      id: r.id as number, persoon: (r.persoon as string) || "", tekst: (r.tekst as string) || "",
      klaar: r.status === "klaar",
      gedeeldAt: r.gedeeld_at ? new Date(r.gedeeld_at as string).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await ensureSchema(); await ensureTable();
  const action = String(body.action || "").trim();

  if (action === "add") {
    const persoon = String(body.persoon || "").trim().slice(0, 60);
    const tekst = String(body.tekst || "").trim().slice(0, 600);
    if (!persoon || !tekst) return NextResponse.json({ ok: false, error: "Persoon en tekst zijn verplicht." }, { status: 400 });
    const { rows } = await sql`INSERT INTO client_discuss_items (client_slug, persoon, tekst) VALUES (${slug}, ${persoon}, ${tekst}) RETURNING id`;
    return NextResponse.json({ ok: true, id: rows[0].id });
  }
  if (action === "vink") {
    const id = Number(body.id || 0);
    const klaar = !!body.klaar;
    await sql`UPDATE client_discuss_items SET status = ${klaar ? "klaar" : "open"} WHERE client_slug = ${slug} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  if (action === "del") {
    const id = Number(body.id || 0);
    await sql`UPDATE client_discuss_items SET status = 'weg' WHERE client_slug = ${slug} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  if (action === "gedeeld") {
    const persoon = String(body.persoon || "").trim();
    await sql`UPDATE client_discuss_items SET gedeeld_at = now() WHERE client_slug = ${slug} AND persoon = ${persoon} AND status = 'open'`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
