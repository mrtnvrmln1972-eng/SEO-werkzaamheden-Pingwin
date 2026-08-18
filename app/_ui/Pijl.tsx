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
