"use client";

// "?"-bolletje met een nette uitleg-popover (verschijnt bij hover of focus):
// UITLEG-label, optionele titel, alinea's en bullets, in de Pingwin-huisstijl.
// Regels in `text` die met "- " beginnen worden automatisch nette bullets.
export default function HelpHint({ text, title, wide }: { text: string; title?: string; wide?: boolean }) {
  const blocks: { type: "p" | "ul"; items: string[] }[] = [];
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.items.push(line.slice(2));
      else blocks.push({ type: "ul", items: [line.slice(2)] });
    } else {
      blocks.push({ type: "p", items: [line] });
    }
  }
  return (
    <span className="help-hint" tabIndex={0} aria-label={text} onClick={(e) => e.stopPropagation()}>
      <span className="help-hint-q">?</span>
      <span className={"help-hint-bubble" + (wide ? " wide" : "")}>
        <span className="hh-label"><span className="hh-label-dot">?</span> Uitleg</span>
        {title && <span className="hh-title">{title}</span>}
        {blocks.map((b, i) => (
          b.type === "p"
            ? <span className="hh-p" key={i}>{b.items[0]}</span>
            : <span className="hh-ul" key={i}>{b.items.map((it, j) => <span className="hh-li" key={j}><span className="hh-li-dot" />{it}</span>)}</span>
        ))}
      </span>
    </span>
  );
}
