import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { alleSchermen, SCHERMEN } from "../../../lib/schermbeeld";
import SchermafbeeldingenClient from "./SchermafbeeldingenClient";

// ═══════════════════════════════════════════════════════════
// /admin/schermafbeeldingen — R14: het dashboard fotografeert zichzelf
// ═══════════════════════════════════════════════════════════
// Eigenaar-only, want "Alles vernieuwen" logt in met de admin-sessie en
// bekijkt intern alle schermen. Zie lib/schermbeeld.ts voor de vaste lijst
// en de anonimisering.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function SchermafbeeldingenPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");

  const schermen = await alleSchermen();
  return <SchermafbeeldingenClient schermen={schermen} verwacht={SCHERMEN.length} />;
}
