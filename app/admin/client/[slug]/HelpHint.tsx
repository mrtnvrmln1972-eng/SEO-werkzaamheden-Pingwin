"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ── Aandachtstrekker: heel af en toe vraagt één vraagteken om aandacht ──
// Elke hint knippert hooguit één keer per gebruiker (browser onthoudt het),
// er knippert er nooit meer dan één tegelijk, hooguit één per 10 minuten en
// maximaal drie per dag. Klikken (of 10 seconden wachten) beëindigt het.
function hintKey(title: string | undefined, text: string): string {
  return "pw_hint_seen_" + (title || text.slice(0, 40)).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
}
function tryClaimAttract(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false; // deze hint is al gesuggereerd/gelezen
    const now = Date.now();
    const last = Number(sessionStorage.getItem("pw_hint_claim") || 0);
    if (now - last < 10 * 60 * 1000) return false; // hooguit één per 10 minuten
    const today = new Date().toISOString().slice(0, 10);
    const day = JSON.parse(localStorage.getItem("pw_hint_day") || "{}");
    if (day.d === today && (day.n || 0) >= 3) return false; // max 3 per dag
    sessionStorage.setItem("pw_hint_claim", String(now));
    localStorage.setItem("pw_hint_day", JSON.stringify({ d: today, n: day.d === today ? (day.n || 0) + 1 : 1 }));
    return true;
  } catch { return false; }
}

// "?"-bolletje met uitleg. Klik opent een gecentreerde popup midden in beeld
// (rustig leesbaar, nette opmaak), sluiten via het kruisje, een klik buiten de
// popup of Escape. De props wide/xl blijven bestaan voor bestaande aanroepen
// maar sturen alleen nog de maximale breedte van de popup.
export default function HelpHint({ text, title, wide, xl }: { text: string; title?: string; wide?: boolean; xl?: boolean }) {
  const [open, setOpen] = useState(false);
  const [attract, setAttract] = useState(false);
  const keyRef = useRef(hintKey(title, text));
  const maxWidth = xl ? 680 : wide ? 560 : 480;

  // Aandachtstrekker: als deze hint nog nooit gesuggereerd is en de frequentie-
  // remmen het toelaten, pulseert het bolletje 10 seconden met een tekstwolkje.
  useEffect(() => {
    const key = keyRef.current;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const startTimer = setTimeout(() => {
      if (!tryClaimAttract(key)) return;
      setAttract(true);
      stopTimer = setTimeout(() => {
        setAttract(false);
        try { localStorage.setItem(key, "1"); } catch { /* geen opslag */ }
      }, 10000);
    }, 1800);
    return () => { clearTimeout(startTimer); if (stopTimer) clearTimeout(stopTimer); };
  }, []);

  function markSeen() {
    setAttract(false);
    try { localStorage.setItem(keyRef.current, "1"); } catch { /* geen opslag */ }
  }

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
      onClick={(e) => { e.stopPropagation(); markSeen(); setOpen(true); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); markSeen(); setOpen(true); } }}>
      <span className={"help-hint-q" + (attract ? " hh-attract" : "")} title="Klik voor uitleg">?</span>
      {attract && <span className="hh-callout">Klik hier: zo werkt dit onderdeel</span>}
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
