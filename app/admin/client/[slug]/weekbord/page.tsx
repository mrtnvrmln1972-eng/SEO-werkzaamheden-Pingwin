import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import Planning from "../Planning";

export const dynamic = "force-dynamic";

// De planning op volle breedte, over álle klanten heen: kaarten per moment
// (vandaag, morgen, volgende week) en kaarten per week, met een schakelaar naar
// alleen deze klant. Dezelfde component staat ook op het tabblad Taken, daar
// vast op één klant. Zelfde toegangsregels als de rest van de cockpit.
export default async function WeekbordPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  return (
    <div className="pl-pagina">
      <Planning slug={params.slug} clientName={client.name} clientEmail={client.email || ""} alleKlanten />
    </div>
  );
}
