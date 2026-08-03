import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan, getWeekplanDev, setWeekplanNaarDev } from "../../../../../lib/weekplan";
import { docsVoorPagina } from "../../../../../lib/developer";
import { devSturing } from "../../../../../lib/developer";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Wat het doorzet-venster laat zien: de opdracht zoals de sitebouwer hem krijgt,
// de opmerkingen, en alle documenten die bij deze pagina horen om uit te kiezen.
//
// De kaart en de doorgeefversie staan los van elkaar. Op de kaart staat het hele
// verhaal (achtergrond, cijfers, aanpak per fase); de sitebouwer krijgt alleen
// wat hij moet doen, en de teksten die hij daarvoor nodig heeft. Welke tekst dat
// is, is een keuze: staat er een herziene versie van de klant, dan moet díe de
// site op en niet onze eigen copy.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const kaart = (await getWeekplan(slug)).find((k) => k.id === id);
  if (!kaart) return NextResponse.json({ ok: false, error: "Kaart niet gevonden." }, { status: 404 });

  const opgeslagen = await getWeekplanDev(slug, id);
  const beschikbaar = await docsVoorPagina(slug, kaart.url || "").catch(() => []);
  const gekozen = opgeslagen?.docs || [];

  return NextResponse.json({
    ok: true,
    // Nog niets doorgezet? Dan als voorstel de kaarttitel en alleen de regels die
    // over de bouw gaan; dat is precies wat er nu automatisch werd doorgestuurd.
    taak: opgeslagen?.taak || kaart.taak || "",
    toelichting: opgeslagen?.toelichting || devSturing(kaart.toelichting || ""),
    docs: beschikbaar,
    gekozen: gekozen.map((d) => d.url),
    url: kaart.url || "",
  });
}

// Doorzetten (of terugtrekken), met de gekozen teksten en documenten.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const id = Number(body.id || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Klant en kaart zijn verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const docs = (Array.isArray(body.docs) ? body.docs : [])
    .map((d) => ({
      label: String((d as Record<string, unknown>)?.label || "").slice(0, 80),
      url: String((d as Record<string, unknown>)?.url || "").trim().slice(0, 600),
    }))
    .filter((d) => d.url);

  await setWeekplanNaarDev(slug, id, body.naarDev !== false, {
    taak: body.taak === undefined ? undefined : String(body.taak),
    toelichting: body.toelichting === undefined ? undefined : String(body.toelichting),
    docs,
  });
  return NextResponse.json({ ok: true });
}
