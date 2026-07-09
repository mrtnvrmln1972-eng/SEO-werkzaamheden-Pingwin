import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../lib/constants";
import { getScopeFromCookie } from "../../lib/admin-scope";
import ReadOnlyGuard from "./ReadOnlyGuard";
import ViewAsBanner from "./ViewAsBanner";

// Gedeelde schil voor alle adminpagina's. Voor gasten zonder wijzig-recht wordt
// de alleen-lezen onderschepper gemonteerd: knoppen blijven zichtbaar, maar een
// actie geeft een net venstertje in plaats van dat er iets gebeurt. In de
// kijk-als-modus ziet de eigenaar bovenin een balkje met een terug-knop.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const scope = await getScopeFromCookie(
    cookies().get(ADMIN_COOKIE)?.value,
    cookies().get(ADMIN_VIEWAS_COOKIE)?.value,
  );
  return (
    <>
      {scope?.viewAs && <ViewAsBanner label={scope.viewAs.label} />}
      {scope && !scope.canEdit && <ReadOnlyGuard editSlugs={scope.editSlugs ?? []} />}
      {children}
    </>
  );
}
