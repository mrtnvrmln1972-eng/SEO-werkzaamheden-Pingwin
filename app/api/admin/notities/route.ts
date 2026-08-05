import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { sql, ensureSchema } from "../../../../lib/db";
import { sanitizeHtml } from "../../../../lib/veilige-html";

export const runtime = "nodejs";
export const maxDuration = 30;

// Notities per klant: losse kladblokjes met een titel, waarin Maarten vrij plakt
// en typt (opgemaakte tekst). Ze tellen mee als kennis over de klant: de tekst
// gaat als achtergrond mee in de chats en de pagina-analyses (lib/notities.ts).

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) tableReady = doEnsure().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}
async function doEnsure(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS client_notes (
      id          SERIAL PRIMARY KEY,
      client_slug TEXT NOT NULL,
      titel       TEXT NOT NULL DEFAULT '',
      inhoud      TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cnotes_slug ON client_notes (client_slug, id DESC)`;
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
    SELECT id, titel, inhoud, created_at, updated_at FROM client_notes
    WHERE client_slug = ${slug} AND status <> 'weg'
    ORDER BY id DESC`;
  return NextResponse.json({
    ok: true,
    notities: rows.map((r) => ({
      id: r.id as number,
      titel: (r.titel as string) || "",
      inhoud: (r.inhoud as string) || "",
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : null,
      updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
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
  const id = Number(body.id || 0);

  if (action === "add") {
    const titel = String(body.titel || "").trim().slice(0, 200);
    const inhoud = sanitizeHtml(String(body.inhoud || "")).slice(0, 60000);
    const { rows } = await sql`INSERT INTO client_notes (client_slug, titel, inhoud) VALUES (${slug}, ${titel}, ${inhoud}) RETURNING id`;
    return NextResponse.json({ ok: true, id: rows[0].id });
  }
  if (action === "edit") {
    if (!id) return NextResponse.json({ ok: false, error: "Geen notitie opgegeven." }, { status: 400 });
    const inhoud = sanitizeHtml(String(body.inhoud || "")).slice(0, 60000);
    await sql`UPDATE client_notes SET inhoud = ${inhoud}, updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  if (action === "titel") {
    if (!id) return NextResponse.json({ ok: false, error: "Geen notitie opgegeven." }, { status: 400 });
    const titel = String(body.titel || "").trim().slice(0, 200);
    await sql`UPDATE client_notes SET titel = ${titel}, updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  if (action === "del") {
    if (!id) return NextResponse.json({ ok: false, error: "Geen notitie opgegeven." }, { status: 400 });
    await sql`UPDATE client_notes SET status = 'weg', updated_at = now() WHERE client_slug = ${slug} AND id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Onbekende actie." }, { status: 400 });
}
