import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { canAccessSlug, getAdminScope } from "../../../../../lib/admin-scope";
import { vensterPoort } from "../../../../../lib/klantvenster";
import { beeldKlant, haalBeeld } from "../../../../../lib/veld-beelden";

export const runtime = "nodejs";

// Het beeld zelf. Staat als <img src="/api/admin/beeld/12"> in een aantekening,
// dus de browser haalt hem op met de sessie-cookie erbij: wie niet ingelogd is,
// krijgt hem niet. Hoort het beeld bij een klant, dan geldt hetzelfde bereik als
// voor de rest van die klant.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return new NextResponse("Geen toegang.", { status: 401 });
  }
  const id = Number(params.id);
  const klant = await beeldKlant(id);
  if (klant === null) return new NextResponse("Niet gevonden.", { status: 404 });
  // Draait dit op een klantvoordeur, dan bestaat een beeld van een andere klant
  // daar niet, ook niet voor de eigenaar. Zelfde slot als overal, en het zit vóór
  // de rechten.
  const weg = vensterPoort(klant);
  if (weg) return weg;
  if (klant) {
    const scope = await getAdminScope(req);
    if (!scope || !canAccessSlug(scope, klant)) return new NextResponse("Geen toegang.", { status: 403 });
  }
  const beeld = await haalBeeld(id);
  if (!beeld) return new NextResponse("Niet gevonden.", { status: 404 });

  return new NextResponse(beeld.bytes, {
    headers: {
      "Content-Type": beeld.mime,
      "Content-Length": String(beeld.bytes.length),
      // Een beeld verandert nooit meer: het nummer hoort bij precies deze bytes.
      // Privé, want het staat achter een inlog en hoort niet in een tussenopslag
      // onderweg te blijven hangen.
      "Cache-Control": "private, max-age=31536000, immutable",
      // Het kan alleen een afbeelding zijn (de bewaarroute laat niets anders
      // toe), maar deze regel maakt van een verkeerd bestand nooit een pagina.
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
