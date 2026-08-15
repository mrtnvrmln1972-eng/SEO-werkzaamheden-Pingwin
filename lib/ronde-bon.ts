import crypto from "crypto";

// ═══════════════════════════════════════════════════════════
// DE TOEGANGSBON VAN EEN RONDE: GEEN GEDEELDE SLEUTEL MEER
// ═══════════════════════════════════════════════════════════
// WAT ER MISGING (15-08-2026). Een tweak-ronde draaide, meldde "geslaagd", en
// had niets gedaan. Vier meldingen stonden een uur later nog gewoon in de
// wachtrij. De oorzaak stond in het GitHub-logboek, in één regel:
//
//     {"ok":false,"error":"Geen toegang."}
//
// De ronde gebruikte de meekijk-sleutel (`PINGWIN_KIJK_SLEUTEL`) om bij het
// dashboard te komen. Die sleutel is bedoeld voor een mens: Maarten drukt op
// "nieuwe sleutel" in de cockpit, plakt hem in zijn Claude-omgeving, en de oude
// wordt op dat moment ingetrokken. Precies dat gebeurde. De ronde had de oude
// nog, kwam er dus niet in, kon niets claimen, en stopte na negentien seconden.
//
// DE ECHTE FOUT ZAT IN HET ONTWERP, NIET IN DE SLEUTEL. Werk dat zonder toezicht
// moet draaien, mag niet afhangen van een geheim dat een mens met de hand naar
// twee plekken kopieert en dat onder hem vandaan vervalt. Er is dan altijd een
// moment waarop de nacht stil staat en niemand het merkt.
//
// WAT ER NU GEBEURT. Het dashboard geeft de ronde zijn eigen toegangsbon mee op
// het moment dat het de ronde start:
//
//  1. Het dashboard maakt een bon: de naam van de ronde, de baan en een
//     vervaltijd, ondertekend met `SESSION_SECRET` (dat het toch al heeft voor
//     de cookies). Er komt dus geen nieuw geheim bij, nergens.
//  2. Die bon gaat als invoerveld mee naar de werkstroom bij GitHub.
//  3. De werkstroom wisselt hem in op `/api/ronde/toegang` voor dezelfde
//     alleen-lezen sessie die Claude anders via de meekijk-sleutel krijgt.
//
// Niemand hoeft iets te kopiëren, en een nieuwe meekijk-sleutel maken raakt de
// nachtronde niet meer. De bon is kort geldig en zegt precies voor welke ronde
// hij bedoeld is; hij valt dus ook niet te hergebruiken voor iets anders.
// ═══════════════════════════════════════════════════════════

/**
 * Hoe lang een bon geldig is. Ruim boven de tijdslimiet van de werkstroom (twee
 * uur), zodat hij nooit halverwege een lange bouw verloopt, en ruim onder "voor
 * altijd", zodat een bon die ergens in een logboek belandt niets meer waard is.
 */
export const BON_UREN = 4;

function geheim(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET ontbreekt; zonder dat kan er geen bon ondertekend worden.");
  return s;
}

function teken(waarde: string): string {
  return crypto.createHmac("sha256", geheim()).update(waarde).digest("hex");
}

export type Bon = { ronde: string; baan: "tweak" | "punt"; tot: number };

/** Een bon maken voor precies deze ronde. */
export function maakBon(ronde: string, baan: "tweak" | "punt"): string {
  const tot = Date.now() + BON_UREN * 3600_000;
  const kern = `${ronde}.${baan}.${tot}`;
  return `${kern}.${teken(kern)}`;
}

/**
 * Een bon nakijken. Geeft null terug bij elke twijfel: verkeerde vorm, niet
 * ondertekend met ons geheim, of verlopen.
 *
 * Vergelijken met `timingSafeEqual`, zodat de tijd die het kost niets verraadt
 * over hoe ver iemand met raden is.
 */
export function leesBon(bon: string | null | undefined): Bon | null {
  const s = (bon || "").trim();
  if (!s) return null;
  const stukken = s.split(".");
  if (stukken.length !== 4) return null;
  const [ronde, baan, totTekst, handtekening] = stukken;
  if (baan !== "tweak" && baan !== "punt") return null;
  const tot = Number(totTekst);
  if (!Number.isFinite(tot) || tot < Date.now()) return null;

  let goed: string;
  try {
    goed = teken(`${ronde}.${baan}.${tot}`);
  } catch {
    return null;
  }
  const a = Buffer.from(goed, "utf8");
  const b = Buffer.from(handtekening, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return { ronde, baan, tot };
}
