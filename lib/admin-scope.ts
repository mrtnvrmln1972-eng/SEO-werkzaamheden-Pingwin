import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminPrincipal, parseViewAsToken } from "./admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "./constants";
import { getTeamUserById } from "./team-users";
import { setAhrefsContext } from "./ahrefs";
import { vensterKlant, magVensterSlug, vensterGeweigerd } from "./klantvenster";

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
  // Mag het developer-overzicht (/admin/developer) openen: alle klanten, maar
  // alleen de taken die naar de developer zijn doorgezet. Owner altijd; een gast
  // alleen als dat recht aanstaat.
  canDev: boolean;
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
  return venstert(await scopeVoor(principal, viewAsValue));
}

// Draait deze omgeving op één klant (het klantvenster), dan krijgt elke sessie
// die ene klant als bereik, ook de eigenaar. Zo filtert elk scherm dat de lijst
// gebruikt vanzelf mee, en hoeft dat nergens apart geregeld te worden.
function venstert(scope: AdminScope | null): AdminScope | null {
  const venster = vensterKlant();
  if (!scope || !venster) return scope;
  return { ...scope, allowedSlugs: [venster] };
}

async function scopeVoor(
  principal: NonNullable<ReturnType<typeof getAdminPrincipal>>,
  viewAsValue?: string | undefined | null,
): Promise<AdminScope | null> {

  // Claude die meekijkt: ziet alles wat Maarten ziet, mag niets veranderen.
  // isOwner false houdt hem uit de eigenaar-only routes (klant aanmaken,
  // teambeheer). canEdit false plus een LEGE editSlugs is wat hem echt
  // alleen-lezen maakt: guardSlug weigert dan elk verzoek dat geen GET is.
  // Let op: editSlugs mag hier niet null zijn, want null betekent juist
  // "geen beperking" in canEditSlug.
  if (principal.kind === "viewer") {
    return { isOwner: false, userId: null, allowedSlugs: null, canSeeMail: true, canEdit: false, editSlugs: [], canDev: true };
  }

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
          canDev: guest.canDev,
          viewAs: { id: guest.id, label: guest.name || guest.loginId },
        };
      }
    }
    return { isOwner: true, userId: null, allowedSlugs: null, canSeeMail: true, canEdit: true, editSlugs: null, canDev: true };
  }

  // Teamgebruiker: lees de rechten uit de database. Bestaat de rij niet meer
  // (verwijderd), dan is er geen geldige scope meer.
  const user = await getTeamUserById(principal.userId);
  if (!user) return null;
  if (user.role === "owner") {
    return { isOwner: true, userId: user.id, allowedSlugs: null, canSeeMail: true, canEdit: true, editSlugs: null, canDev: true };
  }
  return {
    isOwner: false,
    userId: user.id,
    allowedSlugs: user.allowedSlugs,
    // Gasten zien NOOIT mail of de actuele stand van zaken (bewust hard uitgesloten).
    canSeeMail: false,
    canEdit: user.canEdit,
    editSlugs: user.canEdit ? null : user.editSlugs,
    canDev: user.canDev,
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
  // Het klantvenster gaat vóór alle rechten: draait deze omgeving op één klant,
  // dan bestaat een andere klant hier niet, ook niet voor de eigenaar.
  if (!magVensterSlug(slug)) return false;
  if (scope.isOwner || scope.allowedSlugs === null) return true;
  const s = (slug || "").trim().toLowerCase();
  if (!s) return false;
  return scope.allowedSlugs.includes(s);
}

// Mag deze scope op deze klant (slug) schrijven? Owner en canEdit=true: altijd.
// Anders alleen als de slug in het per-klant schrijfrecht (editSlugs) staat.
export function canEditSlug(scope: AdminScope, slug: string): boolean {
  if (!magVensterSlug(slug)) return false;
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

/**
 * Is dit de meekijk-sessie van Claude (de sleutel uit /api/kijk)?
 *
 * Bestaat zodat één route bewust een uitzondering kan maken op "alleen lezen":
 * de tweak-stapel. Claude moet daar een stand kunnen bijwerken ("wordt gebouwd",
 * "klaar, controleer even"), anders kan hij het seintje niet geven en moet
 * Maarten zelf bijhouden wat er gedaan is. Die uitzondering geldt uitsluitend
 * voor de standen van de tweak-stapel; overal elders blijft meekijken kijken.
 */
export function isMeekijker(req: NextRequest): boolean {
  return getAdminPrincipal(req.cookies.get(ADMIN_COOKIE)?.value)?.kind === "viewer";
}

// Poort voor het developer-overzicht (alle klanten, alleen de dev-taken).
// Lezen mag de eigenaar en iedere gast met het dev-recht. Schrijven (afvinken,
// terugkoppeling, een taak bijstellen) mag de eigenaar en een ECHTE gast met dat
// recht; de meekijk-sessie (userId null) blijft alleen-lezen, net als overal.
export async function guardDev(
  req: NextRequest,
): Promise<{ ok: true; scope: AdminScope } | { ok: false; res: NextResponse }> {
  const scope = await getAdminScope(req);
  if (!scope) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 }) };
  }
  if (!scope.isOwner && !scope.canDev) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang tot het developer-overzicht." }, { status: 403 }) };
  }
  const method = (req.method || "GET").toUpperCase();
  const magSchrijven = scope.isOwner || (scope.canDev && scope.userId !== null);
  if (!magSchrijven && method !== "GET" && method !== "HEAD") {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Je kunt hier alleen meekijken." }, { status: 403 }) };
  }
  return { ok: true, scope };
}

// Poort voor eigenaar-only routes (klant aanmaken/verwijderen, team beheren).
// Dat zijn stuk voor stuk bureau-brede zaken, dus in een klantvenster bestaan ze
// niet. Blijkt een van deze routes tóch bij één klant te horen, zet hem dan om
// naar `guardSlug`; daar hoort hij dan ook thuis.
export async function guardOwner(
  req: NextRequest,
): Promise<{ ok: true; scope: AdminScope } | { ok: false; res: NextResponse }> {
  if (vensterKlant()) return { ok: false, res: vensterGeweigerd() };
  const scope = await getAdminScope(req);
  if (!scope) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 }) };
  }
  if (!scope.isOwner) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "Alleen de eigenaar mag dit." }, { status: 403 }) };
  }
  return { ok: true, scope };
}
