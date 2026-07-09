import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { getScopeFromCookie } from "../../lib/admin-scope";
import ReadOnlyGuard from "./ReadOnlyGuard";

// Gedeelde schil voor alle adminpagina's. Voor gasten zonder wijzig-recht wordt
// de alleen-lezen onderschepper gemonteerd: knoppen blijven zichtbaar, maar een
// actie geeft een net venstertje in plaats van dat er iets gebeurt.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value);
  return (
    <>
      {scope && !scope.canEdit && <ReadOnlyGuard />}
      {children}
    </>
  );
}
