"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Gedeelde pop-up-schil die op een x/y-locatie verschijnt (bij een blok of een
// gesleepte plek in het rooster), zichzelf binnen het scherm houdt, en sluit
// bij een klik ernaast of Escape. Bevat zelf geen velden; de aanroeper vult
// hem met zijn eigen inhoud (vergelijkbaar met het portal-patroon elders in
// deze cockpit, maar hier positie-gestuurd in plaats van slot-gestuurd).
export default function AgendaPopup({
  x, y, onClose, onEnter, children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  /** Enter in een gewoon invulveld slaat op; niet in een meerregelig tekstvak (daar is Enter een nieuwe regel). */
  onEnter?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const openedAtRef = useRef(0);

  useLayoutEffect(() => {
    openedAtRef.current = Date.now();
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(margin, Math.min(x, window.innerWidth - margin - w));
    const top = Math.max(margin, Math.min(y, window.innerHeight - margin - h));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (Date.now() - openedAtRef.current < 200) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`ag-popup${pos ? "" : " ag-popup-meten"}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || !onEnter) return;
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        onEnter();
      }}
    >
      {children}
    </div>
  );
}
