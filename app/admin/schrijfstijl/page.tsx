import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { getSchrijfstijl } from "../../../lib/schrijfstijl";
import SchrijfstijlClient from "./SchrijfstijlClient";

// ═══════════════════════════════════════════════════════════
// /admin/schrijfstijl — HOE MAARTEN SCHRIJFT
// ═══════════════════════════════════════════════════════════
// Eén profiel voor heel Pingwin, afgeleid uit zijn eigen verzonden mails aan
// klanten. Het gaat mee in élke klantmail die dit dashboard voorstelt, zodat een
// concept klinkt als een mail van hem en niet als "netjes Nederlands".
//
// Hier kan hij het lezen en bijstellen. Wat hij zelf typt blijft staan: zodra hij
// bewaart, laat de maandelijkse ronde het met rust.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function SchrijfstijlPage() {
  if (!cookies().get(ADMIN_COOKIE)?.value) redirect("/admin/login");
  const stijl = await getSchrijfstijl().catch(() => null);
  return <SchrijfstijlClient start={stijl} />;
}
