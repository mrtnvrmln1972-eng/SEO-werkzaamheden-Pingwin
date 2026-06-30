import { NextRequest, NextResponse } from "next/server";
import {
  ingestEmails, ingestMetrics, ingestKeywords, ingestPages, ingestStatus, setClientMapping, deleteEmails,
  type EmailSnapshot, type MetricSnapshot, type KeywordSnapshot, type PageSnapshot, type ClientStatus,
} from "../../../../lib/snapshots";
import { replaceTasks, type TaskRow } from "../../../../lib/tasks";
import { saveFocus, type ClientFocus } from "../../../../lib/focus";
import { setClientBudget } from "../../../../lib/clients";

export const runtime = "nodejs";

// Inlaaddeur voor de data-brug. Beveiligd met het admin-wachtwoord als bearer-token
// (Authorization: Bearer <ADMIN_PASSWORD>). Server-naar-server, geen cookie nodig.
function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === expected;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Geen klant (slug) opgegeven." }, { status: 400 });
  }

  const result = { emails: 0, metrics: 0, keywords: 0, pages: 0, status: 0, tasks: 0 };
  try {
    if (body.budget && typeof body.budget === "object") {
      const b = body.budget as Record<string, unknown>;
      await setClientBudget(slug, {
        maandbudget: Number(b.maandbudget) || 0, linkbuilding: Number(b.linkbuilding) || 0,
        uurtarief: Number(b.uurtarief) || 0, beschikbareUren: Number(b.beschikbareUren) || 0,
      });
    }
    if (Array.isArray(body.tasks)) result.tasks = await replaceTasks(slug, body.tasks as TaskRow[]);
    if (body.focus && typeof body.focus === "object") await saveFocus(slug, body.focus as Partial<ClientFocus>);
    if (body.domain || body.ahrefsProjectId) {
      await setClientMapping(slug, String(body.domain || "").trim() || null, String(body.ahrefsProjectId || "").trim() || null);
    }
    if (Array.isArray(body.emails)) {
      if (body.replaceEmails === true) await deleteEmails(slug);
      result.emails = await ingestEmails(slug, body.emails as EmailSnapshot[]);
    }
    if (Array.isArray(body.metrics)) result.metrics = await ingestMetrics(slug, body.metrics as MetricSnapshot[]);
    if (Array.isArray(body.keywords)) result.keywords = await ingestKeywords(slug, body.keywords as KeywordSnapshot[]);
    if (Array.isArray(body.pages)) result.pages = await ingestPages(slug, body.pages as PageSnapshot[]);
    if (body.status && typeof body.status === "object" && !Array.isArray(body.status)) {
      result.status = await ingestStatus(slug, body.status as ClientStatus);
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Inladen mislukt: " + (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, ingested: result });
}
