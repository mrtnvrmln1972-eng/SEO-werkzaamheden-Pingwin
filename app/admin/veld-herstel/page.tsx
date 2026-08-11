import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import VeldHerstelClient from "./VeldHerstelClient";

// ═══════════════════════════════════════════════════════════
// /admin/veld-herstel — EEN TEKSTVELD TERUGZETTEN
// ═══════════════════════════════════════════════════════════
// De velden "Zoekwoorden & links" en "Top Prio's" slaan tijdens het typen
// automatisch op. Dat is prettig tot er iets misgaat: er was geen enkele
// geschiedenis, dus toen op 11 augustus 2026 een fout in het slepen inhoud
// buiten het tekstvak zette, schreef die automatische opslag een half leeg
// veld weg en was de rest voorgoed kwijt.
//
// Sindsdien bewaart elke opslag eerst de vorige inhoud. Dit scherm is de
// bijbehorende weg terug: kies een klant, zie de bewaarde versies, zet er een
// terug. Terugzetten bewaart de huidige inhoud óók weer, dus een verkeerd
// gekozen herstelpunt is opnieuw terug te draaien.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function VeldHerstelPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");

  const klanten = (await listClients()).map((c) => ({ slug: c.slug, name: c.name }));
  return <VeldHerstelClient klanten={klanten} />;
}
