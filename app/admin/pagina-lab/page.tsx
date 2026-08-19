import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { ga4PropertiesBekend } from "../../../lib/ga4-pagina";
import { clarityStandAlle } from "../../../lib/clarity";
import PaginaLabClient from "./PaginaLabClient";

// ═══════════════════════════════════════════════════════════
// /admin/pagina-lab — de werkbank van het Pagina-lab
// ═══════════════════════════════════════════════════════════
// Twee dingen op één scherm, want ze horen bij elkaar:
//
//  1. De kennisbank: waartegen het lab een pagina houdt, met bron en datum, en
//     apart daarvan ons eigen vakoordeel. Staat volledig in de code
//     (`lib/pagina-lab/kennisbank/`), dus er valt niets op te slaan.
//  2. Gedrag: weten we van deze klant wat bezoekers werkelijk doen? Analytics
//     vindt zichzelf meestal, Clarity heeft een sleutel per project nodig.
//
// De stand per klant wordt hier op de server gelezen, uit wat er al opgeslagen
// staat. Bewust zonder te gaan zoeken bij Google: dat zou bij dertig klanten
// dertig keer het hele Analytics-account aflopen bij het openen van een scherm.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function PaginaLabPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  const alle = await listClients();
  const zichtbaar = scope.allowedSlugs ? alle.filter((c) => scope.allowedSlugs?.includes(c.slug)) : alle;
  const [properties, clarity] = await Promise.all([
    ga4PropertiesBekend().catch(() => ({} as Awaited<ReturnType<typeof ga4PropertiesBekend>>)),
    clarityStandAlle().catch(() => ({} as Awaited<ReturnType<typeof clarityStandAlle>>)),
  ]);

  const klanten = zichtbaar.map((c) => ({
    slug: c.slug,
    naam: c.name,
    domein: c.domain || "",
    ga4: properties[c.slug]?.property || null,
    ga4Gezocht: properties[c.slug]?.gezochtOp || null,
    clarity: clarity[c.slug] || { gekoppeld: false, laatste: null, vandaag: 0, ruimte: 8, bewaard: 0 },
  }));

  return <PaginaLabClient klanten={klanten} magSchrijven={scope.isOwner || scope.canEdit} />;
}
