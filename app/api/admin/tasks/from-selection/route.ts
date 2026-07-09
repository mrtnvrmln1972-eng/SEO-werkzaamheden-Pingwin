import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { appendTasks } from "../../../../../lib/tasks";

export const runtime = "nodejs";

// Maakt één werkzaamheid van geselecteerde tekst uit de cockpit. De selectie
// komt als interne toelichting in de taak; standaard niet klant-zichtbaar.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const tekst = String(body.tekst || "").trim();
  if (!tekst) return NextResponse.json({ ok: false, error: "Geen tekst geselecteerd." }, { status: 400 });

  // Titel: de eerste regel/zin, afgekapt; volledige tekst als nette toelichting.
  const firstLine = tekst.split("\n")[0].trim();
  const title = (firstLine.length > 70 ? firstLine.slice(0, 67).trimEnd() + "…" : firstLine) || "Notitie uit de cockpit";
  const html = tekst.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

  const ids = await appendTasks(slug, [{
    taak: title,
    toelichting: html,
    status: "Gepland",
    wie: "SEO",
    klantZichtbaar: false,
  }]);
  return NextResponse.json({ ok: true, taskId: ids[0] ?? null, title });
}
