import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════
// HET KLANTVENSTER: één omgeving die maar één klant kan tonen
// ═══════════════════════════════════════════════════════════
// Waarvoor dit bestaat. Naast het gewone dashboard (alle klanten) draait er een
// tweede voordeur op een eigen adres, bedoeld om je scherm mee te delen en om er
// later iemand van buiten in te laten. Die voordeur kijkt naar dezelfde
// gegevens, dus zonder slot zou daar de hele klantenlijst achter zitten.
//
// Zet `WERELD_KLANT` op de slug van die ene klant, en deze omgeving kan niets
// anders meer: geen andere klant, geen klantenlijst, geen financiën, geen
// agenda, geen teambeheer. Staat de variabele niet ingesteld, dan is er geen
// venster en gedraagt alles zich precies zoals altijd. Dat is met opzet zo om:
// het gewone dashboard hoort niets te merken van dit bestand.
//
// Waarom niet "de schermen die niet mogen weghalen": dat is een lijst die
// veroudert zodra er een scherm bijkomt. Dit is omgekeerd: alles is dicht,
// behalve wat hieronder expliciet openstaat. Een nieuw scherm is daarmee vanzelf
// dicht op de voordeur, en `proeven/klantvenster.proef.ts` rekent na dat elke
// route van de beheerkant een poort heeft.
// ═══════════════════════════════════════════════════════════

// De klant waar deze omgeving toe beperkt is, of null als er geen venster is.
export function vensterKlant(): string | null {
  const s = (process.env.WERELD_KLANT || "").trim().toLowerCase();
  return s || null;
}

// Mag deze omgeving bij deze klant? Zonder venster: altijd. Met venster: alleen
// die ene. Geldt ook voor de eigenaar; het venster zit vóór de rechten, niet erin.
export function magVensterSlug(slug: string | null | undefined): boolean {
  const venster = vensterKlant();
  if (!venster) return true;
  return String(slug || "").trim().toLowerCase() === venster;
}

// Mag dit pad geopend worden in deze omgeving? Alleen de inlogroutes, de cockpit
// van de vensterklant, zijn voorbeeldweergave, en het developer-overzicht (dat
// zichzelf op de vensterklant filtert). Al het andere is dicht.
export function magVensterPad(pad: string): boolean {
  const venster = vensterKlant();
  if (!venster) return true;
  const kaal = (pad.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (!kaal.startsWith("/admin")) return true;
  if (kaal === "/admin/login" || kaal === "/admin/enter" || kaal === "/admin/logout") return true;
  if (kaal === "/admin/developer" || kaal.startsWith("/admin/developer/")) return true;
  for (const basis of [`/admin/client/${venster}`, `/admin/preview/${venster}`]) {
    if (kaal === basis || kaal.startsWith(basis + "/")) return true;
  }
  return false;
}

// Waar deze omgeving naartoe wijst als iemand ergens anders belandt.
export function vensterStartPad(): string {
  return `/admin/client/${vensterKlant() || ""}`;
}

// Het standaard-antwoord van een route die in deze omgeving niet bestaat.
export function vensterGeweigerd(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Deze omgeving toont maar één klant; dit scherm hoort er niet bij." },
    { status: 403 },
  );
}

// Poort voor een route die zelf een klant meekrijgt: geeft null als het mag, en
// anders het kant-en-klare antwoord. Eén regel per route:
//   const weg = vensterPoort(slug); if (weg) return weg;
export function vensterPoort(slug?: string | null): NextResponse | null {
  if (!vensterKlant()) return null;
  if (slug !== undefined && slug !== null && magVensterSlug(slug)) return null;
  return vensterGeweigerd();
}
