"use client";

// Uitklapmenu in de kopbalk van de cockpit. Bundelt tabjes die bij elkaar horen
// (Klant, Site-breed) zodat de balk zes knoppen telt in plaats van elf.
//
// Twee dingen bewust zo gehouden als bij de losse tabjes:
// - elk item is een echte link, dus cmd/ctrl/middel-klik opent nog een tabblad;
// - de tab-waarden in de URL blijven ongewijzigd, dus oude bookmarks komen goed uit.
//
// Het menu sluit via Escape, een klik buiten het menu, of een keuze. Het klapt
// nooit dicht bij het slepen van de muis erlangs (vaste huisregel).

import { useEffect, useRef, useState } from "react";

export type MenuItem<T extends string> = {
  id: T;
  label: string;
  /** Eén regel die uitlegt wat het scherm doet. Staat onder het label in het menu. */
  hint?: string;
};

export default function HeaderMenu<T extends string>({
  label,
  items,
  active,
  hrefFor,
  onPick,
}: {
  label: string;
  items: MenuItem<T>[];
  /** De tab die nu open staat (kan ook buiten dit menu vallen). */
  active: T;
  hrefFor: (id: T) => string;
  onPick: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Staat er een van mijn items open, dan licht de knop zelf op. Zo zie je aan de
  // balk nog steeds waar je bent, ook als het menu dicht is.
  const bevat = items.some((it) => it.id === active);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="hm-wrap" ref={wrapRef}>
      <button
        type="button"
        className={"tab hm-knop" + (bevat ? " active" : "") + (open ? " hm-open" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg className="hm-pijl" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="hm-paneel" role="menu" aria-label={label}>
          {items.map((it) => (
            <a
              key={it.id}
              role="menuitem"
              href={hrefFor(it.id)}
              className={"hm-item" + (it.id === active ? " hm-item-actief" : "")}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();
                setOpen(false);
                onPick(it.id);
              }}
            >
              <span className="hm-item-label">{it.label}</span>
              {it.hint && <span className="hm-item-hint">{it.hint}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
