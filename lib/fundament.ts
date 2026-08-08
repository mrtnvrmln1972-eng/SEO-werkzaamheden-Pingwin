// ═══════════════════════════════════════════════════════════
// FUNDAMENT PER KLANT: TONE OF VOICE, STRUCTURED DATA, CONCURRENTEN,
// BEDRIJFSPROFIEL EN POSITIONERING
// ═══════════════════════════════════════════════════════════
// Maarten wilde per klant kunnen zien wat er al staat en wat nog moet: tone of
// voice, structured data, concurrenten, concurrentieanalyse, bedrijfsprofiel en
// positioneringsadvies. Bij het uitzoeken bleek concurrentieanalyse geen eigen
// document: de positionering-skill benchmarkt altijd al tegen de concurrenten.
// Een los veld ervoor zou vragen om iets dat nooit los bestaat, dus die status
// wordt hieronder afgeleid van het positioneringsadvies in plaats van apart
// bijgehouden.
//
// Pure functie, geen database: zo gebruiken zowel het klantenoverzicht
// (/admin/fundament, server-kant, haalt de brondata zelf op) als het
// cockpit-paneel (FundamentPanel.tsx, in de browser, fetcht zijn eigen
// org-data en concurrentenlijst) dezelfde regels. Eén plek bepaalt wat "klaar"
// betekent; die twee schermen kunnen dus nooit een ander verhaal vertellen.
// ═══════════════════════════════════════════════════════════

export type FundamentPunt = "klaar" | "vergrendeld" | "bezig" | "nietbegonnen";

export type FundamentStatus = {
  toneOfVoice: FundamentPunt;
  bedrijfsprofiel: FundamentPunt;
  structuredData: FundamentPunt;
  concurrenten: FundamentPunt;
  concurrentenAantal: number;
  /** Afgeleid van positionering: er bestaat geen los document. */
  concurrentieanalyse: FundamentPunt;
  positionering: FundamentPunt;
};

export type FundamentInput = {
  seoProfile: string | null;
  /** Bedrijfsnaam (of meer) ingevuld in de structured-data-basis. */
  orgFilled: boolean;
  orgLocked: boolean;
  competitorCount: number;
  positioneringUrl: string | null;
};

// Het klantprofiel wordt automatisch gegenereerd met deze twee vaste koppen
// (zie lib/client-profile-gen.ts, action "profile" en "tov"); zo lees je uit
// één tekstveld of het klantprofiel-deel en het tone-of-voice-deel er allebei
// echt staan, en niet alleen een lege kop.
function heeftSectie(tekst: string, kop: RegExp): boolean {
  const m = tekst.match(kop);
  if (!m || m.index === undefined) return false;
  const rest = tekst.slice(m.index + m[0].length, m.index + m[0].length + 4000);
  const volgendeKop = rest.search(/\n##\s/);
  const inhoud = (volgendeKop === -1 ? rest : rest.slice(0, volgendeKop)).trim();
  return inhoud.length > 40;
}

export function berekenFundament(input: FundamentInput): FundamentStatus {
  const profiel = (input.seoProfile || "").trim();
  const toneOfVoice: FundamentPunt = heeftSectie(profiel, /##\s*Tone of voice/i) ? "klaar" : "nietbegonnen";
  const bedrijfsprofiel: FundamentPunt = heeftSectie(profiel, /##\s*Klantprofiel/i) ? "klaar" : "nietbegonnen";
  const structuredData: FundamentPunt = input.orgLocked ? "vergrendeld" : input.orgFilled ? "bezig" : "nietbegonnen";
  const concurrenten: FundamentPunt = input.competitorCount > 0 ? "klaar" : "nietbegonnen";
  const positionering: FundamentPunt = input.positioneringUrl ? "klaar" : "nietbegonnen";
  // "bezig" in plaats van "klaar" zodra de positionering er is: de concurrentie
  // is dan wel meegenomen, maar er is geen eigen, apart afgerond document.
  const concurrentieanalyse: FundamentPunt = positionering === "klaar" ? "bezig" : "nietbegonnen";
  return {
    toneOfVoice, bedrijfsprofiel, structuredData,
    concurrenten, concurrentenAantal: input.competitorCount,
    concurrentieanalyse, positionering,
  };
}

export const PUNT_LABEL: Record<FundamentPunt, string> = {
  klaar: "Klaar",
  vergrendeld: "Vergrendeld",
  bezig: "Bezig",
  nietbegonnen: "Nog niet",
};

/** De zes kolommen op volgorde, zoals ze overal getoond worden. */
export const FUNDAMENT_KOLOMMEN: { key: keyof Omit<FundamentStatus, "concurrentenAantal">; label: string; hint: string }[] = [
  { key: "toneOfVoice", label: "Tone of voice", hint: "Schrijfstijl-sectie in het klantprofiel" },
  { key: "bedrijfsprofiel", label: "Bedrijfsprofiel", hint: "Klantprofiel-sectie: positionering, doelgroep, expertise" },
  { key: "structuredData", label: "Structured data", hint: "Bedrijfsgegevens voor de schema-generatie per pagina" },
  { key: "concurrenten", label: "Concurrenten", hint: "2 tot 4 domeinen voor de gap-analyse" },
  { key: "concurrentieanalyse", label: "Concurrentieanalyse", hint: "Geen los document: zit in het positioneringsadvies" },
  { key: "positionering", label: "Positionering", hint: "Afgerond positioneringsadvies (Drive-document)" },
];

/** Hoeveel van de zes punten niet meer "nietbegonnen" zijn, voor een compact getal. */
export function fundamentVoortgang(s: FundamentStatus): { af: number; totaal: number } {
  const punten: FundamentPunt[] = [
    s.toneOfVoice, s.bedrijfsprofiel, s.structuredData, s.concurrenten, s.concurrentieanalyse, s.positionering,
  ];
  return { af: punten.filter((p) => p !== "nietbegonnen").length, totaal: punten.length };
}
