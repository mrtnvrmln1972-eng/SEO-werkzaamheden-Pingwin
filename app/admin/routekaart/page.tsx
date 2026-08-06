import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import {
  PUNTEN, GOLVEN, kanStarten, wachtOp, raaktZelfde, nuDoen, voortgang,
  startprompt, startpromptTekst,
} from "../../../lib/routekaart";
import RoutekaartClient, { type PuntWeergave } from "./RoutekaartClient";

// ═══════════════════════════════════════════════════════════
// /admin/routekaart — HET BEDIENINGSPANEEL VAN DE ONTWIKKELING
// ═══════════════════════════════════════════════════════════
// Maarten stuurt de ontwikkeling aan vanuit losse chats, één punt per chat. Dit
// scherm is de plek waar hij ziet wat er te doen is, wat er loopt, wat er wacht,
// en waar hij per punt de startregel voor een verse chat kopieert.
//
// Bewust achter de adminlogin: dit is werkvloer, geen verhaal naar buiten. De
// beschrijvingen zelf staan op /uitleg, want daar hoort het verhaal.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function RoutekaartPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  // Alle afgeleide waarden server-side, zodat de client alleen nog tekent.
  const punten: PuntWeergave[] = PUNTEN.map((p) => ({
    ...p,
    kan: kanStarten(p),
    wacht: wachtOp(p).map((x) => x.code),
    botst: raaktZelfde(p).map((x) => x.code),
    prompt: startprompt(p),
    promptTekst: startpromptTekst(p),
  }));

  const advies = nuDoen();

  return (
    <RoutekaartClient
      punten={punten}
      golven={GOLVEN}
      voortgang={voortgang()}
      advies={advies ? { code: advies.code, titel: advies.titel, prompt: startprompt(advies) } : null}
    />
  );
}
