import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan, getWeekplanDev, setWeekplanNaarDev } from "../../../../../lib/weekplan";
import { docsVoorPagina } from "../../../../../lib/developer";
import { goedgekeurdeVersies } from "../../../../../lib/doc-versions";
import { ALLE_PUNTEN, voorstelPunten, type PuntId } from "../../../../../lib/dev-punten";
import { devSturing } from "../../../../../lib/developer";
import { planOpvolging } from "../../../../../lib/mail-opvolg";

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
  // Documenten hangen aan de pagina als die er is, en anders aan de taak zelf
  // (dezelfde sleutel als de kaart gebruikt). Zonder die terugval kreeg je bij een
  // taak zonder pagina een lege lijst, terwijl er wél documenten aan hingen.
  const docSleutel = kaart.url || `taak:${id}`;
  const beschikbaar = await docsVoorPagina(slug, docSleutel).catch(() => []);
  const gekozen = opgeslagen?.docs || [];
  // De versie die jij hebt aangemerkt als geldend staat standaard aan: dat is
  // immers de tekst die de sitebouwer op de site moet zetten.
  const geldend = (await goedgekeurdeVersies(slug, docSleutel).catch(() => []))
    .map((v) => v.driveLink).filter(Boolean);
  // Is er een copy-document, dan hoort dat standaard aan te staan: dat is de
  // tekst die de sitebouwer meestal moet verwerken. Stond er niet bij, dan ging
  // een kaart naar de developer (of een mail aan hem) zonder de copy erbij, en
  // moest hij die alsnog los opvragen. Gepakt uit `beschikbaar` (niet los
  // opnieuw opgezocht): die lijst wijst ook naar de interne documentweergave
  // als er nog geen Drive-link is, en dan moet precies díe link aanstaan.
  const copyLink = beschikbaar.find((d) => d.label === "Copy")?.url || "";

  return NextResponse.json({
    ok: true,
    // Alleen wat er eerder is doorgezet. De velden beginnen bewust LEEG: Maarten
    // schrijft de opdracht voor de sitebouwer zelf, en een voorgevuld veld met de
    // kaarttekst erin moest hij eerst weggooien. Laat hij ze leeg, dan valt de
    // developerlijst terug op de kaart, dus er gaat nooit een lege taak de deur uit.
    taak: opgeslagen?.taak && opgeslagen.taak !== kaart.taak ? opgeslagen.taak : "",
    toelichting: opgeslagen?.toelichting || "",
    docs: beschikbaar,
    // De pagina en het copy-document staan standaard aan; de rest kies je zelf.
    gekozen: gekozen.length ? gekozen.map((d) => d.url) : Array.from(new Set([...(kaart.url ? [kaart.url] : []), ...geldend, ...(copyLink ? [copyLink] : [])])),
    voorstelTaak: kaart.taak || "",
    voorstelToelichting: devSturing(kaart.toelichting || ""),
    url: kaart.url || "",
    // Wat er straks meetbaar af moet zijn. De eerste keer stellen we voor wat we
    // ook echt kunnen nameten; daarna staat jouw eigen keuze er.
    puntKeuzes: ALLE_PUNTEN,
    punten: opgeslagen?.punten?.length
      ? opgeslagen.punten
      : (kaart.url ? await voorstelPunten(slug, kaart.url).catch(() => ["live"] as PuntId[]) : []),
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

  const naarDev = body.naarDev !== false;
  await setWeekplanNaarDev(slug, id, naarDev, {
    taak: body.taak === undefined ? undefined : String(body.taak),
    toelichting: body.toelichting === undefined ? undefined : String(body.toelichting),
    docs,
    punten: Array.isArray(body.punten) ? body.punten.map(String) : undefined,
  });

  // Wil je hier zelf over een paar dagen aan herinnerd worden (ook als er geen
  // mail bij deze keer achteraan gaat), dan komt die check-up op dezelfde manier
  // terug als bij een verstuurde mail: als melding bij het belletje.
  const herinnerDagen = Number(body.herinnerDagen || 0);
  if (naarDev && herinnerDagen > 0) {
    const onderwerp = String(body.taak || body.kaartTitel || "").replace(/<[^>]*>/g, "").trim();
    await planOpvolging({
      clientSlug: slug, taak: onderwerp, onderwerp,
      url: docs[0]?.url || String(body.url || ""), dagen: herinnerDagen, soort: "developer",
    }).catch(() => { /* de taak staat al op de lijst; een mislukte herinnering mag dat niet ongedaan maken */ });
  }
  return NextResponse.json({ ok: true });
}
