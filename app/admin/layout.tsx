import { Suspense } from "react";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../lib/constants";
import { getScopeFromCookie } from "../../lib/admin-scope";
import ReadOnlyGuard from "./ReadOnlyGuard";
import ViewAsBanner from "./ViewAsBanner";
import TweakKnop from "./TweakKnop";
import ProefStijl from "./ProefStijl";
import LinkPreview from "./client/[slug]/LinkPreview";

// Gedeelde schil voor alle adminpagina's. Voor gasten zonder wijzig-recht wordt
// de alleen-lezen onderschepper gemonteerd: knoppen blijven zichtbaar, maar een
// actie geeft een net venstertje in plaats van dat er iets gebeurt. In de
// kijk-als-modus ziet de eigenaar bovenin een balkje met een terug-knop.
//
// Het knopje "Tweak" hangt hier en nergens anders: zo staat het op élk
// beheerscherm zonder dat een pagina er iets voor hoeft door te geven, precies
// zoals het Intern-menu dat via de kopbalk doet. Alleen voor wie ook echt aan
// het dashboard mag werken; een gast zonder ontwikkelrecht ziet het niet.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const scope = await getScopeFromCookie(
    cookies().get(ADMIN_COOKIE)?.value,
    cookies().get(ADMIN_VIEWAS_COOKIE)?.value,
  );
  return (
    <>
      {scope && (scope.isOwner || scope.canDev) && <ProefStijl />}
      {scope?.viewAs && <ViewAsBanner label={scope.viewAs.label} />}
      {scope && !scope.canEdit && (
        <ReadOnlyGuard
          editSlugs={scope.editSlugs ?? []}
          devOk={scope.canDev && scope.userId !== null}
        />
      )}
      {children}
      {/* Eén keer hier, in plaats van los in elk scherm met een werktabel:
          zo krijgt élke beheerpagina de hover-voorvertoning op documenten en
          paginalinks, niet alleen de klant-cockpit waar hij ooit begon. */}
      <LinkPreview />
      {scope && (scope.isOwner || scope.canDev) && (
        <Suspense fallback={null}><TweakKnop /></Suspense>
      )}
    </>
  );
}
