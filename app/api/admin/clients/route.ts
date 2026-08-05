import { NextRequest, NextResponse } from "next/server";
import { getAdminScope, canAccessSlug, guardOwner } from "../../../../lib/admin-scope";
import { opruimWeesOrgData } from "../../../../lib/org-data";
import { listClients, createClient, deleteClient, updateClientCockpit, updateClientCore, parseSheetUrl, resetClientPassword, setClientBudget, setClientBackendUrl, setClientDevName, getOrCreateShareToken } from "../../../../lib/clients";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const scope = await getAdminScope(req);
  if (!scope) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const all = await listClients();
  // Meteen opruimen wat bij geen enkele klant hoort en helemaal leeg is (rest
  // van een verkeerd gespelde klantnaam). Alleen voor de eigenaar, en het mag
  // het scherm niet ophouden, dus zonder erop te wachten.
  if (scope.isOwner) void opruimWeesOrgData().catch(() => 0);
  // Gast: alleen de klanten waar hij toegang toe heeft.
  const clients = scope.isOwner ? all : all.filter((c) => canAccessSlug(scope, c.slug));
  return NextResponse.json({ ok: true, clients });
}

export async function POST(req: NextRequest) {
  // Klant aanmaken: alleen de eigenaar.
  const g = await guardOwner(req); if (!g.ok) return g.res;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const loginId = String(body.loginId || "").trim();
  const email = String(body.email || "").trim();
  const sheetUrl = String(body.sheetUrl || "").trim();

  const maandbudget = Number(body.maandbudget) || 0;
  const linkbuilding = Number(body.linkbuilding) || 0;
  const uurtarief = Number(body.uurtarief) || 0;
  const beschikbareUren = Number(body.beschikbareUren) || 0;

  if (!name || !loginId) {
    return NextResponse.json(
      { ok: false, error: "Naam en inlognaam zijn verplicht." },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(loginId)) {
    return NextResponse.json(
      { ok: false, error: "Inlognaam mag alleen letters, cijfers, punt, streepje of underscore bevatten (geen spaties)." },
      { status: 400 },
    );
  }

  // Klantgroep: leeg = eigen klant, "mmc" = Multimedia Concepts (cockpit-only,
  // login standaard uit, Google Sheet niet verplicht).
  const grp = String(body.grp || "").trim() || null;

  // Sheet is optioneel geworden (cockpit-only klanten hebben er geen). Is er
  // wél een link ingevuld, dan moet die geldig zijn.
  let sheetId = "", gid = "0";
  if (sheetUrl) {
    const parsed = parseSheetUrl(sheetUrl);
    if (!parsed.sheetId) {
      return NextResponse.json(
        { ok: false, error: "Kon geen geldige Google Sheet-link herkennen. Plak de volledige link naar het juiste tabblad, of laat het veld leeg (cockpit-only)." },
        { status: 400 },
      );
    }
    sheetId = parsed.sheetId; gid = parsed.gid;
  }

  try {
    const { client, password } = await createClient({
      name, loginId, email, sheetId, gid,
      maandbudget, linkbuilding, uurtarief, beschikbareUren,
      grp,
      // MMC-klanten krijgen standaard géén klant-login (cockpit-only).
      loginEnabled: grp === "mmc" ? false : true,
    });
    // De deelbare, loginvrije link (/k/<code>) is de standaard manier om het
    // dashboard met de klant te delen; direct meegeven aan het aanmaak-scherm.
    const shareToken = await getOrCreateShareToken(client.slug).catch(() => null);
    return NextResponse.json({ ok: true, client, password, shareToken });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/duplicate key|unique/i.test(msg)) {
      return NextResponse.json(
        { ok: false, error: "Er bestaat al een klant met deze inlognaam. Kies een andere." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Aanmaken mislukt: " + msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Klant bewerken (wachtwoord-reset, budget, kernvelden): alleen de eigenaar.
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  }

  // Inlogpagina van de website-beheeromgeving (voor de "Open in site"-knop).
  if (body.action === "setBackendUrl") {
    const ok = await setClientBackendUrl(slug, String(body.backendUrl || "").trim() || null);
    if (!ok) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // Nieuw wachtwoord genereren (het oude is versleuteld en niet terug te lezen).
  if (body.action === "resetPassword") {
    const password = await resetClientPassword(slug);
    if (!password) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true, password });
  }

  // Alleen de budgetvelden bijwerken (maandfee, linkbuilding, uurtarief, uren).
  // Raakt e-mail/Sheet niet aan, dus veilig als losse actie.
  if (body.action === "setBudget") {
    const ok = await setClientBudget(slug, {
      maandbudget: Number(body.maandbudget) || 0,
      linkbuilding: Number(body.linkbuilding) || 0,
      uurtarief: Number(body.uurtarief) || 0,
      beschikbareUren: Number(body.beschikbareUren) || 0,
    });
    if (!ok) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "devName") {
    const ok = await setClientDevName(slug, String(body.devName || ""));
    if (!ok) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const ok = await updateClientCockpit(slug, {
    emailDomain: String(body.emailDomain || "").trim() || null,
    workDocUrl: String(body.workDocUrl || "").trim() || null,
    resultsUrl: String(body.resultsUrl || "").trim() || null,
    status: String(body.status || "").trim() || null,
    lastContact: String(body.lastContact || "").trim() || null,
    notes: String(body.notes || "").trim() || null,
  });

  // Kernvelden (e-mail, Sheet, budget) alleen bijwerken als ze meegestuurd zijn.
  const hasCore =
    "email" in body || "sheetUrl" in body || "maandbudget" in body ||
    "linkbuilding" in body || "uurtarief" in body || "beschikbareUren" in body;
  if (hasCore) {
    const { sheetId, gid } = parseSheetUrl(String(body.sheetUrl || ""));
    await updateClientCore(slug, {
      email: String(body.email || "").trim() || null,
      sheetId,
      gid,
      maandbudget: Number(body.maandbudget) || 0,
      linkbuilding: Number(body.linkbuilding) || 0,
      uurtarief: Number(body.uurtarief) || 0,
      beschikbareUren: Number(body.beschikbareUren) || 0,
    });
  }

  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  // Klant verwijderen: alleen de eigenaar.
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const slug = new URL(req.url).searchParams.get("slug") || "";
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  }
  const removed = await deleteClient(slug);
  return NextResponse.json({ ok: removed });
}
