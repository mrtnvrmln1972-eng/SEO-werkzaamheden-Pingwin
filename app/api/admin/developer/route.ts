import { NextRequest, NextResponse } from "next/server";
import { guardDev } from "../../../../lib/admin-scope";
import {
  getDeveloperTasks, saveDeveloperOrder, setDeveloperStatus, setOwnerDone,
  nieuweDevTaak, bewerkDevTaak, voegDevDocToe, verwijderDevDoc, verwijderDevTaak,
} from "../../../../lib/developer";
import { sanitizeHtml } from "../../../../lib/veilige-html";
import { ensureFolderFor } from "../../../../lib/drive-map";
import { uploadBestand } from "../../../../lib/drive";
import { getTeamUserById } from "../../../../lib/team-users";

export const runtime = "nodejs";
// Een bestand naar Drive schrijven duurt langer dan een gewone opslag.
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: NextRequest) {
  // Cross-client developer-overzicht: de eigenaar en de developer zelf.
  const g = await guardDev(req); if (!g.ok) return g.res;
  return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
}

// De naam bij een gast-id, met een nette terugval. Een melding zonder naam is
// bruikbaar; een melding die omvalt omdat de naam niet op te halen is niet.
async function naamVanGast(userId: number | null): Promise<string> {
  if (userId === null) return "";
  try { return (await getTeamUserById(userId))?.name || ""; } catch { return ""; }
}

export async function POST(req: NextRequest) {
  const g = await guardDev(req); if (!g.ok) return g.res;

  // Een bestand bij een taak (een zip met beelden, een pdf, een export). Het gaat
  // naar de Drive-map van de klant en hangt daarna als klikbare link aan de taak,
  // zodat de sitebouwer nergens hoeft in te loggen of te mailen om eraan te komen.
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    const clientSlug = String(form.get("clientSlug") || "").trim();
    const taskKey = String(form.get("taskKey") || "").trim();
    const file = form.get("file");
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Dit bestand is groter dan 20 MB. Zet het zelf in Drive en plak de link erbij." }, { status: 400 });
    }
    const folderId = await ensureFolderFor(clientSlug);
    if (!folderId) return NextResponse.json({ ok: false, error: "Geen toegang tot Google Drive; koppel Drive opnieuw in het adminscherm." }, { status: 500 });
    const naam = (file.name || "bestand").slice(0, 200);
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const up = await uploadBestand(folderId, `Dev-${new Date().toISOString().slice(0, 10)}-${naam}`, buf, file.type || "application/octet-stream");
      await voegDevDocToe(clientSlug, taskKey, { label: naam, url: up.link });
      return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
    } catch (e) {
      return NextResponse.json({ ok: false, error: "Uploaden mislukte: " + (e as Error).message }, { status: 500 });
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const clientSlug = String(body.clientSlug || "").trim();
  const taskKey = String(body.taskKey || "").trim();

  // Actie "status": één taak afvinken (klaar/niet klaar) + terugkoppeling opslaan.
  if (body.action === "status") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    // De naam van de gast erbij, zodat de melding "X heeft een taak afgerond"
    // een naam heeft in plaats van "iemand". Owner = Maarten zelf, dan komt er
    // geen melding: van je eigen vinkje hoef je geen belletje.
    const naam = g.scope.isOwner ? "Maarten" : (await naamVanGast(g.scope.userId));
    await setDeveloperStatus(clientSlug, taskKey, !!body.done, String(body.note || ""), {
      naam, isOwner: g.scope.isOwner,
    });
    return NextResponse.json({ ok: true });
  }

  // Actie "afgerond": Maartens eigen vinkje, los van het vinkje van de developer.
  // Alleen hijzelf mag dit zetten; het is zijn eigen controle, niet die van een gast.
  if (body.action === "afgerond") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    if (!g.scope.isOwner) return NextResponse.json({ ok: false, error: "Alleen Maarten kan een taak zelf afronden." }, { status: 403 });
    await setOwnerDone(clientSlug, taskKey, !!body.done);
    return NextResponse.json({ ok: true });
  }

  // Zelf een taak aanmaken bij één klant.
  if (body.action === "nieuw") {
    const taak = sanitizeHtml(String(body.taak || "")).trim();
    if (!clientSlug) return NextResponse.json({ ok: false, error: "Klant ontbreekt." }, { status: 400 });
    if (!taak) return NextResponse.json({ ok: false, error: "Zet er in elk geval een taak bij." }, { status: 400 });
    const key = await nieuweDevTaak(clientSlug, {
      taak,
      toelichting: sanitizeHtml(String(body.toelichting || "")),
      link: String(body.link || "").trim(),
      execDate: String(body.execDate || "").trim(),
    });
    return NextResponse.json({ ok: true, taskKey: key, tasks: await getDeveloperTasks() });
  }

  // De taaktekst, de opmerking of de paginalink bijstellen.
  if (body.action === "bewerk") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    await bewerkDevTaak(clientSlug, taskKey, {
      taak: body.taak === undefined ? undefined : sanitizeHtml(String(body.taak || "")),
      toelichting: body.toelichting === undefined ? undefined : sanitizeHtml(String(body.toelichting || "")),
      link: body.link === undefined ? undefined : String(body.link || "").trim(),
    });
    return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
  }

  // Een document of een link aan de taak hangen, of er weer af halen.
  if (body.action === "doc") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    const url = String(body.url || "").trim();
    try {
      await voegDevDocToe(clientSlug, taskKey, { label: String(body.label || "").trim() || url, url });
      return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
    }
  }
  if (body.action === "docWeg") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    await verwijderDevDoc(clientSlug, taskKey, String(body.url || "").trim());
    return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
  }

  // Een zelf aangemaakte taak weggooien.
  if (body.action === "verwijder") {
    if (!clientSlug || !taskKey) return NextResponse.json({ ok: false, error: "Taak ontbreekt." }, { status: 400 });
    const weg = await verwijderDevTaak(clientSlug, taskKey);
    if (!weg) return NextResponse.json({ ok: false, error: "Deze taak komt uit de weekplanning of Werkzaamheden; haal hem daar weg." }, { status: 400 });
    return NextResponse.json({ ok: true, tasks: await getDeveloperTasks() });
  }

  const items = Array.isArray(body.items) ? (body.items as { clientSlug: string; taskKey: string; execDate: string }[]) : null;
  if (!items) return NextResponse.json({ ok: false, error: "Geen taken opgegeven." }, { status: 400 });
  const n = await saveDeveloperOrder(items);
  return NextResponse.json({ ok: true, saved: n });
}
