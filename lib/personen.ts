// Hoe we een persoon op een bespreeklijst noemen.
//
// Waarom dit bestaat: "Dev" betekende letterlijk "Sander (Dev)" op zes plekken in
// het dashboard, hardgecodeerd. Sander bouwt de site van Kamsteeg, dus bij elke
// andere klant kwam er een naam in beeld die daar niets te maken had. Dat leest
// als een fout van de assistent terwijl het gewoon in de code stond.
//
// Nu komt de naam van de klant zelf (cockpit-veld "devName"). Is die niet
// ingevuld, dan tonen we gewoon "Dev" en verzinnen we niemand.

export const PERSOON_KLANT = "Klant";
export const PERSOON_DEV = "Dev";

/** Label voor de developer van deze klant: "Sander (Dev)", of gewoon "Dev". */
export function devLabel(devName?: string | null): string {
  const naam = (devName || "").trim();
  return naam ? `${naam} (Dev)` : PERSOON_DEV;
}

/** Alleen de voornaam, voor een aanhef in een mail. Leeg als er niets bekend is. */
export function devVoornaam(devName?: string | null): string {
  return (devName || "").trim().split(/\s+/)[0] || "";
}

/** Label voor eender welke persoon op een bespreeklijst. */
export function persoonLabel(persoon: string, opts: { devName?: string | null; clientName?: string | null } = {}): string {
  if (persoon === PERSOON_DEV) return devLabel(opts.devName);
  if (persoon === PERSOON_KLANT && opts.clientName) return `${opts.clientName} (klant)`;
  return persoon;
}
