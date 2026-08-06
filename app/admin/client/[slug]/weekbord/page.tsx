import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import MeldingenMenu from "../../../MeldingenMenu";
import OntwikkelMenu from "../../../OntwikkelMenu";
import AhrefsTeller from "../../../AhrefsTeller";
import KlussenChip from "../KlussenChip";
import KlantTabs from "../KlantTabs";
import Planning from "../Planning";

export const dynamic = "force-dynamic";

// De planning op volle breedte, over álle klanten heen: kaarten per moment
// (vandaag, morgen, volgende week) en kaarten per week, met een schakelaar naar
// alleen deze klant. Dezelfde component staat ook op het tabblad Taken, daar
// vast op één klant. Zelfde toegangsregels als de rest van de cockpit.
//
// De kopbalk hoort erbij: dit was een kaal scherm zonder logo en zonder tabs, dus
// je landde erop en kwam er alleen met de terugknop weer vanaf. Hij gebruikt
// dezelfde tabbalk als de cockpit (KlantTabs), zodat de namen niet uiteen kunnen
// lopen.
export default async function WeekbordPage({ params }: { params: { slug: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const client = await getClientBySlug(params.slug);
  if (!client) redirect("/admin");
  const basis = `/admin/client/${params.slug}`;
  return (
    <>
      <div className="header">
        <div className="header-left">
          <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <a className="header-client header-client-link" href={basis} title={`Naar de cockpit van ${client.name}`}>{client.name}</a>
          </div>
          <KlantTabs basisPad={basis} isLead={client.fase === "lead"} />
        </div>
        <div className="header-right">
          <MeldingenMenu />
          <AhrefsTeller />
        <OntwikkelMenu />
          {/* Wat er op de achtergrond draait, net als in de cockpit: anders is een
              scan die je hier start alleen op dat andere scherm te volgen. */}
          <KlussenChip slug={params.slug} />
        </div>
      </div>
      <div className="pl-pagina">
        <Planning slug={params.slug} clientName={client.name} clientEmail={client.email || ""} alleKlanten />
      </div>
    </>
  );
}
