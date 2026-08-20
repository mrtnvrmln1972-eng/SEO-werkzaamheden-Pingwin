// ═══════════════════════════════════════════════════════════
// WAAR STAAT EEN TAAK: VIER STANDEN, ÉÉN BRON
// ═══════════════════════════════════════════════════════════
// Een taak in de planning is gepland, ligt bij de developer, ligt bij de klant,
// of is afgerond. Dat is wat je op de regel wilt zien en wat je daar wilt kunnen
// wijzigen, zonder de kaart open te klappen.
//
// In de database staat dat op twee plekken, en dat is met opzet zo gebleven:
//
//   status    "gepland" | "bij klant" | "klaar"   (en "bezig" uit de oude tijd)
//   naar_dev  waar/niet waar
//
// `naar_dev` bestond al en is de vlag waar de hele developerlijst op draait
// (`/admin/developer` leest die kolom). Van "bij developer" een derde
// status-waarde maken zou betekenen dat dezelfde stand op twee plekken bestaat,
// en dan lopen ze uiteen zodra iemand er één bijwerkt. Vandaar: één rekenregel
// hier, die de twee kolommen vertaalt naar de vier standen en terug.
//
// Gebruik altijd deze functies; schrijf de vertaling nooit opnieuw uit in een
// scherm. Dat is in dit project de vaste les.

export type Stand = "gepland" | "dev" | "klant" | "klaar";

/**
 * De vier standen zoals ze in het keuzelijstje staan, in deze volgorde.
 *
 * De labels zijn bewust kort. Dit lijstje staat op elke regel van de planning,
 * naast de taaktitel, en het langste label bepaalt hoe breed die kolom moet zijn:
 * "bij developer" kostte veertig pixels die van de titel afgingen, terwijl een
 * pad als /lensimplantatie/refractive-pro-art-lens/ juist ruimte nodig heeft.
 * Wat het precies betekent staat in `uitleg`, en dat verschijnt als je erover
 * gaat staan. Vier woorden van hooguit acht letters, en dat is een grens die
 * `proeven/taken-slepen-afvinken.proef.ts` narekent: wordt er een label langer,
 * dan past het niet meer in de kolom en kapt de browser het stilletjes af.
 */
export const STANDEN: { key: Stand; label: string; uitleg: string }[] = [
  { key: "gepland", label: "gepland", uitleg: "Staat op de planning, ligt bij ons" },
  { key: "dev", label: "dev", uitleg: "Doorgezet naar de sitebouwer; komt op de developerlijst te staan" },
  { key: "klant", label: "klant", uitleg: "We wachten op de klant" },
  { key: "klaar", label: "afgerond", uitleg: "Gebeurd; gaat naar Afgeronde taken en naar Wat we doen" },
];

export const STAND_LABEL: Record<Stand, string> = {
  gepland: "gepland", dev: "dev", klant: "klant", klaar: "afgerond",
};

/** Wat er in de status-kolom staat als een taak bij de klant ligt. */
export const STATUS_KLANT = "bij klant";

/** Welke stand heeft deze taak nu? Afgerond wint, daarna de developer. */
export function standVan(t: { status?: string | null; naarDev?: boolean | null }): Stand {
  const s = (t.status || "").trim().toLowerCase();
  if (s === "klaar") return "klaar";
  if (t.naarDev) return "dev";
  if (s === STATUS_KLANT) return "klant";
  return "gepland";
}

/**
 * Wat er naar de server moet als je een stand kiest.
 *
 * Twee velden, want ze wonen in twee kolommen. `naarDev` staat altijd expliciet
 * in het antwoord: kies je "gepland", dan moet de developer-vlag er ook echt af,
 * anders blijft de taak op de developerlijst staan terwijl hij hier niet meer
 * bij de developer ligt. Afgerond haalt hem er ook af; klaar is klaar.
 */
export function naarOpslag(stand: Stand): { status: string; naarDev: boolean } {
  switch (stand) {
    case "dev": return { status: "gepland", naarDev: true };
    case "klant": return { status: STATUS_KLANT, naarDev: false };
    case "klaar": return { status: "klaar", naarDev: false };
    default: return { status: "gepland", naarDev: false };
  }
}
