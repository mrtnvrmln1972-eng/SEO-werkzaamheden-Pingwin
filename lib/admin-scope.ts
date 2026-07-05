import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminPrincipal } from "./admin-auth";
import { getTeamUserById } from "./team-users";

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
};

// Scope uit een rauwe cookiewaarde. Bruikbaar in server components (via
// cookies()) én API-routes. null als er geen geldige adminsessie is (cookie
// ontbreekt/vervalst, of een gast-id dat niet meer bestaat in de database).
export async function getScopeFromCookie(value: string | undefined | null): Promise<AdminScope | null> {
  const principal = getAdminPrincipal(value);
  if (!principal) return null;

  if (principal.kind === "owner") {
    return { isOwner: true, userId: null, allowedSlugs: null, canSeeMail: true };
  }

  // Teamgebruiker: lees de rechten uit de database. Bestaat de rij niet meer
  // (verwijderd), dan is er geen geldige scope meer.
  const user = await getTeamUserById(principal.userId);
  if (!user) return null;
  if (user.role === "owner") {
    return { isOwner: true, userId: user.id, allowedSlugs: null, canSeeMail: true };
  }
  return {
    isOwner: false,
    userId: user.id,
    allowedSlugs: user.allowedSlugs,
    // Gasten zien NOOIT mail of de actuele stand van zaken (bewust hard uitgesloten).
    canSeeMail: false,
  };
}

// Scope uit een API-route-request.
export async function getAdminScope(req: NextRequest): Promise<AdminScope | null> {
  return getScopeFromCookie(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Mag deze scope bij deze klant (slug)? Owner: altijd. Gast: alleen als de slug
// in zijn lijst staat.
export function canAccessSlug(scope: AdminScope, slug: string): boolean {
  if (scope.isOwner || scope.allowedSlugs === null) return true;
  const s = (slug || "").trim().toLowerCase();
  if (!s) return false;
  return scope.allowedSlugs.includes(s);
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
