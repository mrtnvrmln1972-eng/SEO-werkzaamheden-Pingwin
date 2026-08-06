import type { StapKey } from "./onboarding-stappen";

// ═══════════════════════════════════════════════════════════
// DE GOLVEN: WAT KOST WAT, EN WAT ZIT ERIN
// ═══════════════════════════════════════════════════════════
// Losgetrokken uit lib/onboarding-bulk.ts omdat het bulkscherm in de browser
// draait en die module de database aanraakt. Eén bron voor beide kanten: het
// scherm toont exact de prijzen en de stappen waar de werker mee rekent.
//
// Achttien klanten volledig onboarden kost ongeveer 1,4 miljoen Ahrefs-units.
// Dat is bijna vier maanden budget, en meer dan er in een heel kwartaal
// verbruikt is. Vandaar de indeling op prijs: golf 1 is bijna gratis en is
// precies de inventarisatie waar alle andere scans op wachten, de dure
// onderdelen zitten in golf 2 en 3 en zet je bewust aan.
// ═══════════════════════════════════════════════════════════

export const GOLVEN = ["basis", "prioriteiten", "diep"] as const;
export type Golf = (typeof GOLVEN)[number];

export const GOLF_LABEL: Record<Golf, string> = {
  basis: "Golf 1: de basis",
  prioriteiten: "Golf 2: de prioriteitenscan",
  diep: "Golf 3: opruimen en zoekwoordkansen",
};

export const GOLF_UITLEG: Record<Golf, string> = {
  basis:
    "Pagina's inlezen, klantprofiel, tone of voice, bedrijfsgegevens uit de site, concurrenten opzoeken en de interne linkanalyse. " +
    "Dit kost bijna geen Ahrefs-tegoed en is precies de inventarisatie waar alle andere scans op wachten.",
  prioriteiten:
    "De vindbaarheids-prioriteitenscan per klant. Die haalt de complete zoekwoordenlijst van het domein op en is daarmee de eerste echt dure stap.",
  diep:
    "Opruimen en cannibalisatie plus de zoekwoordkansen. Samen het duurste deel; voor alle klanten tegelijk is dit meer dan twee maanden tegoed.",
};

// Welke stappen uit de onboarding bij welke golf horen. De werker gebruikt deze
// lijst om de rit te beperken, de raming om te bepalen wie het nog nodig heeft.
export const GOLF_STAPPEN: Record<Golf, StapKey[]> = {
  basis: ["urls", "profiel", "tov", "bedrijfsgegevens", "concurrenten", "internelinks"],
  prioriteiten: ["prioriteiten"],
  diep: ["zoekwoorden", "opruimen"],
};

// Wat een golf per klant ongeveer kost aan Ahrefs-units. Niet uit de handleiding
// (die suggereert "rijen keer kolommen"), maar afgelezen uit het echte
// API-verbruik-log van 6 augustus 2026: een zoekwoordenlijst van een domein
// kost 29 units per regel, zoekwoord-ideeën 21, een zoekwoordoverzicht 32, een
// SERP-check 5, en de autoriteit per pagina 2 met een bodem van 50.
export const GOLF_UNITS: Record<Golf, number> = {
  basis: 650,          // 5 SERP-checks voor de concurrenten (250) + autoriteit per pagina (400)
  prioriteiten: 15300, // zoekwoordenlijst 400 regels (11.600) + volumes (3.200) + kapotte backlinks (400) + AI-vermeldingen (105)
  diep: 64500,         // opruimen (23.000) + zoekwoordkansen (41.500)
};

// Wat een golf per klant ongeveer kost aan Claude, in dollarcent. De modelprijzen
// staan in lib/usage.ts; dit is de vertaling naar "wat kost een rit".
export const GOLF_CENT: Record<Golf, number> = {
  basis: 40,
  prioriteiten: 48,
  diep: 207,
};

// Onder deze grens start de rij geen nieuwe klant meer. Bewust ruim: na een
// bulkrun moet je de rest van de maand nog gewoon kunnen werken.
export const BODEM_UNITS = 50000;

export const isGolf = (v: unknown): v is Golf => (GOLVEN as readonly string[]).includes(String(v));

// ── Wat het scherm van de server terugkrijgt ──

export type Rij = {
  slug: string;
  naam: string;
  golf: Golf;
  status: "wacht" | "bezig" | "klaar" | "mislukt" | "afgebroken";
  error: string;
  gestart: string | null;
  bijgewerkt: string | null;
};

export type BulkStand = {
  actief: boolean;
  rijen: Rij[];
  tegoed: { over: number | null; limiet: number | null; bodem: number };
  gestopt: string; // gevuld als de rij zichzelf heeft stilgezet
};

export type Raming = {
  golf: Golf;
  klanten: { slug: string; naam: string; nodig: boolean; mist: string[]; beheerdDoorAnder: boolean }[];
  aantal: number;
  units: number;
  dollar: number;
  over: number | null;
  past: boolean;
  bodem: number;
};
