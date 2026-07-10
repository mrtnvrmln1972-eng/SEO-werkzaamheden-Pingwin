"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// "?"-bolletje met uitleg. Klik opent een gecentreerde popup midden in beeld
// (rustig leesbaar, nette opmaak), sluiten via het kruisje, een klik buiten de
// popup of Escape. De props wide/xl blijven bestaan voor bestaande aanroepen
// maar sturen alleen nog de maximale breedte van de popup.
export default function HelpHint({ text, title, wide, xl }: { text: string; title?: string; wide?: boolean; xl?: boolean }) {
  const [open, setOpen] = useState(false);
  const maxWidth = xl ? 680 : wide ? 560 : 480;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Tekst → kopjes ("## "), alinea's en bullets ("- " aan het regelbegin).
  const blocks: { type: "p" | "ul" | "h"; items: string[] }[] = [];
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      blocks.push({ type: "h", items: [line.slice(3)] });
    } else if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.items.push(line.slice(2));
      else blocks.push({ type: "ul", items: [line.slice(2)] });
    } else {
      blocks.push({ type: "p", items: [line] });
    }
  }

  // Inline-opmaak: **vet** en __onderstreept__ worden echte elementen
  // (strong/u), zonder HTML-injectie.
  const rich = (s: string): React.ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.startsWith("__") && part.endsWith("__")
          ? <u key={i}>{part.slice(2, -2)}</u>
          : part,
    );

  return (
    <span className="help-hint" tabIndex={0} aria-label={title || "Uitleg"}
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}>
      <span className="help-hint-q" title="Klik voor uitleg">?</span>
      {open && typeof document !== "undefined" && createPortal(
        <div className="hh-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }} role="dialog" aria-modal="true">
          <div className="hh-modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
            <div className="hh-modal-top">
              <span className="hh-label"><span className="hh-label-dot">?</span> Uitleg</span>
              <button type="button" className="hh-modal-close" aria-label="Sluiten" onClick={() => setOpen(false)}>&times;</button>
            </div>
            {title && <div className="hh-modal-title">{title}</div>}
            <div className="hh-modal-body">
              {blocks.map((b, i) => (
                b.type === "h"
                  ? <div className="hh-h" key={i}>{rich(b.items[0])}</div>
                  : b.type === "p"
                    ? <p key={i}>{rich(b.items[0])}</p>
                    : <ul key={i}>{b.items.map((it, j) => <li key={j}>{rich(it)}</li>)}</ul>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
