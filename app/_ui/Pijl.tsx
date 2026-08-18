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

/** Een driehoekje omlaag: hier zit iets onder. */
export function Omlaag({ className }: { className?: string }) {
  return <Teken className={className} vulling><path d="M4 6.5h8L8 11z" /></Teken>;
}

/** Een driehoekje naar rechts: klap dit open. */
export function Uitklap({ className }: { className?: string }) {
  return <Teken className={className} vulling><path d="M6 4l5 4-5 4z" /></Teken>;
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
