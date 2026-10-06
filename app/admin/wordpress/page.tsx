import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { slugsMetKoppeling } from "../../../lib/wp-creds";
import KoppelScherm from "./KoppelScherm";

// ═══════════════════════════════════════════════════════════
// /admin/wordpress — DE WORDPRESS-KOPPELINGEN VAN ALLE KLANTEN OP ÉÉN SCHERM
// ═══════════════════════════════════════════════════════════
// Per klant één regel: gebruikersnaam, applicatiewachtwoord, testen, en de
// uitkomst met de rol op die site. Opslaan gaat via /api/admin/wp-creds, dus
// via dezelfde testende ingang als de rest van het dashboard (lib/wp-creds.ts).
//
// Welke klanten erop staan: de vaste lijst hieronder, plus elke klant die al een
// koppeling heeft, plus wat je op het scherm zelf toevoegt. Een klant erbij
// zetten is dus één regel in VASTE_KLANTEN, of op het scherm "Klant toevoegen".
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VASTE_KLANTEN = [
  "eerste-kamer-badkamers",
  "gardenswimm",
  "paul-hoevenaars",
  "spijker-en-prins",
  "schuurman-badkamers",
];

export default async function WordpressKoppelPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");

  const [klanten, gekoppeld] = await Promise.all([listClients(), slugsMetKoppeling()]);
  const alle = klanten
    .filter((k) => k.domain)
    .map((k) => ({ slug: k.slug, naam: k.name, domein: k.domain || "" }));
  const start = alle
    .filter((k) => VASTE_KLANTEN.includes(k.slug) || gekoppeld.includes(k.slug))
    .sort((a, b) => {
      const ia = VASTE_KLANTEN.indexOf(a.slug), ib = VASTE_KLANTEN.indexOf(b.slug);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.naam.localeCompare(b.naam, "nl");
    })
    .map((k) => k.slug);

  return <KoppelScherm alle={alle} start={start} />;
}
