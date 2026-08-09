import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import AdminKop from "../AdminKop";
import AgendaClient from "./AgendaClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// /admin/agenda — MAARTENS PERSOONLIJKE WEEKAGENDA
// ═══════════════════════════════════════════════════════════
// Los van klantwerk: tijdblokken en hele-dag-taken, alleen van en voor Maarten
// zelf. Bewust achter een eigenaar-only guard (zoals Financiën), net als zijn
// eigen administratie hoort dit niet bij een teamgast.
// ═══════════════════════════════════════════════════════════

export default async function AgendaPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");

  return (
    <>
      <AdminKop titel="Agenda" />
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "var(--s-6) var(--s-5) var(--s-10)" }}>
        <AgendaClient />
      </div>
    </>
  );
}
