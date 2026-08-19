import { NextResponse } from "next/server";
import { omgevingStand } from "../../../lib/omgeving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// WELKE VERSIE STAAT ER LIVE, EN WELKE OMGEVING IS DIT?
// ═══════════════════════════════════════════════════════════
// Zonder dit adresje is er geen manier om te bewijzen dat wat je op het scherm
// ziet ook echt de laatste push is. Je kunt de site wel bekijken, maar niet
// aantonen dat het de nieuwe versie is; daardoor bleef "af betekent gezien"
// (brein/11-claude-werkwijze.md) half werk en zat Maarten zelf in Vercel te
// kijken of de deploy al klaar was. Dit geeft die zekerheid in één verzoek.
//
// Bewust publiek: een commit-SHA lekt niets (de repo is openbaar), en zo kan
// scripts/wacht-op-deploy.sh pollen zonder eerst een sessie op te halen.
//
// force-dynamic is niet optioneel: een GET-handler zonder dynamische invoer
// mag Next tijdens de build statisch renderen, en dan vriest de SHA vast op
// het bouwmoment. Cache-Control: no-store houdt de edge ervan af om een oud
// antwoord te blijven serveren. Beide fouten zouden hetzelfde opleveren: een
// antwoord dat er goed uitziet en niet klopt, precies wat we hier uitbannen.
//
// Sinds 19-08-2026 staat hier ook wélke omgeving dit is: de klant waar hij toe
// beperkt is (leeg bij het gewone dashboard) en een vingerafdruk van de database.
// Daarmee kan het dashboard de voordeur van een klant zelf controleren in plaats
// van dat Maarten twee schermen naast elkaar moet leggen en moet gissen of ze
// dezelfde gegevens tonen. Ook publiek, om dezelfde reden als de commit-SHA: het
// is een kenmerk om te vergelijken, geen verbindingsinformatie (zie
// lib/omgeving.ts).
// ═══════════════════════════════════════════════════════════

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || null;
  const stand = omgevingStand();
  const res = NextResponse.json({
    ok: Boolean(sha),
    sha,
    kort: sha ? sha.slice(0, 7) : null,
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    omgeving: process.env.VERCEL_ENV || "development",
    venster: stand.venster,
    gegevens: stand.gegevens,
  });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
