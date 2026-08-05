import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../lib/constants";
import { canAccessSlug, getScopeFromCookie } from "../../lib/admin-scope";
import { listClients } from "../../lib/clients";
import { moneybirdConfigured } from "../../lib/moneybird";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  // De developer heeft hier niets te zoeken: zijn scherm is de takenlijst over
  // alle klanten. Heeft hij geen enkele klant toegewezen gekregen, dan zou hij
  // hier een leeg overzicht zien; dus sturen we hem meteen naar zijn eigen lijst.
  if (!scope.isOwner && scope.canDev && (scope.allowedSlugs?.length ?? 0) === 0) {
    redirect("/admin/developer");
  }

  const all = await listClients();
  // Wie welke klant mag zien staat op één plek: canAccessSlug in lib/admin-scope.
  // Hier stond diezelfde regel nog een keer uitgeschreven, en die twee liepen
  // uiteen: een lege lijst betekent daar "alleen deze klanten", maar géén lijst
  // (allowedSlugs = null) betekent "geen beperking". De regel hier las dat als
  // niets mogen, en dus zag Claude in zijn meekijk-sessie een leeg adminscherm,
  // terwijl de ingang wel "ok" zei. Nooit opnieuw uitschrijven; altijd de poort
  // gebruiken die er al is.
  const clients = all.filter((c) => canAccessSlug(scope, c.slug));
  // Groepen (Multimedia Concepts) alleen in de Pingwin-wereld tonen.
  const isNoc = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").includes("noc-seo-cockpit");
  // Financiën (Maartens privé-administratie) alleen tonen in de wereld waar
  // Moneybird ook echt gekoppeld is; in andere werelden bestaat de knop niet.
  return <AdminClient initialClients={clients} isOwner={scope.isOwner} canDev={scope.canDev} showGroups={!isNoc} showFinance={moneybirdConfigured()} />;
}
