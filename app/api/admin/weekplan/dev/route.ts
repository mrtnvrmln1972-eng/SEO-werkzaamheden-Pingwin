import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getWeekplan, getWeekplanDev, setWeekplanNaarDev } from "../../../../../lib/weekplan";
import { docsVoorPagina } from "../../../../../lib/developer";
import { goedgekeurdeVersies } from "../../../../../lib/doc-versions";
import { ALLE_PUNTEN, voorstelPunten, type PuntId } from "../../../../../lib/dev-punten";
import { devSturing } from "../../../../../lib/developer";
import { planOpvolging } from "../../../../../lib/mail-opvolg";
import { kaartLinks } from "../../../../../lib/kaart-links";
import { standaardMee } from "../../../../../lib/naar-developer";

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
  // Het losse copy_url-veld van de taak (een tekst die apart is aangeleverd of
  // gevonden, niet uit de pijplijn) gaat als "Copy"-categorie mee de lijst in;
  // is het toevallig hetzelfde bestand als het pijplijndocument, dan houdt
  // docsVoorPagina er automatisch maar één van over.
  const beschikbaar = await docsVoorPagina(slug, docSleutel, kaart.copyUrl ? [{ categorie: "Copy", url: kaart.copyUrl }] : []).catch(() => []);
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
  //
  // Het gaat om de GELDENDE copy, dus om de soort en niet om het label. Op het
  // label matchen ("Copy: …") pakte de eerste regel die zo heette, en dat kon
  // een oudere ronde zijn zodra er meerdere copy-documenten bij een pagina
  // stonden. Wélke versie geldt staat in lib/laatste-versie.ts.
  const copyLink = beschikbaar.find((d) => d.soort === "copy" && !d.ouder)?.url || "";

  // De stukken waar de kaart naar verwijst: het stappenplan, de bespreekpunten,
  // een locatie. Dat handgeschreven veld bevat meestal precies wat de sitebouwer
  // nodig heeft, en er ging tot 20-08-2026 niets van mee: het doorzet-venster
  // toonde alleen de documenten uit de pijplijn. Ze staan standaard aan, want ze
  // zijn er niet voor niets bij gezet.
  //
  // Het label is de naam zoals hij op de kaart staat, zonder voorvoegsel. Dat
  // stond er eerst wél ("Uit de kaart: stappenplan"), en dat las in het
  // mailvenster als een rijtje systeemregels in plaats van als de stukken zelf.
  // Waar iets vandaan komt is voor de ontvanger niet interessant; wát het is wel.
  // Ze staan er nog wél bij om aan te vinken, maar ze staan niet meer vanzelf
  // aan: zie lib/naar-developer.ts. Een developer krijgt de link naar het
  // document plus de zin die Maarten erbij schrijft, en verder niets.
  // `uitAantekening` markeert ze, zodat de developer-route ze helemaal kan
  // weglaten en een mail aan de klant ze wél kan aanbieden.
  const uitKaart = kaartLinks(kaart.toelichting || "", kaart.notitie || "")
    .filter((l) => l.url !== kaart.url && !beschikbaar.some((d) => d.url === l.url))
    .map((l) => ({ ...l, uitAantekening: true }));
  const alles = [...beschikbaar, ...uitKaart];

  return NextResponse.json({
    ok: true,
    // Alleen wat er eerder is doorgezet. De velden beginnen bewust LEEG: Maarten
    // schrijft de opdracht voor de sitebouwer zelf, en een voorgevuld veld met de
    // kaarttekst erin moest hij eerst weggooien. Laat hij ze leeg, dan valt de
    // developerlijst terug op de kaart, dus er gaat nooit een lege taak de deur uit.
    taak: opgeslagen?.taak && opgeslagen.taak !== kaart.taak ? opgeslagen.taak : "",
    toelichting: opgeslagen?.toelichting || "",
    docs: alles,
    // Alleen de geldende documenten staan aan. De pagina, de oudere versies en de
    // links uit de aantekeningen stonden hier ook standaard aan, en dat leverde
    // een developer een rij verwijzingen op waar hij niets mee kon (25-08-2026,
    // zie lib/naar-developer.ts). Aanvinken kan nog steeds.
    gekozen: gekozen.length ? gekozen.map((d) => d.url) : standaardMee(beschikbaar),
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
  // De kaarttitel van dit moment gaat mee als basis onder de eigen formulering.
  // Verandert de kaart later, dan weet het dashboard dat die formulering is
  // ingehaald en toont het weer de kaart (zie devTaakNu in lib/weekplan.ts).
  const huidigeKaart = (await getWeekplan(slug)).find((k) => k.id === id);
  await setWeekplanNaarDev(slug, id, naarDev, {
    kaartTaak: huidigeKaart?.taak || "",
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
