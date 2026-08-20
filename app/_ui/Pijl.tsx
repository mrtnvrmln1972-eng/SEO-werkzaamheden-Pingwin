// Een pijltje dat altijd een pijltje is.
//
// WAAROM DIT GEEN TEKEN IS
// ════════════════════════
// Overal stond `&larr;` voor de terug-link. Dat is een letter uit het lettertype,
// en Montserrat heeft hem niet. De browser valt dan terug op een ander lettertype
// (dus staat het pijltje er in een andere letter bij dan de tekst ernaast) of hij
// tekent een leeg vierkantje. Beide zijn op 18-08-2026 in beeld aangetroffen.
//
// Een getekend pijltje heeft dat probleem niet: het erft de kleur van de tekst
// (currentColor), schaalt mee met de lettergrootte (em), en ziet er op elk
// apparaat hetzelfde uit, ook op een server zonder symbolenlettertypes.
//
// Gebruik hetzelfde patroon voor elk ander teken dat als icoon dienstdoet. Een
// vinkje, een kruisje of een driehoekje is geen letter.

export function PijlLinks({ className }: { className?: string }) {
  return <Pijl className={className} draai={180} />;
}

export function PijlRechts({ className }: { className?: string }) {
  return <Pijl className={className} draai={0} />;
}

function Pijl({ className, draai }: { className?: string; draai: number }) {
  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      // Het pijltje staat op de regel zoals een letter dat doet: een SVG hangt
      // standaard op de onderlijn en steekt dan onder de tekst uit.
      style={{ verticalAlign: "-0.125em", transform: draai ? `rotate(${draai}deg)` : undefined }}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/** Naar buiten: een link die ergens anders opent. */
export function PijlSchuin({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M6 10L10.5 5.5M10.5 5.5H7M10.5 5.5V9" />
      <path d="M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" />
    </Teken>
  );
}

/** Los zetten: dit venster groot en centraal openen. */
export function LosVenster({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
    </Teken>
  );
}

/** Een vinkje: dit is gedaan. */
export function Vink({ className }: { className?: string }) {
  return <Teken className={className}><path d="M3.5 8.5l3 3 6-7" /></Teken>;
}

/** Een kruisje: sluiten, of iets wegzetten. Getekend, want een letterlijke ✕
    zit niet in Montserrat en wordt dan een leeg vlakje of helemaal niets. */
export function Kruis({ className }: { className?: string }) {
  return <Teken className={className}><path d="M4 4l8 8M12 4l-8 8" /></Teken>;
}

/** Een driehoekje omlaag: hier zit iets onder. */
export function Omlaag({ className }: { className?: string }) {
  return <Teken className={className} vulling><path d="M4 6.5h8L8 11z" /></Teken>;
}

/** Een driehoekje naar rechts: klap dit open. */
export function Uitklap({ className }: { className?: string }) {
  return <Teken className={className} vulling><path d="M6 4l5 4-5 4z" /></Teken>;
}

/** Een vlaggetje: iets dat nog geen klant is, maar wel in beeld. */
export function Vlag({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M4 14V2.6M4 3.2h8l-1.6 2.6L12 8.4H4" />
    </Teken>
  );
}

/** Twee figuurtjes: mensen, een klantenlijst. */
export function Mensen({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <circle cx="6.2" cy="5.4" r="2.4" />
      <path d="M1.8 13.4c0-2.4 2-4 4.4-4s4.4 1.6 4.4 4" />
      <path d="M11 3.4a2.4 2.4 0 0 1 0 4.6M12.2 9.8c1.3.5 2.2 1.7 2.2 3.6" />
    </Teken>
  );
}

/** Een gebouw: een organisatie of een groep klanten. */
export function Gebouw({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M2.6 13.6V4.2L8 2.2l5.4 2v9.4M1.6 13.6h12.8" />
      <path d="M5.4 13.6v-3h5.2v3M5.6 6.6h1.2M9.2 6.6h1.2M5.6 8.8h1.2M9.2 8.8h1.2" />
    </Teken>
  );
}

/** Een lijstje met vinkjes: een rij die afgewerkt wordt. */
export function Lijstje({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M2.4 4.4l1.4 1.4 2.2-2.4M2.4 11.4l1.4 1.4 2.2-2.4" />
      <path d="M8.4 4.6h5.2M8.4 11.6h5.2" />
    </Teken>
  );
}

/** Een muntje: geld, waarde per klant. */
export function Munt({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M10 5.8a2.6 2.6 0 1 0 0 4.4" />
    </Teken>
  );
}

/** Een oog: meekijken. */
export function Oog({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M1.4 8S3.8 3.8 8 3.8 14.6 8 14.6 8 12.2 12.2 8 12.2 1.4 8 1.4 8Z" />
      <circle cx="8" cy="8" r="1.9" />
    </Teken>
  );
}

/** Twee schakels: een link. */
export function Ketting({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.1-2.1a2.6 2.6 0 0 0-3.7-3.7l-.9.9" />
      <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.6 8.7a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
    </Teken>
  );
}

/** Drie stipjes onder elkaar: hier zit een menu achter. */
export function Kebab({ className }: { className?: string }) {
  return (
    <Teken className={className} vulling>
      <circle cx="8" cy="3.5" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="8" cy="12.5" r="1.3" />
    </Teken>
  );
}

/** Een rondje met een pijlpunt: opnieuw ophalen. */
export function Ververs({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13.2 2.2v2.9h-2.9" />
    </Teken>
  );
}

/** Een gesloten slot: dit ligt vast. */
export function Slot({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <rect x="3.2" y="7" width="9.6" height="6.5" rx="1.4" />
      <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
    </Teken>
  );
}

/** Een blad papier: een document of een bestand. */
export function Blad({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M4 2.2h5l3 3v8.6H4z" /><path d="M9 2.2v3h3" />
    </Teken>
  );
}

/** Een lijstje met een bergje: een afbeelding. */
export function Beeld({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <rect x="2.5" y="3.2" width="11" height="9.6" rx="1.4" />
      <path d="M2.9 11l3.1-3.2 2.2 2.2 2-2 2.9 3" />
    </Teken>
  );
}

/** Een blaadje met dagen: een datum. */
export function Kalender({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <rect x="2.6" y="3.4" width="10.8" height="10" rx="1.4" />
      <path d="M2.6 6.4h10.8M5.6 2.2v2.2M10.4 2.2v2.2" />
    </Teken>
  );
}

/** Een belletje: een herinnering. */
export function Bel({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M4.2 11.2V7.4a3.8 3.8 0 0 1 7.6 0v3.8z" />
      <path d="M3 11.2h10M6.9 13.2h2.2" />
    </Teken>
  );
}

/** Twee pijlen in een rondje: dit komt terug. */
export function Herhaal({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M3.2 6.6A4.6 4.6 0 0 1 12.6 6M12.8 9.4A4.6 4.6 0 0 1 3.4 10" />
      <path d="M11 5.9h1.9V4M5 10.1H3.1V12" />
    </Teken>
  );
}

/** Een driehoekje op zijn kant: het verschil met de vorige periode. */
export function Verschil({ className }: { className?: string }) {
  return <Teken className={className}><path d="M8 3.4 13.2 12.6H2.8z" /></Teken>;
}

/** Twee pijlpunten uit elkaar: maak dit venster groter. */
export function Groter({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M9.4 2.6h4v4M13.4 2.6 9.2 6.8M6.6 13.4h-4v-4M2.6 13.4l4.2-4.2" />
    </Teken>
  );
}

/** Twee pijlpunten naar elkaar toe: maak dit venster kleiner. */
export function Kleiner({ className }: { className?: string }) {
  return (
    <Teken className={className}>
      <path d="M13 3 9.2 6.8M9.2 6.8h3.4M9.2 6.8V3.4M3 13l3.8-3.8M6.8 9.2H3.4M6.8 9.2v3.4" />
    </Teken>
  );
}

/**
 * De gedeelde vorm onder elk teken hierboven.
 *
 * Eén plek voor de maat, de uitlijning op de regel en het meelopen met de
 * tekstkleur. Zonder dat staat het ene icoon een pixel hoger dan het andere en
 * dat zie je pas als ze naast elkaar staan.
 */
function Teken({ className, children, vulling }: { className?: string; children: React.ReactNode; vulling?: boolean }) {
  return (
    <svg
      className={className} width="1em" height="1em" viewBox="0 0 16 16"
      fill={vulling ? "currentColor" : "none"} stroke={vulling ? "none" : "currentColor"}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={{ verticalAlign: "-0.125em" }}
    >
      {children}
    </svg>
  );
}
