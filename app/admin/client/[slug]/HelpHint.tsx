"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// "?"-bolletje met een nette uitleg-popover (hover of focus): UITLEG-label,
// optionele titel, alinea's en bullets, in de Pingwin-huisstijl. De popover wordt
// via een portal op document.body gerenderd met een vaste positie, zodat hij nooit
// wordt afgeknipt door kaarten met overflow of lagere z-index.
export default function HelpHint({ text, title, wide }: { text: string; title?: string; wide?: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const width = wide ? 400 : 320;

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - width - 8));
    // Onder het bolletje; past hij daar niet meer, dan erboven.
    const below = r.bottom + 8;
    const estH = 220;
    const top = below + estH > window.innerHeight && r.top - estH - 8 > 0 ? Math.max(8, r.top - estH - 8) : below;
    setPos({ left, top });
  }
  const hide = () => setPos(null);

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
    <span className="help-hint" tabIndex={0} aria-label={text} ref={ref}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onClick={(e) => { e.stopPropagation(); if (pos) hide(); else show(); }}>
      <span className="help-hint-q">?</span>
      {pos && typeof document !== "undefined" && createPortal(
        <span className="help-hint-bubble hh-fixed" style={{ left: pos.left, top: pos.top, width }}>
          <span className="hh-label"><span className="hh-label-dot">?</span> Uitleg</span>
          {title && <span className="hh-title">{title}</span>}
          {blocks.map((b, i) => (
            b.type === "p"
              ? <span className="hh-p" key={i}>{b.items[0]}</span>
              : <span className="hh-ul" key={i}>{b.items.map((it, j) => <span className="hh-li" key={j}><span className="hh-li-dot" />{it}</span>)}</span>
          ))}
        </span>,
        document.body,
      )}
    </span>
  );
}
