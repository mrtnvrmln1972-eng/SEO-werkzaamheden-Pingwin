import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import PaginaLabClient from "./PaginaLabClient";

// ═══════════════════════════════════════════════════════════
// /admin/pagina-lab — de kennisbank van het Pagina-lab
// ═══════════════════════════════════════════════════════════
// Het lab beoordeelt straks pagina's op conversie, bruikbaarheid, vormgeving en
// interactie. Dit scherm laat zien wáártegen het dat doet: de criteria met hun
// bron en de datum waarop die bron is nagekeken, en daarnaast, apart, ons eigen
// vakoordeel zonder bron.
//
// Alles komt uit `lib/pagina-lab/kennisbank/`, dus er is niets op te slaan en
// er wordt niets uit de database gehaald. Dat past bij de belofte van het lab:
// het leest mee en schrijft niets, bewaakt door
// `proeven/pagina-lab-schrijft-niet.proef.ts`.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function PaginaLabPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  return <PaginaLabClient />;
}
