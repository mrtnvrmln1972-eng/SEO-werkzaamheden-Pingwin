import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminPrincipal, parseViewAsToken } from "./admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "./constants";
import { getTeamUserById } from "./team-users";
import { setAhrefsContext } from "./ahrefs";

// ═══════════════════════════════════════════════════════════
// TOEGANGSBEREIK (scope) van de ingelogde adminsessie
// ═══════════════════════════════════════════════════════════
// Vertaalt de adminsessie-cookie naar wat deze gebruiker mag zien:
//  - Env-eigenaar (owner):  alles (allowedSlugs = null = geen beperking).
//  - Teamgebruiker (gast):  alleen zijn allowed_slugs, mail/status alleen als
//                           can_see_mail aanstaat.
// Server-zijdig, node-runtime (leest de database voor gasten).
// ═══════════════════════════════════════════════════════════

export type AdminScope = {
  isOwner: boolean;
  userId: number | null;
  // null = geen beperking (owner ziet alles). Een lijst = alleen die slugs (gast).
  allowedSlugs: string[] | null;
  canSeeMail: boolean;
  // false = alleen lezen: rondkijken en openklappen mag, maar geen acties
  // uitvoeren of iets opslaan (guardSlug blokkeert dan alles behalve GET).
  canEdit: boolean;
  // Per-klant schrijfrecht: op deze slugs mag de gast wél schrijven, ook als
  // canEdit uitstaat. null = geen beperking (owner of canEdit=true).
  editSlugs: string[] | null;
  // Gevuld als de eigenaar in de kijk-als-modus zit: de gast die hij nadoet.
  viewAs?: { id: number; label: string } | null;
};

// Scope uit een rauwe cookiewaarde. Bruikbaar in server components (via
// cookies()) én API-routes. null als er geen geldige adminsessie is (cookie
// ontbreekt/vervalst, of een gast-id dat niet meer bestaat in de database).
// viewAsValue: de optionele kijk-als-cookie; alleen gehonoreerd voor de eigenaar.
export async function getScopeFromCookie(
  value: string | undefined | null,
  viewAsValue?: string | undefined | null,
): Promise<AdminScope | null> {
  const principal = getAdminPrincipal(value);
  if (!principal) return null;

  if (principal.kind === "owner") {
    // Kijk-als-modus: de eigenaar krijgt tijdelijk exact de scope van de gast,
    // zodat hij ziet (en niet meer kan) wat die gast ziet en kan.
    const viewAsId = parseViewAsToken(viewAsValue);
    if (viewAsId !== null) {
      const guest = await getTeamUserById(viewAsId);
      if (guest && guest.role !== "owner") {
        return {
          isOwner: false,
          userId: guest.id,
          allowedSlugs: guest.allowedSlugs,
          canSeeMail: false,
          canEdit: guest.canEdit,
          editSlugs: guest.canEdit ? null : guest.editSlugs,
          viewAs: { id: guest.id, label: guest.name || guest.loginId },
        };
      }
    }
    return { isOwner: true, userId: null, allowedSlugs: null, canSeeMail: true, canEdit: true, editSlugs: null };
  }

  // Teamgebruiker: lees de rechten uit de database. Bestaat de rij niet meer
  // (verwijderd), dan is er geen geldige scope meer.
  const user = await getTeamUserById(principal.userId);
  if (!user) return null;
  if (user.role === "owner") {
    return { isOwner: true, userId: user.id, allowedSlugs: null, canSeeMail: true, canEdit: true, editSlugs: null };
  }
  return {
    isOwner: false,
    userId: user.id,
    allowedSlugs: user.allowedSlugs,
    // Gasten zien NOOIT mail of de actuele stand van zaken (bewust hard uitgesloten).
    canSeeMail: false,
    canEdit: user.canEdit,
    editSlugs: user.canEdit ? null : user.editSlugs,
  };
}

// Scope uit een API-route-request (inclusief de eventuele kijk-als-cookie).
export async function getAdminScope(req: NextRequest): Promise<AdminScope | null> {
  return getScopeFromCookie(
    req.cookies.get(ADMIN_COOKIE)?.value,
    req.cookies.get(ADMIN_VIEWAS_COOKIE)?.value,
  );
}

// Mag deze scope bij deze klant (slug)? Owner: altijd. Gast: alleen als de slug
// in zijn lijst staat.
export function canAccessSlug(scope: AdminScope, slug: string): boolean {
  if (scope.isOwner || scope.allowedSlugs === null) return true;
  const s = (slug || "").trim().toLowerCase();
  if (!s) return false;
  return scope.allowedSlugs.includes(s);
}

// Mag deze scope op deze klant (slug) schrijven? Owner en canEdit=true: altijd.
// Anders alleen als de slug in het per-klant schrijfrecht (editSlugs) staat.
export function canEditSlug(scope: AdminScope, slug: string): boolean {
  if (scope.isOwner || scope.canEdit || scope.editSlugs === null) return true;
  const s = (slug || "").trim().toLowerCase();
  if (!s) return false;
  return scope.editSlugs.includes(s);
}

// Poort voor API-routes: haalt de scope op en checkt de klant-toegang in één keer.
// Geeft { ok: true, scope } terug, of een kant-en-klare 401/403-Response die de
// route direct kan retourneren. Zo blijft elke route één regel:
//   const g = await guardSlug(req, slug); if (!g.ok) return g.res;
export async function guardSlug(
  req: NextRequest,
  slug: string,
): Promise<{ ok: true; scope: AdminScope } | { ok: false; res: NextResponse }> {
  const scope = await getAdminScope(req);
  if (!scope) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 }) };
  }
  if (!canAccessSlug(scope, slug)) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang tot deze klant." }, { status: 403 }) };
  }
  // Alleen-lezen gast: kijken mag (GET/HEAD), maar elke actie of wijziging
  // (POST/PATCH/DELETE) wordt hier centraal geblokkeerd, over alle routes heen.
  // Per-klant schrijfrecht (editSlugs) kan een klant wél openzetten.
  const method = (req.method || "GET").toUpperCase();
  if (!canEditSlug(scope, slug) && method !== "GET" && method !== "HEAD") {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "Je hebt nog geen rechten om deze actie uit te voeren." },
        { status: 403 },
      ),
    };
  }
  // Klant-context voor de verbruik-meting: elke Ahrefs-call verderop in deze
  // request weet zo bij welke klant hij hoort. Eén regel dekt alle routes.
  setAhrefsContext({ slug: (slug || "").trim().toLowerCase() });
  return { ok: true, scope };
}

// Poort voor eigenaar-only routes (klant aanmaken/verwijderen, team beheren).
export async function guardOwner(
  req: NextRequest,
): Promise<{ ok: true; scope: AdminScope } | { ok: false; res: NextResponse }> {
  const scope = await getAdminScope(req);
  if (!scope) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 }) };
  }
  if (!scope.isOwner) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Alleen de eigenaar mag dit." }, { status: 403 }) };
  }
  return { ok: true, scope };
}
