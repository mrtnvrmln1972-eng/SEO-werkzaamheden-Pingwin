import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import {
  PUNTEN, GOLVEN, kanStarten, wachtOp, raaktZelfde, nuDoen, voortgang,
  startprompt, startpromptTekst, botstMetLopend, geenAdviesReden, parallelNu,
} from "../../../lib/routekaart";
import { beschrijvingen } from "../../../lib/routekaart-tekst";
import { controleerAlles } from "../../../lib/routekaart-bewijs";
import { haalRoutekaartIdeeen } from "../../../lib/tweaks";
import RoutekaartClient, { type PuntWeergave } from "./RoutekaartClient";

// ═══════════════════════════════════════════════════════════
// /admin/routekaart — HET BEDIENINGSPANEEL VAN DE ONTWIKKELING
// ═══════════════════════════════════════════════════════════
// Maarten stuurt de ontwikkeling aan vanuit losse chats, één punt per chat. Dit
// scherm is de plek waar hij ziet wat er te doen is, wat er loopt, wat er wacht,
// en waar hij per punt de startregel voor een verse chat kopieert.
//
// Bewust achter de adminlogin: dit is werkvloer, geen verhaal naar buiten. De
// beschrijvingen staan in lib/uitleg/15-agenda/ (daar hoort het verhaal) maar worden hier
// meegestuurd, zodat je ze bij het punt zelf leest en niet in een lang document
// hoeft te gaan zoeken naar het punt waar je net op klikte.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function RoutekaartPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // Werkvloer, geen klantscherm: dezelfde poort als het developer-overzicht. Stond
  // eerst open voor élke adminsessie, ook een gast zonder ontwikkelrecht.
  if (!scope.isOwner && !scope.canDev) redirect("/admin");

  // De volledige beschrijvingen komen uit lib/uitleg/15-agenda/, zodat ze bij het punt zelf
  // te lezen zijn in plaats van op een ander scherm. Eén bron, twee vensters.
  const teksten = beschrijvingen(PUNTEN.map((p) => p.code));

  // De stand in de routekaart is een bewering van een chat. Hier wordt hij
  // getoetst aan de draaiende versie en aan de database, zodat "af" niet op een
  // vinkje leunt. Deze controle draait ín de live applicatie, dus het antwoord
  // gaat per definitie over de versie die je op dit moment bekijkt.
  const bewijs = await controleerAlles(PUNTEN.map((p) => p.code));

  // Welke punten kunnen nú tegelijk in aparte chats? Een set die elkaar niet
  // raakt, niet een lijst waar je zelf de botsingen uit moet halen.
  const parallel = parallelNu().map((p) => p.code);

  // Alle afgeleide waarden server-side, zodat de client alleen nog tekent.
  const punten: PuntWeergave[] = PUNTEN.map((p) => ({
    ...p,
    kan: kanStarten(p),
    wacht: wachtOp(p).map((x) => x.code),
    botst: raaktZelfde(p).map((x) => x.code),
    prompt: startprompt(p),
    promptTekst: startpromptTekst(p),
    beschrijving: teksten[p.code] ?? null,
    botstLopend: botstMetLopend(p).map((x) => x.code),
    bewijs: bewijs[p.code],
    parallel: parallel.includes(p.code),
  }));

  const advies = nuDoen();

  // De brug vanaf het Tweak-knopje: een idee dat te groot was voor een ronde en
  // waar Maarten ja tegen zei, hoort hier te landen in plaats van tussen de
  // aanpassingen van twee minuten te blijven staan.
  const ideeen = (await haalRoutekaartIdeeen()).map((t) => ({
    id: t.id, tekst: t.tekst, punt: t.punt,
  }));

  return (
    <RoutekaartClient
      ideeen={ideeen}
      punten={punten}
      golven={GOLVEN}
      voortgang={voortgang()}
      advies={advies ? { code: advies.code, titel: advies.titel, prompt: startprompt(advies) } : null}
      reden={geenAdviesReden()}
      parallel={punten.filter((p) => p.parallel).map((p) => ({ code: p.code, titel: p.titel, prompt: p.prompt }))}
    />
  );
}
