"use client";

// Klein "?"-bolletje met een korte uitleg die verschijnt bij hover of focus.
// Herbruikbaar naast kopjes en kolomkoppen in het hele dashboard.
export default function HelpHint({ text, wide }: { text: string; wide?: boolean }) {
  return (
    <span className="help-hint" tabIndex={0} aria-label={text}>
      <span className="help-hint-q">?</span>
      <span className={"help-hint-bubble" + (wide ? " wide" : "")}>{text}</span>
    </span>
  );
}
